// competition.js - Competition formats, scheduling, standings, progression
const CompetitionModule = (() => {
  let _matchId = 0;

  function genId() { return 'm' + (++_matchId); }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function makeMatch(home, away) {
    return { id: genId(), home, away, homeScore: null, awayScore: null, homePens: null, awayPens: null };
  }

  // ===================== STANDINGS =====================

  function computeLeagueStandings(teamNames, allMatches) {
    const table = {};
    teamNames.forEach(n => { table[n] = { name: n, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 }; });
    allMatches.forEach(m => {
      if (m.homeScore === null) return;
      const h = table[m.home], a = table[m.away];
      if (!h || !a) return;
      h.played++; a.played++;
      h.gf += m.homeScore; h.ga += m.awayScore;
      a.gf += m.awayScore; a.ga += m.homeScore;
      h.gd = h.gf - h.ga; a.gd = a.gf - a.ga;
      if (m.homeScore > m.awayScore) { h.won++; a.lost++; h.pts += 3; }
      else if (m.homeScore < m.awayScore) { a.won++; h.lost++; a.pts += 3; }
      else { h.drawn++; a.drawn++; h.pts++; a.pts++; }
    });
    return Object.values(table).sort((a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name)
    );
  }

  // ===================== LEAGUE FORMAT =====================

  function generateLeagueSchedule(teams) {
    const n = teams.length;
    const arr = [...teams.map(t => t.name)];
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const matches = [];
      for (let i = 0; i < n / 2; i++) {
        const j = n - 1 - i;
        const h = r % 2 === 0 ? arr[i] : arr[j];
        const aw = r % 2 === 0 ? arr[j] : arr[i];
        matches.push(makeMatch(h, aw));
      }
      rounds.push({ round: r + 1, name: `Journée ${r + 1}`, matches });
      const last = arr.splice(n - 1, 1)[0];
      arr.splice(1, 0, last);
    }
    return rounds;
  }

  function createLeague(teams, config) {
    const { legs } = config;
    const firstLeg = generateLeagueSchedule(teams);
    let rounds = [...firstLeg];
    if (legs === 2) {
      const n = teams.length - 1;
      const secondLeg = firstLeg.map((r, idx) => ({
        round: n + idx + 1,
        name: `Journée ${n + idx + 1}`,
        matches: r.matches.map(m => makeMatch(m.away, m.home))
      }));
      rounds = [...firstLeg, ...secondLeg];
    }
    return {
      format: 'LEAGUE',
      config,
      teams: teams.map(t => t.name),
      rounds
    };
  }

  // ===================== CUP FORMAT =====================

  function getCupRoundName(remaining) {
    const names = { 2: 'Finale', 4: 'Demi-finales', 8: 'Quarts de finale', 16: '1/8 de finale', 32: '1/16 de finale', 64: '1/32 de finale' };
    return names[remaining] || `Tour (${remaining / 2} matches)`;
  }

  function seedPositions(n, seedCount) {
    // Returns bracket positions [0..n-1] for each seed
    const pos = [];
    if (seedCount >= 1) pos.push(0);
    if (seedCount >= 2) pos.push(n - 2); // bottom of bracket
    if (seedCount >= 3) {
      const opts = shuffle([Math.floor(n / 4) * 2 - 2, Math.floor(n / 4) * 2]);
      const base = opts.filter(x => x >= 0 && x < n - 1 && !pos.includes(x));
      pos.push(base[0] !== undefined ? base[0] : 2);
      if (seedCount >= 4) pos.push(base[1] !== undefined ? base[1] : n - 4);
    }
    if (seedCount >= 5) {
      const eighth = Math.floor(n / 8);
      const candidates = [eighth * 2 - 2, eighth * 2, eighth * 6 - 2, eighth * 6]
        .filter(x => x >= 0 && x < n && x % 2 === 0 && !pos.includes(x));
      const shuffled = shuffle(candidates);
      for (let i = 0; i < 4 && pos.length < seedCount; i++) {
        if (shuffled[i] !== undefined) pos.push(shuffled[i]);
      }
    }
    return pos;
  }

  function createFirstCupRound(teams, seedCount) {
    const n = teams.length;
    const sorted = [...teams].sort((a, b) => b.level - a.level);
    const seeds = sorted.slice(0, seedCount);
    const unseeded = shuffle(sorted.slice(seedCount));

    const bracket = new Array(n).fill(null);
    const sPos = seedPositions(n, seedCount);
    seeds.forEach((s, i) => { if (sPos[i] !== undefined) bracket[sPos[i]] = s.name; });
    let ui = 0;
    for (let i = 0; i < n; i++) { if (bracket[i] === null) bracket[i] = unseeded[ui++]?.name ?? null; }

    const ties = [];
    for (let i = 0; i < n; i += 2) {
      ties.push({ id: genId(), team1: bracket[i], team2: bracket[i + 1], leg1: null, leg2: null, winner: null });
    }
    return ties;
  }

  function createCup(teams, config) {
    const { legs, seedCount } = config;
    const ties = createFirstCupRound(teams, seedCount || 0);
    return {
      format: 'CUP',
      config,
      teams: teams.map(t => t.name),
      knockoutRounds: [{
        name: getCupRoundName(teams.length),
        legs: teams.length === 2 ? 1 : legs, // final always single match
        ties
      }],
      currentRound: 0
    };
  }

  function getTieWinner(tie, legs) {
    if (legs === 1) {
      const m = tie.leg1;
      if (!m || m.homeScore === null) return null;
      if (m.homeScore > m.awayScore) return m.home;
      if (m.awayScore > m.homeScore) return m.away;
      if (m.homePens !== null) return m.homePens > m.awayPens ? m.home : m.away;
      return null;
    }
    // 2 legs
    const l1 = tie.leg1, l2 = tie.leg2;
    if (!l1 || l1.homeScore === null || !l2 || l2.homeScore === null) return null;
    const agg1 = l1.homeScore + l2.awayScore; // team1 aggregate
    const agg2 = l1.awayScore + l2.homeScore; // team2 aggregate
    if (agg1 > agg2) return tie.team1;
    if (agg2 > agg1) return tie.team2;
    // Equal aggregate: penalties in leg2
    if (l2.homePens !== null) return l2.homePens > l2.awayPens ? tie.team2 : tie.team1;
    return null;
  }

  function advanceCupRound(comp) {
    const round = comp.knockoutRounds[comp.currentRound];
    if (!round) return false;
    const winners = round.ties.map(t => getTieWinner(t, round.legs));
    if (winners.some(w => !w)) return false; // not all played
    round.ties.forEach((t, i) => { t.winner = winners[i]; });

    if (winners.length === 1) { return true; } // final done

    const nextTies = [];
    for (let i = 0; i < winners.length; i += 2) {
      nextTies.push({ id: genId(), team1: winners[i], team2: winners[i + 1], leg1: null, leg2: null, winner: null });
    }
    comp.knockoutRounds.push({
      name: getCupRoundName(winners.length),
      legs: winners.length === 2 ? 1 : round.legs, // final always single match
      ties: nextTies
    });
    comp.currentRound++;
    return true;
  }

  // ===================== GROUP + CUP FORMAT =====================

  function createGroups(teams, numGroups, teamsPerGroup) {
    const n = teams.length;
    const sorted = [...teams].sort((a, b) => b.level - a.level);
    const numPots = teamsPerGroup;
    const groups = Array.from({ length: numGroups }, (_, i) => ({
      name: 'Groupe ' + 'ABCDEFGHIJKLMNOP'[i],
      teams: [],
      matches: []
    }));

    // Seeding: distribute teams pot by pot, randomly within each pot
    for (let pot = 0; pot < numPots; pot++) {
      const potTeams = shuffle(sorted.slice(pot * numGroups, (pot + 1) * numGroups));
      potTeams.forEach((t, i) => groups[i].teams.push(t.name));
    }

    // Generate round-robin matches for each group
    groups.forEach(g => {
      const n = g.teams.length;
      const arr = [...g.teams];
      for (let r = 0; r < n - 1; r++) {
        for (let i = 0; i < n / 2; i++) {
          const j = n - 1 - i;
          const h = r % 2 === 0 ? arr[i] : arr[j];
          const aw = r % 2 === 0 ? arr[j] : arr[i];
          g.matches.push({ ...makeMatch(h, aw), round: r + 1 });
        }
        const last = arr.splice(n - 1, 1)[0];
        arr.splice(1, 0, last);
      }
    });

    return groups;
  }

  function createGroupCup(teams, config) {
    const { numGroups, teamsPerGroup, qualifiersPerGroup, knockoutLegs } = config;
    const groups = createGroups(teams, numGroups, teamsPerGroup);
    return {
      format: 'GROUP_CUP',
      config,
      teams: teams.map(t => t.name),
      phase: 'GROUP',
      groups,
      knockoutRounds: [],
      currentRound: 0
    };
  }

  function advanceGroupPhase(comp) {
    const { groups, config } = comp;
    const { qualifiersPerGroup, knockoutLegs } = config;
    const allDone = groups.every(g => g.matches.every(m => m.homeScore !== null));
    if (!allDone) return false;

    // Collect qualifiers sorted by rank (rank0 = group winners, rank1 = runners-up, ...)
    const qualifiedByRank = Array.from({ length: qualifiersPerGroup }, () => []);
    groups.forEach(g => {
      const standings = computeLeagueStandings(g.teams, g.matches);
      standings.slice(0, qualifiersPerGroup).forEach((s, rank) => {
        qualifiedByRank[rank].push(s.name);
      });
    });

    // Shuffle within each rank group, then build seeded bracket:
    // Best seed plays worst, 2nd plays 2nd-worst, etc.
    const orderedTeams = qualifiedByRank.flatMap(rankGroup => shuffle(rankGroup));
    const n = orderedTeams.length;
    const ties = [];
    for (let i = 0; i < n / 2; i++) {
      ties.push({ id: genId(), team1: orderedTeams[i], team2: orderedTeams[n - 1 - i], leg1: null, leg2: null, winner: null });
    }

    comp.knockoutRounds = [{
      name: getCupRoundName(n),
      legs: n === 2 ? 1 : knockoutLegs, // final always single match
      ties
    }];
    comp.phase = 'KNOCKOUT';
    comp.currentRound = 0;
    return true;
  }

  // ===================== UCL FORMAT =====================

  function randomPerfectMatching(n) {
    const arr = shuffle([...Array(n).keys()]);
    const perm = new Array(n);
    for (let i = 0; i < n; i += 2) { perm[arr[i]] = arr[i + 1]; perm[arr[i + 1]] = arr[i]; }
    return perm;
  }

  function generateUCLLeaguePhase(teams) {
    // 32 teams in 4 pots of 8, each team plays 8 matches (2 per pot)
    const pots = [teams.slice(0, 8), teams.slice(8, 16), teams.slice(16, 24), teams.slice(24, 32)];
    const matches = [];

    for (let pi = 0; pi < 4; pi++) {
      for (let pj = pi; pj < 4; pj++) {
        if (pi === pj) {
          // Intra-pot: 2 perfect matchings, each team plays 2
          let m1, m2, tries = 0;
          while (tries++ < 200) {
            m1 = randomPerfectMatching(8);
            m2 = randomPerfectMatching(8);
            let ok = true;
            for (let i = 0; i < 8; i++) { if (m1[i] === m2[i]) { ok = false; break; } }
            if (ok) {
              // Check same-fed
              let sameFed = 0;
              for (let i = 0; i < 8; i++) {
                if (i < m1[i] && pots[pi][i].federation === pots[pi][m1[i]].federation) sameFed++;
                if (i < m2[i] && pots[pi][i].federation === pots[pi][m2[i]].federation) sameFed++;
              }
              if (sameFed === 0 || tries > 150) break;
            }
          }
          for (let i = 0; i < 8; i++) {
            if (i < m1[i]) {
              const [h, a] = Math.random() < 0.5 ? [pots[pi][i], pots[pi][m1[i]]] : [pots[pi][m1[i]], pots[pi][i]];
              matches.push({ ...makeMatch(h.name, a.name), round: null });
            }
            if (i < m2[i]) {
              const [h, a] = Math.random() < 0.5 ? [pots[pi][i], pots[pi][m2[i]]] : [pots[pi][m2[i]], pots[pi][i]];
              matches.push({ ...makeMatch(h.name, a.name), round: null });
            }
          }
        } else {
          // Inter-pot: 2 permutations, each team from pi plays 2 from pj
          let perm1, perm2, tries = 0;
          while (tries++ < 200) {
            perm1 = shuffle([...Array(8).keys()]);
            perm2 = shuffle([...Array(8).keys()]);
            let ok = true;
            for (let i = 0; i < 8; i++) { if (perm1[i] === perm2[i]) { ok = false; break; } }
            if (!ok) continue;
            let sameFed = 0;
            for (let i = 0; i < 8; i++) {
              if (pots[pi][i].federation === pots[pj][perm1[i]].federation) sameFed++;
              if (pots[pi][i].federation === pots[pj][perm2[i]].federation) sameFed++;
            }
            if (sameFed === 0 || tries > 150) break;
          }
          for (let i = 0; i < 8; i++) {
            matches.push({ ...makeMatch(pots[pi][i].name, pots[pj][perm1[i]].name), round: null });
            matches.push({ ...makeMatch(pots[pj][perm2[i]].name, pots[pi][i].name), round: null });
          }
        }
      }
    }

    // Assign round numbers (8 rounds, distribute matches evenly)
    const roundSize = matches.length / 8;
    const shuffled = shuffle(matches);
    shuffled.forEach((m, i) => { m.round = Math.floor(i / roundSize) + 1; });
    return shuffled;
  }

  function getUCLStandings(teamNames, matches) {
    return computeLeagueStandings(teamNames, matches);
  }

  function advanceUCLLeaguePhase(comp) {
    const allDone = comp.leaguePhaseMatches.every(m => m.homeScore !== null);
    if (!allDone) return false;
    const standings = getUCLStandings(comp.teams, comp.leaguePhaseMatches);
    comp.uclStandings = standings;

    // Top 8 → R16 directly as seeds
    // 9-24 → playoffs
    // 25-32 → eliminated
    const top8 = standings.slice(0, 8).map(s => s.name);
    const middle16 = standings.slice(8, 24).map(s => s.name);

    // Playoffs: 9v24, 10v23, ..., 16v17
    const playoffTies = [];
    for (let i = 0; i < 8; i++) {
      playoffTies.push({
        id: genId(), team1: middle16[i], team2: middle16[15 - i],
        leg1: null, leg2: null, winner: null
      });
    }
    comp.phase = 'PLAYOFF';
    comp.top8 = top8;
    comp.playoffTies = playoffTies;
    return true;
  }

  function advanceUCLPlayoff(comp) {
    const allDone = comp.playoffTies.every(t => getTieWinner(t, 2) !== null);
    if (!allDone) return false;
    comp.playoffTies.forEach(t => { t.winner = getTieWinner(t, 2); });
    const playoffWinners = comp.playoffTies.map(t => t.winner);

    // R16: 8 seeds vs 8 playoff winners (seed 1 vs playoff winner 8, etc.)
    const seeds = comp.top8;
    const shuffledPW = shuffle(playoffWinners);
    // Seeds are favoured: they play leg2 at home
    const ties = seeds.map((s, i) => ({
      id: genId(), team1: shuffledPW[i], team2: s, // team2 plays leg2 at home (seed)
      leg1: null, leg2: null, winner: null
    }));
    comp.knockoutRounds = [{ name: '1/8 de finale', legs: 2, ties }];
    comp.currentRound = 0;
    comp.phase = 'KNOCKOUT';
    return true;
  }

  function createUCL(teams) {
    const sorted = [...teams].sort((a, b) => b.level - a.level).slice(0, 32);
    const pots = [sorted.slice(0, 8), sorted.slice(8, 16), sorted.slice(16, 24), sorted.slice(24, 32)];
    const matches = generateUCLLeaguePhase(sorted);
    return {
      format: 'UCL',
      config: {},
      teams: sorted.map(t => t.name),
      pots: pots.map(p => p.map(t => t.name)),
      phase: 'LEAGUE',
      leaguePhaseMatches: matches,
      uclStandings: null,
      top8: [],
      playoffTies: [],
      knockoutRounds: [],
      currentRound: 0
    };
  }

  // ===================== COMPETITION CREATION =====================

  function createCompetition(format, name, teams, config) {
    _matchId = 0;
    let data;
    switch (format) {
      case 'LEAGUE': data = createLeague(teams, config); break;
      case 'CUP': data = createCup(teams, config); break;
      case 'GROUP_CUP': data = createGroupCup(teams, config); break;
      case 'UCL': data = createUCL(teams); break;
      default: throw new Error('Unknown format: ' + format);
    }
    return { ...data, name, createdAt: Date.now() };
  }

  // ===================== PROGRESSION =====================

  function tryAdvance(comp) {
    if (comp.format === 'CUP') return advanceCupRound(comp);
    if (comp.format === 'GROUP_CUP') {
      if (comp.phase === 'GROUP') return advanceGroupPhase(comp);
      if (comp.phase === 'KNOCKOUT') return advanceCupRound(comp);
    }
    if (comp.format === 'UCL') {
      if (comp.phase === 'LEAGUE') return advanceUCLLeaguePhase(comp);
      if (comp.phase === 'PLAYOFF') return advanceUCLPlayoff(comp);
      if (comp.phase === 'KNOCKOUT') return advanceCupRound(comp);
    }
    return false;
  }

  // ===================== MATCH HELPERS =====================

  function updateMatch(comp, matchId, homeScore, awayScore, homePens, awayPens) {
    const match = findMatch(comp, matchId);
    if (!match) return;
    match.homeScore = homeScore;
    match.awayScore = awayScore;
    match.homePens = homePens ?? null;
    match.awayPens = awayPens ?? null;
  }

  function findMatch(comp, matchId) {
    // Search all possible containers regardless of current phase
    if (comp.rounds) {
      for (const r of comp.rounds) {
        const m = r.matches.find(m => m.id === matchId);
        if (m) return m;
      }
    }
    if (comp.knockoutRounds) {
      for (const r of comp.knockoutRounds) {
        for (const t of r.ties) {
          if (t.leg1?.id === matchId) return t.leg1;
          if (t.leg2?.id === matchId) return t.leg2;
        }
      }
    }
    if (comp.groups) {
      for (const g of comp.groups) {
        const m = g.matches.find(m => m.id === matchId);
        if (m) return m;
      }
    }
    if (comp.leaguePhaseMatches) {
      const m = comp.leaguePhaseMatches.find(m => m.id === matchId);
      if (m) return m;
    }
    for (const t of (comp.playoffTies || [])) {
      if (t.leg1?.id === matchId) return t.leg1;
      if (t.leg2?.id === matchId) return t.leg2;
    }
    return null;
  }

  function setTieLeg(comp, tieId, leg, matchData) {
    const ties = getAllTies(comp);
    const tie = ties.find(t => t.id === tieId);
    if (!tie) return;
    if (leg === 1) tie.leg1 = { ...makeMatch(tie.team1, tie.team2), ...matchData };
    else tie.leg2 = { ...makeMatch(tie.team2, tie.team1), ...matchData };
  }

  function getAllTies(comp) {
    const ties = [];
    if (comp.knockoutRounds) comp.knockoutRounds.forEach(r => ties.push(...r.ties));
    if (comp.playoffTies) ties.push(...comp.playoffTies);
    return ties;
  }

  function isLeagueComplete(comp) {
    if (comp.format !== 'LEAGUE') return false;
    return comp.rounds.every(r => r.matches.every(m => m.homeScore !== null));
  }

  function isCupComplete(comp) {
    const rounds = comp.knockoutRounds || [];
    if (!rounds.length) return false;
    const lastRound = rounds[rounds.length - 1];
    return lastRound.ties.length === 1 && lastRound.ties[0].winner !== null;
  }

  return {
    createCompetition,
    computeLeagueStandings,
    getUCLStandings,
    getTieWinner,
    tryAdvance,
    updateMatch,
    findMatch,
    setTieLeg,
    getAllTies,
    isLeagueComplete,
    isCupComplete,
    getCupRoundName,
    makeMatch
  };
})();
