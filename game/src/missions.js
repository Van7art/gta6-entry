// missions.js — the story of Porto Verde and the mission engine. Six chained
// driving jobs for Lena Cross, from a first delivery to stealing Dante
// Ferreira's gold supercar. Each mission is a list of steps (go to, enter a
// car, pick up a fare, race checkpoints, fight guards, escape the heat);
// the engine tracks the current step, spawns mission cars, fares and rival
// crews, and pays out on completion.
import * as THREE from 'three';
import { ECONOMY } from './config.js';
import { Car } from './vehicles.js';
import { clamp, dist2D, formatCash, rand } from './util.js';

export const STORY_INTRO =
  'Porto Verde, 6:47 PM. Jax Moreno is back after five years away — his brother\'s ' +
  'garage burned down, the debt collectors are circling, and the only person who ' +
  'still answers his calls is Lena Cross, who runs Cross Motors and knows every ' +
  'street in the city. Dante Ferreira owns the casinos, the docks and half the ' +
  'cops. Jax is going to take it all back, one job at a time.';

export const MISSIONS = [
  {
    id: 'first-gear', title: '1 · First Gear', reward: ECONOMY.missionRewards[0],
    briefing: 'LENA: "Jax, you\'re back. My coupe is parked up the street — bring it to Cross Motors. Drive like you remember how."',
    steps: [
      { type: 'goto', x: 0, z: 66, label: 'Get to Lena\'s coupe' },
      { type: 'enterVehicle', carId: 'lena-coupe', label: 'Get in the coupe' },
      { type: 'driveTo', x: -90, z: 74, label: 'Drive to Cross Motors', radius: 10 },
    ],
  },
  {
    id: 'fare-game', title: '2 · Fare Game', reward: ECONOMY.missionRewards[1],
    briefing: 'LENA: "The taxi game pays cash every night. Three fares, all over town. Don\'t keep them waiting — and don\'t wreck my cab."',
    timeLimit: 300,
    steps: [
      { type: 'enterVehicle', carId: 'taxi', label: 'Get in the taxi' },
      { type: 'pickup', x: 240, z: -60, label: 'Pick up the fare on Playa Dorada' },
      { type: 'deliver', x: 0, z: -180, label: 'Drop the fare Downtown' },
      { type: 'pickup', x: 60, z: 240, label: 'Pick up the fare at the Docks' },
      { type: 'deliver', x: -180, z: 60, label: 'Drop the fare in Barrio Viejo' },
      { type: 'pickup', x: 120, z: 120, label: 'Pick up the fare in Midtown' },
      { type: 'deliver', x: -90, z: 74, label: 'Drop the fare at Cross Motors' },
    ],
  },
  {
    id: 'dockside-dash', title: '3 · Dockside Dash', reward: ECONOMY.missionRewards[2],
    briefing: 'LENA: "Ferreira\'s boys left a box truck at the docks, full of casino chips. Take it. They\'ll shoot — shoot back or drive fast."',
    steps: [
      { type: 'goto', x: 60, z: 258, label: 'Get to the docks' },
      { type: 'enterVehicle', carId: 'dock-truck', label: 'Steal the box truck', guards: 2, wantedOnEnter: 2 },
      { type: 'driveTo', x: -90, z: 74, label: 'Lose the heat — deliver the truck to Cross Motors', radius: 10 },
    ],
  },
  {
    id: 'street-king', title: '4 · Street King', reward: ECONOMY.missionRewards[3],
    briefing: 'LENA: "Tonight\'s street race decides who owns the night roads. Two rivals, eight gates. Beat them and the whole city will know your name."',
    timeLimit: 180,
    steps: [
      { type: 'goto', x: 0, z: -240, label: 'Get to the start line, North Road' },
      {
        type: 'race', label: 'Race! Hit all 8 gates before your rivals',
        checkpoints: [
          { x: 0, z: -240 }, { x: 240, z: -240 }, { x: 240, z: 0 }, { x: 240, z: 240 },
          { x: 0, z: 240 }, { x: -240, z: 240 }, { x: -240, z: 0 }, { x: -240, z: -240 },
        ],
      },
    ],
  },
  {
    id: 'beach-run', title: '5 · Beach Run', reward: ECONOMY.missionRewards[4],
    briefing: 'LENA: "A package is waiting on the beach. Ferreira\'s cops will be all over you the second you grab it. Two minutes, downtown. Go."',
    timeLimit: 150,
    steps: [
      { type: 'goto', x: 305, z: 120, label: 'Grab the package on the beach', wantedOnStart: 3 },
      { type: 'deliver', x: 0, z: -180, label: 'Deliver downtown — the heat is on!', radius: 12 },
    ],
  },
  {
    id: 'ferreira-job', title: '6 · The Ferreira Job', reward: ECONOMY.missionRewards[5],
    briefing: 'LENA: "This is it. Ferreira\'s gold supercar is in his downtown garage. Take it, outrun everything, and bring it home. After this, Porto Verde is ours."',
    steps: [
      { type: 'goto', x: 60, z: -180, label: 'Get to Ferreira\'s downtown garage' },
      { type: 'enterVehicle', carId: 'gold-car', label: 'Steal the gold supercar', guards: 3, wantedOnEnter: 4 },
      { type: 'driveTo', x: -90, z: 74, label: 'Bring the gold car home to Cross Motors', radius: 10 },
    ],
  },
];

const MISSION_CARS = {
  'lena-coupe': { type: 'sports', x: 0, z: 63.5, heading: 0, color: 0xd94f30 },
  'taxi': { type: 'taxi', x: -90, z: 74, heading: Math.PI / 2, color: 0xf7c600 },
  'dock-truck': { type: 'truck', x: 60, z: 270, heading: Math.PI, color: 0x2471a3 },
  'gold-car': { type: 'sports', x: 60, z: -176, heading: Math.PI, color: 0xf7c600 },
};

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
    if (s.type === 'race') {
      this.raceCheckpoint = 0;
      // Two rival racers line up at the start.
      for (let i = 0; i < 2; i++) {
        const rival = new Car(this.scene, 'sports', -6 + i * 12, -243.5, 0, [0x1abc9c, 0x9b59b6][i]);
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
