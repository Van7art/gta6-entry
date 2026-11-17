// main.js — bootstrap and game loop for Solmar Bay: builds the renderer and
// the world, wires the title / pause / game-over screens, runs the per-frame
// update of every system, and exposes window.__game for play-testing.
import * as THREE from 'three';
import { G } from './state.js';
import { TUNING, CITY_HALF, BEACH_Z, mulberry32 } from './config.js';
import { buildCity, LANDMARKS, makeMarkerBeacon } from './city.js';
import { initInput, axis } from './input.js';
import { buildPlayerMesh, updatePlayer, updateCamera, tryEnterCar, nearestCar } from './player.js';
import { spawnCar, spawnTraffic, updateTraffic, updatePlayerCar, updatePolice } from './vehicles.js';
import { spawnPeds, updatePeds, resetDownPeds } from './pedestrians.js';
import { initCombat, updateCombat, playerShoot } from './combat.js';
import { startMission, startNextMission, updateMissions, tryTalk, currentMission } from './missions.js';
import { updateWanted, clearWanted, respawnAtHospital, respawnAtPoliceStation } from './wanted.js';
import { initHud, updateHud, setPrompt, showBanner } from './hud.js';
import { saveGame, loadSave, applySave, hasSave, clearSave } from './save.js';
import { sound } from './audio.js';
import { shotParam, applyShotStaging } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
let titleCamAngle = 0;
let endTimer = 0;

function setStatus(text) { if (statusEl) statusEl.textContent = text; }

function buildRenderer() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
  });
  return renderer;
}

function spawnParkedCars() {
  const spots = [
    ['marlin', -91, -96, 0.5], // Mara's runabout, parked by the garage forecourt
    ['sunset', 26, -46, 0.4], ['marlin', -52, 14, 1.2], ['dune', 78, -100, 2.6],
    ['taxi', -14, 94, 0.1], ['van', 106, 40, 1.8], ['marlin', -106, -78, 2.2],
    ['sunset', 52, 150, 0.9],
  ];
  for (const [id, x, z, h] of spots) spawnCar(id, x, z, h, { parked: true });
}

function spawnCoins() {
  const rand = mulberry32(99);
  const geo = new THREE.CylinderGeometry(0.9, 0.9, 0.25, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
  for (let i = 0; i < TUNING.coinCount; i++) {
    const x = (rand() * 2 - 1) * (CITY_HALF - 30);
    const z = (rand() * 2 - 1) * (CITY_HALF - 30);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 1.2, z);
    mesh.rotation.x = Math.PI / 2;
    G.scene.add(mesh);
    G.coins.push({ id: `coin-${i}`, x, z, mesh, taken: false });
  }
}

function updateCoins(dt) {
  for (const coin of G.coins) {
    if (coin.taken) continue;
    coin.mesh.rotation.z += dt * 2;
    coin.mesh.position.y = 1.2 + Math.sin(G.time * 2 + coin.x) * 0.25;
    const d = Math.hypot(G.player.pos.x - coin.x, G.player.pos.z - coin.z);
    if (d < 2.4) {
      coin.taken = true;
      coin.mesh.visible = false;
      G.money += TUNING.coinValue;
      G.respect = Math.min(100, G.respect + 1);
      G.flags.coinCollected = true;
      sound.coin();
      showBanner(`KOIN EMAS  +$${TUNING.coinValue}`, 1.6);
    }
  }
}

function updatePrompts() {
  if (!G.started || G.paused || G.over) { setPrompt(''); return; }
  const m = currentMission();
  if (G.missionActive && m) {
    const step = m.steps[G.missionStep];
    if (step && step.type === 'talk') {
      setPrompt('E — Bicara dengan Mara');
      return;
    }
  }
  const car = nearestCar(5.5);
  if (!G.player.inCar && car) {
    setPrompt(`E — Masuk ${car.model.name}${car.parked ? '' : ' (milik orang!)'}`);
    return;
  }
  if (G.player.inCar) {
    setPrompt('E — Keluar mobil  •  W/S gas & rem  •  A/D belok');
    return;
  }
  if (!G.missionActive && G.missionIndex < 6) {
    setPrompt('M — Mulai misi berikutnya  •  WASD jalan  •  Klik mouse menembak');
    return;
  }
  setPrompt('WASD jalan  •  E masuk mobil  •  Klik mouse menembak');
}

// --- screens -----------------------------------------------------------------
const screens = {
  title: document.getElementById('screen-title'),
  pause: document.getElementById('screen-pause'),
  end: document.getElementById('screen-end'),
  hud: document.getElementById('hud'),
};
function showOnly(name) {
  for (const [key, el] of Object.entries(screens)) {
    if (!el) continue;
    el.style.display = key === name ? 'flex' : 'none';
  }
  if (name === 'hud' && screens.hud) screens.hud.style.display = 'block';
}

function startGame(fromSave) {
  sound.ensure();
  if (fromSave) {
    const data = loadSave();
    if (data) applySave(data);
  }
  G.started = true;
  G.paused = false;
  G.over = false;
  showOnly('hud');
  setStatus('Game started. Good luck, Rex.');
  if (!G.missionActive && G.missionIndex < 6) {
    showBanner('Tekan M untuk memulai misi berikutnya', 3);
  }
}

function togglePause() {
  if (!G.started || G.over) return;
  G.paused = !G.paused;
  if (G.paused) {
    showOnly('pause');
    document.exitPointerLock && document.exitPointerLock();
  } else {
    showOnly('hud');
  }
}

function endGame(reason) {
  G.over = true;
  G.overReason = reason;
  sound.fail();
  const title = document.getElementById('end-title');
  const text = document.getElementById('end-text');
  if (reason === 'wasted') {
    title.textContent = 'WASTED';
    text.textContent = 'Rex tumbang di jalanan Solmar. Rumah sakit memungutnya — dan tagihannya.';
  } else {
    title.textContent = 'BUSTED';
    text.textContent = 'SBPD menangkap Rex. Semalam di sel — dan denda yang tidak murah.';
  }
  showOnly('end');
  endTimer = 2.6;
}

// --- init ----------------------------------------------------------------------
function init() {
  G.renderer = buildRenderer();
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  G.camera.position.set(0, 40, 120);
  G.clock = new THREE.Clock();

  buildCity(G.scene);
  makeMarkerBeacon(G.scene);
  G.player.pos = new THREE.Vector3(LANDMARKS.garage.pos.x + 14, 0, LANDMARKS.garage.pos.z + 10);
  G.player.mesh = buildPlayerMesh(G.scene);
  initCombat(G.scene);
  initHud();
  spawnParkedCars();
  spawnTraffic();
  spawnPeds();
  spawnCoins();

  G.onWasted = () => endGame('wasted');
  G.onBusted = () => endGame('busted');
  G.onMissionComplete = () => saveGame(true);

  initInput(canvas, {
    onMissionKey: () => {
      if (!G.started || G.paused || G.over) return;
      const r = startNextMission();
      if (r === 'started') setStatus('Mission started');
    },
    onPauseKey: () => { if (G.started) togglePause(); },
    onInteractKey: () => {
      if (!G.started || G.paused || G.over) return;
      if (tryTalk()) return;
      const r = tryEnterCar();
      if (r === 'enter') {
        G.flags.carEntered = true;
        showBanner('Mobil dicuri — hati-hati polisi!', 2.2);
      } else if (r === 'moving') {
        showBanner('Mobil itu sedang jalan!', 1.6);
      }
    },
  });

  // title screen buttons
  const btnStart = document.getElementById('btn-start');
  const btnContinue = document.getElementById('btn-continue');
  const btnNew = document.getElementById('btn-new');
  if (btnStart) btnStart.addEventListener('click', () => { clearSave(); G.missionIndex = 0; startGame(false); });
  if (btnContinue) btnContinue.addEventListener('click', () => startGame(true));
  if (btnNew) btnNew.addEventListener('click', () => { clearSave(); location.reload(); });
  if (btnContinue && !hasSave()) btnContinue.style.display = 'none';
  const btnResume = document.getElementById('btn-resume');
  const btnSave = document.getElementById('btn-save');
  const btnRestart = document.getElementById('btn-restart');
  const btnQuit = document.getElementById('btn-quit');
  const btnMute = document.getElementById('btn-mute');
  if (btnResume) btnResume.addEventListener('click', togglePause);
  if (btnSave) btnSave.addEventListener('click', () => { saveGame(false); });
  if (btnRestart) btnRestart.addEventListener('click', () => location.reload());
  if (btnQuit) btnQuit.addEventListener('click', () => { saveGame(true); location.reload(); });
  if (btnMute) btnMute.addEventListener('click', () => {
    sound.ensure();
    sound.setMuted(!sound.muted);
    btnMute.textContent = sound.muted ? 'Suara: Mati' : 'Suara: Hidup';
  });
  const btnEndContinue = document.getElementById('btn-end-continue');
  if (btnEndContinue) btnEndContinue.addEventListener('click', () => {
    if (G.overReason === 'wasted') respawnAtHospital();
    else respawnAtPoliceStation();
    resetDownPeds();
    G.over = false;
    showOnly('hud');
  });

  // screenshot staging (?shot=...) or normal title screen
  const shot = shotParam();
  if (shot) {
    applyShotStaging(shot, () => startGame(false));
  } else {
    showOnly('title');
  }

  // play-test / debug hook
  window.__game = {
    G,
    startMission,
    startNextMission,
    setWanted: (n) => { G.wanted = n; },
    teleport: (x, z) => { G.player.pos.set(x, 0, z); if (G.player.inCar) { G.player.inCar.x = x; G.player.inCar.z = z; } },
    shoot: () => playerShoot(),
    enterCar: () => tryEnterCar(),
    saveGame,
    version: 'solmar-bay-v2',
  };

  G.renderer.setAnimationLoop(tick);
  setStatus('Solmar Bay loaded. Press Start.');
}

// --- per-frame -------------------------------------------------------------------
function tick() {
  const dt = Math.min(0.05, G.clock.getDelta());
  if (G.started && !G.paused && !G.over) {
    G.time += dt;
    G.dayTime = (0.42 + G.time / 3600) % 1;
    updatePlayer(dt);
    updatePlayerCar(dt, axis());
    updateTraffic(dt);
    updatePolice(dt);
    updatePeds(dt);
    updateCombat(dt);
    updateMissions(dt);
    updateWanted(dt);
    updateCoins(dt);
    updateCamera(dt);
    updateHud(dt);
    updatePrompts();
    if (G.markerGroup && G.markerGroup.visible) {
      G.markerGroup.rotation.y += dt;
      const s = 1 + Math.sin(G.time * 3) * 0.12;
      G.markerGroup.scale.set(s, 1, s);
    }
  } else if (!G.started) {
    // slow cinematic orbit behind the title screen
    titleCamAngle += dt * 0.05;
    const r = 190;
    G.camera.position.set(Math.cos(titleCamAngle) * r, 70, Math.sin(titleCamAngle) * r + 40);
    G.camera.lookAt(0, 10, 0);
    updateTraffic(dt);
    updatePeds(dt);
    if (G.markerGroup) G.markerGroup.visible = false;
  }
  if (G.over && endTimer > 0) {
    endTimer -= dt;
    if (endTimer <= 0) {
      const btn = document.getElementById('btn-end-continue');
      if (btn) btn.focus();
    }
  }
  G.renderer.render(G.scene, G.camera);
}

init();
