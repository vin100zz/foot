// ui.js - All UI rendering and event handling
const UIModule = (() => {

  // ======================== HELPERS ========================

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function teamDot(team) {
    const c = team?.primaryColor || '888888';
    return `<span class="dot" style="background:#${esc(c)}"></span>`;
  }

  function teamLabel(name, allTeams) {
    const t = allTeams.find(x => x.name === name);
    return `${teamDot(t)}<span class="tname">${esc(name)}</span>`;
  }

  // ======================== MATCH ROW ========================

  function renderMatchRow(match, allTeams, { simBtn = true, label = '' } = {}) {
    const done = match.homeScore !== null;
    const hc = (allTeams.find(t => t.name === match.home)?.primaryColor) || '888';
    const ac = (allTeams.find(t => t.name === match.away)?.primaryColor) || '888';
    const hwin = done && match.homeScore > match.awayScore;
    const awin = done && match.awayScore > match.homeScore;
    const pens = match.homePens !== null ? ` <span class="pens">(${match.homePens}-${match.awayPens} tab)</span>` : '';
    return `
<div class="match-row${done ? ' done' : ''}" data-match-id="${match.id}">
  ${label ? `<span class="match-label">${label}</span>` : ''}
  <span class="team home${hwin ? ' winner' : ''}"><span class="dot" style="background:#${esc(hc)}"></span>${esc(match.home)}</span>
  <input type="number" class="score-input" data-match-id="${match.id}" data-side="home" value="${done ? match.homeScore : ''}" min="0" max="99" placeholder="-">
  <span class="sep">:</span>
  <input type="number" class="score-input" data-match-id="${match.id}" data-side="away" value="${done ? match.awayScore : ''}" min="0" max="99" placeholder="-">
  <span class="team away${awin ? ' winner' : ''}"><span class="dot" style="background:#${esc(ac)}"></span>${esc(match.away)}</span>
  ${simBtn ? `<button class="btn-sim" data-action="sim-match" data-match-id="${match.id}" title="Simuler">▶</button>` : ''}${pens}
</div>`;
  }

  // ======================== STANDINGS ========================

  function renderStandings(standings, { title = '', highlights = [], allTeams = [] } = {}) {
    const rows = standings.map((s, i) => {
      const hl = highlights.find(h => h.from <= i + 1 && i + 1 <= h.to);
      const style = hl ? ` style="border-left:3px solid ${hl.color}"` : '';
      const t = allTeams.find(x => x.name === s.name);
      const dot = t ? `<span class="dot" style="background:#${esc(t.primaryColor)}"></span> ` : '';
      return `<tr${style}><td class="r">${i+1}</td><td class="tn" title="${esc(s.name)}${t ? ' ('+t.level+')' : ''}">${dot}${esc(s.name)}</td><td>${s.played}</td><td>${s.won}</td><td>${s.drawn}</td><td>${s.lost}</td><td>${s.gf}</td><td>${s.ga}</td><td>${s.gd >= 0 ? '+' : ''}${s.gd}</td><td class="pts">${s.pts}</td></tr>`;
    }).join('');
    return `${title ? `<div class="section-title">${title}</div>` : ''}
<table class="standings">
<thead><tr><th>#</th><th>Équipe</th><th>J</th><th>G</th><th>N</th><th>P</th><th>BM</th><th>BE</th><th>DB</th><th>Pts</th></tr></thead>
<tbody>${rows}</tbody>
</table>`;
  }

  // ======================== TIE (knockout) ========================

  function renderTie(tie, legs, allTeams) {
    const done = !!tie.winner;
    const l1 = tie.leg1;
    const l2 = tie.leg2;
    let agg = '';
    if (legs === 2 && l1 && l1.homeScore !== null && l2 && l2.homeScore !== null) {
      const a1 = l1.homeScore + l2.awayScore;
      const a2 = l1.awayScore + l2.homeScore;
      const pens = l2.homePens !== null ? ` <span class="pens">(${l2.homePens}-${l2.awayPens} tab)</span>` : '';
      agg = `<div class="agg">Agg&nbsp;: <strong>${esc(tie.team1)}</strong>&nbsp;${a1}–${a2}&nbsp;<strong>${esc(tie.team2)}</strong>${done ? ` → <em>${esc(tie.winner)}</em>` : ''}${pens}</div>`;
    } else if (legs === 1 && done) {
      agg = `<div class="agg">→ <em>${esc(tie.winner)}</em></div>`;
    } else if (legs === 2 && l1 && l1.homeScore !== null) {
      agg = `<div class="agg" style="color:var(--text2)">Match retour à jouer…</div>`;
    }

    const leg1Html = l1
      ? renderMatchRow(l1, allTeams, { label: legs === 2 ? 'M1' : '' })
      : `<div class="match-row pending">${esc(tie.team1 || '?')} – ${esc(tie.team2 || '?')}</div>`;
    const leg2Html = legs === 2
      ? (l2 ? renderMatchRow(l2, allTeams, { label: 'M2' }) : `<div class="match-row pending" style="opacity:.4">${esc(tie.team2||'?')} – ${esc(tie.team1||'?')} (retour)</div>`)
      : '';

    return `<div class="tie${done ? ' done' : ''}">
  ${leg1Html}${leg2Html}${agg}
</div>`;
  }

  // ======================== LEAGUE VIEW ========================

  function renderLeague(comp, allTeams) {
    const standings = CompetitionModule.computeLeagueStandings(comp.teams, comp.rounds.flatMap(r => r.matches));
    const standingsHL = [];

    const roundsHtml = comp.rounds.map(r => {
      const allDone = r.matches.every(m => m.homeScore !== null);
      return `<div class="round${allDone ? ' done' : ''}">
  <div class="round-header">
    <span class="round-name">${esc(r.name)}</span>
    ${!allDone ? `<button class="btn-sim-round btn-xs" data-action="sim-round" data-round="${r.round}">Simuler tout</button>` : ''}
  </div>
  ${r.matches.map(m => renderMatchRow(m, allTeams)).join('')}
</div>`;
    }).join('');

    return `<div class="comp-layout league-layout">
  <div class="standings-panel">
    ${renderStandings(standings, { title: 'Classement', highlights: standingsHL, allTeams })}
  </div>
  <div class="rounds-panel">${roundsHtml}</div>
</div>`;
  }

  // ======================== CUP VIEW ========================

  function renderKnockoutRounds(knockoutRounds, allTeams) {
    return knockoutRounds.map((r, ri) => {
      const allDone = r.ties.every(t => t.winner);
      const anyPending = r.ties.some(t => !t.winner);
      return `<div class="ko-round${allDone ? ' done' : ''}">
  <div class="round-header">
    <span class="round-name">${esc(r.name)}</span>
    ${anyPending ? `<button class="btn-xs btn-sim-round" data-action="sim-ko-round" data-round-idx="${ri}">Simuler tout</button>` : ''}
  </div>
  ${r.ties.map(t => renderTie(t, r.legs, allTeams)).join('')}
</div>`;
    }).join('');
  }

  function renderCup(comp, allTeams) {
    const curRound = comp.knockoutRounds[comp.currentRound];
    const curDone = curRound && curRound.ties.every(t => t.winner);
    const isFinal = curDone && curRound.ties.length === 1;
    const canAdvance = curDone && !isFinal;
    const winner = isFinal ? curRound.ties[0].winner : null;
    return `<div class="comp-layout cup-layout">
  <div class="ko-panel">
    ${renderKnockoutRounds(comp.knockoutRounds, allTeams)}
  </div>
  ${canAdvance ? `<div class="advance-bar"><button class="btn-primary" data-action="advance-phase">Tour suivant →</button></div>` : ''}
  ${winner ? `<div class="advance-bar" style="color:#ffd700;font-size:14px;font-weight:700">🏆 Vainqueur : ${esc(winner)}</div>` : ''}
</div>`;
  }

  // ======================== GROUP + CUP VIEW ========================

  function renderGroupCup(comp, allTeams) {
    const groupsHtml = comp.groups.map((g, gi) => {
      const standings = CompetitionModule.computeLeagueStandings(g.teams, g.matches);
      const q = comp.config.qualifiersPerGroup;
      const hl = [{ from: 1, to: q, color: '#4caf50' }];
      const rounds = {};
      g.matches.forEach(m => { (rounds[m.round] = rounds[m.round] || []).push(m); });

      const matchesHtml = Object.entries(rounds).map(([rn, ms]) => {
        const allDone = ms.every(m => m.homeScore !== null);
        return `<div class="group-round${allDone ? ' done' : ''}">
    <span class="round-mini">J${rn}</span>
    ${ms.map(m => renderMatchRow(m, allTeams, { simBtn: true })).join('')}
  </div>`;
      }).join('');

      const anyUnplayed = g.matches.some(m => m.homeScore === null);
      return `<div class="group-block">
  <div class="group-header">
    <strong>${esc(g.name)}</strong>
    ${anyUnplayed ? `<button class="btn-xs btn-sim-round" data-action="sim-group" data-group-idx="${gi}">Simuler</button>` : ''}
  </div>
  <div class="group-body">
    <div class="group-standings">${renderStandings(standings, { highlights: hl, allTeams })}</div>
    <div class="group-matches">${matchesHtml}</div>
  </div>
</div>`;
    }).join('');

    const allGroupsDone = comp.groups.every(g => g.matches.every(m => m.homeScore !== null));

    let koHtml = '';
    if (comp.phase === 'KNOCKOUT') {
      const lastRound = comp.knockoutRounds[comp.knockoutRounds.length - 1];
      const winner = lastRound?.ties.length === 1 && lastRound.ties[0].winner ? lastRound.ties[0].winner : null;
      const canAdvanceKO = !winner && comp.knockoutRounds[comp.currentRound]?.ties.every(t => t.winner);
      koHtml = `<div class="ko-section">
  <div class="section-title">Phase à élimination directe</div>
  ${renderKnockoutRounds(comp.knockoutRounds, allTeams)}
  ${canAdvanceKO ? `<div class="advance-bar"><button class="btn-primary" data-action="advance-phase">Tour suivant →</button></div>` : ''}
  ${winner ? `<div class="advance-bar winner-banner">🏆 Vainqueur : ${esc(winner)}</div>` : ''}
</div>`;
    } else if (allGroupsDone) {
      koHtml = `<div class="advance-bar"><button class="btn-primary" data-action="advance-phase">Passer à la phase éliminatoire</button></div>`;
    }

    return `<div class="comp-layout groupcup-layout">
  <div class="groups-panel">${groupsHtml}</div>
  ${koHtml}
</div>`;
  }

  // ======================== UCL VIEW ========================

  function renderUCLPots(comp, allTeams) {
    if (!comp.pots) return '';
    const potNames = ['Chapeau 1', 'Chapeau 2', 'Chapeau 3', 'Chapeau 4'];
    const potsHtml = comp.pots.map((pot, i) => {
      const rows = pot.map(name => {
        const t = allTeams.find(x => x.name === name);
        return `<div class="team-row" style="pointer-events:none">
          ${t ? `<span class="dot" style="background:#${esc(t.primaryColor)}"></span>` : ''}
          <span class="tname">${esc(name)}</span>
          ${t ? `<span class="level">${t.level}</span>` : ''}
        </div>`;
      }).join('');
      return `<div class="pot-block">
        <div class="list-header">${potNames[i]}</div>
        ${rows}
      </div>`;
    }).join('');
    return `<div class="ucl-pots">
      <div class="section-title">Chapeaux</div>
      <div class="pots-grid">${potsHtml}</div>
    </div>`;
  }

  function renderUCL(comp, allTeams) {
    let content = '';
    content += renderUCLPots(comp, allTeams);

    if (comp.phase === 'LEAGUE' || comp.uclStandings) {
      const matches = comp.leaguePhaseMatches;
      const standings = comp.uclStandings || CompetitionModule.getUCLStandings(comp.teams, matches);
      const hl = [
        { from: 1, to: 8, color: '#4caf50' },
        { from: 9, to: 24, color: '#ff9800' },
        { from: 25, to: 32, color: '#f44336' }
      ];

      // Group matches by round
      const byRound = {};
      matches.forEach(m => { (byRound[m.round] = byRound[m.round] || []).push(m); });
      const roundsHtml = Object.entries(byRound).sort((a,b) => +a[0]-+b[0]).map(([rn, ms]) => {
        const allDone = ms.every(m => m.homeScore !== null);
        return `<div class="round${allDone ? ' done' : ''}">
  <div class="round-header">
    <span class="round-name">Journée ${rn}</span>
    ${!allDone ? `<button class="btn-xs btn-sim-round" data-action="sim-ucl-round" data-round="${rn}">Simuler</button>` : ''}
  </div>
  ${ms.map(m => renderMatchRow(m, allTeams)).join('')}
</div>`;
      }).join('');

      content += `<div class="ucl-league-phase">
  <div class="section-title">Phase de ligue</div>
  <div class="ucl-lp-body">
    <div class="standings-panel">${renderStandings(standings, { highlights: hl, allTeams })}</div>
    <div class="rounds-panel">${roundsHtml}</div>
  </div>
</div>`;

      if (comp.phase === 'LEAGUE' && matches.every(m => m.homeScore !== null)) {
        content += `<div class="advance-bar"><button class="btn-primary" data-action="advance-phase">Calculer le classement et établir les barrages</button></div>`;
      }
    }

    if (comp.phase === 'PLAYOFF' || comp.phase === 'KNOCKOUT') {
      content += `<div class="ucl-playoff">
  <div class="section-title">Barrages</div>
  <div class="ko-panel">`;
      const allPODone = comp.playoffTies.every(t => t.winner);
      if (!allPODone) content += `<div class="round-header"><button class="btn-xs btn-sim-round" data-action="sim-ucl-playoff">Simuler tous les barrages</button></div>`;
      comp.playoffTies.forEach(t => { content += renderTie(t, 2, allTeams); });
      content += `</div>`;
      if (comp.phase === 'PLAYOFF' && allPODone) {
        content += `<div class="advance-bar"><button class="btn-primary" data-action="advance-phase">Établir les 1/8 de finale</button></div>`;
      }
      content += `</div>`;
    }

    if (comp.phase === 'KNOCKOUT' && comp.knockoutRounds.length) {
      const lastRound = comp.knockoutRounds[comp.knockoutRounds.length - 1];
      const winner = lastRound?.ties.length === 1 && lastRound.ties[0].winner ? lastRound.ties[0].winner : null;
      const canAdvanceKO = !winner && comp.knockoutRounds[comp.currentRound]?.ties.every(t => t.winner);
      content += `<div class="ucl-knockout">
  <div class="section-title">Phase à élimination directe</div>
  <div class="ko-panel">${renderKnockoutRounds(comp.knockoutRounds, allTeams)}</div>
  ${canAdvanceKO ? `<div class="advance-bar"><button class="btn-primary" data-action="advance-phase">Tour suivant →</button></div>` : ''}
  ${winner ? `<div class="advance-bar winner-banner">🏆 Vainqueur : ${esc(winner)}</div>` : ''}
</div>`;
    }

    return `<div class="comp-layout ucl-layout">${content}</div>`;
  }

  // ======================== COMPETITION VIEW ========================

  function renderCompetitionHeader(comp, confirmNew = false) {
    const fmtNames = { LEAGUE: 'Championnat', CUP: 'Coupe', GROUP_CUP: 'Poules + Coupe', UCL: 'Format Ligue des Champions' };
    const newBtn = confirmNew
      ? `<span class="confirm-bar">Effacer la compétition en cours ?
          <button class="btn-danger btn-xs" data-action="new-competition-confirm">Oui, effacer</button>
          <button class="btn-secondary btn-xs" data-action="new-competition-cancel">Annuler</button>
        </span>`
      : `<button class="btn-danger btn-xs" data-action="new-competition">✕ Nouvelle</button>`;
    return `<div class="comp-header">
  <div class="comp-title">
    <h2>${esc(comp.name)}</h2>
    <span class="badge-format">${fmtNames[comp.format] || comp.format}</span>
    <span class="badge-teams">${comp.teams.length} équipes</span>
  </div>
  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
    <button class="btn-secondary btn-xs" data-action="sim-all" title="Simuler tous les matches restants">⚡ Simuler tout</button>
    ${newBtn}
  </div>
</div>`;
  }

  function renderCompetition(comp, allTeams, { confirmNew = false } = {}) {
    let body;
    switch (comp.format) {
      case 'LEAGUE': body = renderLeague(comp, allTeams); break;
      case 'CUP': body = renderCup(comp, allTeams); break;
      case 'GROUP_CUP': body = renderGroupCup(comp, allTeams); break;
      case 'UCL': body = renderUCL(comp, allTeams); break;
      default: body = `<p>Format inconnu</p>`;
    }
    return renderCompetitionHeader(comp, confirmNew) + body;
  }

  // ======================== SETUP VIEW ========================

  function renderSetupStep1() {
    return `<div class="setup-panel">
<h3>Nouvelle compétition</h3>
<div class="setup-section">
  <label>Type d'équipes</label>
  <div class="btn-group">
    <button class="btn-choice" data-action="set-team-type" data-value="NATION">🌍 Nations</button>
    <button class="btn-choice" data-action="set-team-type" data-value="CLUB">🏟 Clubs</button>
  </div>
</div>
<div class="setup-section">
  <label>Format</label>
  <div class="format-grid">
    <button class="btn-format" data-action="set-format" data-value="LEAGUE">
      <strong>Championnat</strong><small>Chaque équipe joue contre toutes les autres</small>
    </button>
    <button class="btn-format" data-action="set-format" data-value="CUP">
      <strong>Coupe</strong><small>Élimination directe avec têtes de série</small>
    </button>
    <button class="btn-format" data-action="set-format" data-value="GROUP_CUP">
      <strong>Poules + Coupe</strong><small>Phase de poules puis élimination directe</small>
    </button>
    <button class="btn-format" data-action="set-format" data-value="UCL">
      <strong>Format UEFA</strong><small>32 équipes – phase de ligue + barrages + coupe</small>
    </button>
  </div>
</div>
</div>`;
  }

  function renderConfigField(id, label, type, value, attrs = '') {
    return `<div class="config-row">
  <label for="${id}">${label}</label>
  <input type="${type}" id="${id}" name="${id}" value="${value}" ${attrs}>
</div>`;
  }

  function renderSelectField(id, label, options, value) {
    const opts = options.map(([v, l]) => `<option value="${v}"${v == value ? ' selected' : ''}>${l}</option>`).join('');
    return `<div class="config-row"><label for="${id}">${label}</label><select id="${id}" name="${id}">${opts}</select></div>`;
  }

  function renderSetupStep2(setup) {
    const f = setup.format;
    const fmtNames = { LEAGUE: 'Championnat', CUP: 'Coupe', GROUP_CUP: 'Poules + Coupe', UCL: 'Format UEFA' };
    let fields = '';
    const cfg = setup.config;

    // Competition name field (always shown)
    const defaultName = setup.compName || { LEAGUE: 'Championnat', CUP: 'Coupe', GROUP_CUP: 'Compétition', UCL: 'Ligue des Champions' }[f] + ' ' + new Date().getFullYear();
    fields += `<div class="config-row">
  <label for="comp-name">Nom de la compétition</label>
  <input type="text" id="comp-name" name="comp-name" value="${esc(defaultName)}" style="width:200px">
</div>`;

    if (f === 'LEAGUE') {
      fields += renderSelectField('legs', 'Matches', [['1','Match simple'],['2','Aller-retour']], cfg.legs || 2);
    } else if (f === 'CUP') {
      fields += renderSelectField('legs', 'Format', [['1','Match simple'],['2','Aller-retour']], cfg.legs || 1);
      fields += renderConfigField('seedCount', 'Têtes de série', 'number', cfg.seedCount ?? 0, 'min="0" max="64"');
    } else if (f === 'GROUP_CUP') {
      fields += renderSelectField('numGroups', 'Nombre de poules', [['2','2'],['4','4'],['8','8']], cfg.numGroups || 8);
      fields += renderConfigField('teamsPerGroup', 'Équipes par poule', 'number', cfg.teamsPerGroup || 4, 'min="3" max="8"');
      fields += renderSelectField('qualifiersPerGroup', 'Qualifiés par poule', [['1','1'],['2','2'],['4','4']], cfg.qualifiersPerGroup || 2);
      fields += renderSelectField('knockoutLegs', 'Phase éliminatoire', [['1','Match simple'],['2','Aller-retour']], cfg.knockoutLegs || 2);
      const nGroups = cfg.numGroups || 8;
      const tpg = cfg.teamsPerGroup || 4;
      fields += `<div class="config-info">Total équipes requis : ${nGroups * tpg}</div>`;
    } else if (f === 'UCL') {
      fields += `<div class="config-info">Format fixe : 32 équipes — phase de ligue (8 journées), barrages (9e–24e), puis élimination directe aller-retour.</div>`;
    }

    return `<div class="setup-panel">
<h3>Configuration — ${fmtNames[f] || f}</h3>
<form id="config-form">
${fields}
<div class="setup-actions">
  <button type="button" data-action="setup-back" class="btn-secondary">← Retour</button>
  <button type="submit" data-action="config-next" class="btn-primary">Suivant →</button>
</div>
</form>
</div>`;
  }

  function renderSetupStep3(setup, allTeams) {
    const f = setup.format;
    const cfg = setup.config;
    let required = 0;
    if (f === 'LEAGUE' || f === 'CUP') required = setup.teamCount || 16;
    else if (f === 'GROUP_CUP') required = (cfg.numGroups || 8) * (cfg.teamsPerGroup || 4);
    else if (f === 'UCL') required = 32;

    const type = setup.teamType;
    const available = DataModule.getTeams(type);
    const feds = DataModule.getFederations(type);
    const selected = new Set(setup.selectedTeams.map(t => t.name));
    const filtered = DataModule.filterTeams(available, {
      federation: setup.filter?.federation || null,
      nameSearch: setup.filter?.search || ''
    }).filter(t => !selected.has(t.name));

    const need = required - selected.size;
    const fedOptions = ['<option value="">Toutes fédérations</option>',
      ...feds.map(f => `<option value="${esc(f)}"${setup.filter?.federation === f ? ' selected' : ''}>${esc(f)}</option>`)
    ].join('');

    const teamRows = filtered.slice(0, 100).map(t =>
      `<div class="team-row" data-action="select-team" data-team="${esc(t.name)}">
    <span class="dot" style="background:#${esc(t.primaryColor)}"></span>
    <span class="tname">${esc(t.name)}</span>
    <span class="level">${t.level}</span>
    <span class="fed">${esc(t.federation)}</span>
  </div>`
    ).join('');

    const selectedRows = [...selected].map(n => {
      const t = allTeams.find(x => x.name === n);
      return `<div class="team-row selected" data-action="deselect-team" data-team="${esc(n)}">
    ${t ? `<span class="dot" style="background:#${esc(t.primaryColor)}"></span>` : ''}
    <span class="tname">${esc(n)}</span>
    ${t ? `<span class="level">${t.level}</span>` : ''}
    <span class="remove">✕</span>
  </div>`;
    }).join('');

    const canCreate = selected.size === required;

    return `<div class="setup-panel wide">
<h3>Sélection des équipes (${selected.size}/${required})</h3>
<div class="team-selector">
  <div class="team-filters">
    <select id="filter-fed" data-action="filter-fed">${fedOptions}</select>
    <input type="text" id="filter-search" placeholder="Rechercher..." value="${esc(setup.filter?.search || '')}" data-action="filter-search">
    <button class="btn-xs btn-secondary" data-action="add-best" data-count="${need}">+ ${need} meilleurs</button>
    <button class="btn-xs btn-secondary" data-action="add-random" data-count="${need}">+ ${need} aléatoire</button>
  </div>
  <div class="team-lists">
    <div class="available-list">
      <div class="list-header">Disponibles (${filtered.length})</div>
      <div class="team-list-scroll">${teamRows}${filtered.length > 100 ? '<div class="list-more">Affiner la recherche pour voir plus...</div>' : ''}</div>
    </div>
    <div class="selected-list">
      <div class="list-header">Sélectionnées (${selected.size}/${required})</div>
      <div class="team-list-scroll">${selectedRows}</div>
    </div>
  </div>
</div>
<div class="setup-actions">
  <button data-action="setup-back" class="btn-secondary">← Retour</button>
  ${f !== 'UCL' && f !== 'GROUP_CUP' ? `<label style="font-size:11px;color:var(--text2)">N équipes : <select id="team-count" data-action="change-team-count">${[[4,'4'],[8,'8'],[16,'16'],[32,'32'],[64,'64']].map(([v,l]) => `<option value="${v}"${v == required ? ' selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
  <button data-action="create-competition" class="btn-primary"${canCreate ? '' : ` disabled title="Sélectionnez exactement ${required} équipes (${selected.size} sélectionnées)"`}>Créer la compétition</button>
</div>
</div>`;
  }

  function renderSetup(setup, allTeams) {
    if (!setup.step || setup.step === 1) return renderSetupStep1();
    if (setup.step === 2) return renderSetupStep2(setup);
    if (setup.step === 3) return renderSetupStep3(setup, allTeams);
    return renderSetupStep1();
  }

  // ======================== MAIN RENDER ========================

  function render(state) {
    const root = document.getElementById('app-root');
    const scroll = window.scrollY;
    if (!state.competition) {
      root.innerHTML = renderSetup(state.setup || {}, state.allTeams || []);
    } else {
      root.innerHTML = renderCompetition(state.competition, state.allTeams || [], { confirmNew: state._confirmNew });
    }
    window.scrollTo(0, scroll);
  }

  return { render };
})();
