// Weapons: pistol, SMG, shotgun, the wheel, bullets, reload, punch.
import { WEAPONS } from './state.js';
import { dist } from './util.js';
import { buildingAt } from './city.js';
import { damageCar } from './vehicles.js';
import { scarePeds } from './peds.js';

export function currentWeapon(g) {
  return WEAPONS[g.weapons.slot];
}

export function fireWeapon(g) {
  if (g.mode !== 'playing') return;
  const w = currentWeapon(g);
  const now = g.time;
  if (g.weapons.cool > now) return;
  if (g.weapons.mags[g.weapons.slot] <= 0) {
    reloadWeapon(g);
    return;
  }
  g.weapons.cool = now + w.rate;
  g.weapons.mags[g.weapons.slot] -= 1;
  g.stats.shots += 1;
  const ox = g.player.x;
  const oy = g.player.y;
  const cam = g.camera;
  const wx = cam.x - 640 + g.mouse.x;
  const wy = cam.y - 400 + g.mouse.y;
  const base = Math.atan2(wy - oy, wx - ox);
  for (let i = 0; i < w.pellets; i++) {
    const a = base + (Math.random() - 0.5) * 2 * w.spread;
    g.bullets.push({
      x: ox + Math.cos(base) * 26, y: oy + Math.sin(base) * 26,
      vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
      dmg: w.dmg, from: 'player', life: 0.9,
    });
  }
  g.particles.push({ x: ox + Math.cos(base) * 30, y: oy + Math.sin(base) * 30, vx: 0, vy: 0, life: 0.08, max: 0.08, kind: 'flash' });
  scarePeds(g, ox, oy, 260);
  if (g.audio) g.audio.shoot();
}

export function reloadWeapon(g) {
  const w = currentWeapon(g);
  const slot = g.weapons.slot;
  const need = w.mag - g.weapons.mags[slot];
  if (need <= 0 || g.weapons.reserve <= 0) return;
  const take = Math.min(need, g.weapons.reserve);
  g.weapons.mags[slot] += take;
  g.weapons.reserve -= take;
  if (g.audio) g.audio.reload();
}

export function switchWeapon(g, slot) {
  if (slot < 0 || slot > 2) return;
  if (!g.weapons.owned[slot]) return;
  g.weapons.slot = slot;
  g.weapons.cool = 0;
}

export function punch(g) {
  if (g.mode !== 'playing' || !g.player.onFoot) return;
  const px = g.player.x;
  const py = g.player.y;
  const a = g.player.angle;
  const tx = px + Math.cos(a) * 30;
  const ty = py + Math.sin(a) * 30;
  for (const p of g.peds) {
    if (dist(p.x, p.y, tx, ty) < 26) {
      p.state = 'flee';
      p.fleeX = px; p.fleeY = py; p.timer = 2;
      p.x += Math.cos(a) * 26;
      p.y += Math.sin(a) * 26;
    }
  }
  for (const cop of g.cops) {
    if (dist(cop.x, cop.y, tx, ty) < 30) {
      cop.speed = Math.max(cop.speed, 120);
      cop.x += Math.cos(a) * 20;
      cop.y += Math.sin(a) * 20;
      if (g.wanted < 5) { g.wanted += 1; g.toast = 'You hit a cop — wanted level up!'; }
    }
  }
  if (g.audio) g.audio.punch();
}

export function updateBullets(g, dt) {
  for (const b of g.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (buildingAt(g, b.x, b.y)) {
      b.life = 0;
      g.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.15, max: 0.15, kind: 'spark' });
    }
    if (b.from === 'player') {
      const targets = [...g.cars, ...g.cops];
      if (g.car) targets.push(g.car);
      for (const car of targets) {
        if (car.dead || car.isPlayer) continue;
        if (dist(b.x, b.y, car.x, car.y) < 24) {
          b.life = 0;
          g.stats.hits += 1;
          damageCar(g, car, b.dmg);
          if (car.isCop && g.wanted < 5) { g.wanted += 1; g.toast = 'You shot a cop — wanted level up!'; }
          break;
        }
      }
      if (b.life > 0) {
        for (let i = 0; i < g.peds.length; i++) {
          const p = g.peds[i];
          if (dist(b.x, b.y, p.x, p.y) < 12) {
            b.life = 0;
            g.stats.hits += 1;
            if (typeof p.hp === 'number') {
              // Armed guard (mission target): takes damage, no wanted change.
              p.hp -= b.dmg;
              if (p.hp <= 0) g.peds.splice(i, 1);
            } else {
              p.state = 'flee';
              p.fleeX = b.x; p.fleeY = b.y; p.timer = 4;
              if (g.wanted < 5) { g.wanted += 1; g.toast = 'Pedestrian shot — wanted level up!'; }
            }
            break;
          }
        }
      }
    } else if (b.from === 'heli') {
      if (g.car) {
        if (dist(b.x, b.y, g.car.x, g.car.y) < 26) {
          b.life = 0;
          damageCar(g, g.car, b.dmg);
        }
      } else if (dist(b.x, b.y, g.player.x, g.player.y) < 14) {
        b.life = 0;
        g.player.hp -= b.dmg;
      }
    }
  }
  g.bullets = g.bullets.filter((b) => b.life > 0);
}

export function drawBullets(ctx, g) {
  for (const b of g.bullets) {
    ctx.strokeStyle = b.from === 'heli' ? '#ff5a4d' : '#ffe9a8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const p of g.particles) {
    const a = p.life / p.max;
    if (p.kind === 'smoke') {
      ctx.fillStyle = `rgba(120,120,120,${0.5 * a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10 * (1.6 - a), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'fire') {
      ctx.fillStyle = `rgba(255,${120 + Math.floor(80 * a)},40,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8 * a + 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'flash') {
      ctx.fillStyle = `rgba(255,240,160,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12 * a + 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'spark') {
      ctx.fillStyle = `rgba(255,220,120,${a})`;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    } else if (p.kind === 'tracer') {
      ctx.strokeStyle = `rgba(255,90,70,${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.tx, p.ty);
      ctx.stroke();
    }
  }
}
