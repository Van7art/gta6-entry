// police.js — the wanted system and the Porto Verde PD. Stars rise when the
// player commits crimes; police cruisers spawn on nearby roads, chase and
// ram the player, and pin them to bust them. Break line of sight long
// enough and the heat cools off one star at a time.
import { WANTED } from './config.js';
import { Car } from './vehicles.js';
import { clamp, dist2D, rand } from './util.js';

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.stars = 0;
    this.cars = [];
    this.unseenTimer = 0;
    this.bustTimer = 0;
    this.time = 0;
    this.onBusted = null; // callback
    this.onStarsChanged = null;
  }

  setStars(n, silent) {
    const v = clamp(Math.round(n), 0, WANTED.maxStars);
    if (v !== this.stars) {
      this.stars = v;
      this.unseenTimer = 0;
      this.bustTimer = 0;
      if (!silent && this.onStarsChanged) this.onStarsChanged(v);
    }
  }

  addStars(n) { this.setStars(this.stars + n); }

  clear() { this.setStars(0); }

  spawnCruiser(px, pz, pHeading) {
    // Spawn on a road 60-110 m from the player, roughly ahead of them.
    for (let tries = 0; tries < 10; tries++) {
      const p = this.city.randomPointOnRoad();
      const d = dist2D(p.x, p.z, px, pz);
      if (d > 55 && d < 120) {
        const car = new Car(this.scene, 'police', p.x, p.z, rand(0, Math.PI * 2));
        this.cars.push(car);
        return car;
      }
    }
    const p = this.city.randomPointOnRoad();
    const car = new Car(this.scene, 'police', p.x, p.z, rand(0, Math.PI * 2));
    this.cars.push(car);
    return car;
  }

  update(dt, player) {
    this.time += dt;
    const wanted = WANTED.policePerStar[this.stars];
    // Keep the right number of cruisers on the road.
    while (this.cars.length < wanted) this.spawnCruiser(player.x, player.z, player.heading);
    while (this.cars.length > wanted) {
      const c = this.cars.pop();
      c.remove();
    }
    let nearest = Infinity;
    let anyClose = false;
    for (const car of this.cars) {
      const d = dist2D(car.x, car.z, player.x, player.z);
      nearest = Math.min(nearest, d);
      if (d < 45) anyClose = true;
      // Pursuit steering: aim at the player, with a little weave.
      const targetAngle = Math.atan2(-(player.z - car.z), player.x - car.x);
      let dh = targetAngle - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = clamp(dh * 1.4, -1, 1);
      // Ram speed: full throttle, but ease off when right on top of the player
      // so the cruiser keeps bumping instead of overshooting.
      const throttle = d > 6 ? 1 : 0.4;
      const impact = car.step(dt, { throttle, steer, handbrake: false }, this.city, 1);
      if (impact && this.onImpact) this.onImpact(impact);
      // Flash the light bar.
      const phase = Math.floor(this.time * 8) % 2 === 0;
      if (car.mesh.userData.lightRed) {
        car.mesh.userData.lightRed.material.color.setHex(phase ? 0xff3333 : 0x551111);
        car.mesh.userData.lightBlue.material.color.setHex(phase ? 0x111155 : 0x3366ff);
      }
      // Ram the player: push the player's car / knock the player down.
      if (d < car.radius + 2.2) {
        if (player.car) {
          const f = car.forward();
          player.car.velX += f.x * 6 * dt * 60 * 0.16;
          player.car.velZ += f.z * 6 * dt * 60 * 0.16;
          player.car.damage(2 * dt * 60 * 0.05);
        } else {
          player.knockback(car.x, car.z, 8);
        }
      }
    }
    // Busted: a cruiser is right next to a slow player.
    const playerSpeed = player.car ? player.car.speed : player.onFootSpeed;
    if (this.stars > 0 && nearest < 4.5 && playerSpeed < 2.5) {
      this.bustTimer += dt;
      if (this.bustTimer > WANTED.bustSeconds && this.onBusted) {
        this.onBusted();
        this.bustTimer = 0;
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
    // Heat cools when no cruiser can see the player.
    if (this.stars > 0) {
      if (!anyClose) {
        this.unseenTimer += dt;
        if (this.unseenTimer > WANTED.decaySeconds) {
          this.unseenTimer = 0;
          this.setStars(this.stars - 1);
        }
      } else {
        this.unseenTimer = 0;
      }
    }
  }

  // Player entered the respray bay: lose the heat for cash.
  resprayCost() { return WANTED.resprayCost; }

  removeAll() {
    for (const c of this.cars) c.remove();
    this.cars = [];
  }
}
