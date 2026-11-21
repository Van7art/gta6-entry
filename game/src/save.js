// save.js — save / load through localStorage: cash, street rep, completed
// missions, the player's position and car, the clock, the full garage
// (performance stages, paint, wheels, spoiler), the weapon wheel state
// and the radio/mute settings. Autosaves after every completed mission,
// every garage purchase and on pause.
import { SAVE_KEY, ECONOMY } from './config.js';
import { defaultGarage } from './upgrades.js';
import { defaultWeaponState } from './weapons.js';

export function defaultSave() {
  return {
    cash: ECONOMY.startCash,
    rep: 0,
    missionsDone: [],
    playerX: 6, playerZ: 72, heading: 0,
    carType: null, carX: 0, carZ: 0, carHeading: 0,
    clockMinutes: 18 * 60 + 47,
    upgrades: defaultGarage(),
    weapons: defaultWeaponState(),
    settings: { station: 0, muted: false },
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    const merged = { ...defaultSave(), ...data };
    merged.upgrades = { ...defaultGarage(), ...(data.upgrades || {}) };
    merged.weapons = { ...defaultWeaponState(), ...(data.weapons || {}) };
    merged.settings = { ...defaultSave().settings, ...(data.settings || {}) };
    return merged;
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
