// Cars: player driving physics, traffic AI, carjacking, damage.
import { ROAD_X, ROAD_Y, WORLD_W, WORLD_H, BEACH_Y, SEA_Y, GARAGE, PAINTS } from './state.js';
import { clamp, angleDiff, angleLerp, dist, mulberry32, pick } from './util.js';
import { onRoad, collideBuildings, inSea } from './city.js';

const TRAFFIC_COLORS = ['#c23b2e', '#2e6fc2', '#e8e8e8', '#3a3a3a', '#c2a23a', '#4da24a', '#7a4da2', '#d47f2e'];

export function makeCar(x, y, angle, opts = {}) {
  return {
    x, y, angle, speed: 0,
    color: opts.color || '#c23b2e',
    kind: opts.kind || 'sedan', // sedan | sport | taxi | cop | van
    hp: opts.hp || 100,
    maxHp: opts.hp || 100,
    isPlayer: !!opts.isPlayer,
    isCop: !!opts.isCop,
    driver: opts.driver !== false,
    top: opts.top || 300,
    accel: opts.accel || 380,
    cruise: 120 + Math.random() * 60,
    wp: null, // traffic waypoint {x,y}
    wait: 0,
    dead: false,
    smoke: 0,
    paint: opts.paint ?? 0,
    wheels: opts.wheels ?? 0,
    spoiler: !!opts.spoiler,
    slowTimer: 0,
  };
}

export function playerTopSpeed(g) {
  return GARAGE.engine[g.garage.engine - 1].top;
}

export function spawnTraffic(g, n) {
  const rng = mulberry32(g.rngSeed + 77);
  g.cars = [];
  for (let i = 0; i < n; i++) {
    const rx = pick(rng, ROAD_X);
    const ry = pick(rng, ROAD_Y);
    const horizontal = rng() < 0.5;
    const car = makeCar(
      horizontal ? 100 + rng() * (WORLD_W - 200) : rx,
      horizontal ? ry : 100 + rng() * (BEACH_Y - 200),
      horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      { color: pick(rng, TRAFFIC_COLORS), kind: rng() < 0.12 ? 'taxi' : 'sedan' },
    );
    car.wp = nextWaypoint(g, car, rng);
    g.cars.push(car);
  }
}

function nextWaypoint(g, car, rng) {
  const r = rng || Math.random;
  // Pick a nearby intersection, then head for it.
  const xs = ROAD_X.filter((x) => Math.abs(x - car.x) < 900);
  const ys = ROAD_Y.filter((y) => Math.abs(y - car.y) < 900);
  return { x: xs[Math.floor(r() * xs.length)] ?? 1000, y: ys[Math.floor(r() * ys.length)] ?? 600 };
}

export function updatePlayerCar(g, dt) {
  const car = g.car;
  if (!car) return;
  const inp = g.input;
  const top = playerTopSpeed(g) * (car.slowTimer > 0 ? 0.55 : 1);
  const offroad = !onRoad(g, car.x, car.y);
  const limit = offroad ? top * 0.62 : top;
  if (inp.up) car.speed += car.accel * dt;
  if (inp.down) car.speed -= (car.speed > 0 ? 620 : 260) * dt;
  if (!inp.up && !inp.down) car.speed -= Math.sign(car.speed) * 220 * dt;
  car.speed = clamp(car.speed, -130, limit);
  if (Math.abs(car.speed) < 4 && !inp.up && !inp.down) car.speed = 0;
  const steer = (inp.left ? -1 : 0) + (inp.right ? 1 : 0);
  const grip = inp.drift ? 2.6 : 1.5;
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * grip * clamp(Math.abs(car.speed) / 160, 0, 1) * dt * dir;
  if (inp.drift && Math.abs(car.speed) > 120) {
    g.particles.push({ x: car.x, y: car.y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 0.5, max: 0.5, kind: 'smoke' });
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const oldX = car.x;
  const oldY = car.y;
  car.x = clamp(nx, 30, WORLD_W - 30);
  car.y = clamp(ny, 30, SEA_Y - 24);
  if (inSea(g, car.x, car.y)) { car.x = oldX; car.y = oldY; car.speed *= 0.4; }
  if (collideBuildings(g, car, 20)) car.speed *= 0.45;
  if (car.slowTimer > 0) car.slowTimer -= dt;
  if (car.hp < 40 && Math.random() < dt * 4) {
    g.particles.push({ x: car.x, y: car.y - 8, vx: 0, vy: -30, life: 0.8, max: 0.8, kind: 'smoke' });
  }
  // Sync the on-foot player position to the car.
  g.player.x = car.x;
  g.player.y = car.y;
  g.player.angle = car.angle;
}

export function updateTraffic(g, dt) {
  const px = g.player.x;
  const py = g.player.y;
  for (const car of g.cars) {
    if (car.dead) continue;
    if (!car.wp || dist(car.x, car.y, car.wp.x, car.wp.y) < 60) {
      car.wp = nextWaypoint(g, car, Math.random);
    }
    const want = Math.atan2(car.wp.y - car.y, car.wp.x - car.x);
    car.angle = angleLerp(car.angle, want, dt * 1.6);
    let target = car.cruise;
    // Brake for a car ahead.
    for (const other of [...g.cars, g.car].filter(Boolean)) {
      if (other === car || other.dead) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 70) {
        const ahead = Math.cos(car.angle) * (other.x - car.x) + Math.sin(car.angle) * (other.y - car.y);
        if (ahead > 0) target = 0;
      }
    }
    car.speed = car.speed < target ? Math.min(target, car.speed + 200 * dt) : Math.max(target, car.speed - 300 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (collideBuildings(g, car, 18)) car.speed *= 0.5;
    // Keep traffic near the action: respawn far cars elsewhere on the grid.
    if (dist(car.x, car.y, px, py) > 1100) {
      const rx = ROAD_X[Math.floor(Math.random() * ROAD_X.length)];
      const ry = ROAD_Y[Math.floor(Math.random() * ROAD_Y.length)];
      car.x = rx + (Math.random() - 0.5) * 60;
      car.y = ry + (Math.random() - 0.5) * 60;
      car.wp = nextWaypoint(g, car, Math.random);
    }
  }
  // Gentle car-car separation so traffic does not stack.
  const all = [...g.cars.filter((c) => !c.dead), g.car].filter(Boolean);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const d = dist(a.x, a.y, b.x, b.y);
      if (d < 34 && d > 0.01) {
        const push = (34 - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
      }
    }
  }
}

export function tryEnterCar(g) {
  if (g.car) return false; // already driving
  let best = null;
  let bestD = 90;
  for (const car of g.cars) {
    if (car.dead) continue;
    const d = dist(g.player.x, g.player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return false;
  const stolen = best.driver && !best.isCop;
  if (stolen) {
    g.stats.carjacks += 1;
    addWanted(g, 1, 'carjack');
    spawnPed(g, best.x, best.y); // the pulled-out driver
  }
  best.driver = true;
  best.isPlayer = true;
  best.color = PAINTS[g.garage.paint].color;
  best.top = playerTopSpeed(g);
  best.maxHp = GARAGE.armour[g.garage.armour - 1].hp;
  if (best.hp > best.maxHp) best.hp = best.maxHp;
  g.car = best;
  g.cars = g.cars.filter((c) => c !== best);
  g.player.onFoot = false;
  return true;
}

export function exitCar(g) {
  if (!g.car) return;
  const car = g.car;
  car.isPlayer = false;
  car.driver = true;
  g.cars.push(car);
  g.car = null;
  g.player.onFoot = true;
  g.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  g.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
}

export function addWanted(g, stars, why) {
  if (g.wanted >= 5) return;
  g.wanted = Math.min(5, g.wanted + stars);
  g.hiddenTimer = 0;
  if (g.wanted >= 3 && why) g.toast = why === 'carjack' ? 'Car stolen — wanted level up!' : 'Wanted level up!';
}

export function damageCar(g, car, dmg) {
  car.hp -= dmg;
  if (car.hp <= 0 && !car.dead) {
    car.dead = true;
    for (let i = 0; i < 14; i++) {
      g.particles.push({
        x: car.x + (Math.random() - 0.5) * 30, y: car.y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160,
        life: 0.7, max: 0.7, kind: 'fire',
      });
    }
    if (car.isPlayer) {
      g.player.hp = 0;
    }
  }
}

export function spawnPed(g, x, y) {
  g.peds.push({
    x, y, angle: Math.random() * Math.PI * 2, speed: 0,
    color: ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c'][Math.floor(Math.random() * 5)],
    state: 'walk', fleeX: 0, fleeY: 0, timer: 2 + Math.random() * 4,
  });
}

export function drawCar(ctx, g, car) {
  // Long dusk shadow to the east.
  ctx.fillStyle = 'rgba(40,20,5,0.35)';
  ctx.beginPath();
  ctx.ellipse(car.x + 14, car.y + 6, 26, 12, car.angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const len = car.kind === 'van' ? 52 : 44;
  const wid = 22;
  ctx.fillStyle = '#111';
  ctx.fillRect(-len / 2 - 2, -wid / 2 - 3, 10, 6);
  ctx.fillRect(-len / 2 - 2, wid / 2 - 3, 10, 6);
  ctx.fillRect(len / 2 - 8, -wid / 2 - 3, 10, 6);
  ctx.fillRect(len / 2 - 8, wid / 2 - 3, 10, 6);
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-len / 2, -wid / 2, len, wid, 6);
  ctx.fill();
  if (car.isCop) {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(-6, -wid / 2, 12, wid);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PVPD', 0, 3);
  }
  ctx.fillStyle = 'rgba(20,30,50,0.85)';
  ctx.beginPath();
  ctx.roundRect(-4, -wid / 2 + 3, 14, wid - 6, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,180,0.9)';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 4, 3, 5);
  ctx.fillRect(len / 2 - 2, wid / 2 - 9, 3, 5);
  if (car.spoiler) {
    ctx.fillStyle = '#222';
    ctx.fillRect(-len / 2 - 2, -wid / 2 - 2, 4, wid + 4);
  }
  if (car.hp < 40) {
    ctx.fillStyle = 'rgba(120,120,120,0.7)';
    ctx.beginPath();
    ctx.arc(-8, -6, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
