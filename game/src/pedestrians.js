// pedestrians.js — people on the sidewalks. They stroll along sidewalk
// lines, turn at intersections, wait at crossings, and run away from danger
// (speeding cars, gunshots, crashes). A few stand around the beach and the
// harbour. Each one is a simple two-box figure with swinging arms.
import * as THREE from 'three';
import { CITY } from './config.js';
import { clamp, dist2D, rand, pick } from './util.js';

const SHIRT_COLORS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xecf0f1, 0xe67e22, 0x1abc9c, 0xfd79a8, 0x636e72];
const PANTS_COLORS = [0x2c3e50, 0x34495e, 0x7f8c8d, 0x6c5ce7, 0x2d3436];

function makePedMesh() {
  const g = new THREE.Group();
  const shirt = pick(SHIRT_COLORS);
  const pants = pick(PANTS_COLORS);
  const skin = pick([0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac]);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.62; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), new THREE.MeshLambertMaterial({ color: pants }));
  legL.position.set(-0.14, 0.33, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.18), new THREE.MeshLambertMaterial({ color: shirt }));
  armL.position.set(-0.38, 1.1, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.38; g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class Pedestrians {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.peds = [];
    this.time = 0;
    this.danger = null; // {x,z,until} — gunshots / crashes scare people
  }

  spawn(count, nearX, nearZ) {
    for (let i = 0; i < count; i++) this.spawnOne(nearX, nearZ);
  }

  spawnOneAt(x, z) {
    const mesh = makePedMesh();
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const ped = {
      mesh, x, z, axis: 'x', dir: 1,
      speed: rand(0.9, 1.9), heading: 0, walkPhase: 0,
      state: 'idle', stateTimer: 120, hp: 100,
    };
    this.peds.push(ped);
    return ped;
  }

  spawnOne(nearX, nearZ) {
    let x, z;
    for (let tries = 0; tries < 10; tries++) {
      const p = this.city.randomPointOnRoad();
      const onBeach = Math.random() < 0.18;
      if (onBeach) { x = rand(296, 316); z = rand(-230, 230); break; }
      // Sidewalk: offset 9.5 m from a road centreline.
      if (Math.random() < 0.5) { x = p.x + (Math.random() < 0.5 ? 9.5 : -9.5); z = p.z + rand(-230, 230); }
      else { x = p.x + rand(-230, 230); z = p.z + (Math.random() < 0.5 ? 9.5 : -9.5); }
      if (nearX === undefined || Math.hypot(x - nearX, z - nearZ) < 150) break;
    }
    if (x === undefined) { x = 9.5; z = 0; }
    const mesh = makePedMesh();
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const axis = Math.abs(x - this.city.nearestRoadCoord(x)) < Math.abs(z - this.city.nearestRoadCoord(z)) ? 'z' : 'x';
    this.peds.push({
      mesh, x, z, axis,
      dir: Math.random() < 0.5 ? 1 : -1,
      speed: rand(0.9, 1.9),
      heading: rand(0, Math.PI * 2),
      walkPhase: rand(0, Math.PI * 2),
      state: 'walk', // walk | idle | flee
      stateTimer: rand(0, 6),
      hp: 100,
    });
  }

  scare(x, z, radius) {
    this.danger = { x, z, radius, until: this.time + 4 };
  }

  update(dt, playerX, playerZ, playerSpeed) {
    this.time += dt;
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i];
      const distPlayer = dist2D(p.x, p.z, playerX, playerZ);
      if (distPlayer > 240) {
        // Recycle far pedestrians near the player.
        this.scene.remove(p.mesh);
        this.peds.splice(i, 1);
        this.spawnOne(playerX, playerZ);
        continue;
      }
      // Danger nearby? Run away from it.
      let fleeing = false;
      if (this.danger && this.time < this.danger.until && dist2D(p.x, p.z, this.danger.x, this.danger.z) < this.danger.radius) {
        fleeing = true;
        p.state = 'flee';
      } else if (playerSpeed > 12 && distPlayer < 9) {
        fleeing = true;
        p.state = 'flee';
      }
      if (p.state === 'flee' && !fleeing) { p.state = 'walk'; p.stateTimer = 0; }
      let speed = 0;
      if (p.state === 'walk') {
        speed = p.speed;
        p.stateTimer -= dt;
        if (p.stateTimer <= 0) {
          p.stateTimer = rand(2, 8);
          if (Math.random() < 0.3) { p.state = 'idle'; }
          else if (Math.random() < 0.35) {
            // Turn at an intersection onto the crossing road.
            p.axis = p.axis === 'x' ? 'z' : 'x';
            p.dir = Math.random() < 0.5 ? 1 : -1;
          }
        }
      } else if (p.state === 'idle') {
        speed = 0;
        p.stateTimer -= dt;
        if (p.stateTimer <= 0) { p.state = 'walk'; p.stateTimer = rand(3, 8); }
      } else if (p.state === 'flee') {
        speed = 5.2;
        // Run directly away from the danger / player.
        const dx = p.x - (this.danger && this.time < this.danger.until ? this.danger.x : playerX);
        const dz = p.z - (this.danger && this.time < this.danger.until ? this.danger.z : playerZ);
        p.heading = Math.atan2(-dz, dx);
      }
      if (p.state !== 'flee') {
        p.heading = p.axis === 'x' ? (p.dir > 0 ? 0 : Math.PI) : (p.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      }
      if (speed > 0) {
        p.x += Math.cos(p.heading) * speed * dt;
        p.z += -Math.sin(p.heading) * speed * dt;
        p.walkPhase += dt * speed * 3.2;
        // Stay inside the world.
        p.x = clamp(p.x, -315, 315);
        p.z = clamp(p.z, -315, 315);
      }
      // Walk-cycle swing.
      const swing = Math.sin(p.walkPhase) * (speed > 0 ? 0.5 : 0);
      p.mesh.userData.armL.rotation.x = swing;
      p.mesh.userData.armR.rotation.x = -swing;
      p.mesh.userData.legL.rotation.x = -swing * 0.8;
      p.mesh.userData.legR.rotation.x = swing * 0.8;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
    }
  }

  // The player car hit a pedestrian: they tumble and the crowd scatters.
  hitPed(ped) {
    ped.hp = 0;
    this.scare(ped.x, ped.z, 30);
    return ped;
  }

  count() { return this.peds.length; }
}
