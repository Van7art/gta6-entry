// vehicles.js — car factory (every car is built from boxes, wheels and lights),
// arcade driving physics for the player, traffic AI that follows the road
// grid, and police interceptors that chase and ram the player.
import * as THREE from 'three';
import { CAR_MODELS, CITY_HALF, PITCH, ROAD, BEACH_Z, mulberry32 } from './config.js';
import { G } from './state.js';
import { nearestRoadPoint } from './city.js';
import { sound } from './audio.js';

const rand = mulberry32(777);

export function modelById(id) {
  return CAR_MODELS.find((m) => m.id === id) || CAR_MODELS[2];
}

export function buildCarMesh(model, isPolice) {
  const group = new THREE.Group();
  const bodyColor = isPolice ? 0x1c2733 : model.color;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.75, 4.4),
    new THREE.MeshLambertMaterial({ color: bodyColor }),
  );
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 2.2),
    new THREE.MeshLambertMaterial({ color: isPolice ? 0xffffff : 0x222a33 }),
  );
  cabin.position.set(0, 1.3, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  if (model.sport) {
    const spoiler = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.1, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x1c2733 }),
    );
    spoiler.position.set(0, 1.15, -2.1);
    group.add(spoiler);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  group.userData.wheels = [];
  for (const [wx, wz] of [[-1.05, 1.45], [1.05, 1.45], [-1.05, -1.45], [1.05, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
    group.userData.wheels.push(wheel);
  }
  // headlights + taillights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const sx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
    h.position.set(sx, 0.7, 2.22);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    t.position.set(sx, 0.7, -2.22);
    group.add(t);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }),
    );
    bar.position.set(0, 1.75, -0.2);
    group.add(bar);
    group.userData.lightBar = bar;
    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(2.12, 0.3, 1.2),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    badge.position.set(0, 0.65, 0.4);
    group.add(badge);
  }
  return group;
}

export function spawnCar(modelId, x, z, heading, opts) {
  const o = opts || {};
  const model = modelById(modelId);
  const mesh = buildCarMesh(model, !!o.police);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  const car = {
    model,
    mesh,
    heading,
    speed: 0,
    x,
    z,
    health: 100,
    isPlayer: !!o.player,
    isPolice: !!o.police,
    isTraffic: !!o.traffic,
    parked: !!o.parked,
    stolen: false,
    // traffic AI
    aiDir: 0, // 0=+x 1=-x 2=+z 3=-z
    aiSpeed: 8 + rand() * 6,
    aiTurnAt: 0,
    flash: 0,
  };
  G.cars.push(car);
  if (car.isTraffic) G.traffic.push(car);
  if (car.isPolice) G.police.push(car);
  return car;
}

export function removeCar(car) {
  G.scene.remove(car.mesh);
  for (const arr of [G.cars, G.traffic, G.police]) {
    const i = arr.indexOf(car);
    if (i >= 0) arr.splice(i, 1);
  }
  if (G.player.inCar === car) G.player.inCar = null;
}

// --- collision helpers ------------------------------------------------------
function collideBuildings(x, z, radius) {
  for (const c of G.colliders) {
    if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) {
      return c;
    }
  }
  return null;
}

export function resolveCircleVsBuildings(pos, radius) {
  const c = collideBuildings(pos.x, pos.z, radius);
  if (!c) return false;
  const dxLeft = pos.x + radius - c.minX;
  const dxRight = c.maxX - (pos.x - radius);
  const dzTop = pos.z + radius - c.minZ;
  const dzBottom = c.maxZ - (pos.z - radius);
  const m = Math.min(dxLeft, dxRight, dzTop, dzBottom);
  if (m === dxLeft) pos.x = c.minX - radius;
  else if (m === dxRight) pos.x = c.maxX + radius;
  else if (m === dzTop) pos.z = c.minZ - radius;
  else pos.z = c.maxZ + radius;
  return true;
}

// --- player driving ---------------------------------------------------------
export function updatePlayerCar(dt, input) {
  const car = G.player.inCar;
  if (!car) return;
  const m = car.model;
  const fwd = input.y; // +1 accelerate, -1 brake/reverse
  const steer = input.x;
  if (fwd > 0) car.speed += m.accel * dt;
  else if (fwd < 0) {
    if (car.speed > 0.5) car.speed -= m.accel * 1.4 * dt;
    else car.speed -= m.accel * 0.55 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 9 * dt;
    if (Math.abs(car.speed) < 0.3) car.speed = 0;
  }
  car.speed = Math.max(-14, Math.min(m.top, car.speed));
  const steerAmt = steer * m.grip * dt * Math.min(1, Math.abs(car.speed) / 8 + 0.25) * Math.sign(car.speed || 1);
  car.heading -= steerAmt;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const hit = collideBuildings(nx, nz, 1.6);
  if (hit) {
    if (Math.abs(car.speed) > 12) { sound.crash(); addHeat(0.08); }
    car.speed *= -0.25;
  } else {
    car.x = Math.max(-CITY_HALF - 30, Math.min(CITY_HALF + 30, nx));
    car.z = Math.max(-CITY_HALF - 30, Math.min(BEACH_Z + 30, nz));
  }
  // bump traffic cars
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 12 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const push = (3.5 - d) * 0.5;
      other.x += (dx / d) * push;
      other.z += (dz / d) * push;
      if (Math.abs(car.speed) > 6) {
        car.speed *= 0.82;
        if (other.isTraffic) { other.speed = 0; sound.crash(); }
      }
    }
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2;
  G.player.speed = car.speed;
  sound.setEngine(Math.abs(car.speed) / m.top, true);
}

export function addHeat(amount) {
  G.wantedHeat = Math.min(1, G.wantedHeat + amount);
}

// --- traffic AI ---------------------------------------------------------------
export function spawnTraffic() {
  const ids = ['marlin', 'sunset', 'dune', 'taxi', 'van', 'marlin', 'sunset'];
  for (let i = 0; i < 14; i++) {
    const x = (rand() * 2 - 1) * (CITY_HALF - 20);
    const z = (rand() * 2 - 1) * (CITY_HALF - 20);
    const p = nearestRoadPoint(x, z);
    const car = spawnCar(ids[i % ids.length], p.x, p.z, rand() * Math.PI * 2, { traffic: true });
    car.aiDir = Math.floor(rand() * 4);
    car.speed = car.aiSpeed;
  }
}

const DIR_VEC = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export function updateTraffic(dt) {
  for (const car of G.traffic) {
    if (car.speed < car.aiSpeed) car.speed += 4 * dt;
    const [dx, dz] = DIR_VEC[car.aiDir];
    let nx = car.x + dx * car.speed * dt;
    let nz = car.z + dz * car.speed * dt;
    // turn at intersections
    const onRoadX = Math.abs(((nx + CITY_HALF + ROAD / 2) % PITCH) - ROAD / 2) < 2 || true;
    const nearIntersection =
      Math.abs(((nx + CITY_HALF + ROAD / 2) % PITCH) - PITCH / 2) < 4 &&
      Math.abs(((nz + CITY_HALF + ROAD / 2) % PITCH) - PITCH / 2) < 4;
    if (nearIntersection && rand() < dt * 1.2) {
      car.aiDir = Math.floor(rand() * 4);
    }
    // keep inside the city, bounce at the edge
    if (nx > CITY_HALF + 10 || nx < -CITY_HALF - 10 || nz > BEACH_Z - 6 || nz < -CITY_HALF - 10) {
      car.aiDir = (car.aiDir + 2) % 4;
      nx = car.x; nz = car.z;
    }
    // don't drive through buildings: slide along the road instead
    if (collideBuildings(nx, nz, 1.6)) {
      car.aiDir = (car.aiDir + (rand() < 0.5 ? 1 : 3)) % 4;
      nx = car.x; nz = car.z;
    }
    // slow down for the car ahead
    for (const other of G.cars) {
      if (other === car) continue;
      const ox = other.x - car.x;
      const oz = other.z - car.z;
      if (ox * dx + oz * dz > 0 && ox * ox + oz * oz < 64) {
        car.speed = Math.max(0, car.speed - 14 * dt);
      }
    }
    car.x = nx; car.z = nz;
    const targetHeading = Math.atan2(dx, dz);
    let dh = targetHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += dh * Math.min(1, dt * 3);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2;
  }
}

// --- police -------------------------------------------------------------------
export function spawnPolice(count) {
  const p = G.player.pos;
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const x = p.x + Math.cos(a) * (40 + rand() * 30);
    const z = p.z + Math.sin(a) * (40 + rand() * 30);
    const rp = nearestRoadPoint(x, z);
    spawnCar('police', rp.x, rp.z, 0, { police: true });
  }
}

export function updatePolice(dt) {
  const p = G.player.pos;
  const inCar = !!G.player.inCar;
  const playerSpeed = inCar ? Math.abs(G.player.inCar.speed) : 0;
  for (const cop of [...G.police]) {
    const dx = p.x - cop.x;
    const dz = p.z - cop.z;
    const dist = Math.hypot(dx, dz);
    const targetHeading = Math.atan2(dx, dz);
    let dh = targetHeading - cop.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const top = cop.model.top * (0.9 + G.wanted * 0.04);
    const wantSpeed = dist > 60 ? top : Math.min(top, 12 + dist * 0.35 + playerSpeed * 0.55);
    cop.speed += (wantSpeed - cop.speed) * Math.min(1, dt * 1.2);
    cop.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh * 2.2 * dt));
    let nx = cop.x + Math.sin(cop.heading) * cop.speed * dt;
    let nz = cop.z + Math.cos(cop.heading) * cop.speed * dt;
    if (collideBuildings(nx, nz, 1.6)) {
      cop.heading += 1.2 * dt * 8;
      nx = cop.x; nz = cop.z;
      cop.speed *= 0.6;
    }
    cop.x = nx; cop.z = nz;
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.heading;
    cop.flash += dt * 6;
    if (cop.mesh.userData.lightBar) {
      cop.mesh.userData.lightBar.material.color.setHex(Math.sin(cop.flash) > 0 ? 0xff2222 : 0x2244ff);
    }
    for (const w of cop.mesh.userData.wheels) w.rotation.x += cop.speed * dt * 2;
    // ram the player car
    if (inCar && dist < 4.2) {
      G.player.inCar.speed *= 0.92;
      cop.speed *= 0.9;
      if (Math.abs(G.player.inCar.speed) > 8 && Math.random() < dt * 2) sound.crash();
    }
    // on foot: cops close in and the bust timer runs (handled in wanted.js)
  }
}
