// hud.js — every DOM overlay: health / money / rep, wanted stars, mission
// objective + dialogue subtitles, the 2D minimap (roads, buildings, player,
// police, traffic, mission marker), speedometer, banners, damage vignette
// and the context prompt ("E — enter car", "M — start mission").
import { G } from './state.js';
import { LANDMARKS } from './city.js';
import { CITY_HALF, PITCH, streetNameAt } from './config.js';
import { missionLabel } from './missions.js';

let els = {};
let minimap = null;
let minimapCtx = null;
let lastMinimap = 0;

export function initHud() {
  els = {
    money: document.getElementById('hud-money'),
    healthFill: document.getElementById('hud-health-fill'),
    healthText: document.getElementById('hud-health-text'),
    repFill: document.getElementById('hud-rep-fill'),
    repText: document.getElementById('hud-rep-text'),
    stars: document.getElementById('hud-stars'),
    clock: document.getElementById('hud-clock'),
    street: document.getElementById('hud-street'),
    objective: document.getElementById('hud-objective'),
    objectiveTitle: document.getElementById('hud-objective-title'),
    dialog: document.getElementById('hud-dialog'),
    dialogName: document.getElementById('hud-dialog-name'),
    dialogText: document.getElementById('hud-dialog-text'),
    banner: document.getElementById('hud-banner'),
    prompt: document.getElementById('hud-prompt'),
    speed: document.getElementById('hud-speed'),
    speedValue: document.getElementById('hud-speed-value'),
    mission: document.getElementById('hud-mission'),
    crosshair: document.getElementById('hud-crosshair'),
    bust: document.getElementById('hud-bust'),
  };
  minimap = document.getElementById('minimap');
  if (minimap) minimapCtx = minimap.getContext('2d');
}

export function showBanner(text, seconds) {
  G.banner = text;
  G.bannerTimer = seconds || 3;
}

function formatClock() {
  const total = (G.dayTime * 24 + G.time / 3600) % 24;
  const h = Math.floor(total);
  const m = Math.floor((total - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function updateHud(dt) {
  if (!els.money) return;
  els.money.textContent = `$${G.money.toLocaleString('en-US')}`;
  const hp = Math.max(0, Math.round((G.player.health / G.player.maxHealth) * 100));
  els.healthFill.style.width = `${hp}%`;
  els.healthFill.style.background = hp > 50 ? '#4ade80' : hp > 25 ? '#facc15' : '#ef4444';
  els.healthText.textContent = `${hp}`;
  els.repFill.style.width = `${G.respect}%`;
  els.repText.textContent = `REP ${G.respect}`;
  els.stars.textContent = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
  els.stars.style.color = G.wanted > 0 ? '#ff4444' : '#ffffff88';
  els.clock.textContent = formatClock();
  els.street.textContent = streetNameAt(G.player.pos.x, G.player.pos.z);
  els.mission.textContent = missionLabel();
  // objective panel
  if (G.missionActive && G.missionObjective) {
    els.objective.style.display = 'block';
    els.objectiveTitle.textContent = missionLabel();
    els.objective.querySelector('.obj-text').textContent = G.missionObjective;
  } else if (!G.missionActive && G.missionIndex < 6) {
    els.objective.style.display = 'block';
    els.objectiveTitle.textContent = 'Free Roam';
    els.objective.querySelector('.obj-text').textContent = 'Tekan M untuk memulai misi berikutnya';
  } else {
    els.objective.style.display = 'block';
    els.objectiveTitle.textContent = 'Free Roam — Legenda Solmar';
    els.objective.querySelector('.obj-text').textContent = 'Cari koin emas, curi mobil, jelajahi kota';
  }
  // dialogue subtitles, one line at a time
  if (G.dialog.length > 0) {
    G.dialogTimer += dt;
    const line = G.dialog[0];
    const [name, ...rest] = line.split(':');
    els.dialog.style.display = 'block';
    els.dialogName.textContent = rest.length ? name : '';
    els.dialogText.textContent = rest.length ? rest.join(':').trim() : line;
    if (G.dialogTimer > 4.2) {
      G.dialog.shift();
      G.dialogTimer = 0;
      if (G.dialog.length === 0) els.dialog.style.display = 'none';
    }
  } else {
    els.dialog.style.display = 'none';
  }
  // banner
  if (G.bannerTimer > 0) {
    G.bannerTimer -= dt;
    els.banner.style.display = 'block';
    els.banner.textContent = G.banner;
    if (G.bannerTimer <= 0) els.banner.style.display = 'none';
  } else {
    els.banner.style.display = 'none';
  }
  // bust progress
  if (G.bustTimer > 0) {
    els.bust.style.display = 'block';
    els.bust.textContent = `DITANGKAP... ${Math.ceil(2.5 - G.bustTimer)}`;
  } else {
    els.bust.style.display = 'none';
  }
  // speedometer
  if (G.player.inCar) {
    els.speed.style.display = 'block';
    const kmh = Math.round(Math.abs(G.player.inCar.speed) * 3.6);
    els.speedValue.textContent = `${kmh}`;
    document.getElementById('hud-car-name').textContent = G.player.inCar.model.name;
  } else {
    els.speed.style.display = 'none';
  }
  els.crosshair.style.display = G.player.inCar ? 'none' : 'block';
  drawMinimap();
}

export function setPrompt(text) {
  if (!els.prompt) return;
  if (text) {
    els.prompt.style.display = 'block';
    els.prompt.textContent = text;
  } else {
    els.prompt.style.display = 'none';
  }
}

function drawMinimap() {
  if (!minimapCtx) return;
  const now = performance.now();
  if (now - lastMinimap < 90) return;
  lastMinimap = now;
  const ctx = minimapCtx;
  const S = minimap.width;
  const scale = S / (CITY_HALF * 2 + 80);
  const toMap = (x, z) => [(x + CITY_HALF + 40) * scale, (z + CITY_HALF + 40) * scale];
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#12261a';
  ctx.fillRect(0, 0, S, S);
  // sea
  ctx.fillStyle = '#1f7fa8';
  const [, seaY] = toMap(0, 243 + 46);
  ctx.fillRect(0, seaY, S, S - seaY);
  // roads
  ctx.strokeStyle = '#3a3f45';
  ctx.lineWidth = Math.max(2, 14 * scale);
  for (let i = 0; i <= 9; i++) {
    const p = -CITY_HALF - 7 + i * PITCH;
    const [x1, y1] = toMap(p, -CITY_HALF);
    const [x2, y2] = toMap(p, CITY_HALF);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const [x3, y3] = toMap(-CITY_HALF, p);
    const [x4, y4] = toMap(CITY_HALF, p);
    ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
  }
  // buildings
  ctx.fillStyle = '#8a94a3';
  for (const c of G.colliders) {
    const [x, y] = toMap(c.minX, c.minZ);
    const [x2, y2] = toMap(c.maxX, c.maxZ);
    ctx.fillRect(x, y, Math.max(1, x2 - x), Math.max(1, y2 - y));
  }
  // mission marker
  if (G.missionMarker) {
    const [x, y] = toMap(G.missionMarker.x, G.missionMarker.z);
    ctx.fillStyle = '#ffc93c';
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
  }
  // traffic dots
  ctx.fillStyle = '#ffffff';
  for (const car of G.traffic) {
    const [x, y] = toMap(car.x, car.z);
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  // police dots
  ctx.fillStyle = '#ff4444';
  for (const cop of G.police) {
    const [x, y] = toMap(cop.x, cop.z);
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  }
  // enemies
  ctx.fillStyle = '#ff8800';
  for (const e of G.enemies) {
    const [x, y] = toMap(e.x, e.z);
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  }
  // coins
  ctx.fillStyle = '#ffd700';
  for (const coin of G.coins) {
    if (coin.taken) continue;
    const [x, y] = toMap(coin.x, coin.z);
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  // player arrow (rotates with heading)
  const [px, py] = toMap(G.player.pos.x, G.player.pos.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.PI - G.player.heading);
  ctx.fillStyle = '#37e6c8';
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.closePath();
  ctx.fill();
  ctx.restore();
  // north label
  ctx.fillStyle = '#ffffffaa';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('N', 4, 12);
}
