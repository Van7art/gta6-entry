// The law: wanted levels, police pursuit, Air One, roadblocks, spike strips.
import { ROAD_X, ROAD_Y, WORLD_W, WORLD_H, SEA_Y } from './state.js';
import { clamp, dist, angleLerp } from './util.js';
import { onRoad, nearestRoadPoint, collideBuildings } from './city.js';
import { makeCar, damageCar, drawCar } from './vehicles.js';

const COPS_PER_STAR = [0, 2, 3, 4, 5, 6];

export function updateWanted(g, dt) {
  // Hiding: no cop close and out of the heli spotlight sheds a star every 12s.
  let seen = false;
  for (const cop of g.cops) if (dist(cop.x, cop.y, g.player.x, g.player.y) < 450) seen = true;
  if (g.heli && dist(g.heli.x, g.heli.y, g.player.x, g.player.y) < 320) seen = true;
  if (g.wanted > 0 && !seen && g.mode === 'playing') {
    g.hiddenTimer += dt;
    if (g.hiddenTimer > 12) {
      g.wanted -= 1;
      g.hiddenTimer = 0;
      g.toast = 'You lost them — wanted level down.';
    }
  } else {
    g.hiddenTimer = 0;
  }

  // Keep the pursuit at strength.
  const want = COPS_PER_STAR[g.wanted];
  g.cops = g.cops.filter((c) => !c.dead);
  while (g.cops.length < want) {
    const spot = spawnSpot(g);
    const cop = makeCar(spot.x, spot.y, Math.atan2(g.player.y - spot.y, g.player.x - spot.x),
      { color: '#1c2733', kind: 'cop', isCop: true, top: 380, hp: 120 });
    g.cops.push(cop);
  }
  while (g.cops.length > want) g.cops.pop();

  // Roadblocks from 4 stars.
  if (g.wanted >= 4) {
    g.roadblocks = g.roadblocks.filter((r) => r.timer > 0);
    if (g.roadblocks.length === 0) layRoadblock(g);
    for (const r of g.roadblocks) r.timer -= dt;
  } else {
    g.roadblocks = [];
  }

  // Air One from 5 stars.
  if (g.wanted >= 5) {
    if (!g.heli) {
      g.heli = { x: g.player.x, y: g.player.y - 260, angle: 0, rotor: 0, shootTimer: 1.2 };
      g.toast = '🚁 AIR ONE OVERHEAD';
    }
  } else {
    g.heli = null;
  }

  // Spike strips at 5 stars: one armed strip ahead of the player, re-armed every 20s.
  if (g.wanted >= 5) {
    g.stripTimer = (g.stripTimer || 0) - dt;
    if (g.stripTimer <= 0) {
      const ahead = { x: g.player.x + Math.cos(g.player.angle) * 420, y: g.player.y + Math.sin(g.player.angle) * 420 };
      const rp = nearestRoadPoint(g, ahead.x, ahead.y);
      if (rp) {
        g.strips = [{ x: rp.x, y: rp.y, angle: Math.atan2(g.player.y - rp.y, g.player.x - rp.x), armed: true, timer: 20 }];
        g.stripTimer = 20;
      }
    }
  } else {
    g.strips = [];
  }
  for (const s of g.strips) s.timer -= dt;
  g.strips = g.strips.filter((s) => s.timer > 0);
}

function spawnSpot(g) {
  const px = g.player.x;
  const py = g.player.y;
  for (let tries = 0; tries < 12; tries++) {
    const horizontal = Math.random() < 0.5;
    const x = horizontal ? px + (Math.random() < 0.5 ? -1 : 1) * (560 + Math.random() * 260)
      : ROAD_X[Math.floor(Math.random() * ROAD_X.length)];
    const y = horizontal ? ROAD_Y[Math.floor(Math.random() * ROAD_Y.length)]
      : py + (Math.random() < 0.5 ? -1 : 1) * (560 + Math.random() * 260);
    const cx = clamp(x, 60, WORLD_W - 60);
    const cy = clamp(y, 60, SEA_Y - 60);
    if (dist(cx, cy, px, py) > 500) return { x: cx, y: cy };
  }
  return { x: clamp(px + 650, 60, WORLD_W - 60), y: clamp(py, 60, SEA_Y - 60) };
}

function layRoadblock(g) {
  const px = g.player.x;
  const py = g.player.y;
  const ahead = { x: px + Math.cos(g.player.angle) * 380, y: py + Math.sin(g.player.angle) * 380 };
  const rp = nearestRoadPoint(g, ahead.x, ahead.y);
  if (!rp) return;
  const along = Math.abs(rp.x - px) > Math.abs(rp.y - py) ? 'v' : 'h';
  const rb = { x: rp.x, y: rp.y, angle: along === 'v' ? 0 : Math.PI / 2, timer: 30, cars: [] };
  for (const off of [-34, 34]) {
    const car = makeCar(
      along === 'v' ? rp.x : rp.x + off,
      along === 'v' ? rp.y + off : rp.y,
      rb.angle,
      { color: '#1c2733', kind: 'cop', isCop: true, hp: 120 },
    );
    rb.cars.push(car);
    g.cops.push(car);
  }
  g.roadblocks.push(rb);
}

export function updateCops(g, dt) {
  for (const cop of g.cops) {
    if (cop.dead) continue;
    const isBlock = g.roadblocks.some((r) => r.cars.includes(cop));
    if (isBlock) continue; // parked across the road
    const want = Math.atan2(g.player.y - cop.y, g.player.x - cop.x);
    cop.angle = angleLerp(cop.angle, want, dt * 2.2);
    const d = dist(cop.x, cop.y, g.player.x, g.player.y);
    const target = d > 90 ? cop.top : 120;
    cop.speed = cop.speed < target ? Math.min(target, cop.speed + 420 * dt) : Math.max(target, cop.speed - 400 * dt);
    if (!onRoad(g, cop.x, cop.y)) cop.speed = Math.min(cop.speed, 200);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.x = clamp(cop.x, 30, WORLD_W - 30);
    cop.y = clamp(cop.y, 30, SEA_Y - 24);
    if (collideBuildings(g, cop, 20)) cop.speed *= 0.5;
    // Ramming the player.
    if (g.car && d < 40 && Math.abs(cop.speed) > 80) {
      damageCar(g, g.car, 8 * dt * 10);
      cop.speed *= 0.6;
    }
    if (!g.car && d < 34) {
      g.player.hp -= 14 * dt;
    }
  }
  // Air One follows just ahead of the player and shoots at 5 stars.
  if (g.heli) {
    const h = g.heli;
    const tx = g.player.x + Math.cos(g.player.angle) * 150;
    const ty = g.player.y + Math.sin(g.player.angle) * 150;
    h.angle = angleLerp(h.angle, Math.atan2(ty - h.y, tx - h.x), dt * 1.5);
    h.x += Math.cos(h.angle) * 260 * dt;
    h.y += Math.sin(h.angle) * 260 * dt;
    h.rotor += dt * 22;
    h.shootTimer -= dt;
    if (h.shootTimer <= 0) {
      h.shootTimer = 1.4;
      const a = Math.atan2(g.player.y - h.y, g.player.x - h.x);
      g.bullets.push({ x: h.x, y: h.y, vx: Math.cos(a) * 950, vy: Math.sin(a) * 950, dmg: g.car ? 4 : 6, from: 'heli', life: 1.2 });
      g.particles.push({ x: h.x, y: h.y, vx: 0, vy: 0, life: 0.12, max: 0.12, kind: 'tracer', tx: g.player.x, ty: g.player.y });
    }
  }
  // Spike strips.
  if (g.car) {
    for (const s of g.strips) {
      if (s.armed && dist(g.car.x, g.car.y, s.x, s.y) < 30) {
        s.armed = false;
        g.car.slowTimer = 8;
        damageCar(g, g.car, 10);
        g.toast = 'Spike strip! Top speed cut for 8s.';
      }
    }
  }
}

export function drawPolice(ctx, g, view) {
  for (const s of g.strips) {
    if (s.x < view.x0 || s.x > view.x1 || s.y < view.y0 || s.y > view.y1) continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle + Math.PI / 2);
    ctx.fillStyle = '#222';
    ctx.fillRect(-46, -6, 92, 12);
    ctx.fillStyle = s.armed ? '#ffd76a' : '#888';
    for (let x = -40; x <= 40; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, -6); ctx.lineTo(x + 5, 0); ctx.lineTo(x, 6);
      ctx.fill();
    }
    ctx.restore();
  }
  for (const rb of g.roadblocks) {
    for (const car of rb.cars) drawCar(ctx, g, car);
  }
  if (g.heli) {
    const h = g.heli;
    // Spotlight cone on the ground, aimed at the player.
    const a = Math.atan2(g.player.y - h.y, g.player.x - h.x);
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(a);
    const grad = ctx.createLinearGradient(0, 0, 420, 0);
    grad.addColorStop(0, 'rgba(255,244,180,0.30)');
    grad.addColorStop(1, 'rgba(255,244,180,0.02)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(420, -110);
    ctx.lineTo(420, 110);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(40,20,5,0.3)';
    ctx.beginPath();
    ctx.ellipse(h.x + 18, h.y + 10, 30, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.angle);
    ctx.fillStyle = '#22303f';
    ctx.beginPath();
    ctx.roundRect(-22, -10, 44, 20, 8);
    ctx.fill();
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath();
    ctx.roundRect(6, -7, 12, 14, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-34, 0); ctx.lineTo(34, 0);
    ctx.moveTo(0, -34); ctx.lineTo(0, 34);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AIR ONE', h.x, h.y - 30);
  }
}
