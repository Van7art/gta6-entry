// save.js — save / load through localStorage: money, rep, mission progress,
// player position and health, collected coins. Auto-saves after every
// mission and offers Continue on the title screen.
import { G } from './state.js';
import { SAVE_KEY } from './config.js';
import { startMission } from './missions.js';

export function saveGame(silent) {
  try {
    const data = {
      version: 1,
      money: G.money,
      respect: G.respect,
      missionIndex: G.missionIndex,
      missionsDone: G.missionsDone,
      kills: G.kills,
      carsStolen: G.carsStolen,
      health: G.player.health,
      pos: { x: G.player.pos.x, y: 0, z: G.player.pos.z },
      coins: G.coins.filter((c) => c.taken).map((c) => c.id),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    if (!silent) G.banner = 'Game disimpan';
    if (!silent) G.bannerTimer = 2;
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function applySave(data) {
  if (!data) return false;
  G.money = data.money ?? G.money;
  G.respect = data.respect ?? 0;
  G.missionIndex = data.missionIndex ?? 0;
  G.missionsDone = data.missionsDone ?? 0;
  G.kills = data.kills ?? 0;
  G.carsStolen = data.carsStolen ?? 0;
  G.player.health = data.health ?? 100;
  if (data.pos) G.player.pos.set(data.pos.x, 0, data.pos.z);
  if (Array.isArray(data.coins)) {
    for (const coin of G.coins) {
      if (data.coins.includes(coin.id)) {
        coin.taken = true;
        coin.mesh.visible = false;
      }
    }
  }
  return true;
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
}
