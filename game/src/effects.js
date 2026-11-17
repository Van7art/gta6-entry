// effects.js — particles, tracers, skid marks and explosions. All transient
// visual feedback: dust and smoke from tyres, muzzle tracers, crash sparks,
// explosion fireballs and floating pickup text.
import * as THREE from 'three';
import { rand } from './util.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.tracers = [];
    this.skids = [];
    this.skidGeo = new THREE.PlaneGeometry(0.35, 1.4);
    this.skidMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.55, depthWrite: false });
    this.explosions = [];
  }

  spawnParticle(x, y, z, vx, vy, vz, life, size, color) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    m.position.set(x, y, z);
    this.scene.add(m);
    this.particles.push({ m, vx, vy, vz, life, maxLife: life });
  }

  smoke(x, y, z, color) {
    this.spawnParticle(x, y, z, rand(-0.5, 0.5), rand(0.8, 1.8), rand(-0.5, 0.5), rand(0.5, 1.1), rand(0.3, 0.6), color || 0x888888);
  }

  sparks(x, y, z) {
    for (let i = 0; i < 10; i++) {
      this.spawnParticle(x, y, z, rand(-6, 6), rand(1, 6), rand(-6, 6), rand(0.2, 0.5), 0.12, 0xffcc33);
    }
  }

  explosion(x, y, z) {
    for (let i = 0; i < 26; i++) {
      const c = [0xff6600, 0xffcc33, 0xff3300, 0x888888][i % 4];
      this.spawnParticle(x, y + rand(0, 1), z, rand(-9, 9), rand(2, 12), rand(-9, 9), rand(0.4, 1.0), rand(0.3, 0.8), c);
    }
    this.explosions.push({ x, z, t: 0 });
  }

  tracer(x1, y1, z1, x2, y2, z2, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.12 });
  }

  skidMark(x, z, heading) {
    if (this.skids.length > 220) {
      const old = this.skids.shift();
      this.scene.remove(old);
    }
    const m = new THREE.Mesh(this.skidGeo, this.skidMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = heading;
    m.position.set(x, 0.06, z);
    this.scene.add(m);
    this.skids.push(m);
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.m);
        this.particles.splice(i, 1);
        continue;
      }
      p.m.position.x += p.vx * dt;
      p.m.position.y += p.vy * dt;
      p.m.position.z += p.vz * dt;
      p.vy -= 2 * dt;
      p.m.material.opacity = (p.life / p.maxLife) * 0.9;
      p.m.scale.setScalar(1 + (1 - p.life / p.maxLife) * 1.5);
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        this.tracers.splice(i, 1);
      }
    }
  }
}
