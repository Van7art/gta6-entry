// combat.js — shooting (hitscan pistol with a tracer + muzzle flash), enemy
// gang members with health bars, and the player's health / wasted flow.
import * as THREE from 'three';
import { TUNING } from './config.js';
import { G } from './state.js';
import { sound } from './audio.js';
import { scarePeds } from './pedestrians.js';
import { addHeat } from './vehicles.js';

let raycaster = null;
let tracer = null;
let tracerLife = 0;
let flash = null;

export function initCombat(scene) {
  raycaster = new THREE.Raycaster();
  raycaster.far = TUNING.pistolRange;
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
  tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
  scene.add(tracer);
  flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffd76e, transparent: true, opacity: 0 }),
  );
  scene.add(flash);
}

export function spawnEnemy(x, z, opts) {
  const o = opts || {};
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: o.color || 0x8a2f2f });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.45), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
  head.position.y = 1.85;
  group.add(head);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.55), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.5, 0.9, 0.3);
  group.add(gun);
  // health bar floating above the head
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: 0x330000, side: THREE.DoubleSide }));
  barBg.position.y = 2.4;
  group.add(barBg);
  const barFg = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.1), new THREE.MeshBasicMaterial({ color: 0xff4444, side: THREE.DoubleSide }));
  barFg.position.y = 2.4;
  barFg.position.z = 0.01;
  group.add(barFg);
  group.position.set(x, 0, z);
  G.scene.add(group);
  const enemy = {
    mesh: group,
    barFg,
    x, z,
    health: o.health || TUNING.enemyHealth,
    maxHealth: o.health || TUNING.enemyHealth,
    shootTimer: 1 + Math.random() * 2,
    strafe: Math.random() * Math.PI * 2,
    speed: 2.2,
  };
  G.enemies.push(enemy);
  return enemy;
}

export function clearEnemies() {
  for (const e of G.enemies) G.scene.remove(e.mesh);
  G.enemies.length = 0;
}

export function playerShoot() {
  const p = G.player;
  if (p.inCar || p.shootCooldown > 0 || G.paused || !G.started) return false;
  p.shootCooldown = TUNING.pistolCooldown;
  sound.gunshot();
  G.flags.shotFired = true;
  scarePeds(p.pos.x, p.pos.z, 30);
  addHeat(0.12);
  // muzzle flash at the gun
  const gunPos = new THREE.Vector3(p.pos.x, p.pos.y + 1.2, p.pos.z)
    .add(new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading)).multiplyScalar(0.8));
  flash.position.copy(gunPos);
  flash.material.opacity = 0.9;
  // shoot toward the camera centre
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  raycaster.set(G.camera.position, dir);
  const targets = [];
  for (const e of G.enemies) targets.push(e.mesh);
  for (const cop of G.police) targets.push(cop.mesh);
  const hits = raycaster.intersectObjects(targets, true);
  let end = new THREE.Vector3().copy(G.camera.position).add(dir.clone().multiplyScalar(TUNING.pistolRange));
  let hitEnemy = null;
  let hitCop = false;
  if (hits.length > 0) {
    const hit = hits[0];
    end = hit.point.clone();
    // climb to the top-level group (car or enemy) that owns the hit mesh
    let node = hit.object;
    while (node && node.parent && node.parent !== G.scene) node = node.parent;
    hitEnemy = G.enemies.find((e) => e.mesh === node) || null;
    hitCop = G.police.some((c) => c.mesh === node);
  }
  if (!hitEnemy) {
    // aim assist: the ray is anchored to the player's chest, so a distant
    // enemy sits slightly above the crosshair — accept any enemy whose chest
    // passes within a small cone of the ray.
    const origin = G.camera.position.clone();
    let bestT = TUNING.pistolRange;
    for (const e of G.enemies) {
      const chest = new THREE.Vector3(e.x, 1.2, e.z);
      const to = chest.clone().sub(origin);
      const t = to.dot(dir);
      if (t < 2 || t > bestT) continue;
      const closest = origin.clone().add(dir.clone().multiplyScalar(t));
      if (closest.distanceTo(chest) < 2.4) { bestT = t; hitEnemy = e; end = chest.clone(); }
    }
  }
  if (hitEnemy) {
    damageEnemy(hitEnemy, TUNING.pistolDamage);
  } else if (hitCop) {
    addHeat(0.5);
  }
  const pos = tracer.geometry.attributes.position;
  pos.setXYZ(0, gunPos.x, gunPos.y, gunPos.z);
  pos.setXYZ(1, end.x, end.y, end.z);
  pos.needsUpdate = true;
  tracer.material.opacity = 0.9;
  tracerLife = 0.07;
  return true;
}

export function damageEnemy(enemy, dmg) {
  enemy.health -= dmg;
  enemy.barFg.scale.x = Math.max(0.01, enemy.health / enemy.maxHealth);
  enemy.barFg.position.x = -(1.16 - 1.16 * Math.max(0, enemy.health / enemy.maxHealth)) / 2;
  if (enemy.health <= 0) {
    enemy.mesh.rotation.x = -Math.PI / 2;
    enemy.mesh.position.y = 0.4;
    enemy.dead = true;
    G.kills += 1;
    G.money += 25;
    G.enemies = G.enemies.filter((e) => e !== enemy);
    setTimeout(() => { if (enemy.mesh.parent) G.scene.remove(enemy.mesh); }, 4000);
  }
}

export function damagePlayer(amount) {
  const p = G.player;
  if (p.health <= 0) return;
  p.health = Math.max(0, p.health - amount);
  document.body.classList.add('hurt');
  setTimeout(() => document.body.classList.remove('hurt'), 220);
  if (p.health <= 0) {
    if (G.onWasted) G.onWasted();
  }
}

export function updateCombat(dt) {
  const p = G.player;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (tracerLife > 0) {
    tracerLife -= dt;
    if (tracerLife <= 0) tracer.material.opacity = 0;
  }
  if (flash) flash.material.opacity = Math.max(0, flash.material.opacity - dt * 8);
  // click-to-shoot (also allow holding the mouse)
  if (G.mouseDown && !p.inCar) playerShoot();
  // enemies: strafe, face the player, shoot back
  for (const e of [...G.enemies]) {
    if (e.dead) continue;
    const dx = p.pos.x - e.x;
    const dz = p.pos.z - e.z;
    const dist = Math.hypot(dx, dz);
    e.strafe += dt;
    const strafeDir = Math.sin(e.strafe) * 0.8;
    const mx = (dx / (dist || 1)) * 0.4 + Math.cos(Math.atan2(dx, dz) + Math.PI / 2) * strafeDir;
    const mz = (dz / (dist || 1)) * 0.4 + Math.sin(Math.atan2(dx, dz) + Math.PI / 2) * strafeDir;
    if (dist > 14) {
      e.x += (dx / dist) * e.speed * dt;
      e.z += (dz / dist) * e.speed * dt;
    } else if (dist < 7) {
      e.x -= (dx / dist) * e.speed * 0.5 * dt;
      e.z -= (dz / dist) * e.speed * 0.5 * dt;
    } else {
      e.x += mx * e.speed * 0.6 * dt;
      e.z += mz * e.speed * 0.6 * dt;
    }
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = Math.atan2(dx, dz);
    e.mesh.children.forEach((c) => { if (c.geometry && c.geometry.type === 'PlaneGeometry') c.lookAt(G.camera.position); });
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && dist < 42) {
      e.shootTimer = 1.1 + Math.random() * 1.2;
      sound.enemyShot();
      // hit chance grows as the enemy gets closer
      const hitChance = Math.max(0.12, 0.55 - dist * 0.01);
      if (Math.random() < hitChance) damagePlayer(6 + Math.random() * 6);
      // enemy tracer
      const pos = tracer.geometry.attributes.position;
      pos.setXYZ(0, e.x, 1.4, e.z);
      pos.setXYZ(1, p.pos.x, p.pos.y + 1.2, p.pos.z);
      pos.needsUpdate = true;
      tracer.material.opacity = 0.5;
      tracerLife = 0.06;
    }
  }
}
