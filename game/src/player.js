// player.js — Jax Moreno on foot: walking, sprinting, entering and leaving
// cars, and combat with the weapon wheel (pistol / SMG / shotgun, keys
// 4/5/6 or C to cycle). The player is a simple figure with a visible gun;
// shots are hitscan with a tracer.
import * as THREE from 'three';
import { PLAYER_STATS } from './config.js';
import { WEAPONS, WEAPON_ORDER, weaponDef, defaultWeaponState } from './weapons.js';
import { clamp, dist2D, lerpAngle, rand } from './util.js';

function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = 0xd94f30; // Jax's orange jacket
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.36), new THREE.MeshLambertMaterial({ color: jacket }));
  body.position.y = 1.08; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), new THREE.MeshLambertMaterial({ color: 0xe0ac69 }));
  head.position.y = 1.66; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  cap.position.y = 1.86; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.24), new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
  legL.position.set(-0.15, 0.34, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), new THREE.MeshLambertMaterial({ color: jacket }));
  armR.position.set(0.42, 1.1, 0.1); g.add(armR);
  const armL = armR.clone(); armL.position.x = -0.42; g.add(armL);
  // Pistol in the right hand.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.42), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.42, 0.85, 0.28); g.add(gun);
  g.userData = { legL, legR, armL, armR, gun };
  return g;
}

export class Player {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.mesh = makePlayerMesh();
    scene.add(this.mesh);
    this.x = 0; this.z = 30;
    this.heading = 0;
    this.health = PLAYER_STATS.health;
    // Weapon wheel: one shared reserve, a magazine per slot.
    this.weapon = 'pistol';
    this.mags = { pistol: WEAPONS.pistol.mag, smg: WEAPONS.smg.mag, shotgun: WEAPONS.shotgun.mag };
    this.ammo = WEAPONS.pistol.mag;
    this.ammoReserve = 60;
    this.onFootSpeed = 0;
    this.car = null; // Car instance when driving, else null
    this.walkPhase = 0;
    this.shootCooldown = 0;
    this.reloadTimer = 0;
    this.punchCooldown = 0;
    this.knockTimer = 0;
    this.dead = false;
  }

  get inCar() { return !!this.car; }

  // Weapon wheel state for the save file.
  saveWeapons() {
    this.mags[this.weapon] = this.ammo;
    return { current: this.weapon, mags: { ...this.mags }, reserve: this.ammoReserve };
  }

  loadWeapons(saved) {
    if (!saved) return;
    const base = defaultWeaponState();
    const mags = { ...base.mags, ...(saved.mags || {}) };
    this.mags = mags;
    this.ammoReserve = typeof saved.reserve === 'number' ? saved.reserve : base.reserve;
    this.selectWeapon(saved.current || 'pistol');
  }

  selectWeapon(key) {
    if (!WEAPONS[key]) return false;
    this.mags[this.weapon] = this.ammo;
    this.weapon = key;
    this.ammo = this.mags[key];
    this.reloadTimer = 0;
    // The held gun visibly changes: SMG long, shotgun thick.
    const gun = this.mesh.userData.gun;
    if (gun) {
      const s = key === 'smg' ? [1, 1, 1.6] : key === 'shotgun' ? [1.8, 1.4, 2.0] : [1, 1, 1];
      gun.scale.set(s[0], s[1], s[2]);
    }
    return true;
  }

  cycleWeapon() {
    const i = WEAPON_ORDER.indexOf(this.weapon);
    return this.selectWeapon(WEAPON_ORDER[(i + 1) % WEAPON_ORDER.length]);
  }

  weaponName() { return weaponDef(this.weapon).name; }

  setPosition(x, z, heading) {
    this.x = x; this.z = z;
    if (heading !== undefined) this.heading = heading;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
  }

  knockback(fromX, fromZ, power) {
    if (this.knockTimer > 0) return;
    this.knockTimer = 0.5;
    const dx = this.x - fromX, dz = this.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    this.x += (dx / d) * power * 0.3;
    this.z += (dz / d) * power * 0.3;
    this.damage(8);
  }

  damage(amount) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 0) { this.health = 0; this.dead = true; }
  }

  heal(amount) { this.health = clamp(this.health + amount, 0, PLAYER_STATS.health); }

  // On-foot step. moveX/moveZ are camera-relative wish directions (-1..1).
  stepOnFoot(dt, moveX, moveZ, sprint, camYaw) {
    if (this.dead) return;
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.knockTimer = Math.max(0, this.knockTimer - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0 && this.ammoReserve > 0) {
        const need = weaponDef(this.weapon).mag - this.ammo;
        const take = Math.min(need, this.ammoReserve);
        this.ammo += take;
        this.ammoReserve -= take;
      }
    }
    const speed = sprint ? PLAYER_STATS.sprintSpeed : PLAYER_STATS.walkSpeed;
    // Camera-relative movement: forward = (cos yaw, 0, -sin yaw), right = (sin yaw, 0, cos yaw).
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    const wx = (moveZ * cos + moveX * sin) * speed;
    const wz = (-moveZ * sin + moveX * cos) * speed;
    const moving = Math.hypot(moveX, moveZ) > 0.1;
    this.onFootSpeed = moving ? speed : 0;
    if (moving) {
      this.heading = lerpAngle(this.heading, Math.atan2(-wz, wx), 1 - Math.exp(-12 * dt));
      this.walkPhase += dt * speed * 1.6;
      let nx = this.x + wx * dt;
      let nz = this.z + wz * dt;
      const hit = this.city.collideCircle(nx, nz, 0.6);
      if (hit) { nx += hit.nx * hit.depth; nz += hit.nz * hit.depth; }
      nx = clamp(nx, -316, 316);
      nz = clamp(nz, -316, 316);
      this.x = nx; this.z = nz;
    }
    const swing = moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.mesh.userData.armL.rotation.x = swing;
    this.mesh.userData.armR.rotation.x = -swing;
    this.mesh.userData.legL.rotation.x = -swing * 0.8;
    this.mesh.userData.legR.rotation.x = swing * 0.8;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // Slow health regen out of combat.
    if (this.health < PLAYER_STATS.health) this.heal(1.5 * dt);
  }

  reload() {
    if (this.reloadTimer <= 0 && this.ammo < weaponDef(this.weapon).mag && this.ammoReserve > 0) {
      this.reloadTimer = 1.1;
      return true;
    }
    return false;
  }

  // Hitscan shot toward a world point. targets: [{x,z,radius,hit(dmg)}].
  // The shotgun fires five pellets with spread; the SMG fires fast.
  // Returns {hitX,hitZ,hit} for the tracer / impact fx.
  shoot(targetPoint, targets) {
    if (this.shootCooldown > 0 || this.reloadTimer > 0 || this.ammo <= 0) return null;
    const w = weaponDef(this.weapon);
    this.ammo--;
    this.shootCooldown = w.cooldown;
    const ox = this.x, oz = this.z;
    let bestHit = null, bestDist = Infinity, bestEnd = null;
    for (let p = 0; p < w.pellets; p++) {
      const a = Math.atan2(-(targetPoint.z - oz), targetPoint.x - ox) + rand(-w.spread, w.spread);
      const ux = Math.cos(a), uz = -Math.sin(a);
      const len = Math.hypot(targetPoint.x - ox, targetPoint.z - oz) || 1;
      let bDist = Math.min(len, w.range);
      let best = null;
      for (const t of targets) {
        const tx = t.x - ox, tz = t.z - oz;
        const along = tx * ux + tz * uz;
        if (along < 0 || along > w.range) continue;
        const perp = Math.abs(tx * (-uz) + tz * ux);
        if (perp < (t.radius || 1) + 0.4) {
          if (along < bDist) { bDist = along; best = t; }
        }
      }
      if (best) {
        best.hit(w.damage);
        if (bDist < bestDist) { bestDist = bDist; bestHit = best; bestEnd = { x: ox + ux * bDist, z: oz + uz * bDist }; }
      } else if (!bestEnd) {
        bestEnd = { x: ox + ux * bDist, z: oz + uz * bDist };
      }
    }
    const hitX = bestEnd ? bestEnd.x : ox;
    const hitZ = bestEnd ? bestEnd.z : oz;
    return { hitX, hitZ, hit: !!bestHit };
  }

  enterCar(car) {
    this.car = car;
    this.mesh.visible = false;
    this.onFootSpeed = 0;
  }

  exitCar() {
    if (!this.car) return null;
    const car = this.car;
    this.car = null;
    // Step out to the driver's side.
    const side = { x: -Math.sin(car.heading), z: -Math.cos(car.heading) };
    this.x = car.x + side.x * 2.2;
    this.z = car.z + side.z * 2.2;
    this.heading = car.heading;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    return car;
  }
}
