// police.js — the wanted system and the Porto Verde PD. Stars rise when the
// player commits crimes; police cruisers spawn on nearby roads, chase and
// ram the player, and pin them to bust them. At 4 stars the PVPD sends
// "Air One", a police helicopter with a searchlight that tracks the player
// and opens fire at 5 stars, plus roadblocks of parked cruisers across the
// road ahead. At 5 stars a spike strip is laid ahead: drive over it and
// the tyres blow, capping top speed until the car is repaired. Break line
// of sight long enough and the heat cools off one star at a time.
import * as THREE from 'three';
import { WANTED } from './config.js';
import { Car } from './vehicles.js';
import { clamp, dist2D, rand } from './util.js';

function makeHeliMesh() {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.3, 1.8), mat(0x1c2f4a));
  body.position.y = 0; g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.6), mat(0xecf0f1));
  nose.position.set(2.1, -0.1, 0); g.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 0.5), mat(0x1c2f4a));
  tail.position.set(-3.0, 0.3, 0); g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.2), mat(0xd94f30));
  fin.position.set(-4.5, 0.8, 0); g.add(fin);
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  for (const s of [-0.8, 0.8]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.18), skidMat);
    skid.position.set(0.4, -0.95, s); g.add(skid);
  }
  // Main rotor (spins) + tail rotor.
  const rotor = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  rotor.add(blade);
  const blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2; rotor.add(blade2);
  rotor.position.y = 1.0; g.add(rotor);
  // Searchlight cone: apex at the heli, base on the ground below.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(4.5, 38, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  );
  cone.position.y = -19; g.add(cone);
  // Light pool on the ground under the beam.
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.2, depthWrite: false })
  );
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.1; g.add(pool);
  g.userData = { rotor, cone, pool };
  return g;
}

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.stars = 0;
    this.cars = [];
    this.unseenTimer = 0;
    this.bustTimer = 0;
    this.time = 0;
    this.onBusted = null; // callback
    this.onStarsChanged = null;
    this.onImpact = null;
    this.onHeliShot = null; // callback(player)
    this.onSpikeHit = null; // callback()
    // 5-star escalation.
    this.heli = null;
    this.heliAngle = 0;
    this.heliShotTimer = 0;
    this.roadblocks = []; // [{cars:[Car,Car], x, z}]
    this.roadblockTimer = 0;
    this.spikeStrip = null; // {mesh, x, z, armed, cooldown}
  }

  get heliActive() { return !!this.heli; }

  setStars(n, silent) {
    const v = clamp(Math.round(n), 0, WANTED.maxStars);
    if (v !== this.stars) {
      this.stars = v;
      this.unseenTimer = 0;
      this.bustTimer = 0;
      if (v < 4) { this.removeHeli(); this.removeRoadblocks(); }
      if (v < 5) this.removeSpikeStrip();
      if (!silent && this.onStarsChanged) this.onStarsChanged(v);
    }
  }

  addStars(n) { this.setStars(this.stars + n); }

  clear() { this.setStars(0); }

  spawnCruiser(px, pz, pHeading) {
    // Spawn on a road 60-110 m from the player, roughly ahead of them.
    for (let tries = 0; tries < 10; tries++) {
      const p = this.city.randomPointOnRoad();
      const d = dist2D(p.x, p.z, px, pz);
      if (d > 55 && d < 120) {
        const car = new Car(this.scene, 'police', p.x, p.z, rand(0, Math.PI * 2));
        this.cars.push(car);
        return car;
      }
    }
    const p = this.city.randomPointOnRoad();
    const car = new Car(this.scene, 'police', p.x, p.z, rand(0, Math.PI * 2));
    this.cars.push(car);
    return car;
  }

  // --- Air One helicopter -----------------------------------------------
  spawnHeli(player) {
    if (this.heli) return this.heli;
    const mesh = makeHeliMesh();
    // Park it ahead of the player, in the chase camera's view, so the
    // cover shot actually shows Air One instead of empty sky.
    const fwd = player.car ? player.car.forward() : { x: Math.cos(player.heading), z: -Math.sin(player.heading) };
    mesh.position.set(player.x + fwd.x * 18, 12, player.z + fwd.z * 18);
    this.scene.add(mesh);
    this.heli = { mesh, x: mesh.position.x, z: mesh.position.z };
    this.heliShotTimer = 1.0;
    return this.heli;
  }

  removeHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli.mesh);
    this.heli = null;
  }

  updateHeli(dt, player) {
    if (this.stars < 4) { this.removeHeli(); return; }
    if (!this.heli) this.spawnHeli(player);
    const h = this.heli;
    // Hover ahead of the player (in the chase camera's view) at ~12 m up,
    // weaving side to side, spotlight tracking them.
    this.heliAngle += dt * 0.35;
    const fwd = player.car ? player.car.forward() : { x: Math.cos(player.heading), z: -Math.sin(player.heading) };
    const perp = { x: -fwd.z, z: fwd.x };
    const sway = Math.sin(this.heliAngle) * 12;
    const tx = player.x + fwd.x * 18 + perp.x * sway;
    const tz = player.z + fwd.z * 18 + perp.z * sway;
    h.x += (tx - h.x) * (1 - Math.exp(-1.2 * dt));
    h.z += (tz - h.z) * (1 - Math.exp(-1.2 * dt));
    h.mesh.position.set(h.x, 12, h.z);
    h.mesh.rotation.y = Math.atan2(-(player.z - h.z), player.x - h.x);
    h.mesh.userData.rotor.rotation.y += dt * 22;
    // Aim the cone from the heli down at the player.
    const cone = h.mesh.userData.cone;
    const pool = h.mesh.userData.pool;
    const dx = player.x - h.x, dz = player.z - h.z;
    const dist = Math.hypot(dx, dz);
    const len = Math.hypot(dist, 12);
    cone.scale.set(1, len / 38, 1);
    cone.position.set(0, -len / 2, 0);
    cone.rotation.x = 0; cone.rotation.z = 0;
    // Tilt the whole heli group slightly toward the player so the beam lands
    // on them instead of straight down.
    h.mesh.rotation.z = clamp(dx / 60, -0.3, 0.3);
    pool.position.set(dx, -11.8, dz);
    // At 5 stars Air One opens fire from the air.
    if (this.stars >= 5) {
      this.heliShotTimer -= dt;
      if (this.heliShotTimer <= 0) {
        this.heliShotTimer = 1.4;
        if (this.onHeliShot) this.onHeliShot(player, { x: h.x, z: h.z });
      }
    }
  }

  // --- Roadblocks ---------------------------------------------------------
  spawnRoadblock(player, aheadDist) {
    const fwd = player.car ? player.car.forward() : { x: Math.cos(player.heading), z: -Math.sin(player.heading) };
    const ax = player.x + fwd.x * aheadDist;
    const az = player.z + fwd.z * aheadDist;
    const snap = this.city.snapToRoad(ax, az);
    const acrossX = snap.axis === 'x' ? 0 : 1;
    const acrossZ = snap.axis === 'x' ? 1 : 0;
    const heading = snap.axis === 'x' ? Math.PI / 2 : 0;
    const cars = [];
    for (const off of [-3.2, 3.2]) {
      const car = new Car(this.scene, 'police', snap.x + acrossX * off, snap.z + acrossZ * off, heading);
      cars.push(car);
    }
    const block = { cars, x: snap.x, z: snap.z };
    this.roadblocks.push(block);
    return block;
  }

  removeRoadblocks() {
    for (const b of this.roadblocks) for (const c of b.cars) c.remove();
    this.roadblocks = [];
  }

  roadblockCars() {
    const out = [];
    for (const b of this.roadblocks) for (const c of b.cars) out.push(c);
    return out;
  }

  updateRoadblocks(dt, player) {
    if (this.stars < 4) { this.removeRoadblocks(); return; }
    this.roadblockTimer -= dt;
    // Keep two blocks ahead of the player; re-lay them once the player
    // passes one or every 8 s so the chase always runs into the next one.
    let need = 2 - this.roadblocks.length;
    if (this.roadblockTimer <= 0) {
      this.roadblockTimer = 8;
      for (let i = this.roadblocks.length - 1; i >= 0; i--) {
        const b = this.roadblocks[i];
        if (dist2D(b.x, b.z, player.x, player.z) < 22) {
          for (const c of b.cars) c.remove();
          this.roadblocks.splice(i, 1);
          need++;
        }
      }
    }
    let ahead = 40;
    while (need-- > 0) { this.spawnRoadblock(player, ahead); ahead += 55; }
  }

  // --- Spike strip --------------------------------------------------------
  spawnSpikeStrip(player) {
    if (this.spikeStrip) return this.spikeStrip;
    const fwd = player.car ? player.car.forward() : { x: Math.cos(player.heading), z: -Math.sin(player.heading) };
    const snap = this.city.snapToRoad(player.x + fwd.x * 24, player.z + fwd.z * 24);
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.18, 1.6), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    base.position.y = 0.09; g.add(base);
    // Yellow edge bars so the strip reads on the road at a glance.
    for (const s of [-0.7, 0.7]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.06, 0.2), new THREE.MeshBasicMaterial({ color: 0xffd24a }));
      bar.position.set(0, 0.2, s); g.add(bar);
    }
    const spikeMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 6), spikeMat);
      s.position.set(-1.8 + i * 0.9, 0.45, 0); g.add(s);
    }
    g.position.set(snap.x, 0, snap.z);
    g.rotation.y = snap.axis === 'x' ? 0 : Math.PI / 2;
    this.scene.add(g);
    this.spikeStrip = { mesh: g, x: snap.x, z: snap.z, armed: true, cooldown: 0 };
    return this.spikeStrip;
  }

  removeSpikeStrip() {
    if (!this.spikeStrip) return;
    this.scene.remove(this.spikeStrip.mesh);
    this.spikeStrip = null;
  }

  updateSpikeStrip(dt, player) {
    if (this.stars < 5) { this.removeSpikeStrip(); return; }
    if (!this.spikeStrip) { this.spawnSpikeStrip(player); return; }
    const s = this.spikeStrip;
    if (!s.armed) {
      s.cooldown -= dt;
      if (s.cooldown <= 0) {
        // Re-lay the strip ahead of the player and re-arm it.
        this.removeSpikeStrip();
        this.spawnSpikeStrip(player);
      }
      return;
    }
    if (player.car && dist2D(player.car.x, player.car.z, s.x, s.z) < 3) {
      s.armed = false;
      s.cooldown = 20;
      player.car.burstTires(8);
      player.car.damage(10);
      if (this.onSpikeHit) this.onSpikeHit();
    }
  }

  update(dt, player) {
    this.time += dt;
    const wanted = WANTED.policePerStar[this.stars];
    // Keep the right number of cruisers on the road.
    while (this.cars.length < wanted) this.spawnCruiser(player.x, player.z, player.heading);
    while (this.cars.length > wanted) {
      const c = this.cars.pop();
      c.remove();
    }
    let nearest = Infinity;
    let anyClose = false;
    for (const car of this.cars) {
      const d = dist2D(car.x, car.z, player.x, player.z);
      nearest = Math.min(nearest, d);
      if (d < 45) anyClose = true;
      // Pursuit steering: aim at the player, with a little weave.
      const targetAngle = Math.atan2(-(player.z - car.z), player.x - car.x);
      let dh = targetAngle - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = clamp(dh * 1.4, -1, 1);
      // Ram speed: full throttle, but ease off when right on top of the player
      // so the cruiser keeps bumping instead of overshooting.
      const throttle = d > 6 ? 1 : 0.4;
      const impact = car.step(dt, { throttle, steer, handbrake: false }, this.city, 1);
      if (impact && this.onImpact) this.onImpact(impact);
      // Flash the light bar.
      const phase = Math.floor(this.time * 8) % 2 === 0;
      if (car.mesh.userData.lightRed) {
        car.mesh.userData.lightRed.material.color.setHex(phase ? 0xff3333 : 0x551111);
        car.mesh.userData.lightBlue.material.color.setHex(phase ? 0x111155 : 0x3366ff);
      }
      // Ram the player: push the player's car / knock the player down.
      if (d < car.radius + 2.2) {
        if (player.car) {
          const f = car.forward();
          player.car.velX += f.x * 6 * dt * 60 * 0.16;
          player.car.velZ += f.z * 6 * dt * 60 * 0.16;
          player.car.damage(2 * dt * 60 * 0.05);
        } else {
          player.knockback(car.x, car.z, 8);
        }
      }
    }
    this.updateHeli(dt, player);
    this.updateRoadblocks(dt, player);
    this.updateSpikeStrip(dt, player);
    // Busted: a cruiser is right next to a slow player.
    const playerSpeed = player.car ? player.car.speed : player.onFootSpeed;
    if (this.stars > 0 && nearest < 4.5 && playerSpeed < 2.5) {
      this.bustTimer += dt;
      if (this.bustTimer > WANTED.bustSeconds && this.onBusted) {
        this.onBusted();
        this.bustTimer = 0;
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
    // Heat cools when no cruiser can see the player.
    if (this.stars > 0) {
      if (!anyClose) {
        this.unseenTimer += dt;
        if (this.unseenTimer > WANTED.decaySeconds) {
          this.unseenTimer = 0;
          this.setStars(this.stars - 1);
        }
      } else {
        this.unseenTimer = 0;
      }
    }
  }

  // Player entered the respray bay: lose the heat for cash.
  resprayCost() { return WANTED.resprayCost; }

  removeAll() {
    for (const c of this.cars) c.remove();
    this.cars = [];
    this.removeHeli();
    this.removeRoadblocks();
    this.removeSpikeStrip();
  }
}
