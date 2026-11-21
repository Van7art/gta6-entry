// HUD: stars, cash, respect, mission, radio, health, weapons, speed, minimap.
import { WORLD_W, WORLD_H, STATIONS, WEAPONS } from './state.js';
import { fmtMoney, fmtTime, $ } from './util.js';
import { rankLabel } from './missions.js';
import { onRoad } from './city.js';

export function showToast(g, text) {
  g.toast = text;
  g.toastTimer = 3.5;
}

export function updateHUD(g) {
  // Wanted stars.
  const stars = $('stars');
  let html = '';
  for (let i = 0; i < 5; i++) {
    html += '<span class="' + (i < g.wanted ? 'lit' : 'dim') + '">★</span>';
  }
  stars.innerHTML = html;
  $('airone').classList.toggle('hidden', !g.heli);
  $('cash').textContent = fmtMoney(g.cash);
  $('rep').textContent = rankLabel(g);
  const h = Math.floor(g.clockMin / 60) % 24;
  const m = Math.floor(g.clockMin % 60);
  $('clock').textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');

  if (g.mission) {
    $('mission-title').textContent = g.mission.def.title;
    $('mission-obj').textContent = g.mission.marker ? g.mission.marker.label : g.mission.def.brief;
    const t = $('mission-timer');
    if (g.mission.timer > 0) {
      t.classList.remove('hidden');
      t.textContent = fmtTime(g.mission.timer);
    } else {
      t.classList.add('hidden');
    }
  } else {
    $('mission-title').textContent = g.missionIndex >= 8
      ? 'All jobs done — free roam'
      : 'Free roam — press N for the next job';
    $('mission-obj').textContent = '';
    $('mission-timer').classList.add('hidden');
  }

  const st = STATIONS[g.radio.station];
  $('radio-label').textContent = '♪ ' + st.name + ' · ' + st.show + (g.radio.muted ? ' (muted)' : '');

  $('hp-fill').style.width = Math.max(0, g.player.hp) + '%';
  $('hp-text').textContent = Math.max(0, Math.ceil(g.player.hp)) + ' HP';
  const armed = g.player.onFoot || g.car;
  $('ammo-text').classList.toggle('hidden', !armed);
  $('weapon-slots').classList.toggle('hidden', !armed);
  if (armed) {
    const w = WEAPONS[g.weapons.slot];
    $('ammo-text').textContent = 'AMMO ' + g.weapons.mags[g.weapons.slot] + ' / ' + g.weapons.reserve;
    $('weapon-slots').innerHTML = WEAPONS.map((wp, i) =>
      '<div class="slot' + (i === g.weapons.slot ? ' active' : '') + '">' + wp.name + ' ' + g.weapons.mags[i] + '</div>',
    ).join('');
  }
  const speedEl = $('speed-num');
  const carHp = $('car-hp');
  if (g.car) {
    speedEl.textContent = Math.round(Math.abs(g.car.speed) * 0.36);
    carHp.textContent = 'CAR ' + Math.max(0, Math.ceil((g.car.hp / g.car.maxHp) * 100)) + '%';
    carHp.style.display = '';
  } else {
    speedEl.textContent = Math.round(Math.hypot(g.player.vx || 0, g.player.vy || 0) * 0.36);
    carHp.style.display = 'none';
  }

  const toast = $('toast');
  if (g.toast && g.toastTimer > 0) {
    toast.textContent = g.toast;
    toast.classList.remove('hidden');
  } else {
    toast.classList.add('hidden');
  }
}

export function drawMinimap(g) {
  const cv = $('minimap');
  const ctx = cv.getContext('2d');
  const S = 220 / WORLD_W;
  ctx.clearRect(0, 0, 220, 220);
  ctx.fillStyle = '#0c2412';
  ctx.fillRect(0, 0, 220, 220);
  // Sea + beach.
  ctx.fillStyle = '#2f7f9e';
  ctx.fillRect(0, 1690 * S, 220, 220 - 1690 * S);
  ctx.fillStyle = '#e8cf96';
  ctx.fillRect(0, 1520 * S, 220, (1690 - 1520) * S);
  // Roads.
  ctx.strokeStyle = '#3a3a40';
  ctx.lineWidth = 6;
  for (const rx of [200, 600, 1000, 1400, 1800, 2200]) {
    ctx.beginPath(); ctx.moveTo(rx * S, 0); ctx.lineTo(rx * S, 1520 * S); ctx.stroke();
  }
  for (const ry of [200, 600, 1000, 1400]) {
    ctx.beginPath(); ctx.moveTo(0, ry * S); ctx.lineTo(220, ry * S); ctx.stroke();
  }
  // Garage.
  ctx.fillStyle = '#7dff8a';
  ctx.fillRect(1000 * S - 4, 600 * S - 4, 8, 8);
  // Mission marker.
  if (g.mission && g.mission.marker) {
    const pulse = 4 + Math.sin(g.time * 5) * 2;
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(g.mission.marker.x * S, g.mission.marker.y * S, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Traffic dots, cops, heli, player.
  ctx.fillStyle = '#fff';
  for (const car of g.cars) ctx.fillRect(car.x * S - 1, car.y * S - 1, 2, 2);
  ctx.fillStyle = '#5aa2ff';
  for (const cop of g.cops) ctx.fillRect(cop.x * S - 1.5, cop.y * S - 1.5, 3, 3);
  if (g.heli) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(g.heli.x * S, g.heli.y * S, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff3b30';
  ctx.save();
  ctx.translate(g.player.x * S, g.player.y * S);
  ctx.rotate(g.player.angle);
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawPlayer(ctx, g) {
  const p = g.player;
  if (!p.onFoot) return;
  ctx.fillStyle = 'rgba(40,20,5,0.35)';
  ctx.beginPath();
  ctx.ellipse(p.x + 5, p.y + 3, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  // Body: jacket, head, gun arm.
  ctx.fillStyle = '#d43a2a';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(2, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(6, -2, 12, 3);
  ctx.restore();
  // Aim crosshair at the mouse.
  const cam = g.camera;
  const wx = cam.x - 640 + g.mouse.x;
  const wy = cam.y - 400 + g.mouse.y;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(wx, wy, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(wx - 14, wy); ctx.lineTo(wx - 6, wy);
  ctx.moveTo(wx + 6, wy); ctx.lineTo(wx + 14, wy);
  ctx.moveTo(wx, wy - 14); ctx.lineTo(wx, wy - 6);
  ctx.moveTo(wx, wy + 6); ctx.lineTo(wx, wy + 14);
  ctx.stroke();
}

export function drawMarker(ctx, g, view) {
  const m = g.mission && g.mission.marker;
  if (!m) return;
  const pulse = 1 + Math.sin(g.time * 4) * 0.15;
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(m.x, m.y, 34 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,215,106,0.25)';
  ctx.beginPath();
  ctx.arc(m.x, m.y, 34 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 14px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(m.label, m.x, m.y - 44);
  // Edge arrow when the marker is off screen.
  if (m.x < view.x0 || m.x > view.x1 || m.y < view.y0 || m.y > view.y1) {
    const cx = (view.x0 + view.x1) / 2;
    const cy = (view.y0 + view.y1) / 2;
    const a = Math.atan2(m.y - cy, m.x - cx);
    const ax = cx + Math.cos(a) * 300;
    const ay = cy + Math.sin(a) * 200;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.moveTo(16, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
