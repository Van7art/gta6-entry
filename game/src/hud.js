// hud.js — the heads-up display: wanted stars, cash, street rep, health,
// ammo, speedometer, mission objective, toasts, and the live minimap drawn
// on a 2D canvas (roads, beach, water, traffic, police, mission marker).
import { CITY } from './config.js';
import { formatCash } from './util.js';

export class HUD {
  constructor() {
    this.el = {
      stars: document.getElementById('stars'),
      cash: document.getElementById('cash'),
      rep: document.getElementById('rep'),
      clock: document.getElementById('clock'),
      healthFill: document.getElementById('health-fill'),
      healthText: document.getElementById('health-text'),
      ammo: document.getElementById('ammo'),
      speed: document.getElementById('speed'),
      speedUnit: document.getElementById('speed-unit'),
      carHp: document.getElementById('car-hp'),
      objective: document.getElementById('objective'),
      objectiveLabel: document.getElementById('objective-label'),
      toast: document.getElementById('toast'),
      vignette: document.getElementById('vignette'),
      crosshair: document.getElementById('crosshair'),
      radio: document.getElementById('radio'),
      minimap: document.getElementById('minimap'),
      missionTimer: document.getElementById('mission-timer'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.toastTimer = 0;
    this.lastStars = -1;
  }

  toast(text, seconds) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    this.toastTimer = seconds || 4;
  }

  update(dt, state) {
    // Wanted stars.
    if (state.stars !== this.lastStars) {
      this.lastStars = state.stars;
      let s = '';
      for (let i = 0; i < 5; i++) s += i < state.stars ? '★' : '☆';
      this.el.stars.textContent = s;
      this.el.stars.classList.toggle('hot', state.stars >= 3);
    }
    this.el.cash.textContent = formatCash(state.cash);
    this.el.rep.textContent = 'REP ' + state.rep;
    this.el.clock.textContent = state.clock;
    this.el.healthFill.style.width = state.health + '%';
    this.el.healthFill.classList.toggle('low', state.health < 30);
    this.el.healthText.textContent = Math.ceil(state.health) + ' HP';
    this.el.ammo.textContent = state.inCar ? '' : ('AMMO ' + state.ammo + ' / ' + state.ammoReserve + (state.reloading ? ' · RELOADING' : ''));
    const kmh = Math.round(Math.abs(state.speed) * 3.6);
    this.el.speed.textContent = state.inCar ? kmh : '';
    this.el.speedUnit.textContent = state.inCar ? 'km/h' : '';
    this.el.carHp.textContent = state.inCar ? ('CAR ' + Math.ceil(state.carHp) + '%') : '';
    this.el.carHp.style.color = state.carHp < 35 ? '#ff5544' : '#ffd24a';
    this.el.objective.textContent = state.objective || 'Free roam — press N for the next job';
    this.el.objectiveLabel.textContent = state.missionTitle || 'PORTO VERDE';
    this.el.missionTimer.textContent = state.missionTimeLeft ? ('⏱ ' + state.missionTimeLeft) : '';
    this.el.crosshair.style.display = state.inCar ? 'none' : 'block';
    this.el.vignette.style.opacity = state.health < 35 ? String((35 - state.health) / 35 * 0.7) : '0';
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.classList.remove('show');
    }
    this.drawMinimap(state);
  }

  drawMinimap(state) {
    const ctx = this.mapCtx;
    const S = 220;
    const scale = S / 640; // world -320..320
    const toMap = (x, z) => [(x + 320) * scale, (z + 320) * scale];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#1d2b1a';
    ctx.fillRect(0, 0, S, S);
    // Water + beach on the east.
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(toMap(320, -320)[0], 0, S - toMap(320, -320)[0], S);
    ctx.fillStyle = '#e8d9a8';
    ctx.fillRect(toMap(252, -320)[0], 0, toMap(320, -320)[0] - toMap(252, -320)[0], S);
    // Harbour apron south.
    ctx.fillStyle = '#6f6a60';
    ctx.fillRect(0, toMap(-320, 248)[1], S, S - toMap(-320, 248)[1]);
    // Roads.
    ctx.strokeStyle = '#3c3c40';
    ctx.lineWidth = 14 * scale;
    for (const r of CITY.roads) {
      const [x1, y1] = toMap(-320, r);
      const [x2, y2] = toMap(320, r);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [x3, y3] = toMap(r, -320);
      const [x4, y4] = toMap(r, 320);
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
    }
    // Park.
    ctx.fillStyle = '#5d8a4a';
    const [px, py] = toMap(-23, -23);
    ctx.fillRect(px, py, 46 * scale, 46 * scale);
    // Garage.
    ctx.fillStyle = '#ffd24a';
    const [gx, gy] = toMap(-90, 90);
    ctx.fillRect(gx - 3, gy - 3, 6, 6);
    // Coins.
    ctx.fillStyle = '#ffe14a';
    for (const c of state.coins || []) {
      if (c.taken) continue;
      const [cx, cy] = toMap(c.x, c.z);
      ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }
    // Traffic dots.
    ctx.fillStyle = '#ffffff';
    for (const t of state.traffic || []) {
      const [tx, ty] = toMap(t.x, t.z);
      ctx.fillRect(tx - 1.5, ty - 1.5, 3, 3);
    }
    // Police (flashing blue).
    ctx.fillStyle = Math.floor(performance.now() / 300) % 2 ? '#3388ff' : '#ff3333';
    for (const p of state.police || []) {
      const [px2, py2] = toMap(p.x, p.z);
      ctx.beginPath(); ctx.arc(px2, py2, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // Mission marker (pulsing yellow diamond).
    if (state.marker) {
      const [mx, my] = toMap(state.marker.x, state.marker.z);
      const r = 5 + Math.sin(performance.now() / 200) * 1.5;
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.moveTo(mx, my - r); ctx.lineTo(mx + r, my); ctx.lineTo(mx, my + r); ctx.lineTo(mx - r, my);
      ctx.closePath(); ctx.fill();
    }
    // Player arrow.
    const [ux, uy] = toMap(state.playerX, state.playerZ);
    ctx.save();
    ctx.translate(ux, uy);
    ctx.rotate(-state.playerHeading + Math.PI / 2);
    ctx.fillStyle = '#ff5533';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial';
    ctx.fillText('N', 8, 14);
  }
}
