// activities.js — free-roam activities: collectible cash coins scattered
// around the city, and the Cross Motors garage bay (repair + respray to
// lose the heat). Coins respin and bob; picking one up pays cash.
import * as THREE from 'three';
import { ECONOMY, WANTED } from './config.js';
import { dist2D, rand } from './util.js';

const COIN_SPOTS = [
  [30, -30], [-30, -90], [90, 30], [-150, -30], [150, 150], [-210, 210],
  [210, -150], [0, 210], [-60, -210], [120, -90], [-120, 180], [180, 60],
  [305, -60], [305, 180], [60, 270], [-180, 270], [240, 90], [-240, -120],
  [90, -210], [-90, -150],
];

export class Activities {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.coins = [];
    this.garage = city.garage;
    this.lastRepairAt = -99;
    this.lastResprayAt = -99;
    const coinGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.15, 16);
    const coinMat = new THREE.MeshBasicMaterial({ color: 0xffd24a });
    for (const [x, z] of COIN_SPOTS) {
      const m = new THREE.Mesh(coinGeo, coinMat);
      m.rotation.x = Math.PI / 2;
      m.position.set(x, 1.2, z);
      scene.add(m);
      this.coins.push({ mesh: m, x, z, taken: false, phase: rand(0, Math.PI * 2) });
    }
  }

  update(dt, ctx, time) {
    for (const c of this.coins) {
      if (c.taken) continue;
      c.phase += dt * 2;
      c.mesh.rotation.y = c.phase;
      c.mesh.position.y = 1.2 + Math.sin(c.phase * 1.4) * 0.25;
      if (dist2D(ctx.player.x, ctx.player.z, c.x, c.z) < 2.2) {
        c.taken = true;
        this.scene.remove(c.mesh);
        ctx.addCash(ECONOMY.coinValue);
        ctx.audio.coin();
        ctx.toast('Cash coin +' + ECONOMY.coinValue, 2);
      }
    }
    // Garage bay: repair + respray while stopped inside (with a cooldown,
    // so grinding into the wall cannot drain the player's cash).
    const p = ctx.player;
    const g = this.garage;
    if (dist2D(p.x, p.z, g.x, g.z) < g.radius) {
      if (p.car && p.car.speed < 3) {
        const car = p.car;
        if (car.hp < car.stats.hp && time - this.lastRepairAt > 5) {
          const cost = Math.ceil((car.stats.hp - car.hp) * ECONOMY.repairCostPerHp);
          if (ctx.cash >= cost) {
            ctx.addCash(-cost);
            car.repair();
            this.lastRepairAt = time;
            ctx.toast('Car repaired at Cross Motors (-$' + cost + ')', 3);
            ctx.audio.missionDone();
          }
        }
        if (ctx.police.stars > 0 && ctx.cash >= WANTED.resprayCost && time - this.lastResprayAt > 5) {
          ctx.addCash(-WANTED.resprayCost);
          ctx.police.clear();
          this.lastResprayAt = time;
          ctx.toast('Respray done — the heat is off (-$' + WANTED.resprayCost + ')', 3);
        }
      }
    }
  }

  coinsLeft() { return this.coins.filter(c => !c.taken).length; }
}
