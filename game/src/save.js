// save.js — save / load through localStorage: cash, street rep, completed
// missions, the player's position and car, and the clock. Autosaves after
// every completed mission and on pause.
import { SAVE_KEY, ECONOMY } from './config.js';

export function defaultSave() {
  return {
    cash: ECONOMY.startCash,
    rep: 0,
    missionsDone: [],
    playerX: 6, playerZ: 72, heading: 0,
    carType: null, carX: 0, carZ: 0, carHeading: 0,
    clockMinutes: 18 * 60 + 47,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    return { ...defaultSave(), ...data };
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* private mode */ }
}
