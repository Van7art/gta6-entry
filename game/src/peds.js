// Pedestrians: sidewalk walkers who flee gunfire and speeding cars.
import { WORLD_W, WORLD_H, BEACH_Y, SEA_Y, ROAD_X, ROAD_Y } from './state.js';
import { clamp, dist, mulberry32, pick } from './util.js';
import { collideBuildings } from './city.js';

const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1'];

export function spawnPeds(g, n) {
  const rng = mulberry32(g.rngSeed + 31);
  g.peds = [];
  for (let i = 0; i < n; i++) {
    const onBeach = rng() < 0.25;
    g.peds.push({
      x: onBeach ? 60 + rng() * (WORLD_W - 120) : 60 + rng() * (WORLD_W - 120),
      y: onBeach ? BEACH_Y + 20 + rng() * 110 : 60 + rng() * (BEACH_Y - 120),
      angle: rng() * Math.PI * 2,
      speed: 0,
      color: pick(rng, SHIRTS),
      state: 'walk',
      fleeX: 0, fleeY: 0,
      timer: 1 + rng() * 4,
    });
  }
}

export function scarePeds(g, x, y, radius) {
  for (const p of g.peds) {
    if (dist(p.x, p.y, x, y) < radius) {
      p.state = 'flee';
      p.fleeX = x;
      p.fleeY = y;
      p.timer = 2.5;
    }
  }
}

export function updatePeds(g, dt) {
  for (const p of g.peds) {
    p.timer -= dt;
    if (p.state === 'flee') {
      const away = Math.atan2(p.y - p.fleeY, p.x - p.fleeX);
      p.angle = away;
      p.speed = 190;
      if (p.timer <= 0) { p.state = 'walk'; p.timer = 2 + Math.random() * 3; }
    } else {
      p.speed = 55;
      if (p.timer <= 0) {
        // Wander: mostly along roads, sometimes across the beach.
        const nearRoad = ROAD_X.concat(ROAD_Y).length > 0;
        p.angle = Math.floor(Math.random() * 4) * (Math.PI / 2) + (Math.random() - 0.5) * 0.4;
        p.timer = 2 + Math.random() * 4;
      }
    }
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    p.x = clamp(nx, 24, WORLD_W - 24);
    p.y = clamp(ny, 24, SEA_Y - 18);
    if (collideBuildings(g, p, 10)) {
      p.angle += Math.PI / 2;
      p.timer = 0.5;
    }
    // A speeding car that clips a ped is a crime.
    if (g.car && dist(p.x, p.y, g.car.x, g.car.y) < 26 && Math.abs(g.car.speed) > 60) {
      p.state = 'flee';
      p.fleeX = g.car.x;
      p.fleeY = g.car.y;
      p.timer = 2;
      if (!p.hit) {
        p.hit = true;
        g.player.hp = Math.max(0, g.player.hp - 2);
        // Hitting a pedestrian draws the police.
        if (g.wanted < 5) {
          g.wanted = Math.min(5, g.wanted + 1);
          g.toast = 'Pedestrian hit — wanted level up!';
        }
      }
    } else if (dist(p.x, p.y, g.player.x, g.player.y) > 60) {
      p.hit = false;
    }
  }
}

export function drawPeds(ctx, g, view) {
  for (const p of g.peds) {
    if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
    ctx.fillStyle = 'rgba(40,20,5,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x + 5, p.y + 3, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (p.state === 'flee') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Trebuchet MS, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', p.x, p.y - 12);
    }
  }
}
