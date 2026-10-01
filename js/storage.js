// storage.js - LocalStorage persistence
const StorageModule = (() => {
  const COMP_KEY = 'footsim_competition';
  const SETUP_KEY = 'footsim_setup';

  function saveCompetition(comp) {
    try {
      localStorage.setItem(COMP_KEY, JSON.stringify(comp));
    } catch (e) {
      console.error('Save failed:', e);
    }
  }

  function loadCompetition() {
    try {
      const raw = localStorage.getItem(COMP_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearCompetition() {
    localStorage.removeItem(COMP_KEY);
  }

  function saveSetup(setup) {
    try {
      localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
    } catch (e) {}
  }

  function loadSetup() {
    try {
      const raw = localStorage.getItem(SETUP_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearSetup() {
    localStorage.removeItem(SETUP_KEY);
  }

  return { saveCompetition, loadCompetition, clearCompetition, saveSetup, loadSetup, clearSetup };
})();
