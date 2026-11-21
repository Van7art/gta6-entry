// Save / load through localStorage. Autosaves on job complete, purchase, pause, and every 30s.
const KEY = 'portoVerdeSaveV1';

export function saveGame(g) {
  try {
    const data = {
      v: 1,
      cash: g.cash,
      rep: g.rep,
      missionIndex: g.missionIndex,
      missionsDone: g.missionsDone,
      garage: g.garage,
      weapons: { slot: g.weapons.slot, mags: g.weapons.mags, reserve: g.weapons.reserve },
      radio: { station: g.radio.station, muted: g.radio.muted },
      player: { x: g.player.x, y: g.player.y, angle: g.player.angle, hp: g.player.hp, onFoot: g.player.onFoot },
      car: g.car ? { x: g.car.x, y: g.car.y, angle: g.car.angle, hp: g.car.hp, color: g.car.color } : null,
      clockMin: g.clockMin,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return !!loadSave();
}

export function applySave(g, data) {
  g.cash = data.cash;
  g.rep = data.rep;
  g.missionIndex = data.missionIndex || 0;
  g.missionsDone = data.missionsDone || [];
  g.garage = { ...g.garage, ...data.garage };
  g.weapons.slot = data.weapons.slot || 0;
  g.weapons.mags = data.weapons.mags || [12, 30, 6];
  g.weapons.reserve = data.weapons.reserve ?? 60;
  g.radio.station = data.radio.station || 0;
  g.radio.muted = !!data.radio.muted;
  g.clockMin = data.clockMin || 18 * 60 + 47;
  g.player.x = data.player.x;
  g.player.y = data.player.y;
  g.player.angle = data.player.angle;
  g.player.hp = data.player.hp;
  g.player.onFoot = data.player.onFoot;
  return data;
}
