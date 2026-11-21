// Eight chained story jobs from Mara Voss. Each mission is a small state machine:
// setup places its target, update checks progress, complete pays out (+25 REP).
import { GARAGE_POS } from './state.js';
import { dist } from './util.js';
import { collideBuildings } from './city.js';
import { makeCar, damageCar } from './vehicles.js';
import { rankFor } from './state.js';

export const MISSION_DEFS = [
  { title: '1 · First Keys', brief: 'Steal any car and bring it to Cross Motors.', pay: 150 },
  { title: '2 · Beach Run', brief: 'Get the package to the beach in 2:30.', pay: 400 },
  { title: '3 · Hot Wheels', brief: 'Steal the Comet at the docks. The docks are watched.', pay: 600 },
  { title: '4 · Payback', brief: "Ram Rico's sedan until it stops moving.", pay: 700 },
  { title: '5 · Night Shift', brief: 'Drive Mara to three drops across the city.', pay: 800 },
  { title: '6 · Golden Getaway', brief: 'Lose a 4-star chase and reach the hills hideout.', pay: 1000 },
  { title: '7 · The Vault', brief: 'Deal with the guards, grab the cash, deliver it.', pay: 1200 },
  { title: '8 · Street King', brief: 'Outrun Air One. Deliver the ledger to the lighthouse.', pay: 2000 },
];

const DROPS = [
  { x: 200, y: 200, label: 'Drop 1 — North Hills' },
  { x: 2200, y: 600, label: 'Drop 2 — East Docks' },
  { x: 600, y: 1400, label: 'Drop 3 — South Row' },
];

export function startMission(g, idx) {
  const def = MISSION_DEFS[idx];
  const m = { idx, def, stage: 0, timer: 0, marker: null, extra: {} };
  if (idx === 0) {
    m.marker = { x: GARAGE_POS.x, y: GARAGE_POS.y, label: 'Cross Motors' };
  } else if (idx === 1) {
    m.timer = 150;
    m.marker = { x: 1200, y: 1560, label: 'Beach package point' };
  } else if (idx === 2) {
    const comet = makeCar(2150, 300, -Math.PI / 2, { color: '#e74c3c', kind: 'sport', top: 420, hp: 140 });
    g.cars.push(comet);
    m.extra.comet = comet;
    m.marker = { x: 2150, y: 300, label: 'The Comet — East Docks' };
  } else if (idx === 3) {
    const sedan = makeCar(1400, 1000, 0, { color: '#8e44ad', kind: 'sedan', top: 330, hp: 120 });
    g.cars.push(sedan);
    m.extra.sedan = sedan;
    m.marker = { x: 1400, y: 1000, label: "Rico's sedan" };
  } else if (idx === 4) {
    m.marker = { x: DROPS[0].x, y: DROPS[0].y, label: DROPS[0].label };
  } else if (idx === 5) {
    g.wanted = 4;
    m.timer = 90;
    m.marker = { x: 200, y: 200, label: 'Hills hideout' };
  } else if (idx === 6) {
    const van = makeCar(1800, 1000, Math.PI, { color: '#e8e8e8', kind: 'van', top: 260, hp: 160 });
    g.cars.push(van);
    m.extra.van = van;
    m.extra.guards = [];
    for (let i = 0; i < 3; i++) {
      const gp = { x: 1800 + (i - 1) * 44, y: 960, angle: 0, speed: 0, color: '#2c3e50', state: 'guard', fleeX: 0, fleeY: 0, timer: 99, hp: 34 };
      g.peds.push(gp);
      m.extra.guards.push(gp);
    }
    m.marker = { x: 1800, y: 1000, label: 'Cash van — guarded' };
  } else if (idx === 7) {
    g.wanted = 5;
    m.marker = { x: 2250, y: 1560, label: 'Lighthouse — deliver the ledger' };
  }
  g.mission = m;
  g.toast = def.title + ' — ' + def.brief;
  if (g.audio) g.audio.mission();
}

export function updateMission(g, dt) {
  const m = g.mission;
  if (!m) return;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(g, 'Out of time.'); return; }
  }
  const px = g.player.x;
  const py = g.player.y;
  switch (m.idx) {
    case 0: {
      if (g.car && dist(px, py, GARAGE_POS.x, GARAGE_POS.y) < 130) completeMission(g);
      else if (g.car) m.marker = { x: GARAGE_POS.x, y: GARAGE_POS.y, label: 'Cross Motors — bring the car here' };
      else m.marker = { x: px, y: py, label: 'Steal a car first (E)' };
      break;
    }
    case 1: {
      if (dist(px, py, 1200, 1560) < 60) completeMission(g);
      break;
    }
    case 2: {
      const comet = m.extra.comet;
      if (comet.dead) { failMission(g, 'The Comet was wrecked.'); break; }
      if (!m.extra.stolen && g.car === comet) {
        m.extra.stolen = true;
        g.wanted = Math.max(g.wanted, 2);
        g.toast = 'The Comet is yours — and the docks are calling it in!';
        m.marker = { x: GARAGE_POS.x, y: GARAGE_POS.y, label: 'Cross Motors' };
      }
      if (m.extra.stolen && dist(px, py, GARAGE_POS.x, GARAGE_POS.y) < 130) completeMission(g);
      break;
    }
    case 3: {
      const sedan = m.extra.sedan;
      if (sedan.dead) { completeMission(g); break; }
      // The sedan flees the player.
      const away = Math.atan2(sedan.y - py, sedan.x - px);
      sedan.angle = away;
      sedan.speed = 260;
      sedan.x += Math.cos(sedan.angle) * sedan.speed * dt;
      sedan.y += Math.sin(sedan.angle) * sedan.speed * dt;
      sedan.x = Math.max(40, Math.min(2360, sedan.x));
      sedan.y = Math.max(40, Math.min(1660, sedan.y));
      if (collideBuildings(g, sedan, 18)) {
        // Slide around the wall instead of grinding into it.
        sedan.x += Math.cos(away + Math.PI / 2) * 180 * dt;
        sedan.y += Math.sin(away + Math.PI / 2) * 180 * dt;
      }
      m.marker = { x: sedan.x, y: sedan.y, label: "Rico's sedan" };
      if (g.car && dist(px, py, sedan.x, sedan.y) < 44 && Math.abs(g.car.speed) > 90) {
        damageCar(g, sedan, 40);
        g.car.speed *= 0.5;
        g.particles.push({ x: sedan.x, y: sedan.y, vx: 0, vy: 0, life: 0.3, max: 0.3, kind: 'spark' });
      }
      break;
    }
    case 4: {
      const drop = DROPS[m.stage];
      if (dist(px, py, drop.x, drop.y) < 70) {
        m.stage += 1;
        g.cash += 0;
        if (m.stage >= DROPS.length) { completeMission(g); break; }
        m.marker = { x: DROPS[m.stage].x, y: DROPS[m.stage].y, label: DROPS[m.stage].label };
        g.toast = 'Drop done — next: ' + DROPS[m.stage].label;
      }
      break;
    }
    case 5: {
      if (dist(px, py, 200, 200) < 80) completeMission(g);
      break;
    }
    case 6: {
      const alive = m.extra.guards.filter((gp) => gp.hp > 0);
      if (alive.length > 0) {
        m.marker = { x: 1800, y: 1000, label: `Guards left: ${alive.length}` };
      } else if (!m.extra.cash) {
        m.extra.cash = { x: 1800, y: 1040, kind: 'cash', taken: false, respawn: 0, vault: true };
        g.pickups.push(m.extra.cash);
        m.marker = { x: 1800, y: 1040, label: 'Grab the cash' };
        g.toast = 'Guards down — grab the cash!';
      } else if (m.extra.cash.taken) {
        m.marker = { x: GARAGE_POS.x, y: GARAGE_POS.y, label: 'Deliver the cash — Cross Motors' };
        if (dist(px, py, GARAGE_POS.x, GARAGE_POS.y) < 130) completeMission(g);
      }
      break;
    }
    case 7: {
      if (dist(px, py, 2250, 1560) < 70) completeMission(g);
      break;
    }
  }
}

export function completeMission(g) {
  const m = g.mission;
  if (!m) return;
  g.cash += m.def.pay;
  g.rep += 25;
  g.missionsDone.push(m.idx);
  g.missionIndex = Math.max(g.missionIndex, m.idx + 1);
  g.mission = null;
  const final = m.idx === 7;
  if (final) g.wanted = 0;
  g.toast = (final ? 'STREET KING — ' : 'Job done — ') + '+' + m.def.pay + ' · +25 REP' + (final ? ' · Porto Verde is yours.' : '');
  if (g.audio) g.audio.mission();
  g.saveNow = true;
}

export function failMission(g, reason) {
  g.mission = null;
  g.toast = 'Job failed — ' + reason + ' Press N to retry.';
  if (g.audio) g.audio.busted();
}

export function nextJob(g) {
  if (g.mission) return;
  if (g.missionIndex >= MISSION_DEFS.length) {
    g.toast = 'All eight jobs done. Porto Verde is yours — free roam.';
    return;
  }
  startMission(g, g.missionIndex);
}

export function rankLabel(g) {
  return 'REP ' + g.rep + ' · ' + rankFor(g.rep);
}
