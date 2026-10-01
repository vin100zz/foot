// data.js - Team data loading and filtering
const DataModule = (() => {
  let allTeams = [];

  function parseCSV(text) {
    const lines = text.trim().split('\n');
    const teams = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split(',');
      if (parts.length < 6) continue;
      const [type, name, federation, level, primaryColor, secondaryColor] = parts;
      if (type === 'type') continue; // skip header row
      teams.push({
        type: type.trim(),
        name: name.trim(),
        federation: federation.trim(),
        level: parseInt(level.trim(), 10),
        primaryColor: primaryColor.trim(),
        secondaryColor: secondaryColor.trim()
      });
    }
    return teams;
  }

  async function loadTeams() {
    // Data is inlined in teams-data.js as TEAMS_CSV constant — no fetch needed
    allTeams = parseCSV(TEAMS_CSV);
    return allTeams;
  }

  function getTeams(type = null) {
    if (!type) return [...allTeams];
    return allTeams.filter(t => t.type === type);
  }

  function filterTeams(teams, { federation, nameSearch } = {}) {
    return teams.filter(t => {
      if (federation && t.federation !== federation) return false;
      if (nameSearch && !t.name.toLowerCase().includes(nameSearch.toLowerCase())) return false;
      return true;
    });
  }

  function getTopN(teams, n) {
    return [...teams].sort((a, b) => b.level - a.level).slice(0, n);
  }

  function getRandomN(teams, n) {
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  function getTeamByName(name) {
    return allTeams.find(t => t.name === name);
  }

  function getFederations(type = null) {
    const teams = type ? allTeams.filter(t => t.type === type) : allTeams;
    return [...new Set(teams.map(t => t.federation))].sort();
  }

  return { loadTeams, getTeams, filterTeams, getTopN, getRandomN, getTeamByName, getFederations };
})();
