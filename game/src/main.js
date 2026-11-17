// main.js — boot and the game loop. Wires the city, traffic, pedestrians,
// police, missions, HUD, audio and save together; owns the camera, the
// car-stealing / shooting / busted / death flows, and the menus.
import * as THREE from 'three';
import { CITY, GAME_TITLE, ECONOMY, WANTED, PLAYER_STATS } from './config.js';
import { clamp, dist2D, formatCash, formatTime, rand } from './util.js';
import { City } from './city.js';
import { Car } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Player } from './player.js';
import { MissionEngine, MISSIONS, STORY_INTRO } from './missions.js';
import { Activities } from './activities.js';
import { Effects } from './effects.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { defaultSave, loadSave, writeSave, clearSave } from './save.js';
import { applyDebugScene } from './debug.js';

window.__pv = { ready: false, errors: [], state: 'boot' };
window.addEventListener('error', (e) => window.__pv.errors.push(String(e.message || e.error)));

const params = new URLSearchParams(location.search);
const AUTOSTART = params.has('autostart');

class Game {
  constructor() {
    this.state = 'menu'; // menu | playing | paused | busted | dead | complete
    this.cash = ECONOMY.startCash;
    this.rep = 0;
    this.missionsDone = [];
    this.clockMinutes = 18 * 60 + 47;
    this.time = 0;
    this.camYaw = 0;
    this.camPitch = 0.34;
    this.camDist = 11;
    this.shake = 0;
    this.lastPedHit = 0;
    this.saveTimer = 0;
    this.storyShown = false;
  }

  init() {
    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    // Render scale: full resolution on real GPUs, lower in software rendering
    // (?scale=1 forces full res for screenshots).
    this.renderScale = parseFloat(params.get('scale') || '0.66');
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b5d6);
    this.scene.fog = new THREE.Fog(0xf2c98f, 180, 620);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.applySize();

    // Golden-hour sun + sky fill.
    const sun = new THREE.DirectionalLight(0xffd9a8, 2.4);
    sun.position.set(-180, 220, 120);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
    sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
    sun.shadow.camera.far = 700;
    this.sun = sun;
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 0.9));

    this.city = new City(this.scene);
    this.traffic = new Traffic(this.scene, this.city);
    this.peds = new Pedestrians(this.scene, this.city);
    this.police = new Police(this.scene, this.city);
    this.player = new Player(this.scene, this.city);
    this.missions = new MissionEngine(this.scene, this.city);
    this.activities = new Activities(this.scene, this.city);
    this.fx = new Effects(this.scene);
    this.hud = new HUD();
    this.audio = new AudioEngine();
    this.audio.radioLabel = document.getElementById('radio');
    this.input = new Input();
    this.input.onFirstGesture = () => this.audio.init();

    this.parkedCars = [];
    this.spawnParkedCars();
    this.traffic.spawn(24, 0, 60);
    this.peds.spawn(42, 0, 60);
    this.player.setPosition(6, 72, 0);
    this.camYaw = 0;

    // Shared context handed to the mission engine.
    this.ctx = {
      scene: this.scene, player: this.player, police: this.police, peds: this.peds,
      audio: this.audio, fx: this.fx,
      allCars: this.allCarsList(),
      toast: (t, s) => this.hud.toast(t, s),
      addCash: (n) => { this.cash += n; },
      addRep: (n) => { this.rep += n; },
    };
    // Garage code reads ctx.cash; keep it live on the game's own cash.
    Object.defineProperty(this.ctx, 'cash', { get: () => this.cash });

    this.police.onBusted = () => this.onBusted();
    this.police.onStarsChanged = (n) => {
      if (n > 0) this.hud.toast(n >= 3 ? 'The whole PVPD is after you!' : 'Wanted level ' + n + ' — lose the cops!', 3);
    };
    this.police.onImpact = (impact) => {
      this.fx.sparks(impact.x, 0.8, impact.z);
      this.audio.crash(impact.strength);
    };
    this.missions.onComplete = (m) => {
      this.missionsDone.push(m.id);
      this.saveGame();
      if (this.missionsDone.length >= MISSIONS.length && !this.storyShown) {
        this.storyShown = true;
        this.state = 'complete';
        document.getElementById('complete-screen').classList.remove('hidden');
      }
    };

    this.wireMenus();
    window.addEventListener('resize', () => this.onResize());
    this.renderer.setAnimationLoop((t) => this.frame(t));
    if (AUTOSTART) this.startGame(false);
    // Debug scenes run after startGame so their positions are not reset.
    applyDebugScene(this, params);
    window.__pv.ready = true;
    window.__pv.game = this;
    window.__pv.state = this.state;
  }

  allCarsList() {
    const set = new Set();
    const out = [];
    const add = (c) => { if (c && !set.has(c)) { set.add(c); out.push(c); } };
    for (const c of this.traffic.cars) add(c);
    for (const c of this.parkedCars) add(c);
    for (const c of this.police.cars) add(c);
    for (const c of Object.values(this.missions.missionCars)) add(c);
    for (const c of this.missions.rivals) add(c);
    if (this.player.car) add(this.player.car);
    return out;
  }

  spawnParkedCars() {
    const spots = [
      [30, 63.5, 0, 'sedan'], [-60, 56.5, Math.PI, 'pickup'], [120, -56.5, Math.PI, 'sedan'],
      [-120, 123.5, 0, 'van'], [180, 183.5, 0, 'sports'], [-180, -116.5, Math.PI, 'sedan'],
      [60, -183.5, Math.PI, 'sedan'], [-30, 243.5, 0, 'pickup'], [210, 3.5, 0, 'sedan'],
      [-210, -63.5, Math.PI, 'van'], [90, 153.5, 0, 'sedan'], [150, -243.5, Math.PI, 'sports'],
    ];
    for (const [x, z, h, type] of spots) {
      this.parkedCars.push(new Car(this.scene, type, x, z, h));
    }
  }

  // --- Menus ---------------------------------------------------------------
  wireMenus() {
    const $ = (id) => document.getElementById(id);
    $('btn-new').addEventListener('click', () => { clearSave(); this.startGame(true); });
    $('btn-continue').addEventListener('click', () => this.startGame(false));
    $('btn-resume').addEventListener('click', () => this.resume());
    $('btn-save').addEventListener('click', () => { this.saveGame(); this.hud.toast('Game saved.', 2); });
    $('btn-quit').addEventListener('click', () => { this.saveGame(); location.reload(); });
    $('btn-busted').addEventListener('click', () => this.afterBusted());
    $('btn-dead').addEventListener('click', () => this.afterDeath());
    $('btn-complete').addEventListener('click', () => {
      $('complete-screen').classList.add('hidden');
      this.state = 'playing';
    });
    $('btn-mute').addEventListener('click', () => {
      this.audio.setMuted(!this.audio.muted);
      $('btn-mute').textContent = this.audio.muted ? 'Unmute (M)' : 'Mute (M)';
    });
    // Mission list in the pause menu.
    const list = $('mission-list');
    list.innerHTML = '';
    MISSIONS.forEach((m, i) => {
      const b = document.createElement('button');
      b.className = 'menu-btn mission-btn';
      b.textContent = m.title + ' — ' + formatCash(m.reward);
      b.addEventListener('click', () => {
        this.resume();
        this.missions.start(i, this.ctx);
      });
      list.appendChild(b);
    });
    const save = loadSave();
    $('btn-continue').style.display = save ? 'block' : 'none';
    $('save-info').textContent = save
      ? 'Save found: ' + formatCash(save.cash) + ' · ' + save.missionsDone.length + '/' + MISSIONS.length + ' missions done'
      : 'No save yet — start a new game.';
    document.getElementById('story-text').textContent = STORY_INTRO;
    document.title = GAME_TITLE;
  }

  startGame(fresh) {
    const save = fresh ? null : loadSave();
    if (save) {
      this.cash = save.cash;
      this.rep = save.rep;
      this.missionsDone = save.missionsDone.slice();
      this.clockMinutes = save.clockMinutes;
      this.player.setPosition(save.playerX, save.playerZ, save.heading);
      if (save.carType) {
        const car = new Car(this.scene, save.carType, save.carX, save.carZ, save.carHeading);
        this.parkedCars.push(car);
        this.player.enterCar(car);
      }
    } else {
      this.cash = ECONOMY.startCash;
      this.rep = 0;
      this.missionsDone = [];
      this.player.setPosition(6, 72, 0);
    }
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    this.state = 'playing';
    this.audio.init();
    // Screenshot scenes skip the welcome toast so it cannot linger on screen.
    this.hud.toast(save ? 'Welcome back, Jax.' : 'Welcome to Porto Verde, Jax. Press N for your first job.', params.get('scene') ? 0.01 : 5);
    window.__pv.state = this.state;
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    document.getElementById('pause-menu').classList.remove('hidden');
    this.saveGame();
    window.__pv.state = this.state;
  }

  resume() {
    document.getElementById('pause-menu').classList.add('hidden');
    this.state = 'playing';
    window.__pv.state = this.state;
  }

  saveGame() {
    const p = this.player;
    writeSave({
      cash: this.cash, rep: this.rep, missionsDone: this.missionsDone,
      playerX: p.x, playerZ: p.z, heading: p.heading,
      carType: p.car ? p.car.type : null,
      carX: p.car ? p.car.x : 0, carZ: p.car ? p.car.z : 0,
      carHeading: p.car ? p.car.heading : 0,
      clockMinutes: this.clockMinutes,
    });
  }

  onBusted() {
    if (this.state !== 'playing') return;
    const fine = WANTED.finePerStar * this.police.stars;
    this.cash = Math.max(0, this.cash - fine);
    this.audio.busted();
    if (this.missions.active) this.missions.fail(this.ctx, 'Busted by the PVPD');
    if (this.player.car) { this.player.exitCar(); }
    this.police.clear();
    this.police.removeAll();
    this.state = 'busted';
    document.getElementById('busted-fine').textContent = 'Fine paid: ' + formatCash(fine) + ' · Cash left: ' + formatCash(this.cash);
    document.getElementById('busted-screen').classList.remove('hidden');
    window.__pv.state = this.state;
  }

  afterBusted() {
    document.getElementById('busted-screen').classList.add('hidden');
    this.player.setPosition(-84, 74, Math.PI / 2);
    this.player.health = PLAYER_STATS.health;
    this.state = 'playing';
    window.__pv.state = this.state;
  }

  onDeath() {
    if (this.state !== 'playing') return;
    this.audio.busted();
    if (this.missions.active) this.missions.fail(this.ctx, 'Jax went down');
    this.state = 'dead';
    document.getElementById('dead-screen').classList.remove('hidden');
    window.__pv.state = this.state;
  }

  afterDeath() {
    document.getElementById('dead-screen').classList.add('hidden');
    this.player.setPosition(-84, 74, Math.PI / 2);
    this.player.health = PLAYER_STATS.health;
    this.player.dead = false;
    this.cash = Math.max(0, this.cash - 200);
    this.police.clear();
    this.state = 'playing';
    window.__pv.state = this.state;
  }

  applySize() {
    const w = Math.max(320, Math.floor(window.innerWidth * this.renderScale));
    const h = Math.max(240, Math.floor(window.innerHeight * this.renderScale));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  onResize() {
    this.applySize();
  }

  // --- Interaction ---------------------------------------------------------
  nearestCar(maxDist) {
    let best = null, bestD = maxDist;
    for (const c of this.allCarsList()) {
      if (c.dead) continue;
      const d = dist2D(this.player.x, this.player.z, c.x, c.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  tryEnterExitCar() {
    const p = this.player;
    if (p.car) {
      p.exitCar();
      this.hud.toast('Out of the car.', 1.5);
      return;
    }
    const car = this.nearestCar(4.5);
    if (!car) return;
    // Stealing a traffic car: its driver bails and the law notices.
    const ti = this.traffic.cars.indexOf(car);
    if (ti >= 0) {
      this.traffic.cars.splice(ti, 1);
      this.police.addStars(1);
      this.hud.toast('Car stolen! Wanted level up.', 3);
      this.audio.honk();
    } else {
      this.hud.toast('In the car — W/S to drive, Space to drift.', 2.5);
    }
    p.enterCar(car);
  }

  tryShoot() {
    const p = this.player;
    if (p.inCar || p.dead) return;
    // Aim from the camera through the click point onto the ground.
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2(
      (this.input.clickX / window.innerWidth) * 2 - 1,
      -(this.input.clickY / window.innerHeight) * 2 + 1
    );
    ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, target)) return;
    const targets = [];
    for (const e of this.missions.enemies) if (!e.dead) targets.push(e);
    for (const c of this.allCarsList()) {
      if (c === p.car || c.dead) continue;
      targets.push({
        x: c.x, z: c.z, radius: c.radius,
        hit: (dmg) => {
          c.damage(dmg);
          if (c.type === 'police') this.police.addStars(1);
          if (c.dead) { this.fx.explosion(c.x, 1, c.z); this.audio.crash(1); this.shake = 0.5; }
        },
      });
    }
    const result = p.shoot({ x: target.x, z: target.z }, targets);
    if (result) {
      this.audio.gunshot();
      this.fx.tracer(p.x, 1.3, p.z, result.hitX, 1.0, result.hitZ, 0xffdd55);
      if (result.hit) this.fx.sparks(result.hitX, 1.0, result.hitZ);
      this.peds.scare(p.x, p.z, 35);
      if (this.police.stars === 0 && Math.random() < 0.5) this.police.addStars(1);
      this.shake = Math.max(this.shake, 0.08);
    }
  }

  // --- Frame ----------------------------------------------------------------
  frame() {
    const dt = Math.min(this.clockDelta(), 0.05);
    this.time += dt;
    const input = this.input;
    if (this.state === 'playing') {
      this.update(dt);
    } else if (this.state === 'menu') {
      // Slow cinematic orbit over the city behind the start screen.
      const a = this.time * 0.06;
      this.camera.position.set(Math.sin(a) * 190, 95, Math.cos(a) * 190);
      this.camera.lookAt(0, 0, 0);
    }
    // Global keys work in every state.
    if (input.wasPressed('Escape') || input.wasPressed('KeyP')) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
    if (input.wasPressed('KeyM')) {
      this.audio.setMuted(!this.audio.muted);
    }
    if (input.wasPressed('Digit1')) this.audio.setStation(0);
    if (input.wasPressed('Digit2')) this.audio.setStation(1);
    if (input.wasPressed('Digit3')) this.audio.setStation(2);
    if (input.wasPressed('KeyN') && this.state === 'playing' && !this.missions.active) {
      const next = MISSIONS.findIndex(m => !this.missionsDone.includes(m.id));
      if (next >= 0) this.missions.start(next, this.ctx);
      else this.hud.toast('All jobs done — Porto Verde is yours. Free roam!', 4);
    }
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
    window.__pv.state = this.state;
  }

  clockDelta() {
    const now = performance.now() / 1000;
    const d = this._last === undefined ? 0.016 : now - this._last;
    this._last = now;
    return d;
  }

  update(dt) {
    const input = this.input;
    const p = this.player;
    // Camera orbit from mouse drag.
    this.camYaw -= input.mouseDX * 0.005;
    this.camPitch = clamp(this.camPitch + input.mouseDY * 0.003, 0.12, 0.7);
    if (input.wasPressed('KeyE')) this.tryEnterExitCar();
    if (input.clicked && !p.inCar) this.tryShoot();
    if (input.wasPressed('KeyR')) {
      if (!p.inCar) p.reload();
      else if (p.car) {
        // Reset a stuck / flipped car onto the nearest road.
        const snap = this.city.snapToRoad(p.car.x, p.car.z);
        p.car.x = snap.x; p.car.z = snap.z;
        p.car.velX = 0; p.car.velZ = 0;
        p.car.heading = snap.axis === 'x' ? 0 : -Math.PI / 2;
      }
    }
    if (input.wasPressed('KeyH') && p.car) this.audio.honk();
    if (input.wasPressed('KeyF') && !p.inCar) {
      // Punch the nearest enemy / thug.
      for (const e of this.missions.enemies) {
        if (!e.dead && dist2D(p.x, p.z, e.x, e.z) < 2.2) {
          e.hit(PLAYER_STATS.punchDamage);
          this.audio.blip(120, 0.1, 'square', 0.25);
          this.hud.toast('Punch!', 1);
        }
      }
    }

    // Player movement.
    if (p.car) {
      const drive = input.driveInput();
      const surface = this.city.surfaceFactor(p.car.x, p.car.z);
      const impact = p.car.step(dt, drive, this.city, surface);
      if (impact) {
        this.fx.sparks(impact.x, 0.8, impact.z);
        this.audio.crash(impact.strength);
        this.shake = Math.max(this.shake, impact.strength * 0.4);
        this.peds.scare(p.car.x, p.car.z, 25);
      }
      // Drift smoke + skid marks.
      if (p.car.drifting) {
        this.fx.smoke(p.car.x - Math.cos(p.car.heading) * 1.5, 0.4, p.car.z + Math.sin(p.car.heading) * 1.5, 0xcccccc);
        this.fx.skidMark(p.car.x, p.car.z, p.car.heading);
      }
      // Exhaust smoke when badly damaged.
      if (p.car.hp < 35 && Math.random() < dt * 8) {
        this.fx.smoke(p.car.x, 1.2, p.car.z, 0x333333);
      }
      if (p.car.dead) {
        this.fx.explosion(p.car.x, 1, p.car.z);
        this.audio.crash(1);
        p.exitCar();
        this.hud.toast('Your car is wrecked!', 3);
        this.shake = 0.6;
      }
      p.x = p.car.x; p.z = p.car.z;
    } else {
      const w = input.walkInput();
      p.stepOnFoot(dt, w.right, w.forward, w.sprint, this.camYaw);
    }

    // Car-car collisions (all cars on the road).
    const cars = this.allCarsList();
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j];
        if (a.dead || b.dead) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = a.radius + b.radius - 0.6;
        if (d > 0.01 && d < min) {
          const nx = dx / d, nz = dz / d;
          const overlap = min - d;
          a.x -= nx * overlap * 0.5; a.z -= nz * overlap * 0.5;
          b.x += nx * overlap * 0.5; b.z += nz * overlap * 0.5;
          const rel = (b.velX - a.velX) * nx + (b.velZ - a.velZ) * nz;
          if (rel < 0) {
            const imp = -rel;
            a.velX -= nx * imp * 0.5; a.velZ -= nz * imp * 0.5;
            b.velX += nx * imp * 0.5; b.velZ += nz * imp * 0.5;
            if (imp > 5) {
              a.damage(imp * 0.8); b.damage(imp * 0.8);
              this.fx.sparks((a.x + b.x) / 2, 0.8, (a.z + b.z) / 2);
              if (a === p.car || b === p.car) {
                this.audio.crash(imp / 18);
                this.shake = Math.max(this.shake, imp * 0.03);
              }
            }
          }
        }
      }
    }

    // On foot, cars are solid: push the player out of them.
    if (!p.car) {
      for (const c of cars) {
        const d = dist2D(p.x, p.z, c.x, c.z);
        const min = c.radius + 0.6;
        if (d > 0.01 && d < min) {
          const nx = (p.x - c.x) / d, nz = (p.z - c.z) / d;
          p.x = c.x + nx * min;
          p.z = c.z + nz * min;
        }
      }
    }

    // Player car vs pedestrians.
    if (p.car && p.car.speed > 3 && this.time - this.lastPedHit > 2) {
      for (const ped of this.peds.peds) {
        if (dist2D(p.car.x, p.car.z, ped.x, ped.z) < p.car.radius + 0.7) {
          this.peds.hitPed(ped);
          this.scene.remove(ped.mesh);
          this.peds.peds.splice(this.peds.peds.indexOf(ped), 1);
          this.lastPedHit = this.time;
          this.police.addStars(1);
          this.audio.crash(0.5);
          this.hud.toast('You hit a pedestrian! Wanted level up.', 3);
          break;
        }
      }
    }

    this.traffic.update(dt, p, cars);
    this.peds.update(dt, p.x, p.z, p.car ? p.car.speed : p.onFootSpeed);
    this.police.update(dt, p);
    this.missions.update(dt, this.ctx);
    this.activities.update(dt, this.ctx, this.time);
    this.fx.update(dt);

    // Clock: 1 game minute every 2.5 real seconds.
    this.clockMinutes += dt / 2.5;
    if (this.clockMinutes >= 24 * 60) this.clockMinutes -= 24 * 60;

    // Audio: engine + siren follow the driving.
    const speedRatio = p.car ? clamp(p.car.speed / p.car.stats.maxSpeed, 0, 1) : 0;
    this.audio.updateEngine(speedRatio, p.car ? p.car.drifting : false, this.police.stars);

    // Sun shadow follows the player.
    this.sun.position.set(p.x - 180, 220, p.z + 120);
    this.sun.target.position.set(p.x, 0, p.z);
    this.sun.target.updateMatrixWorld();

    if (p.dead && this.state === 'playing') this.onDeath();
    this.updateCamera(dt);
    this.updateHUD(dt);
    this.saveTimer += dt;
    if (this.saveTimer > 30) { this.saveTimer = 0; this.saveGame(); }
  }

  updateCamera(dt) {
    const p = this.player;
    // Ease the orbit back behind the car / player when not dragging.
    const targetYaw = p.car ? p.car.heading : p.heading;
    if (!this.input.dragging) {
      let d = targetYaw - this.camYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.camYaw += d * (1 - Math.exp(-1.1 * dt));
    }
    const speed = p.car ? p.car.speed : p.onFootSpeed;
    const dist = (p.car ? 11 : 7) + clamp(speed / 40, 0, 1) * 4;
    this.camDist += (dist - this.camDist) * (1 - Math.exp(-3 * dt));
    const fx = Math.cos(this.camYaw), fz = -Math.sin(this.camYaw);
    const height = this.camDist * Math.tan(this.camPitch) + 2.2;
    const cx = p.x - fx * this.camDist;
    const cz = p.z - fz * this.camDist;
    this.shake = Math.max(0, this.shake - dt * 1.4);
    const shX = this.shake > 0 ? rand(-1, 1) * this.shake * 0.4 : 0;
    const shY = this.shake > 0 ? rand(-1, 1) * this.shake * 0.3 : 0;
    this.camera.position.set(cx + shX, height + shY, cz);
    this.camera.lookAt(p.x + fx * 7, 1.6, p.z + fz * 7);
  }

  updateHUD(dt) {
    const p = this.player;
    const m = this.missions;
    const hh = Math.floor(this.clockMinutes / 60);
    const mm = Math.floor(this.clockMinutes % 60);
    let timeLeft = '';
    if (m.active && m.mission.timeLimit) {
      const left = Math.max(0, m.mission.timeLimit - m.missionTime);
      timeLeft = formatTime(left);
    }
    this.hud.update(dt, {
      stars: this.police.stars,
      cash: this.cash,
      rep: this.rep,
      clock: String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'),
      health: p.health,
      ammo: p.ammo,
      ammoReserve: p.ammoReserve,
      reloading: p.reloadTimer > 0,
      speed: p.car ? p.car.speed : 0,
      inCar: !!p.car,
      carHp: p.car ? (p.car.hp / p.car.stats.hp) * 100 : 100,
      objective: m.active ? m.markerLabel : '',
      missionTitle: m.active ? m.mission.title : '',
      missionTimeLeft: timeLeft,
      playerX: p.x, playerZ: p.z, playerHeading: p.car ? p.car.heading : p.heading,
      marker: m.markerPos,
      traffic: this.traffic.cars,
      police: this.police.cars,
      coins: this.activities.coins,
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init();
});
