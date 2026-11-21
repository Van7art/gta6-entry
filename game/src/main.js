// Porto Verde: Full Throttle — Golden Hour. Bootstrap, input, loop, render, scenes.
import { createGame, GARAGE_POS, WORLD_W, WORLD_H, SEA_Y, PAINTS, STATIONS } from './state.js';
import { clamp, dist, $, mulberry32 } from './util.js';
import { buildCity, drawCity, nearestRoadPoint, collideBuildings, inSea, onRoad } from './city.js';
import { makeCar, spawnTraffic, updatePlayerCar, updateTraffic, tryEnterCar, exitCar, drawCar, playerTopSpeed } from './vehicles.js';
import { spawnPeds, updatePeds, drawPeds, scarePeds } from './peds.js';
import { updateWanted, updateCops, drawPolice } from './police.js';
import { fireWeapon, reloadWeapon, switchWeapon, punch, updateBullets, drawBullets, currentWeapon } from './weapons.js';
import { createAudio } from './audio.js';
import { startMission, updateMission, nextJob, MISSION_DEFS } from './missions.js';
import { saveGame, loadSave, applySave, hasSave } from './save.js';
import { openShop, closeShop } from './upgrades.js';
import { updateHUD, drawMinimap, drawPlayer, drawMarker, showToast } from './hud.js';

const canvas = $('game');
const ctx = canvas.getContext('2d');
const g = createGame();
g.audio = createAudio();
window.__pv = g;
// Probe hooks for the headless test harness (not part of the game itself).
// Bound to the live game object so the harness calls them with no arguments.
window.__pvTest = {
  newGame, continueGame, respawn, loadSave,
  startMission: (i) => startMission(g, i),
  nextJob: () => nextJob(g),
  tryEnterCar: () => tryEnterCar(g),
  exitCar: () => exitCar(g),
  fireWeapon: () => fireWeapon(g),
  reloadWeapon: () => reloadWeapon(g),
  switchWeapon: (s) => switchWeapon(g, s),
  punch: () => punch(g),
  openShop: () => openShop(g),
  closeShop: () => closeShop(g),
  saveGame: () => saveGame(g),
  applySave: (d) => applySave(g, d),
};

function freshWorld() {
  buildCity(g);
  spawnTraffic(g, 26);
  spawnPeds(g, 44);
  g.cops = [];
  g.heli = null;
  g.roadblocks = [];
  g.strips = [];
  g.bullets = [];
  g.particles = [];
  g.mission = null;
  g.wanted = 0;
  g.camera = { x: GARAGE_POS.x, y: GARAGE_POS.y, zoom: 1 };
}

function newGame() {
  const keepAudio = g.audio;
  const fresh = createGame();
  for (const k of Object.keys(fresh)) g[k] = fresh[k];
  g.audio = keepAudio;
  window.__pv = g;
  freshWorld();
  g.player = { x: GARAGE_POS.x, y: GARAGE_POS.y - 40, angle: -Math.PI / 2, hp: 100, onFoot: true, vx: 0, vy: 0 };
  g.mode = 'playing';
  $('menu').classList.add('hidden');
  $('pause').classList.add('hidden');
  $('busted').classList.add('hidden');
  g.audio.start();
  showToast(g, 'Welcome to Porto Verde. Press N for your first job.');
}

function continueGame() {
  const data = loadSave();
  if (!data) return;
  const keepAudio = g.audio;
  const fresh = createGame();
  for (const k of Object.keys(fresh)) g[k] = fresh[k];
  g.audio = keepAudio;
  window.__pv = g;
  freshWorld();
  g.player = { x: 1000, y: 560, angle: -Math.PI / 2, hp: 100, onFoot: true, vx: 0, vy: 0 };
  applySave(g, data);
  if (data.car) {
    const car = makeCar(data.car.x, data.car.y, data.car.angle,
      { color: data.car.color, kind: 'sedan', hp: data.car.hp, isPlayer: true, top: playerTopSpeed(g) });
    car.paint = g.garage.paint;
    car.spoiler = g.garage.spoiler;
    g.car = car;
    g.player.onFoot = false;
  }
  g.mode = 'playing';
  $('menu').classList.add('hidden');
  $('busted').classList.add('hidden');
  g.audio.start();
  showToast(g, 'Welcome back. ' + (g.missionIndex >= 8 ? 'All jobs done — free roam.' : 'Press N for the next job.'));
}

function respawn() {
  g.player.x = GARAGE_POS.x;
  g.player.y = GARAGE_POS.y - 40;
  g.player.hp = 100;
  g.player.onFoot = true;
  g.player.angle = -Math.PI / 2;
  g.car = null;
  g.wanted = 0;
  g.cops = [];
  g.heli = null;
  g.roadblocks = [];
  g.strips = [];
  g.bustedTimer = 0;
  g.cash = Math.floor(g.cash * 0.9);
  g.mode = 'playing';
  $('busted').classList.add('hidden');
  saveGame(g);
  showToast(g, 'You wake up at Cross Motors. 10% lighter.');
}

// ---------- input ----------
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'drift',
};
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  const mapped = KEYMAP[e.code];
  if (mapped) g.input[mapped] = true;
  if (e.repeat) return;
  if (g.mode === 'menu' && (e.code === 'Enter' || e.code === 'Space')) { newGame(); return; }
  if (g.mode !== 'playing' && g.mode !== 'garage') return;
  switch (e.code) {
    case 'KeyE':
      if (g.mode === 'playing') { if (g.car) exitCar(g); else tryEnterCar(g); }
      break;
    case 'KeyF': punch(g); break;
    case 'KeyH': if (g.car && g.audio) g.audio.horn(); break;
    case 'KeyN': if (g.mode === 'playing') nextJob(g); break;
    case 'KeyG':
      if (g.mode === 'playing' && dist(g.player.x, g.player.y, GARAGE_POS.x, GARAGE_POS.y) < 170) openShop(g);
      else if (g.mode === 'garage') closeShop(g);
      break;
    case 'KeyQ': cycleRadio(1); break;
    case 'Digit1': setStation(0); break;
    case 'Digit2': setStation(1); break;
    case 'Digit3': setStation(2); break;
    case 'Digit4': switchWeapon(g, 0); break;
    case 'Digit5': switchWeapon(g, 1); break;
    case 'Digit6': switchWeapon(g, 2); break;
    case 'KeyC': switchWeapon(g, (g.weapons.slot + 1) % 3); break;
    case 'KeyM': if (g.audio) { g.radio.muted = g.audio.toggleMute(); } break;
    case 'KeyR':
      if (g.car) resetCar(g);
      else reloadWeapon(g);
      break;
    case 'Escape':
      if (g.mode === 'playing') pauseGame();
      else if (g.mode === 'paused') resumeGame();
      else if (g.mode === 'garage') closeShop(g);
      break;
  }
});
window.addEventListener('keyup', (e) => {
  const mapped = KEYMAP[e.code];
  if (mapped) g.input[mapped] = false;
});
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  g.mouse.x = (e.clientX - r.left) * (1280 / r.width);
  g.mouse.y = (e.clientY - r.top) * (800 / r.height);
});
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  g.mouse.down = true;
  if (g.mode === 'playing') fireWeapon(g);
});
window.addEventListener('mouseup', () => { g.mouse.down = false; });

function cycleRadio(dir) {
  setStation((g.radio.station + dir) % 3);
}
function setStation(i) {
  g.radio.station = i;
  if (g.audio) g.audio.setStation(i);
}
function resetCar(carG) {
  const rp = nearestRoadPoint(carG, carG.car.x, carG.car.y);
  if (!rp) return;
  carG.car.x = rp.x;
  carG.car.y = rp.y;
  carG.car.speed = 0;
  carG.car.angle = 0;
  carG.toast = 'Car reset to the nearest road.';
}
function pauseGame() {
  g.mode = 'paused';
  $('pause').classList.remove('hidden');
  saveGame(g);
}
function resumeGame() {
  g.mode = 'playing';
  $('pause').classList.add('hidden');
}

$('btn-new').addEventListener('click', newGame);
$('btn-continue').addEventListener('click', continueGame);
$('btn-resume').addEventListener('click', resumeGame);
$('btn-quit').addEventListener('click', () => {
  saveGame(g);
  g.mode = 'menu';
  $('pause').classList.add('hidden');
  $('menu').classList.remove('hidden');
  refreshMenu();
});
$('btn-close-shop').addEventListener('click', () => closeShop(g));
$('btn-retry').addEventListener('click', respawn);
$('radio-label').addEventListener('click', () => cycleRadio(1));

function refreshMenu() {
  const data = loadSave();
  $('btn-continue').classList.toggle('hidden', !data);
  $('save-info').textContent = data
    ? 'Save found: ' + fmtMoney(data.cash) + ' · REP ' + data.rep + ' · ' + data.missionsDone.length + '/8 jobs done.'
    : '';
}
function fmtMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }

// ---------- update ----------
function update(dt) {
  g.time += dt;
  g.clockMin += dt * 0.05;
  if (g.toastTimer > 0) g.toastTimer -= dt;

  // On-foot movement + aim.
  if (g.player.onFoot) {
    const ix = (g.input.right ? 1 : 0) - (g.input.left ? 1 : 0);
    const iy = (g.input.down ? 1 : 0) - (g.input.up ? 1 : 0);
    const len = Math.hypot(ix, iy) || 1;
    const sp = 175;
    g.player.vx = (ix / len) * sp * (ix || iy ? 1 : 0);
    g.player.vy = (iy / len) * sp * (ix || iy ? 1 : 0);
    const nx = g.player.x + g.player.vx * dt;
    const ny = g.player.y + g.player.vy * dt;
    g.player.x = clamp(nx, 24, WORLD_W - 24);
    g.player.y = clamp(ny, 24, SEA_Y - 18);
    if (inSea(g, g.player.x, g.player.y)) { g.player.x -= g.player.vx * dt; g.player.y -= g.player.vy * dt; }
    collideBuildings(g, g.player, 10);
    const cam = g.camera;
    g.player.angle = Math.atan2(cam.y - 400 + g.mouse.y - g.player.y, cam.x - 640 + g.mouse.x - g.player.x);
    if (g.mouse.down) fireWeapon(g);
  } else {
    updatePlayerCar(g, dt);
  }

  updateTraffic(g, dt);
  updatePeds(g, dt);
  updateCops(g, dt);
  updateWanted(g, dt);
  updateBullets(g, dt);
  updateMission(g, dt);

  // Particles.
  for (const p of g.particles) {
    p.x += (p.vx || 0) * dt;
    p.y += (p.vy || 0) * dt;
    p.life -= dt;
  }
  g.particles = g.particles.filter((p) => p.life > 0);

  // Pickups.
  for (const pk of g.pickups) {
    if (pk.taken) {
      pk.respawn -= dt;
      if (pk.respawn <= 0) pk.taken = false;
      continue;
    }
    if (dist(g.player.x, g.player.y, pk.x, pk.y) < 30) {
      pk.taken = true;
      pk.respawn = 45;
      if (pk.kind === 'cash') {
        const gain = 50 + Math.floor(Math.random() * 100);
        g.cash += gain;
        g.toast = '+' + fmtMoney(gain) + ' picked up.';
      } else if (pk.kind === 'ammo') {
        g.weapons.reserve += 30;
        g.toast = '+30 reserve ammo.';
      } else {
        g.player.hp = Math.min(100, g.player.hp + 40);
        g.toast = '+40 HP.';
      }
      if (pk.vault) { /* vault cash is the mission object; keep it taken */ }
      if (g.audio) g.audio.pickup();
    }
  }

  // Busted / wasted.
  if (g.player.hp <= 0) {
    endRun('WASTED', 'Porto Verde General patched you up. 10% lighter.');
    return;
  }
  let nearCop = false;
  for (const cop of g.cops) {
    if (dist(cop.x, cop.y, g.player.x, g.player.y) < 55) nearCop = true;
  }
  const slow = g.car ? Math.abs(g.car.speed) < 40 : true;
  if (g.wanted >= 2 && nearCop && slow) {
    g.bustedTimer = (g.bustedTimer || 0) + dt;
    if (g.bustedTimer > 2.5) {
      endRun('BUSTED', 'The Porto Verde police took you in. 10% lighter.');
      return;
    }
  } else {
    g.bustedTimer = 0;
  }

  // Camera follows with a little lookahead.
  const look = g.car ? 0.22 : 0.1;
  const tx = g.player.x + (g.car ? Math.cos(g.car.angle) * g.car.speed * look : 0);
  const ty = g.player.y + (g.car ? Math.sin(g.car.angle) * g.car.speed * look : 0);
  g.camera.x += (clamp(tx, 640, WORLD_W - 640) - g.camera.x) * Math.min(1, dt * 4);
  g.camera.y += (clamp(ty, 400, WORLD_H - 400) - g.camera.y) * Math.min(1, dt * 4);

  // Autosave.
  g.saveTimer = (g.saveTimer || 0) + dt;
  if (g.saveNow || g.saveTimer > 30) {
    saveGame(g);
    g.saveNow = false;
    g.saveTimer = 0;
  }
}

function endRun(title, sub) {
  g.mode = 'busted';
  $('busted-title').textContent = title;
  $('busted-sub').textContent = sub;
  $('busted').classList.remove('hidden');
  if (g.audio) g.audio.busted();
  saveGame(g);
}

// ---------- render ----------
function render() {
  const cam = g.camera;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#f7b267';
  ctx.fillRect(0, 0, 1280, 800);
  ctx.save();
  ctx.translate(640 - cam.x, 400 - cam.y);
  const view = { x0: cam.x - 660, y0: cam.y - 420, x1: cam.x + 660, y1: cam.y + 420 };
  drawCity(ctx, g, view);
  drawPeds(ctx, g, view);
  for (const car of g.cars) {
    if (car.dead) continue;
    if (car.x < view.x0 || car.x > view.x1 || car.y < view.y0 || car.y > view.y1) continue;
    drawCar(ctx, g, car);
  }
  for (const cop of g.cops) {
    if (cop.dead) continue;
    if (cop.x < view.x0 || cop.x > view.x1 || cop.y < view.y0 || cop.y > view.y1) continue;
    drawCar(ctx, g, cop);
  }
  if (g.car) drawCar(ctx, g, g.car);
  drawPlayer(ctx, g);
  drawPolice(ctx, g, view);
  drawBullets(ctx, g);
  drawMarker(ctx, g, view);
  ctx.restore();
  // Golden-hour wash: warm light from the west, long shadows baked into the art.
  const wash = ctx.createRadialGradient(300, 400, 100, 640, 400, 900);
  wash.addColorStop(0, 'rgba(255,190,90,0.10)');
  wash.addColorStop(1, 'rgba(140,50,10,0.16)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 1280, 800);
  if (g.mode === 'playing' || g.mode === 'paused' || g.mode === 'garage' || g.mode === 'busted') {
    updateHUD(g);
    drawMinimap(g);
  }
}

// ---------- staged scenes (deterministic screenshots) ----------
function stageScene(name) {
  const rng = mulberry32(4242);
  const keepAudio = g.audio;
  const fresh = createGame();
  for (const k of Object.keys(fresh)) g[k] = fresh[k];
  g.audio = keepAudio;
  window.__pv = g;
  g.scene = name;
  buildCity(g);
  spawnTraffic(g, 14);
  spawnPeds(g, 18);
  g.player = { x: 1000, y: 1000, angle: 0, hp: 100, onFoot: false, vx: 0, vy: 0 };
  g.camera = { x: 1000, y: 1000, zoom: 1 };
  g.mode = 'playing';
  g.frozen = true;
  $('menu').classList.add('hidden');

  if (name === 'chase') {
    g.cash = 5200; g.rep = 120; g.wanted = 5; g.radio.station = 1;
    const taxi = makeCar(1000, 1000, 0, { color: '#f1c40f', kind: 'taxi', hp: 100, isPlayer: true, top: 410 });
    taxi.speed = 140; taxi.spoiler = true;
    g.car = taxi;
    g.player.angle = 0;
    g.heli = { x: 1180, y: 940, angle: 0.3, rotor: 1.2, shootTimer: 1.0 };
    g.roadblocks = [];
    for (const bx of [1380, 1760]) {
      const rb = { x: bx, y: 1000, angle: Math.PI / 2, timer: 99, cars: [] };
      for (const off of [-34, 34]) {
        const cop = makeCar(bx + off, 1000, Math.PI / 2, { color: '#1c2733', kind: 'cop', isCop: true, hp: 120 });
        rb.cars.push(cop);
        g.cops.push(cop);
      }
      g.roadblocks.push(rb);
    }
    g.strips = [{ x: 1240, y: 1000, angle: 0, armed: true, timer: 99 }];
    for (let i = 0; i < 3; i++) {
      const cop = makeCar(760 + i * 60, 940 + (i % 2) * 120, 0, { color: '#1c2733', kind: 'cop', isCop: true, hp: 120, top: 380 });
      cop.speed = 200;
      g.cops.push(cop);
    }
    g.mission = { idx: 4, def: MISSION_DEFS[4], stage: 0, timer: 149, marker: { x: 2200, y: 600, label: 'Drop 2 — East Docks' }, extra: {} };
    g.missionIndex = 4;
    g.missionsDone = [0, 1, 2, 3];
    g.camera = { x: 1120, y: 1000, zoom: 1 };
  } else if (name === 'drive') {
    g.cash = 150; g.rep = 0; g.wanted = 0; g.radio.station = 0;
    const car = makeCar(1000, 600, -Math.PI / 2, { color: '#2a6fd4', kind: 'sedan', hp: 100, isPlayer: true, top: 340 });
    car.speed = 170;
    g.car = car;
    g.player.angle = -Math.PI / 2;
    g.camera = { x: 1000, y: 700, zoom: 1 };
  } else if (name === 'garage') {
    g.cash = 8500; g.rep = 120; g.wanted = 0; g.radio.station = 0;
    g.garage = { engine: 2, armour: 2, paint: 2, wheels: 1, spoiler: false, ownedPaints: [0, 2] };
    const car = makeCar(1000, 620, -Math.PI / 2, { color: '#f1c40f', kind: 'sedan', hp: 100, isPlayer: true, top: 410 });
    g.car = car;
    g.player.angle = -Math.PI / 2;
    g.camera = { x: 1000, y: 600, zoom: 1 };
    openShop(g);
  } else if (name === 'foot') {
    g.cash = 150; g.rep = 120; g.wanted = 0; g.radio.station = 2;
    g.player = { x: 1200, y: 1560, angle: -Math.PI / 2, hp: 100, onFoot: true, vx: 0, vy: 0 };
    g.weapons.slot = 2;
    g.weapons.mags = [12, 30, 6];
    g.weapons.reserve = 60;
    g.camera = { x: 1200, y: 1500, zoom: 1 };
  }
  g.toast = null;
  g.toastTimer = 0;
  render();
  window.__pvReady = true;
}

// ---------- boot ----------
freshWorld();
g.player = { x: GARAGE_POS.x, y: GARAGE_POS.y - 40, angle: -Math.PI / 2, hp: 100, onFoot: true, vx: 0, vy: 0 };
refreshMenu();

const params = new URLSearchParams(location.search);
const scene = params.get('scene');
if (scene) {
  stageScene(scene);
} else {
  g.mode = 'menu';
}

let last = performance.now();
let frames = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (g.mode === 'playing' && !g.frozen) update(dt);
  if (g.mode !== 'menu' || g.scene) render();
  frames += 1;
  if (frames === 3 && g.scene) window.__pvReady = true;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
