// pickups.js — health packs and ammo boxes scattered around Porto Verde.
// They bob and spin, respawn a minute after being taken, and show on the
// minimap. On foot or in a car: drive or walk over one to grab it.
import * as THREE from 'three';
import { dist2D, rand } from './util.js';

const HEALTH_SPOTS = [
  [30, 30], [-150, 90], [150, -150], [-60, 270], [240, 120], [-240, -60],
];
const AMMO_SPOTS = [
  [-30, -150], [90, 210], [-210, 180], [210, -30], [60, -270], [-120, -30],
];

export class Pickups {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    const healthGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
    const healthMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71 });
    const ammoGeo = new THREE.BoxGeometry(1.0, 0.7, 1.0);
    const ammoMat = new THREE.MeshBasicMaterial({ color: 0xf39c12 });
    for (const [x, z] of HEALTH_SPOTS) {
      const m = new THREE.Mesh(healthGeo, healthMat);
      m.position.set(x, 1.0, z);
      scene.add(m);
      this.items.push({ mesh: m, x, z, kind: 'health', taken: false, respawnAt: 0, phase: rand(0, 6) });
    }
    for (const [x, z] of AMMO_SPOTS) {
      const m = new THREE.Mesh(ammoGeo, ammoMat);
      m.position.set(x, 0.9, z);
      scene.add(m);
      this.items.push({ mesh: m, x, z, kind: 'ammo', taken: false, respawnAt: 0, phase: rand(0, 6) });
    }
  }

  update(dt, ctx, time) {
    const p = ctx.player;
    for (const it of this.items) {
      if (it.taken) {
        if (time > it.respawnAt) {
          it.taken = false;
          this.scene.add(it.mesh);
        }
        continue;
      }
      it.phase += dt * 2;
      it.mesh.rotation.y = it.phase;
      it.mesh.position.y = (it.kind === 'health' ? 1.0 : 0.9) + Math.sin(it.phase * 1.4) * 0.2;
      if (dist2D(p.x, p.z, it.x, it.z) < 2.4) {
        it.taken = true;
        it.respawnAt = time + 60;
        this.scene.remove(it.mesh);
        if (it.kind === 'health') {
          p.heal(40);
          ctx.toast('Health pack +40 HP', 2);
        } else {
          p.ammoReserve += 24;
          ctx.toast('Ammo box +24 rounds', 2);
        }
        ctx.audio.coin();
      }
    }
  }
}
