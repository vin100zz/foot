// simulation.js - Match result simulation using Poisson distribution
const SimulationModule = (() => {

  function poisson(lambda) {
    if (lambda <= 0) return 0;
    const L = Math.exp(-Math.min(lambda, 20));
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }

  // venue: 'home' | 'away' | 'neutral'
  // needsWinner: if true and draw, simulate penalties
  function simulateMatch(homeTeam, awayTeam, venue = 'home', needsWinner = false) {
    const hl = homeTeam.level;
    const al = awayTeam.level;
    const homeBonus = venue === 'home' ? 1.12 : (venue === 'away' ? 0.88 : 1.0);
    const effHome = hl * homeBonus;
    const effAway = al;
    const total = effHome + effAway;
    // Expected goals per team proportional to relative strength
    const avgGoals = 2.55;
    const lh = Math.max(0.15, avgGoals * (effHome / total));
    const la = Math.max(0.15, avgGoals * (effAway / total));
    const homeScore = poisson(lh);
    const awayScore = poisson(la);
    let homePens = null, awayPens = null;
    if (needsWinner && homeScore === awayScore) {
      const p = simulatePenalties(homeTeam, awayTeam);
      homePens = p.home;
      awayPens = p.away;
    }
    return { homeScore, awayScore, homePens, awayPens };
  }

  function simulatePenalties(team1, team2) {
    // Each team takes up to 5 kicks; each kick ~72% chance of scoring, adjusted by level
    const diff = (team1.level - team2.level) / 200; // -0.5 to 0.5
    const p1 = Math.max(0.5, Math.min(0.9, 0.72 + diff));
    const p2 = Math.max(0.5, Math.min(0.9, 0.72 - diff));
    let g1 = 0, g2 = 0;
    for (let i = 0; i < 5; i++) {
      if (Math.random() < p1) g1++;
      if (Math.random() < p2) g2++;
    }
    // Sudden death
    let sd = 0;
    while (g1 === g2 && sd < 15) {
      sd++;
      const s1 = Math.random() < p1;
      const s2 = Math.random() < p2;
      if (s1 && !s2) { g1++; break; }
      if (!s1 && s2) { g2++; break; }
      if (s1 && s2) { g1++; g2++; }
    }
    if (g1 === g2) g1++; // force winner after extreme SD
    return { home: g1, away: g2 };
  }

  return { simulateMatch, simulatePenalties };
})();
