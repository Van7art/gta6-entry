// vehicles.js — car meshes and arcade driving physics. Every car is a small
// box-built model (body, cabin, wheels, lights) plus a physics state: heading,
// speed, steering and damage. Handling is arcade: speed-sensitive steering,
// handbrake drift (lateral grip drops, rear slides, smoke) and crash damage.
import * as THREE from 'three';
import { VEHICLE_STATS } from './config.js';
import { clamp, lerp, rand, wrapAngle } from './util.js';

const CAR_COLORS = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x1c1c1e, 0x7f8c8d, 0x16a085];

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  m.position.set(x, y, z);
  return m;
}

export function makeCarMesh(type, colorHex) {
  const group = new THREE.Group();
  const color = colorHex !== undefined ? colorHex : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  const isTruck = type === 'truck';
  const isVan = type === 'van';
  const isSports = type === 'sports' || type === 'police';
  const length = isTruck ? 7.2 : isVan ? 5.4 : isSports ? 4.4 : 4.6;
  const width = isTruck ? 2.5 : 2.0;
  const bodyH = isTruck ? 1.1 : isVan ? 1.5 : 0.75;

  if (type === 'police') {
    group.add(box(length, bodyH, width, 0x1a1a1a, 0, 0.65, 0));
    group.add(box(length * 0.55, 0.6, width * 0.9, 0xecf0f1, -0.2, 1.3, 0));
    // Light bar.
    const bar = box(0.5, 0.22, 1.4, 0x222222, -0.2, 1.72, 0);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.2, 1.86, -0.35); group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.6), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(-0.2, 1.86, 0.35); group.add(blue);
    group.userData.lightRed = red; group.userData.lightBlue = blue;
    group.add(box(0.15, 0.25, 0.5, 0xffe9a8, length / 2, 0.7, -0.6));
    group.add(box(0.15, 0.25, 0.5, 0xffe9a8, length / 2, 0.7, 0.6));
  } else if (isTruck) {
    group.add(box(2.2, 1.6, width, color, length / 2 - 1.1, 1.1, 0)); // cab
    group.add(box(1.4, 1.1, width * 0.9, 0x222831, length / 2 - 0.6, 2.3, 0));
    group.add(box(4.6, 2.6, width, 0xd8d8d8, -length / 2 + 2.4, 1.7, 0)); // cargo box
  } else if (isVan) {
    group.add(box(length, 1.9, width, color, 0, 1.15, 0));
    group.add(box(length * 0.5, 0.5, width * 0.9, 0x222831, 0.3, 2.2, 0));
  } else {
    group.add(box(length, bodyH, width, color, 0, 0.62, 0));
    group.add(box(length * 0.52, 0.62, width * 0.86, 0x222831, -length * 0.05, 1.25, 0));
    if (isSports) {
      const spoiler = box(0.18, 0.08, width * 0.95, 0x111111, -length / 2 + 0.15, 1.35, 0);
      group.add(spoiler);
    }
    if (type === 'taxi') {
      group.children[0].material = new THREE.MeshLambertMaterial({ color: 0xf7c600 });
      const sign = box(0.9, 0.22, 0.5, 0x111111, 0, 1.68, 0);
      group.add(sign);
      const signTop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.5), new THREE.MeshBasicMaterial({ color: 0xffe14a }));
      signTop.position.set(0, 1.8, 0); group.add(signTop);
    }
  }
  // Headlights + taillights.
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.42), hl);
    h.position.set(length / 2 + 0.02, 0.66, s * (width / 2 - 0.45));
    group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.42), new THREE.MeshBasicMaterial({ color: 0xcc2222 }));
    t.position.set(-length / 2 - 0.02, 0.66, s * (width / 2 - 0.45));
    group.add(t);
  }
  // Wheels: a steer group per wheel (front wheels yaw), mesh spins on its axle.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  group.userData.wheels = [];
  group.userData.frontWheels = [];
  for (const [wx, wz, front] of [
    [length / 2 - 0.9, width / 2, true], [length / 2 - 0.9, -width / 2, true],
    [-length / 2 + 0.9, width / 2, false], [-length / 2 + 0.9, -width / 2, false],
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.38, wz);
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    pivot.add(w);
    group.add(pivot);
    group.userData.wheels.push(w);
    if (front) group.userData.frontWheels.push(pivot);
  }
  // Only the body and cabin cast shadows — wheels and lights do not.
  if (group.children[0]) group.children[0].castShadow = true;
  if (group.children[1]) group.children[1].castShadow = true;
  group.userData.length = length;
  group.userData.width = width;
  group.userData.type = type;
  return group;
}

export class Car {
  constructor(scene, type, x, z, heading, colorHex) {
    this.type = type;
    this.stats = VEHICLE_STATS[type];
    this.mesh = makeCarMesh(type, colorHex);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x; this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.hp = this.stats.hp;
    this.dead = false;
    this.drifting = false;
    this.velX = 0; this.velZ = 0;
    this.smokeTimer = 0;
    this.scene = scene;
  }

  get pos() { return { x: this.x, z: this.z }; }
  get radius() { return this.mesh.userData.length * 0.42; }

  // Forward unit vector in the XZ plane.
  forward() { return { x: Math.cos(this.heading), z: -Math.sin(this.heading) }; }

  // Arcade step. input: {throttle -1..1, steer -1..1, handbrake bool}.
  // surface: 1 on road, lower off-road. Returns impact info for sound/fx.
  step(dt, input, city, surface) {
    if (this.dead) return null;
    const st = this.stats;
    const fwd = this.forward();
    const forwardSpeed = this.velX * fwd.x + this.velZ * fwd.z;
    // Engine / brake.
    if (input.throttle > 0) {
      const accel = st.accel * surface * (1 - clamp(forwardSpeed / st.maxSpeed, 0, 1) * 0.85);
      this.velX += fwd.x * accel * input.throttle * dt;
      this.velZ += fwd.z * accel * input.throttle * dt;
    } else if (input.throttle < 0) {
      if (forwardSpeed > 0.5) {
        // Brake.
        this.velX -= fwd.x * st.accel * 1.6 * dt;
        this.velZ -= fwd.z * st.accel * 1.6 * dt;
      } else {
        // Reverse.
        const accel = st.accel * 0.6 * surface;
        this.velX += fwd.x * accel * input.throttle * dt;
        this.velZ += fwd.z * accel * input.throttle * dt;
      }
    }
    // Steering: stronger at low speed, weaker at top speed.
    const speedAbs = Math.hypot(this.velX, this.velZ);
    const steerAuthority = clamp(speedAbs / 8, 0, 1) * (1 - clamp(speedAbs / st.maxSpeed, 0, 1) * 0.55);
    const steerTarget = input.steer * st.turn * steerAuthority;
    this.steer = lerp(this.steer, steerTarget, 1 - Math.exp(-8 * dt));
    const dir = forwardSpeed >= 0 ? 1 : -1;
    this.heading += this.steer * dir * dt * (input.handbrake ? 1.5 : 1);
    // Grip: split velocity into forward/lateral, kill lateral by grip.
    const nf = this.forward();
    const fSpeed = this.velX * nf.x + this.velZ * nf.z;
    let lSpeed = this.velX * (-nf.z) + this.velZ * nf.x;
    const grip = input.handbrake ? 1.6 : st.grip;
    lSpeed *= Math.exp(-grip * dt);
    this.velX = nf.x * fSpeed + (-nf.z) * lSpeed;
    this.velZ = nf.z * fSpeed + nf.x * lSpeed;
    // Drag + rolling resistance.
    const drag = Math.exp(-(0.35 + (input.throttle === 0 ? 0.9 : 0)) * dt);
    this.velX *= drag; this.velZ *= drag;
    // Clamp speeds.
    const f2 = this.velX * nf.x + this.velZ * nf.z;
    if (f2 > st.maxSpeed * 1.15) {
      const k = (st.maxSpeed * 1.15) / f2;
      this.velX *= k; this.velZ *= k;
    }
    if (f2 < -st.maxReverse) {
      const k = (-st.maxReverse) / f2;
      this.velX *= k; this.velZ *= k;
    }
    this.x += this.velX * dt;
    this.z += this.velZ * dt;
    this.speed = Math.hypot(this.velX, this.velZ);
    this.drifting = input.handbrake && this.speed > 10 && Math.abs(this.steer) > 0.4;
    // Building collision: push out, lose speed, take damage.
    let impact = null;
    const hit = city.collideCircle(this.x, this.z, this.radius * 0.8);
    if (hit) {
      this.x += hit.nx * hit.depth;
      this.z += hit.nz * hit.depth;
      const into = this.velX * hit.nx + this.velZ * hit.nz;
      if (into < 0) {
        const loss = -into;
        this.velX -= hit.nx * into * 1.6;
        this.velZ -= hit.nz * into * 1.6;
        if (loss > 4) {
          this.damage(loss * 1.6);
          impact = { strength: loss / 20, x: this.x - hit.nx * 1.5, z: this.z - hit.nz * 1.5 };
        }
      }
    }
    // Ocean wall: the sea starts past x = 318.
    if (this.x > 316) { this.x = 316; if (this.velX > 0) this.velX *= -0.3; }
    if (this.x < -316) { this.x = -316; if (this.velX < 0) this.velX *= -0.3; }
    if (this.z > 316) { this.z = 316; if (this.velZ > 0) this.velZ *= -0.3; }
    if (this.z < -316) { this.z = -316; if (this.velZ < 0) this.velZ *= -0.3; }
    // Mesh sync: wheels spin + steer, body leans a touch in corners.
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const wheelSpin = (this.speed * dt) / 0.38;
    for (const w of this.mesh.userData.wheels) w.rotation.y += wheelSpin * (forwardSpeed >= 0 ? 1 : -1);
    for (const p of this.mesh.userData.frontWheels) p.rotation.y = this.steer * 0.35;
    this.mesh.rotation.z = clamp(-this.steer * this.speed * 0.004, -0.06, 0.06);
    return impact;
  }

  damage(amount) {
    this.hp -= amount;
    if (this.hp <= 0 && !this.dead) {
      this.hp = 0;
      this.dead = true;
      this.velX *= 0.2; this.velZ *= 0.2;
    }
  }

  repair() { this.hp = this.stats.hp; this.dead = false; }

  remove() {
    this.scene.remove(this.mesh);
  }
}
