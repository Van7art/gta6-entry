// missions.js — the story of Porto Verde and the mission engine. Six chained
// driving jobs for Lena Cross, from a first delivery to stealing Dante
// Ferreira's gold supercar. Each mission is a list of steps (go to, enter a
// car, pick up a fare, race checkpoints, fight guards, escape the heat);
// the engine tracks the current step, spawns mission cars, fares and rival
// crews, and pays out on completion.
import * as THREE from 'three';
import { Car } from './vehicles.js';
import { clamp, dist2D, formatCash, rand } from './util.js';

import { STORY_INTRO, MISSIONS, MISSION_CARS } from './missions-data.js';
export { STORY_INTRO, MISSIONS };

// A rival crew member on foot: shoots at the player, can be shot.
export class Enemy {
  constructor(scene, x, z) {
    this.x = x; this.z = z;
    this.hp = 100;
    this.dead = false;
    this.shootTimer = rand(0.5, 1.5);
    this.group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.36), new THREE.MeshLambertMaterial({ color: 0x6c3483 }));
    body.position.y = 1.08; this.group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), new THREE.MeshLambertMaterial({ color: 0x8d5524 }));
    head.position.y = 1.66; this.group.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.42), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.3, 1.0, 0.3); this.group.add(gun);
    this.group.position.set(x, 0, z);
    scene.add(this.group);
    this.scene = scene;
    this.radius = 1;
  }

  hit(dmg) {
    this.hp -= dmg;
    if (this.hp <= 0) this.die();
  }

  die() {
    this.dead = true;
    this.scene.remove(this.group);
  }

  update(dt, player, fx, audio) {
    if (this.dead) return;
    const d = dist2D(this.x, this.z, player.x, player.z);
    this.group.rotation.y = Math.atan2(-(player.z - this.z), player.x - this.x);
    this.shootTimer -= dt;
    if (d < 45 && this.shootTimer <= 0) {
      this.shootTimer = rand(1.0, 1.8);
      fx.tracer(this.x, 1.2, this.z, player.x, 1.2, player.z, 0xffaa33);
      audio.gunshot();
      if (Math.random() < 0.55) player.damage(rand(4, 9));
    }
  }
}

export class MissionEngine {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.activeIndex = -1;
    this.stepIndex = 0;
    this.stepTimer = 0;
    this.missionTime = 0;
    this.missionCars = {}; // carId -> Car
    this.enemies = [];
    this.rivals = [];
    this.raceCheckpoint = 0;
    this.farePed = null;
    this.markerPos = null;
    this.markerLabel = '';
    this.onComplete = null; // (mission) => void
    this.onFail = null;
    this.onStep = null; // (label) => void
    this.buildMarker();
  }

  buildMarker() {
    const geo = new THREE.CylinderGeometry(2.2, 2.2, 30, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    this.marker = new THREE.Mesh(geo, mat);
    this.marker.position.y = 15;
    this.marker.visible = false;
    this.scene.add(this.marker);
    const ringGeo = new THREE.TorusGeometry(3, 0.25, 8, 24);
    this.markerRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd24a }));
    this.markerRing.rotation.x = -Math.PI / 2;
    this.markerRing.position.y = 0.3;
    this.markerRing.visible = false;
    this.scene.add(this.markerRing);
  }

  get active() { return this.activeIndex >= 0; }
  get mission() { return this.active ? MISSIONS[this.activeIndex] : null; }
  get step() { return this.active ? this.mission.steps[this.stepIndex] : null; }

  start(index, ctx) {
    this.cleanup(ctx);
    this.activeIndex = index;
    this.stepIndex = 0;
    this.stepTimer = 0;
    this.missionTime = 0;
    const m = this.mission;
    ctx.audio.missionStart();
    ctx.toast(m.title + ' — ' + m.briefing, 8);
    this.beginStep(ctx);
  }

  beginStep(ctx) {
    const s = this.step;
    if (!s) return;
    this.markerLabel = s.label;
    if (s.type === 'enterVehicle' && !this.missionCars[s.carId]) {
      const def = MISSION_CARS[s.carId];
      const car = new Car(this.scene, def.type, def.x, def.z, def.heading, def.color);
      this.missionCars[s.carId] = car;
      ctx.allCars.push(car);
      if (s.guards) {
        for (let i = 0; i < s.guards; i++) {
          const e = new Enemy(this.scene, def.x + rand(-8, 8), def.z + rand(-8, 8));
          this.enemies.push(e);
        }
        ctx.toast('Ferreira\'s crew is guarding the car!', 4);
      }
    }
    if (s.type === 'clearOut' && s.guards) {
      for (let i = 0; i < s.guards; i++) {
        const e = new Enemy(this.scene, s.x + rand(-10, 10), s.z + rand(-10, 10));
        this.enemies.push(e);
      }
      ctx.toast('Ferreira\'s crew is here — clear them out!', 4);
    }
    if (s.type === 'race') {
      this.raceCheckpoint = 0;
      // Rival racers line up at the start (two by default, more on convoy jobs).
      const rivalCount = s.rivals || 2;
      const rivalColors = [0x1abc9c, 0x9b59b6, 0xe67e22, 0x2471a3];
      for (let i = 0; i < rivalCount; i++) {
        const startCp = s.checkpoints[0];
        const rival = new Car(this.scene, 'sports', startCp.x - 6 + i * 12, startCp.z - 2.5, 0, rivalColors[i % rivalColors.length]);
        rival.cruise = 30 + i * 2;
        rival.cp = 0;
        this.rivals.push(rival);
        ctx.allCars.push(rival);
      }
    }
    if (s.type === 'pickup') {
      // A fare waits on the sidewalk.
      const ped = ctx.peds.spawnOneAt ? ctx.peds.spawnOneAt(s.x, s.z + 9) : null;
      this.farePed = ped;
    }
    if (this.onStep) this.onStep(s.label);
    this.updateMarker();
  }

  updateMarker() {
    const s = this.step;
    if (!s) { this.marker.visible = false; this.markerRing.visible = false; this.markerPos = null; return; }
    let pos = null;
    if (s.type === 'race') pos = s.checkpoints[this.raceCheckpoint];
    else if (s.type === 'enterVehicle') {
      const c = this.missionCars[s.carId];
      pos = c ? { x: c.x, z: c.z } : MISSION_CARS[s.carId];
    } else pos = { x: s.x, z: s.z };
    this.markerPos = pos;
    this.marker.position.set(pos.x, 15, pos.z);
    this.markerRing.position.set(pos.x, 0.3, pos.z);
    this.marker.visible = true;
    this.markerRing.visible = true;
  }

  advance(ctx) {
    this.stepIndex++;
    if (this.stepIndex >= this.mission.steps.length) {
      this.complete(ctx);
      return;
    }
    this.beginStep(ctx);
  }

  complete(ctx) {
    const m = this.mission;
    ctx.audio.missionDone();
    ctx.addCash(m.reward);
    ctx.addRep(25);
    ctx.toast('MISSION COMPLETE: ' + m.title + ' — +' + formatCash(m.reward), 6);
    if (this.onComplete) this.onComplete(m);
    this.activeIndex = -1;
    this.stepIndex = 0;
    this.marker.visible = false;
    this.markerRing.visible = false;
    this.markerPos = null;
    this.cleanup(ctx);
  }

  fail(ctx, reason) {
    ctx.toast('MISSION FAILED: ' + reason + ' — press N to retry.', 6);
    if (this.onFail) this.onFail(this.mission);
    this.activeIndex = -1;
    this.stepIndex = 0;
    this.marker.visible = false;
    this.markerRing.visible = false;
    this.markerPos = null;
    this.cleanup(ctx);
  }

  cleanup(ctx) {
    for (const id of Object.keys(this.missionCars)) {
      const car = this.missionCars[id];
      if (ctx.player.car !== car) {
        car.remove();
        const i = ctx.allCars.indexOf(car);
        if (i >= 0) ctx.allCars.splice(i, 1);
      }
    }
    this.missionCars = {};
    for (const e of this.enemies) if (!e.dead) e.die();
    this.enemies = [];
    for (const r of this.rivals) {
      r.remove();
      const i = ctx.allCars.indexOf(r);
      if (i >= 0) ctx.allCars.splice(i, 1);
    }
    this.rivals = [];
    this.farePed = null;
  }

  update(dt, ctx) {
    if (!this.active) return;
    const m = this.mission;
    const s = this.step;
    const p = ctx.player;
    this.missionTime += dt;
    if (m.timeLimit && this.missionTime > m.timeLimit) {
      this.fail(ctx, 'Out of time');
      return;
    }
    // Enemies keep shooting.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) { this.enemies.splice(i, 1); continue; }
      e.update(dt, p, ctx.fx, ctx.audio);
    }
    // Mission-car destroyed = fail (except the race rivals).
    if (s && s.type !== 'race') {
      for (const id of Object.keys(this.missionCars)) {
        if (this.missionCars[id].dead) { this.fail(ctx, 'The mission car was wrecked'); return; }
      }
    }
    // Marker pulse.
    this.marker.material.opacity = 0.2 + Math.sin(this.missionTime * 4) * 0.08;
    this.markerRing.scale.setScalar(1 + Math.sin(this.missionTime * 4) * 0.12);
    this.updateMarker();

    switch (s.type) {
      case 'clearOut':
        if (this.enemies.length === 0) {
          ctx.toast('Crew cleared — grab the van!', 3);
          this.advance(ctx);
        }
        break;
      case 'goto':
        if (dist2D(p.x, p.z, s.x, s.z) < (s.radius || 5)) {
          if (s.wantedOnStart) ctx.police.setStars(s.wantedOnStart);
          this.advance(ctx);
        }
        break;
      case 'enterVehicle': {
        const car = this.missionCars[s.carId];
        if (car && p.car === car) {
          if (s.wantedOnEnter) ctx.police.setStars(s.wantedOnEnter);
          ctx.toast('Got it. Now drive!', 3);
          this.advance(ctx);
        }
        break;
      }
      case 'driveTo':
      case 'deliver':
        if (dist2D(p.x, p.z, s.x, s.z) < (s.radius || 8)) {
          if (s.wantedOnStart) ctx.police.setStars(s.wantedOnStart);
          this.advance(ctx);
        }
        break;
      case 'pickup':
        if (p.car && dist2D(p.x, p.z, s.x, s.z) < 8) {
          ctx.audio.coin();
          ctx.toast('Fare aboard — drive!', 3);
          if (this.farePed) {
            // The fare gets in: remove their sidewalk figure.
            const idx = ctx.peds.peds.indexOf(this.farePed);
            if (idx >= 0) { ctx.scene.remove(this.farePed.mesh); ctx.peds.peds.splice(idx, 1); }
            this.farePed = null;
          }
          this.advance(ctx);
        }
        break;
      case 'race': {
        const cp = s.checkpoints[this.raceCheckpoint];
        if (dist2D(p.x, p.z, cp.x, cp.z) < 9) {
          this.raceCheckpoint++;
          ctx.audio.coin();
          if (this.raceCheckpoint >= s.checkpoints.length) {
            this.advance(ctx);
            break;
          }
          ctx.toast('Gate ' + (this.raceCheckpoint + 1) + ' of ' + s.checkpoints.length, 2);
        }
        // Rivals follow the gates.
        for (const r of this.rivals) {
          if (r.dead) continue;
          const rcp = s.checkpoints[Math.min(r.cp, s.checkpoints.length - 1)];
          const d = dist2D(r.x, r.z, rcp.x, rcp.z);
          if (d < 9) r.cp++;
          if (r.cp >= s.checkpoints.length) {
            this.fail(ctx, 'A rival finished first');
            return;
          }
          const targetAngle = Math.atan2(-(rcp.z - r.z), rcp.x - r.x);
          let dh = targetAngle - r.heading;
          while (dh > Math.PI) dh -= Math.PI * 2;
          while (dh < -Math.PI) dh += Math.PI * 2;
          const steer = clamp(dh * 1.6, -1, 1);
          r.step(dt, { throttle: 1, steer, handbrake: false }, this.city, 1);
        }
        break;
      }
    }
  }
}
