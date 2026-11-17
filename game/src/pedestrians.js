// pedestrians.js — people walking the sidewalks of Solmar Bay. They stroll,
// chat in place, and flee from gunfire and speeding cars. Hitting one is a
// crime: it raises the wanted heat.
import * as THREE from 'three';
import { CITY_HALF, mulberry32 } from './config.js';
import { G } from './state.js';
import { resolveCircleVsBuildings } from './vehicles.js';
import { addHeat } from './vehicles.js';

const rand = mulberry32(4242);
const SHIRTS = [0xff8a5c, 0x5cb8ff, 0x9dff6e, 0xff5da2, 0xffc93c, 0xc58cff, 0xffffff, 0x37e6c8];
const SKINS = [0xf2c9a0, 0xd9a066, 0x8a5a33, 0xf7d7b5];

export function buildPedMesh() {
  const group = new THREE.Group();
  const skin = SKINS[Math.floor(rand() * SKINS.length)];
  const shirt = SHIRTS[Math.floor(rand() * SHIRTS.length)];
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.9, 0.4),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.45, 0.45),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  head.position.y = 1.75;
  head.castShadow = true;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.35),
    new THREE.MeshLambertMaterial({ color: 0x2c3240 }),
  );
  legs.position.y = 0.3;
  group.add(legs);
  group.userData.legs = legs;
  return group;
}

export function spawnPeds() {
  for (let i = 0; i < 26; i++) {
    const mesh = buildPedMesh();
    const x = (rand() * 2 - 1) * (CITY_HALF - 10);
    const z = (rand() * 2 - 1) * (CITY_HALF - 10);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    G.peds.push({
      mesh,
      x, z,
      heading: rand() * Math.PI * 2,
      speed: 1 + rand() * 1.4,
      state: 'walk', // walk | flee | down
      panic: 0,
      bob: rand() * 10,
    });
  }
}

export function scarePeds(x, z, radius) {
  for (const ped of G.peds) {
    const d = Math.hypot(ped.x - x, ped.z - z);
    if (d < radius) {
      ped.state = 'flee';
      ped.panic = 3 + Math.random() * 2;
      ped.heading = Math.atan2(ped.x - x, ped.z - z);
    }
  }
}

export function updatePeds(dt) {
  const player = G.player;
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    let speed = ped.speed;
    if (ped.state === 'flee') {
      speed = 5.5;
      ped.panic -= dt;
      if (ped.panic <= 0) ped.state = 'walk';
    }
    // flee a fast car bearing down
    if (player.inCar && Math.abs(player.inCar.speed) > 10) {
      const d = Math.hypot(ped.x - player.inCar.x, ped.z - player.inCar.z);
      if (d < 9) {
        ped.state = 'flee';
        ped.panic = 2;
        ped.heading = Math.atan2(ped.x - player.inCar.x, ped.z - player.inCar.z);
      }
    }
    // wander: pick a new heading now and then
    if (Math.random() < dt * 0.25 && ped.state === 'walk') {
      ped.heading += (Math.random() - 0.5) * 1.6;
    }
    const nx = ped.x + Math.sin(ped.heading) * speed * dt;
    const nz = ped.z + Math.cos(ped.heading) * speed * dt;
    const pos = { x: nx, z: nz };
    const blocked = resolveCircleVsBuildings(pos, 0.6);
    if (!blocked && Math.abs(nx) < CITY_HALF + 20 && Math.abs(nz) < CITY_HALF + 60) {
      ped.x = nx; ped.z = nz;
    } else {
      ped.heading += Math.PI / 2;
    }
    // hit by the player's car?
    if (player.inCar && Math.abs(player.inCar.speed) > 2) {
      const d = Math.hypot(ped.x - player.inCar.x, ped.z - player.inCar.z);
      if (d < 2.2) {
        ped.state = 'down';
        ped.mesh.rotation.x = -Math.PI / 2;
        ped.mesh.position.y = 0.4;
        addHeat(0.55);
        scarePeds(ped.x, ped.z, 25);
      }
    }
    ped.bob += dt * speed * 4;
    ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.bob)) * 0.06, ped.z);
    ped.mesh.rotation.y = ped.heading;
    ped.mesh.userData.legs.scale.y = 1 + Math.sin(ped.bob) * 0.15;
  }
}

export function resetDownPeds() {
  for (const ped of G.peds) {
    if (ped.state === 'down') {
      ped.state = 'walk';
      ped.mesh.rotation.x = 0;
      ped.mesh.position.y = 0;
    }
  }
}
