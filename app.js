/* Simulateur de championnat - entièrement côté client, sans compilation */
(function(){
  const STORAGE_KEY = 'foot8_state_v1';

  // Utiliser la configuration importée
  const TEAMS = TEAMS_CONFIG;

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
  let state = {teams: TEAMS, matches: [], updated: Date.now()};

  function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function loadState(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      try{ state = JSON.parse(raw); }
      catch(e){ console.warn('Invalid state in storage, resetting'); }
    } else {
      // build
      const rounds = generateRoundRobin(TEAMS);
      assignAlternating(rounds);
      state.matches = buildMatchesFromRounds(rounds);
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
    const grouped = groupMatchesByDay();
    const grid = document.createElement('div'); grid.className = 'rounds-grid';
    const matchTemplate = getMatchTemplate();
    grouped.forEach(group=>{
      const div = document.createElement('div'); div.className='round';
      const h = document.createElement('h3'); h.textContent = `Journée ${group.day}`;
      const simAllBtn = document.createElement('button'); simAllBtn.className = 'btn-round-sim'; simAllBtn.textContent = '▶';
      simAllBtn.setAttribute('aria-label', `Simuler la journée ${group.day}`);
      simAllBtn.setAttribute('title', `Simuler la journée ${group.day}`);
      simAllBtn.addEventListener('click',()=>{ simulateDay(group.day); });
      // Exclure ce bouton de la navigation Tab pour aller directement d'un input de score à l'autre
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
        // Exclure le bouton 'Simuler' par match de la navigation Tab (accessible par clic)
        simBtn.tabIndex = -1;
        div.appendChild(row);
      });
      grid.appendChild(div);
    });
    roundsContainer.appendChild(grid);
  }

  function groupMatchesByDay(){
    const map = {};
    state.matches.forEach(m=>{ (map[m.day] = map[m.day]||[]).push(m); });
    return Object.keys(map).sort((a,b)=>a-b).map(k=>({day:parseInt(k),matches:map[k]}));
  }

  function renderStandings(){
    const standingsTbody = getStandingsTbody();
    const rows = computeStandings();
    standingsTbody.innerHTML = '';
    rows.forEach(r=>{
      const tr = document.createElement('tr');
      const tdPos = document.createElement('td'); tdPos.className='pos'; tdPos.textContent = r.pos;
      const tdTeam = document.createElement('td'); tdTeam.className='team-cell';
      const kit = document.createElement('span'); kit.className = 'kit team-'+r.id;
      const name = document.createElement('span'); name.textContent = r.name;
      tdTeam.appendChild(kit); tdTeam.appendChild(name);
      const tdPts = document.createElement('td'); tdPts.textContent = r.pts;
      const tdDiff = document.createElement('td'); tdDiff.textContent = (r.diff>0?'+':'')+r.diff;
      tr.appendChild(tdPos); tr.appendChild(tdTeam); tr.appendChild(tdPts); tr.appendChild(tdDiff);
      standingsTbody.appendChild(tr);
    });
  }

  function setScore(matchId, hGoals, aGoals){
    const m = state.matches.find(x=>x.id===matchId);
    if(!m) return;
    if(Number.isFinite(hGoals) && Number.isFinite(aGoals) && hGoals>=0 && aGoals>=0){
      m.homeGoals = hGoals; m.awayGoals = aGoals;
    } else {
      m.homeGoals = null; m.awayGoals = null;
    }
    state.updated = Date.now(); saveState(); renderStandings();
  }

  function randomScore(){
    // Poisson-ish: favour low scores
    const p = Math.random();
    if(p < 0.6) return Math.floor(Math.random()*3); // 0-2
    if(p < 0.9) return 3 + Math.floor(Math.random()*2); //3-4
    return 5 + Math.floor(Math.random()*3);
  }

  function simulateMatch(matchId){
    const m = state.matches.find(x=>x.id===matchId); if(!m) return;
    m.homeGoals = randomScore(); m.awayGoals = randomScore();
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

  function startChampionship(){
    // Réinitialiser le localStorage pour générer un nouveau calendrier
    localStorage.removeItem(STORAGE_KEY);
    // Charger ou créer l'état
    loadState();
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
      btn.addEventListener('click', ()=>{ startChampionship(); });
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

})();
