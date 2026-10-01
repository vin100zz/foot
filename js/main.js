// main.js - Application bootstrap, state management, event handling
(async () => {
  const state = {
    allTeams: [],
    competition: null,
    setup: { step: 1, format: null, teamType: 'CLUB', config: {}, selectedTeams: [], filter: { federation: '', search: '' }, teamCount: 16 }
  };

  // ======================== INIT ========================
  state.allTeams = await DataModule.loadTeams();
  const saved = StorageModule.loadCompetition();
  if (saved) { initCompetitionState(saved); state.competition = saved; }
  render();

  // ======================== RENDER ========================
  function render() { UIModule.render(state); }
  function save() { if (state.competition) StorageModule.saveCompetition(state.competition); }

  // ======================== COMPETITION HELPERS ========================

  function initCompetitionState(comp) {
    // Pre-create leg match objects for all ties
    ensureTieLegs(comp);
  }

  function ensureTieLegs(comp) {
    const allTies = CompetitionModule.getAllTies(comp);
    allTies.forEach(tie => {
      const legs = getTieLegCount(comp, tie);
      if (!tie.leg1) tie.leg1 = CompetitionModule.makeMatch(tie.team1, tie.team2);
      if (legs === 2 && !tie.leg2) tie.leg2 = CompetitionModule.makeMatch(tie.team2, tie.team1);
    });
  }

  function getTieLegCount(comp, tie) {
    if (comp.playoffTies?.some(t => t.id === tie.id)) return 2;
    for (const r of (comp.knockoutRounds || [])) {
      if (r.ties.some(t => t.id === tie.id)) return r.legs;
    }
    return 1;
  }

  function findTieForMatch(comp, matchId) {
    // getAllTies covers knockoutRounds + playoffTies
    for (const t of CompetitionModule.getAllTies(comp)) {
      if (t.leg1?.id === matchId || t.leg2?.id === matchId) return t;
    }
    return null;
  }

  function isTieMatch(comp, matchId) {
    return !!findTieForMatch(comp, matchId);
  }

  function recalcTieWinners(comp) {
    const allTies = CompetitionModule.getAllTies(comp);
    allTies.forEach(tie => {
      const legs = getTieLegCount(comp, tie);
      if (legs === 1) {
        const m = tie.leg1;
        if (!m || m.homeScore === null) { tie.winner = null; return; }
        if (m.homeScore !== m.awayScore) {
          tie.winner = m.homeScore > m.awayScore ? m.home : m.away;
          m.homePens = null; m.awayPens = null;
        } else {
          if (m.homePens === null) autoSimPens(m);
          tie.winner = (m.homePens > m.awayPens) ? m.home : m.away;
        }
      } else {
        const l1 = tie.leg1, l2 = tie.leg2;
        if (!l1 || l1.homeScore === null || !l2 || l2.homeScore === null) { tie.winner = null; return; }
        const agg1 = l1.homeScore + l2.awayScore;
        const agg2 = l1.awayScore + l2.homeScore;
        if (agg1 !== agg2) {
          tie.winner = agg1 > agg2 ? tie.team1 : tie.team2;
          l2.homePens = null; l2.awayPens = null;
        } else {
          if (l2.homePens === null) autoSimPens(l2);
          tie.winner = (l2.homePens > l2.awayPens) ? l2.home : l2.away;
        }
      }
    });
  }

  function autoSimPens(match) {
    const h = DataModule.getTeamByName(match.home);
    const a = DataModule.getTeamByName(match.away);
    if (!h || !a) return;
    const p = SimulationModule.simulatePenalties(h, a);
    match.homePens = p.home;
    match.awayPens = p.away;
  }

  function simSingleMatch(matchId) {
    const comp = state.competition;
    const match = CompetitionModule.findMatch(comp, matchId);
    if (!match) return;
    // Determine if this is a KO match that needs a winner
    const tie = findTieForMatch(comp, matchId);
    const needsWinner = !tie ? false : (() => {
      const legs = getTieLegCount(comp, tie);
      if (legs === 1) return true;
      // 2-leg: leg2 might need pens
      return match.id === tie.leg2?.id;
    })();
    const h = DataModule.getTeamByName(match.home);
    const a = DataModule.getTeamByName(match.away);
    if (!h || !a) return;
    const venue = !tie ? 'home' : 'neutral';
    const result = SimulationModule.simulateMatch(h, a, venue, needsWinner);
    match.homeScore = result.homeScore;
    match.awayScore = result.awayScore;
    match.homePens = result.homePens;
    match.awayPens = result.awayPens;
    recalcTieWinners(comp);
    save(); render();
  }

  function simRound(roundIdx, comp) {
    const r = comp.rounds?.[roundIdx - 1];
    if (!r) return;
    r.matches.forEach(m => {
      if (m.homeScore === null) {
        const h = DataModule.getTeamByName(m.home);
        const a = DataModule.getTeamByName(m.away);
        if (h && a) { const res = SimulationModule.simulateMatch(h, a, 'home'); m.homeScore = res.homeScore; m.awayScore = res.awayScore; }
      }
    });
    save(); render();
  }

  function simKORound(roundIdx, comp) {
    const r = comp.knockoutRounds?.[roundIdx];
    if (!r) return;
    r.ties.forEach(tie => {
      if (!tie.winner) simTie(tie, r.legs);
    });
    recalcTieWinners(comp);
    save(); render();
  }

  function simTie(tie, legs) {
    if (!tie.leg1) tie.leg1 = CompetitionModule.makeMatch(tie.team1, tie.team2);
    if (legs === 2 && !tie.leg2) tie.leg2 = CompetitionModule.makeMatch(tie.team2, tie.team1);
    const h = DataModule.getTeamByName(tie.leg1.home);
    const a = DataModule.getTeamByName(tie.leg1.away);
    if (!h || !a) return;
    if (tie.leg1.homeScore === null) {
      const r1 = SimulationModule.simulateMatch(h, a, 'neutral', legs === 1);
      tie.leg1.homeScore = r1.homeScore; tie.leg1.awayScore = r1.awayScore;
      tie.leg1.homePens = r1.homePens; tie.leg1.awayPens = r1.awayPens;
    }
    if (legs === 2 && tie.leg2.homeScore === null) {
      const h2 = DataModule.getTeamByName(tie.leg2.home);
      const a2 = DataModule.getTeamByName(tie.leg2.away);
      if (h2 && a2) {
        const r2 = SimulationModule.simulateMatch(h2, a2, 'home', false);
        tie.leg2.homeScore = r2.homeScore; tie.leg2.awayScore = r2.awayScore;
        const agg1 = tie.leg1.homeScore + r2.awayScore;
        const agg2 = tie.leg1.awayScore + r2.homeScore;
        if (agg1 === agg2) { autoSimPens(tie.leg2); }
      }
    }
  }

  function simAll(comp) {
    if (!comp) return;
    // Keep simming & advancing until complete
    let iterations = 0;
    while (iterations++ < 20) {
      let progress = false;
      // Sim league rounds
      if (comp.format === 'LEAGUE') {
        comp.rounds.forEach(r => {
          r.matches.forEach(m => {
            if (m.homeScore === null) {
              const h = DataModule.getTeamByName(m.home);
              const a = DataModule.getTeamByName(m.away);
              if (h && a) { const res = SimulationModule.simulateMatch(h, a, 'home'); m.homeScore = res.homeScore; m.awayScore = res.awayScore; progress = true; }
            }
          });
        });
      }
      // Sim UCL league phase
      if (comp.format === 'UCL' && comp.phase === 'LEAGUE') {
        comp.leaguePhaseMatches.forEach(m => {
          if (m.homeScore === null) {
            const h = DataModule.getTeamByName(m.home);
            const a = DataModule.getTeamByName(m.away);
            if (h && a) { const res = SimulationModule.simulateMatch(h, a, 'home'); m.homeScore = res.homeScore; m.awayScore = res.awayScore; progress = true; }
          }
        });
      }
      // Sim group phases
      if ((comp.format === 'GROUP_CUP') && comp.phase === 'GROUP') {
        comp.groups?.forEach(g => {
          g.matches.forEach(m => {
            if (m.homeScore === null) {
              const h = DataModule.getTeamByName(m.home);
              const a = DataModule.getTeamByName(m.away);
              if (h && a) { const res = SimulationModule.simulateMatch(h, a, 'neutral'); m.homeScore = res.homeScore; m.awayScore = res.awayScore; progress = true; }
            }
          });
        });
      }
      // Sim UCL/GROUP_CUP playoff ties
      const playoff = comp.playoffTies || [];
      playoff.forEach(tie => {
        if (!tie.winner) { simTie(tie, 2); progress = true; }
      });
      recalcTieWinners(comp);
      // Sim KO rounds (only current round)
      const koRound = comp.knockoutRounds?.[comp.currentRound];
      if (koRound) {
        koRound.ties.forEach(tie => {
          if (!tie.winner) { simTie(tie, koRound.legs); progress = true; }
        });
        recalcTieWinners(comp);
      }
      // Try advancing
      const advanced = CompetitionModule.tryAdvance(comp);
      if (advanced) { ensureTieLegs(comp); progress = true; }
      if (!progress) break;
    }
    save(); render();
  }

  function handleScoreEntered(matchId) {
    const comp = state.competition;
    if (!comp) return;
    const match = CompetitionModule.findMatch(comp, matchId);
    if (!match) return;
    const hInput = document.querySelector(`[data-match-id="${CSS.escape(matchId)}"][data-side="home"]`);
    const aInput = document.querySelector(`[data-match-id="${CSS.escape(matchId)}"][data-side="away"]`);
    if (!hInput || !aInput || hInput.value === '' || aInput.value === '') return;
    const hs = parseInt(hInput.value, 10);
    const as_ = parseInt(aInput.value, 10);
    if (isNaN(hs) || isNaN(as_)) return;
    match.homeScore = hs;
    match.awayScore = as_;
    match.homePens = null;
    match.awayPens = null;
    recalcTieWinners(comp);
    save(); render();
  }

  function advancePhase() {
    const comp = state.competition;
    if (!comp) return;
    const ok = CompetitionModule.tryAdvance(comp);
    if (ok) { ensureTieLegs(comp); save(); render(); }
  }

  // ======================== SETUP ACTIONS ========================

  function readConfigForm() {
    const form = document.getElementById('config-form');
    if (!form) return {};
    const fd = new FormData(form);
    const cfg = {};
    ['legs','seedCount','numGroups','teamsPerGroup','qualifiersPerGroup','knockoutLegs'].forEach(k => {
      const v = fd.get(k);
      if (v !== null) cfg[k] = parseInt(v, 10);
    });
    return cfg;
  }

  // ======================== EVENT DELEGATION ========================

  document.getElementById('app-root').addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const s = state.setup;

    switch (action) {
      case 'set-team-type':
        s.teamType = el.dataset.value;
        s.selectedTeams = [];
        render(); break;

      case 'set-format':
        s.format = el.dataset.value;
        s.step = 2;
        s.config = {};
        render(); break;

      case 'setup-back':
        s.step = Math.max(1, (s.step || 1) - 1);
        render(); break;

      case 'config-next': {
        e.preventDefault();
        s.config = readConfigForm();
        // Grab comp name from form
        const nameEl = document.getElementById('comp-name');
        if (nameEl?.value) s.compName = nameEl.value;
        // Determine required team count
        if (s.format === 'GROUP_CUP') s.teamCount = (s.config.numGroups || 8) * (s.config.teamsPerGroup || 4);
        else if (s.format === 'UCL') s.teamCount = 32;
        else s.teamCount = s.teamCount || 16;
        s.step = 3;
        render(); break;
      }

      case 'filter-fed': break; // handled by change event

      case 'select-team': {
        const name = el.dataset.team;
        const t = state.allTeams.find(x => x.name === name);
        if (t && !s.selectedTeams.find(x => x.name === name)) s.selectedTeams.push(t);
        render(); break;
      }

      case 'deselect-team': {
        const name = el.dataset.team;
        s.selectedTeams = s.selectedTeams.filter(x => x.name !== name);
        render(); break;
      }

      case 'add-best': {
        const count = parseInt(el.dataset.count, 10);
        const existing = new Set(s.selectedTeams.map(t => t.name));
        const pool = DataModule.getTeams(s.teamType).filter(t => !existing.has(t.name));
        const filtered = DataModule.filterTeams(pool, { federation: s.filter?.federation, nameSearch: s.filter?.search });
        const top = DataModule.getTopN(filtered, count);
        top.forEach(t => { if (!existing.has(t.name)) s.selectedTeams.push(t); });
        render(); break;
      }

      case 'add-random': {
        const count = parseInt(el.dataset.count, 10);
        const existing = new Set(s.selectedTeams.map(t => t.name));
        const pool = DataModule.getTeams(s.teamType).filter(t => !existing.has(t.name));
        const filtered = DataModule.filterTeams(pool, { federation: s.filter?.federation, nameSearch: s.filter?.search });
        const rnd = DataModule.getRandomN(filtered, count);
        rnd.forEach(t => { if (!existing.has(t.name)) s.selectedTeams.push(t); });
        render(); break;
      }

      case 'create-competition': {
        if (el.hasAttribute('disabled')) return;
        const cfg = { ...s.config };
        const name = s.compName || `${s.format === 'LEAGUE' ? 'Championnat' : s.format === 'CUP' ? 'Coupe' : s.format === 'GROUP_CUP' ? 'Compétition' : 'Ligue des Champions'} ${new Date().getFullYear()}`;
        const comp = CompetitionModule.createCompetition(s.format, name, s.selectedTeams, cfg);
        initCompetitionState(comp);
        state.competition = comp;
        StorageModule.clearSetup();
        save();
        render(); break;
      }

      case 'change-team-count': {
        // handled by change event below
        break;
      }

      case 'new-competition':
        state._confirmNew = true;
        render(); break;

      case 'new-competition-cancel':
        state._confirmNew = false;
        render(); break;

      case 'new-competition-confirm':
        state._confirmNew = false;
        state.competition = null;
        state.setup = { step: 1, format: null, teamType: 'CLUB', config: {}, selectedTeams: [], filter: { federation: '', search: '' }, teamCount: 16 };
        StorageModule.clearCompetition();
        render(); break;

      case 'sim-match':
        simSingleMatch(el.dataset.matchId);
        break;

      case 'sim-round':
        simRound(parseInt(el.dataset.round, 10), state.competition);
        break;

      case 'sim-ko-round':
        simKORound(parseInt(el.dataset.roundIdx, 10), state.competition);
        break;

      case 'sim-group': {
        const gi = parseInt(el.dataset.groupIdx, 10);
        const g = state.competition.groups?.[gi];
        if (g) {
          g.matches.forEach(m => {
            if (m.homeScore === null) {
              const h = DataModule.getTeamByName(m.home);
              const a = DataModule.getTeamByName(m.away);
              if (h && a) { const r = SimulationModule.simulateMatch(h, a, 'neutral'); m.homeScore = r.homeScore; m.awayScore = r.awayScore; }
            }
          });
          save(); render();
        }
        break;
      }

      case 'sim-ucl-round': {
        const rn = parseInt(el.dataset.round, 10);
        const comp = state.competition;
        comp.leaguePhaseMatches.filter(m => m.round === rn && m.homeScore === null).forEach(m => {
          const h = DataModule.getTeamByName(m.home);
          const a = DataModule.getTeamByName(m.away);
          if (h && a) { const r = SimulationModule.simulateMatch(h, a, 'home'); m.homeScore = r.homeScore; m.awayScore = r.awayScore; }
        });
        save(); render(); break;
      }

      case 'sim-ucl-playoff': {
        const comp = state.competition;
        comp.playoffTies.forEach(tie => { if (!tie.winner) simTie(tie, 2); });
        recalcTieWinners(comp);
        save(); render(); break;
      }

      case 'advance-phase':
        advancePhase();
        break;

      case 'sim-all':
        simAll(state.competition);
        break;
    }
  });

  // Score input, filter, and team-count changes
  document.getElementById('app-root').addEventListener('change', e => {
    if (e.target.classList.contains('score-input')) {
      handleScoreEntered(e.target.dataset.matchId);
    }
    if (e.target.id === 'filter-fed') {
      state.setup.filter = { ...state.setup.filter, federation: e.target.value || '' };
      render();
    }
    if (e.target.id === 'team-count') {
      state.setup.teamCount = parseInt(e.target.value, 10);
      // Trim excess selections if needed
      if (state.setup.selectedTeams.length > state.setup.teamCount) {
        state.setup.selectedTeams = state.setup.selectedTeams.slice(0, state.setup.teamCount);
      }
      render();
    }
  });

  document.getElementById('app-root').addEventListener('input', e => {
    if (e.target.id === 'filter-search') {
      state.setup.filter = { ...state.setup.filter, search: e.target.value };
      render();
    }
  });

  document.getElementById('app-root').addEventListener('keydown', e => {
    // Tab between score inputs only (skip all buttons and other elements)
    if (e.key === 'Tab' && e.target.classList.contains('score-input')) {
      e.preventDefault();
      const inputs = [...document.querySelectorAll('.score-input')];
      const idx = inputs.indexOf(e.target);
      const next = inputs[e.shiftKey ? idx - 1 : idx + 1];
      if (next) next.focus();
      return;
    }
    if (e.key === 'Enter' && e.target.classList.contains('score-input')) {
      e.target.blur();
      handleScoreEntered(e.target.dataset.matchId);
    }
    if (e.key === 'Enter' && e.target.id === 'comp-name') {
      const btn = document.querySelector('[data-action="create-competition"]');
      btn?.click();
    }
  });

  // Form submit
  document.getElementById('app-root').addEventListener('submit', e => {
    if (e.target.id === 'config-form') {
      e.preventDefault();
      const btn = document.querySelector('[data-action="config-next"]');
      btn?.click();
    }
  });

})();
