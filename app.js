/* Simulateur de championnat - entièrement côté client, sans compilation */
(function(){
  const STORAGE_KEY_PREFIX = 'foot8_state_';
  let currentCompetition = null;
  let STORAGE_KEY = null;
  let competitionType = null; // 'league' ou 'euro'

  // Utiliser la configuration importée
  let TEAMS = [];
  let COMPETITIONS_REF = ALL_COMPETITIONS || COMPETITIONS;

  // shuffle array (Fisher-Yates)
  function shuffle(arr){
    const a = [...arr];
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // generate round-robin (single round, n-1 rounds)
  function generateRoundRobin(teams){
    // Mélanger les équipes pour un calendrier différent à chaque tirage
    const shuffledTeams = shuffle(teams);
    const n = shuffledTeams.length;
    if(n % 2 !== 0) shuffledTeams = shuffledTeams.concat({id: '__bye', name:'Bye'});
    const players = shuffledTeams.map(t=>t.id);
    const rounds = [];
    const numRounds = players.length - 1;
    for(let r=0;r<numRounds;r++){
      const pairings = [];
      for(let i=0;i<players.length/2;i++){
        const a = players[i];
        const b = players[players.length-1-i];
        if(a !== '__bye' && b !== '__bye') pairings.push({home:a,away:b});
      }
      rounds.push(pairings);
      // rotate
      players.splice(1,0,players.pop());
    }
    return rounds;
  }

  // Assurer une vraie alternance domicile/extérieur pour chaque équipe
  function assignAlternating(rounds){
    const teamStatus = {}; // Suivi du dernier rôle (home/away) pour chaque équipe

    rounds.forEach((pairings, dayIdx) => {
      pairings.forEach(p => {
        const h = p.home;
        const a = p.away;

        // Vérifier si l'équipe home a joué home le jour précédent
        const hPlayedHomeLast = teamStatus[h] === 'home';
        const aPlayedHomeLast = teamStatus[a] === 'home';

        // Si home a joué home le jour précédent, inverser le match
        if (hPlayedHomeLast && !aPlayedHomeLast) {
          p.home = a;
          p.away = h;
        }

        // Mettre à jour le statut des équipes
        teamStatus[p.home] = 'home';
        teamStatus[p.away] = 'away';
      });
    });

    return rounds;
  }

  function buildMatchesFromRounds(rounds){
    const matches = [];
    let id = 1;
    rounds.forEach((pairs, idx)=>{
      const day = idx+1;
      pairs.forEach(p=>{
        matches.push({id:id++, day, homeId:p.home, awayId:p.away, homeGoals:null, awayGoals:null});
      });
    });
    return matches;
  }

  // state
  let state = {teams: [], matches: [], updated: Date.now()};

  function saveState(){
    if(STORAGE_KEY) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  function loadState(){
    // Réinitialiser l'état avec les équipes courantes
    state = {teams: TEAMS, matches: [], updated: Date.now()};

    const raw = STORAGE_KEY ? localStorage.getItem(STORAGE_KEY) : null;
    if(raw){
      try{ state = JSON.parse(raw); }
      catch(e){ console.warn('Invalid state in storage, resetting'); }
    } else {
      // build
      const rounds = generateRoundRobin(TEAMS);
      assignAlternating(rounds);
      state.matches = buildMatchesFromRounds(rounds);
      state.teams = TEAMS;
      saveState();
    }
  }

  function loadStateEuro(){
    // Réinitialiser l'état avec les équipes courantes
    state = {teams: TEAMS, matches: [], groups: {}, stage: 'group', knockout: {}, updated: Date.now()};

    const raw = STORAGE_KEY ? localStorage.getItem(STORAGE_KEY) : null;
    if(raw){
      try{ state = JSON.parse(raw); }
      catch(e){ console.warn('Invalid state in storage, resetting'); }
    } else {
      // Générer le calendrier des groupes
      const comp = COMPETITIONS_REF[currentCompetition];
      const groups = comp.groups; // ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

      let matchId = 1;
      groups.forEach(groupLetter => {
        // Récupérer les 4 équipes du groupe
        const groupTeams = TEAMS.filter(t => t.group === groupLetter);

        // Générer le round-robin pour ce groupe (6 matches = 3 journées)
        const rounds = generateRoundRobin(groupTeams);
        assignAlternating(rounds);

        // Construire les matches pour ce groupe
        const groupMatches = [];
        rounds.forEach((pairs, idx) => {
          const day = idx + 1;
          pairs.forEach(p => {
            groupMatches.push({
              id: matchId++,
              day,
              group: groupLetter,
              homeId: p.home,
              awayId: p.away,
              homeGoals: null,
              awayGoals: null
            });
          });
        });

        state.groups[groupLetter] = { teams: groupTeams, matches: groupMatches, qualified: [] };
      });

      // Fusionner tous les matches dans le tableau principal
      Object.values(state.groups).forEach(group => {
        state.matches.push(...group.matches);
      });

      saveState();
    }
  }

  // standings computation
  function computeStandings(){
    const table = {};
    state.teams.forEach(t=>{ table[t.id] = {id:t.id,name:t.name,pts:0,played:0,w:0,d:0,l:0,gf:0,ga:0}; });
    state.matches.forEach(m=>{
      if(m.homeGoals == null || m.awayGoals == null) return;
      const h = table[m.homeId], a = table[m.awayId];
      h.played++; a.played++;
      h.gf += m.homeGoals; h.ga += m.awayGoals;
      a.gf += m.awayGoals; a.ga += m.homeGoals;
      if(m.homeGoals > m.awayGoals){ h.w++; a.l++; h.pts += 3; }
      else if(m.homeGoals < m.awayGoals){ a.w++; h.l++; a.pts += 3; }
      else { h.d++; a.d++; h.pts += 1; a.pts += 1; }
    });
    const arr = Object.values(table);
    arr.sort((x,y)=>{
      if(y.pts !== x.pts) return y.pts - x.pts;
      const gdY = y.gf - y.ga, gdX = x.gf - x.ga;
      if(gdY !== gdX) return gdY - gdX;
      if(y.gf !== x.gf) return y.gf - x.gf;
      return x.name.localeCompare(y.name);
    });
    return arr.map((t,i)=>({...t,pos:i+1,diff:t.gf - t.ga}));
  }

  // rendering - lazy load des références DOM
  function getRoundsContainer(){ return document.getElementById('rounds'); }
  function getStandingsTbody(){ return document.querySelector('#table-standings tbody'); }
  function getMatchTemplate(){ return document.getElementById('match-row-template'); }

  function findTeam(id){ return state.teams.find(t=>t.id===id) || {id,name:'?'}; }

  function render(){
    renderRounds();
    renderStandings();
  }

  function renderRounds(){
    const roundsContainer = getRoundsContainer();
    roundsContainer.innerHTML = '';
    const matchTemplate = getMatchTemplate();

    if(competitionType === 'euro'){
      // Pour l'Euro
      const comp = COMPETITIONS_REF[currentCompetition];

      if(state.stage === 'group'){
        // Afficher par groupe
        const groups = comp.groups;

        groups.forEach(groupLetter => {
          const groupSection = document.createElement('div');
          groupSection.className = 'group-section';

          const groupTitle = document.createElement('h2');
          groupTitle.textContent = `Groupe ${groupLetter}`;
          groupSection.appendChild(groupTitle);

          // Afficher les matches du groupe groupés par journée
          const groupMatches = state.matches.filter(m => m.group === groupLetter);
          const grouped = {};
          groupMatches.forEach(m => { (grouped[m.day] = grouped[m.day]||[]).push(m); });

          Object.keys(grouped).sort((a,b)=>a-b).forEach(dayKey => {
            const day = parseInt(dayKey);
            const div = document.createElement('div');
            div.className='round';
            const h = document.createElement('h3');
            h.textContent = `Journée ${day}`;
            const simAllBtn = document.createElement('button');
            simAllBtn.className = 'btn-round-sim';
            simAllBtn.textContent = '▶';
            simAllBtn.setAttribute('aria-label', `Simuler la journée ${day}`);
            simAllBtn.setAttribute('title', `Simuler la journée ${day}`);
            simAllBtn.addEventListener('click',()=>{ simulateDay(day); });
            simAllBtn.tabIndex = -1;
            h.appendChild(simAllBtn);
            div.appendChild(h);

            grouped[dayKey].forEach(m => {
              const node = matchTemplate.content.cloneNode(true);
              const row = node.querySelector('.match-row');
              const homeName = findTeam(m.homeId).name;
              const awayName = findTeam(m.awayId).name;
              row.querySelector('.team.home .name').textContent = homeName;
              row.querySelector('.team.away .name').textContent = awayName;
              row.querySelector('.team.home .kit').className = 'kit team-'+m.homeId.replace(/\s+/g,'');
              row.querySelector('.team.away .kit').className = 'kit team-'+m.awayId.replace(/\s+/g,'');
              const inputH = row.querySelector('.home-goals');
              const inputA = row.querySelector('.away-goals');
              inputH.value = m.homeGoals != null ? m.homeGoals : '';
              inputA.value = m.awayGoals != null ? m.awayGoals : '';
              inputH.addEventListener('change',()=>{ setScore(m.id, parseInt(inputH.value), parseInt(inputA.value)); });
              inputA.addEventListener('change',()=>{ setScore(m.id, parseInt(inputH.value), parseInt(inputA.value)); });
              const simBtn = row.querySelector('.btn-sim');
              simBtn.addEventListener('click',()=>{ simulateMatch(m.id); });
              simBtn.tabIndex = -1;
              div.appendChild(row);
            });
            groupSection.appendChild(div);
          });

          roundsContainer.appendChild(groupSection);
        });

        // Ajouter un bouton pour lancer le knockout
        const knockoutBtn = document.createElement('button');
        knockoutBtn.className = 'btn-knockout-start';
        knockoutBtn.textContent = 'Lancer la phase knockout →';
        knockoutBtn.addEventListener('click', () => {
          generateKnockout();
          render();
        });
        roundsContainer.appendChild(knockoutBtn);

      } else if(state.stage === 'knockout'){
        // Afficher les phases knockout
        const stages = ['1/8', '1/4', '1/2', 'Final'];
        stages.forEach(stage => {
          if(!state.knockout[stage]) return;

          const stageSection = document.createElement('div');
          stageSection.className = 'knockout-section';

          const stageTitle = document.createElement('h2');
          stageTitle.textContent = stage === 'Final' ? 'Finale' : stage + 'e de finale';
          stageSection.appendChild(stageTitle);

          const stageMatches = state.knockout[stage];
          stageMatches.forEach(m => {
            // Créer un conteneur pour le match avec possibilité de highlight
            const matchContainer = document.createElement('div');
            matchContainer.className = 'knockout-match-container';

            // Ajouter une classe si une équipe est qualifiée
            if(m.winner){
              matchContainer.classList.add('has-winner');
            }

            const node = matchTemplate.content.cloneNode(true);
            const row = node.querySelector('.match-row');

            // Ajouter des classes pour identifier l'équipe gagnante
            if(m.winner){
              if(m.winner === m.homeId){
                row.classList.add('home-winner');
              } else {
                row.classList.add('away-winner');
              }
            }

            const homeName = findTeam(m.homeId).name;
            const awayName = findTeam(m.awayId).name;
            row.querySelector('.team.home .name').textContent = homeName;
            row.querySelector('.team.away .name').textContent = awayName;
            row.querySelector('.team.home .kit').className = 'kit team-'+m.homeId.replace(/\s+/g,'');
            row.querySelector('.team.away .kit').className = 'kit team-'+m.awayId.replace(/\s+/g,'');
            const inputH = row.querySelector('.home-goals');
            const inputA = row.querySelector('.away-goals');
            inputH.value = m.homeGoals != null ? m.homeGoals : '';
            inputA.value = m.awayGoals != null ? m.awayGoals : '';
            inputH.addEventListener('change',()=>{ setScore(m.id, parseInt(inputH.value), parseInt(inputA.value)); });
            inputA.addEventListener('change',()=>{ setScore(m.id, parseInt(inputH.value), parseInt(inputA.value)); });
            const simBtn = row.querySelector('.btn-sim');
            simBtn.addEventListener('click',()=>{ simulateMatch(m.id); });
            simBtn.tabIndex = -1;

            matchContainer.appendChild(row);
            stageSection.appendChild(matchContainer);

            // Ajouter un badge "Qualifié(e)" si une équipe a gagné
            if(m.winner){
              const badge = document.createElement('div');
              badge.className = 'qualified-badge';
              const winner = findTeam(m.winner);
              badge.textContent = '✓ ' + winner.name + ' qualifié(e)';
              matchContainer.appendChild(badge);
            }
          });

          roundsContainer.appendChild(stageSection);

          // Ajouter un bouton pour avancer à l'étape suivante si tous les matches sont joués
          const nextStageMap = { '1/8': '1/4', '1/4': '1/2', '1/2': 'Final' };
          const nextStage = nextStageMap[stage];

          if(nextStage && stageMatches.every(m => m.homeGoals != null && m.awayGoals != null)){
            const advanceBtn = document.createElement('button');
            advanceBtn.className = 'btn-advance-stage';
            advanceBtn.textContent = `Générer les ${nextStage === 'Final' ? 'finales' : nextStage + 'e de finale'} →`;
            advanceBtn.addEventListener('click', () => {
              advanceKnockoutStage(stage);
              render();
            });
            roundsContainer.appendChild(advanceBtn);
          }
        });
      }
    } else {
      // Pour les championnats réguliers, affichage par journée
      const grouped = groupMatchesByDay();
      const grid = document.createElement('div'); grid.className = 'rounds-grid';
      grouped.forEach(group=>{
        const div = document.createElement('div'); div.className='round';
        const h = document.createElement('h3'); h.textContent = `Journée ${group.day}`;
        const simAllBtn = document.createElement('button'); simAllBtn.className = 'btn-round-sim'; simAllBtn.textContent = '▶';
        simAllBtn.setAttribute('aria-label', `Simuler la journée ${group.day}`);
        simAllBtn.setAttribute('title', `Simuler la journée ${group.day}`);
        simAllBtn.addEventListener('click',()=>{ simulateDay(group.day); });
        simAllBtn.tabIndex = -1;
        h.appendChild(simAllBtn);
        div.appendChild(h);
        group.matches.forEach(m=>{
          const node = matchTemplate.content.cloneNode(true);
          const row = node.querySelector('.match-row');
          const homeName = findTeam(m.homeId).name;
          const awayName = findTeam(m.awayId).name;
          row.querySelector('.team.home .name').textContent = homeName;
          row.querySelector('.team.away .name').textContent = awayName;
          row.querySelector('.team.home .kit').className = 'kit team-'+m.homeId.replace(/\s+/g,'');
          row.querySelector('.team.away .kit').className = 'kit team-'+m.awayId.replace(/\s+/g,'');
          const inputH = row.querySelector('.home-goals');
          const inputA = row.querySelector('.away-goals');
          inputH.value = m.homeGoals != null ? m.homeGoals : '';
          inputA.value = m.awayGoals != null ? m.awayGoals : '';
          inputH.addEventListener('change',()=>{ setScore(m.id, parseInt(inputH.value), parseInt(inputA.value)); });
          inputA.addEventListener('change',()=>{ setScore(m.id, parseInt(inputH.value), parseInt(inputA.value)); });
          const simBtn = row.querySelector('.btn-sim');
          simBtn.addEventListener('click',()=>{ simulateMatch(m.id); });
          simBtn.tabIndex = -1;
          div.appendChild(row);
        });
        grid.appendChild(div);
      });
      roundsContainer.appendChild(grid);
    }
  }

  function groupMatchesByDay(){
    const map = {};
    state.matches.forEach(m=>{ (map[m.day] = map[m.day]||[]).push(m); });
    return Object.keys(map).sort((a,b)=>a-b).map(k=>({day:parseInt(k),matches:map[k]}));
  }

  function renderStandings(){
    const standingsTbody = getStandingsTbody();
    standingsTbody.innerHTML = '';

    if(competitionType === 'euro'){
      // Pour l'Euro, afficher le classement par groupe
      const comp = COMPETITIONS_REF[currentCompetition];
      const groups = comp.groups;

      groups.forEach(groupLetter => {
        // Calculer le classement pour ce groupe
        const groupTeams = state.teams.filter(t => t.group === groupLetter);
        const groupMatches = state.matches.filter(m => m.group === groupLetter);

        const table = {};
        groupTeams.forEach(t => {
          table[t.id] = {id:t.id,name:t.name,pts:0,played:0,w:0,d:0,l:0,gf:0,ga:0};
        });

        groupMatches.forEach(m => {
          if(m.homeGoals == null || m.awayGoals == null) return;
          const h = table[m.homeId], a = table[m.awayId];
          h.played++; a.played++;
          h.gf += m.homeGoals; h.ga += m.awayGoals;
          a.gf += m.awayGoals; a.ga += m.homeGoals;
          if(m.homeGoals > m.awayGoals){ h.w++; a.l++; h.pts += 3; }
          else if(m.homeGoals < m.awayGoals){ a.w++; h.l++; a.pts += 3; }
          else { h.d++; a.d++; h.pts += 1; a.pts += 1; }
        });

        const arr = Object.values(table);
        arr.sort((x,y)=>{
          if(y.pts !== x.pts) return y.pts - x.pts;
          const gdY = y.gf - y.ga, gdX = x.gf - x.ga;
          if(gdY !== gdX) return gdY - gdX;
          if(y.gf !== x.gf) return y.gf - x.gf;
          return x.name.localeCompare(y.name);
        });

        // Ajouter les lignes du groupe
        const groupHeaderTr = document.createElement('tr');
        const groupHeaderTd = document.createElement('td');
        groupHeaderTd.colSpan = 4;
        groupHeaderTd.style.cssText = 'font-weight:bold;font-size:14px;padding-top:10px;padding-bottom:5px;background:#f0f0f0;';
        groupHeaderTd.textContent = `Groupe ${groupLetter}`;
        groupHeaderTr.appendChild(groupHeaderTd);
        standingsTbody.appendChild(groupHeaderTr);

        arr.forEach((r, idx) => {
          const tr = document.createElement('tr');
          const tdPos = document.createElement('td'); tdPos.className='pos'; tdPos.textContent = (idx+1);
          const tdTeam = document.createElement('td'); tdTeam.className='team-cell';
          const kit = document.createElement('span'); kit.className = 'kit team-'+r.id.replace(/\s+/g,'');
          const name = document.createElement('span'); name.textContent = r.name;
          tdTeam.appendChild(kit); tdTeam.appendChild(name);
          const tdPts = document.createElement('td'); tdPts.textContent = r.pts;
          const tdDiff = document.createElement('td'); tdDiff.textContent = (r.gf - r.ga > 0 ? '+' : '') + (r.gf - r.ga);
          tr.appendChild(tdPos); tr.appendChild(tdTeam); tr.appendChild(tdPts); tr.appendChild(tdDiff);
          standingsTbody.appendChild(tr);
        });
      });
    } else {
      // Pour les championnats réguliers
      const rows = computeStandings();
      rows.forEach(r=>{
        const tr = document.createElement('tr');
        const tdPos = document.createElement('td'); tdPos.className='pos'; tdPos.textContent = r.pos;
        const tdTeam = document.createElement('td'); tdTeam.className='team-cell';
        const kit = document.createElement('span'); kit.className = 'kit team-'+r.id.replace(/\s+/g,'');
        const name = document.createElement('span'); name.textContent = r.name;
        tdTeam.appendChild(kit); tdTeam.appendChild(name);
        const tdPts = document.createElement('td'); tdPts.textContent = r.pts;
        const tdDiff = document.createElement('td'); tdDiff.textContent = (r.diff>0?'+':'')+r.diff;
        tr.appendChild(tdPos); tr.appendChild(tdTeam); tr.appendChild(tdPts); tr.appendChild(tdDiff);
        standingsTbody.appendChild(tr);
      });
    }
  }

  function setScore(matchId, hGoals, aGoals){
    const m = state.matches.find(x=>x.id===matchId);
    if(!m) return;
    if(Number.isFinite(hGoals) && Number.isFinite(aGoals) && hGoals>=0 && aGoals>=0){
      m.homeGoals = hGoals; m.awayGoals = aGoals;

      // Si c'est un match knockout, calculer le gagnant
      if(m.stage){
        if(hGoals > aGoals){
          m.winner = m.homeId;
        } else if(aGoals > hGoals){
          m.winner = m.awayId;
        } else {
          // Nul - choisir aléatoirement
          m.winner = Math.random() < 0.5 ? m.homeId : m.awayId;
        }
      }
    } else {
      m.homeGoals = null; m.awayGoals = null;
      m.winner = null; // Réinitialiser le gagnant si on efface le score
    }
    state.updated = Date.now(); saveState(); render();
  }

  function randomScore(){
    // Poisson-ish: favour low scores
    const p = Math.random();
    if(p < 0.6) return Math.floor(Math.random()*3); // 0-2
    if(p < 0.9) return 3 + Math.floor(Math.random()*2); //3-4
    return 5 + Math.floor(Math.random()*3);
  }

  function simulateMatch(matchId){
    const m = state.matches.find(x=>x.id===matchId);
    if(!m) return;
    m.homeGoals = randomScore();
    m.awayGoals = randomScore();

    // Si c'est un match knockout, calculer le gagnant
    if(m.stage){
      if(m.homeGoals > m.awayGoals){
        m.winner = m.homeId;
      } else if(m.awayGoals > m.homeGoals){
        m.winner = m.awayId;
      } else {
        // Nul - choisir aléatoirement
        m.winner = Math.random() < 0.5 ? m.homeId : m.awayId;
      }
    }

    state.updated = Date.now(); saveState(); render();
  }

  function simulateDay(day){
    state.matches.filter(m=>m.day===day).forEach(m=>{
      if(m.homeGoals == null || m.awayGoals == null) {
        m.homeGoals = randomScore(); m.awayGoals = randomScore();
      }
    });
    state.updated = Date.now(); saveState(); render();
  }

  function simulateAll(){
    state.matches.forEach(m=>{ if(m.homeGoals==null||m.awayGoals==null){ m.homeGoals=randomScore(); m.awayGoals=randomScore(); }});
    state.updated = Date.now(); saveState(); render();
  }

  // Navigation entre écrans
  function showScreen(screenId){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if(screen) screen.classList.add('active');
  }

  function startChampionship(competitionId){
    // Vérifier si la compétition existe
    if(!COMPETITIONS_REF || !COMPETITIONS_REF[competitionId]){
      console.error('Compétition introuvable:', competitionId);
      return;
    }

    // Définir la compétition courante et les équipes
    currentCompetition = competitionId;
    const comp = COMPETITIONS_REF[competitionId];

    // Pour l'Euro, générer les groupes aléatoirement
    if(comp.type === 'euro' && comp.getTeams){
      TEAMS = comp.getTeams();
    } else {
      TEAMS = comp.teams;
    }

    competitionType = comp.type || 'league'; // 'league' par défaut
    STORAGE_KEY = STORAGE_KEY_PREFIX + competitionId;

    // Mettre à jour le titre du championnat
    const titleEl = document.getElementById('championship-title');
    if(titleEl){
      titleEl.textContent = '⚽ ' + comp.name;
    }

    // Réinitialiser le localStorage pour générer un nouveau calendrier
    localStorage.removeItem(STORAGE_KEY);

    // Charger ou créer l'état
    if(competitionType === 'euro'){
      loadStateEuro();
    } else {
      loadState();
    }

    // Rendre le contenu
    render();
    // Afficher l'écran du championnat
    showScreen('championship-screen');
  }

  // reset: retourner à l'accueil
  function reset(){
    showScreen('home-screen');
  }

  // Initialiser les event listeners quand le DOM est prêt
  function initEventListeners(){
    const resetBtn = document.getElementById('btn-reset');
    const randomAllBtn = document.getElementById('btn-random-all');

    if(resetBtn) resetBtn.addEventListener('click', reset);
    if(randomAllBtn) randomAllBtn.addEventListener('click', ()=>{ if(confirm('Simuler tous les matches non joués ?')) simulateAll(); });

    // wire compétitions
    document.querySelectorAll('.competition-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const competitionId = btn.getAttribute('data-competition');
        startChampionship(competitionId);
      });
    });
  }

  // Attendre que le DOM soit prêt
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initEventListeners);
  } else {
    initEventListeners();
  }

  // expose some simple self-tests for manual console validation
  function selfTest(){
    const rounds = generateRoundRobin(state.teams);
    const matches = buildMatchesFromRounds(rounds);
    const days = rounds.length;
    const totalMatches = matches.length;
    // unique pair check
    const pairs = new Set();
    matches.forEach(m=>{
      const a = [m.homeId,m.awayId].sort().join('::'); pairs.add(a);
    });
    const uniquePairs = pairs.size;
    return {days,totalMatches,uniquePairs,ok: days===7 && totalMatches===28 && uniquePairs===28};
  }
  window.footSelfTest = selfTest;

  // Fonction pour qualifier les équipes et générer le tableau knockout
  function generateKnockout(){
    // Calculer les classements finaux de chaque groupe
    const qualifiedTeams = {}; // {A: [team1, team2], ...}

    const comp = COMPETITIONS_REF[currentCompetition];
    comp.groups.forEach(groupLetter => {
      const groupTeams = TEAMS.filter(t => t.group === groupLetter);
      const groupMatches = state.matches.filter(m => m.group === groupLetter);

      // Calculer les points pour ce groupe
      const table = {};
      groupTeams.forEach(t => {
        table[t.id] = {id:t.id,name:t.name,pts:0,played:0,w:0,d:0,l:0,gf:0,ga:0};
      });

      groupMatches.forEach(m => {
        if(m.homeGoals == null || m.awayGoals == null) return;
        const h = table[m.homeId], a = table[m.awayId];
        h.played++; a.played++;
        h.gf += m.homeGoals; h.ga += m.awayGoals;
        a.gf += m.awayGoals; a.ga += m.homeGoals;
        if(m.homeGoals > m.awayGoals){ h.w++; a.l++; h.pts += 3; }
        else if(m.homeGoals < m.awayGoals){ a.w++; h.l++; a.pts += 3; }
        else { h.d++; a.d++; h.pts += 1; a.pts += 1; }
      });

      const arr = Object.values(table);
      arr.sort((x,y)=>{
        if(y.pts !== x.pts) return y.pts - x.pts;
        const gdY = y.gf - y.ga, gdX = x.gf - x.ga;
        if(gdY !== gdX) return gdY - gdX;
        if(y.gf !== x.gf) return y.gf - x.gf;
        return x.name.localeCompare(y.name);
      });

      // Les 2 meilleures équipes sont qualifiées
      qualifiedTeams[groupLetter] = [
        findTeam(arr[0].id),
        findTeam(arr[1].id)
      ];

      state.groups[groupLetter].qualified = qualifiedTeams[groupLetter];
    });

    // Générer les appariements des 1/8èmes
    // Format: Groupe A 1er vs Groupe B 2e, Groupe B 1er vs Groupe A 2e, etc.
    const eighthfinal = [
      { home: qualifiedTeams['A'][0], away: qualifiedTeams['B'][1] },
      { home: qualifiedTeams['B'][0], away: qualifiedTeams['A'][1] },
      { home: qualifiedTeams['C'][0], away: qualifiedTeams['D'][1] },
      { home: qualifiedTeams['D'][0], away: qualifiedTeams['C'][1] },
      { home: qualifiedTeams['E'][0], away: qualifiedTeams['F'][1] },
      { home: qualifiedTeams['F'][0], away: qualifiedTeams['E'][1] },
      { home: qualifiedTeams['G'][0], away: qualifiedTeams['H'][1] },
      { home: qualifiedTeams['H'][0], away: qualifiedTeams['G'][1] }
    ];

    // Créer les matches de 1/8
    state.knockout['1/8'] = eighthfinal.map((match, idx) => ({
      id: 1000 + idx,
      stage: '1/8',
      homeId: match.home.id,
      awayId: match.away.id,
      homeGoals: null,
      awayGoals: null,
      extraTime: false,
      penalties: { home: null, away: null },
      winner: null
    }));

    state.matches.push(...state.knockout['1/8']);
    state.stage = 'knockout';
    saveState();
  }

  // Fonction pour qualifier les équipes d'une étape et générer la suivante
  function advanceKnockoutStage(currentStage){
    const stageMap = { '1/8': '1/4', '1/4': '1/2', '1/2': 'Final' };
    const nextStage = stageMap[currentStage];
    if(!nextStage) return; // Pas de prochaine étape

    // Récupérer les vainqueurs de cette étape
    const currentMatches = state.knockout[currentStage];
    const winners = [];

    currentMatches.forEach(match => {
      if(match.homeGoals == null || match.awayGoals == null) return;

      let winnerId;
      if(match.homeGoals > match.awayGoals){
        winnerId = match.homeId;
      } else if(match.awayGoals > match.homeGoals){
        winnerId = match.awayId;
      } else {
        // Match nul - choisir aléatoirement un vainqueur
        winnerId = Math.random() < 0.5 ? match.homeId : match.awayId;
      }

      // Marquer l'équipe gagnante
      match.winner = winnerId;
      winners.push(winnerId);
    });

    // Générer les matches de la prochaine étape en appairant les vainqueurs dans l'ordre
    const nextMatches = [];
    const matchesPerRound = winners.length / 2;

    for(let i = 0; i < winners.length; i += 2){
      nextMatches.push({
        id: 2000 + (currentStage === '1/8' ? 0 : currentStage === '1/4' ? 100 : 200) + (i/2),
        stage: nextStage,
        homeId: winners[i],
        awayId: winners[i+1],
        homeGoals: null,
        awayGoals: null,
        extraTime: false,
        penalties: { home: null, away: null },
        winner: null
      });
    }

    state.knockout[nextStage] = nextMatches;
    state.matches.push(...nextMatches);
    saveState();
  }
})();
