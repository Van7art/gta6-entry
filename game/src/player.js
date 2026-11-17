// player.js — the on-foot character: WASD movement relative to the camera,
// running, jumping, entering and exiting cars (E), the third-person camera
// that follows on foot and chases behind the car, and building collision.
import * as THREE from 'three';
import { TUNING, CITY_HALF, BEACH_Z } from './config.js';
import { G } from './state.js';
import { resolveCircleVsBuildings, addHeat } from './vehicles.js';
import { sound } from './audio.js';
import { consumeMouseDelta, axis } from './input.js';

export function buildPlayerMesh(scene) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2f6fb2 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3240 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.45), jacket);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.55), new THREE.MeshLambertMaterial({ color: 0xffc93c }));
  cap.position.y = 2.14;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.65, 0.35), pants);
  legL.position.set(-0.2, 0.33, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.2;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.25), jacket);
  armL.position.set(-0.55, 1.1, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.55;
  group.add(armR);
  // the pistol, visible in the right hand
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.55, 0.75, 0.3);
  group.add(gun);
  group.userData.legL = legL;
  group.userData.legR = legR;
  group.userData.armR = armR;
  group.visible = true;
  scene.add(group);
  return group;
}

export function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist || 5.5;
  for (const car of G.cars) {
    if (car.isPolice) continue;
    const d = Math.hypot(car.x - G.player.pos.x, car.z - G.player.pos.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function tryEnterCar() {
  const p = G.player;
  if (p.inCar) {
    // get out: step to the side of the car
    const car = p.inCar;
    car.speed = 0;
    p.pos.set(car.x + Math.sin(car.heading + Math.PI / 2) * 2.4, 0, car.z + Math.cos(car.heading + Math.PI / 2) * 2.4);
    p.inCar = null;
    sound.door();
    sound.setEngine(0, false);
    return 'exit';
  }
  const car = nearestCar(5.5);
  if (!car) return null;
  if (!car.stolen && !car.parked && car.isTraffic) {
    // jacking a moving car is not allowed; only parked or stopped ones
    if (Math.abs(car.speed) > 1) return 'moving';
  }
  p.inCar = car;
  car.stolen = true;
  car.isTraffic = false;
  G.traffic = G.traffic.filter((c) => c !== car);
  G.carsStolen += 1;
  if (!car.parked) addHeat(0.3);
  sound.door();
  return 'enter';
}

export function updatePlayer(dt) {
  const p = G.player;
  const { dx, dy } = consumeMouseDelta();
  p.camYaw -= dx * 0.0032;
  p.camPitch = Math.max(0.05, Math.min(1.1, p.camPitch + dy * 0.0024));

  if (p.inCar) {
    // player position follows the car; camera handled in updateCamera
    p.pos.set(p.inCar.x, 0, p.inCar.z);
    p.heading = p.inCar.heading;
    return;
  }
  const input = axis();
  const run = G.keys.ShiftLeft || G.keys.ShiftRight;
  const speed = run ? TUNING.runSpeed : TUNING.walkSpeed;
  const len = Math.hypot(input.x, input.y);
  let moving = false;
  if (len > 0) {
    moving = true;
    const nx = input.x / len;
    const ny = input.y / len;
    // camera-relative movement: W walks away from the camera, D strafes right.
    const sin = Math.sin(p.camYaw);
    const cos = Math.cos(p.camYaw);
    const vx = nx * cos - ny * sin;
    const vz = -nx * sin - ny * cos;
    const px = p.pos.x + vx * speed * dt;
    const pz = p.pos.z + vz * speed * dt;
    const pos = { x: px, z: pz };
    if (!resolveCircleVsBuildings(pos, TUNING.playerRadius)) {
      p.pos.x = Math.max(-CITY_HALF - 30, Math.min(CITY_HALF + 30, px));
      p.pos.z = Math.max(-CITY_HALF - 30, Math.min(BEACH_Z + 60, pz));
    }
    p.heading = Math.atan2(vx, vz);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  // jump + gravity
  if (G.keys.Space && p.onGround) {
    p.velY = TUNING.jumpSpeed;
    p.onGround = false;
  }
  if (!p.onGround) {
    p.velY -= TUNING.gravity * dt;
    p.pos.y += p.velY * dt;
    if (p.pos.y <= 0) { p.pos.y = 0; p.velY = 0; p.onGround = true; }
  }
  // walk-cycle animation
  const mesh = p.mesh;
  if (mesh) {
    mesh.position.copy(p.pos);
    mesh.rotation.y = p.heading;
    mesh.visible = true;
    const swing = moving ? Math.sin(G.time * (run ? 14 : 10)) * 0.5 : 0;
    mesh.userData.legL.rotation.x = swing;
    mesh.userData.legR.rotation.x = -swing;
    mesh.userData.armR.rotation.x = p.shootCooldown > 0 ? -1.4 : -swing * 0.7;
  }
  sound.setEngine(0, false);
}

export function updateCamera(dt) {
  const p = G.player;
  const cam = G.camera;
  if (!cam) return;
  let target;
  let dist = p.camDist;
  let height = 3.2;
  let yaw = p.camYaw;
  if (p.inCar) {
    const car = p.inCar;
    // chase cam: ease the yaw toward the car's heading
    let dh = (car.heading + Math.PI) - p.camYaw;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    p.camYaw += dh * Math.min(1, dt * 2.2);
    yaw = p.camYaw;
    dist = 11;
    height = 4.2;
    target = new THREE.Vector3(car.x, 1.6, car.z);
  } else {
    target = new THREE.Vector3(p.pos.x, p.pos.y + 1.8, p.pos.z);
  }
  const cx = target.x + Math.sin(yaw) * Math.cos(p.camPitch) * dist;
  const cz = target.z + Math.cos(yaw) * Math.cos(p.camPitch) * dist;
  const cy = target.y + Math.sin(p.camPitch) * dist + (p.inCar ? 0.4 : 0);
  const desired = new THREE.Vector3(cx, Math.max(1.2, cy), cz);
  cam.position.lerp(desired, Math.min(1, dt * 8));
  cam.lookAt(target);
}
