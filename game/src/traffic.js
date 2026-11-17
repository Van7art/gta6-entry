// traffic.js — the city's traffic. Cars pick a road, drive in a lane on the
// right-hand side, brake for the car ahead and for red lights, and turn at
// intersections. Cars too far from the player are recycled to a road near
// the player so the streets always feel busy.
import { CITY } from './config.js';
import { Car } from './vehicles.js';
import { clamp, rand } from './util.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'pickup', 'sports', 'truck'];

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cars = [];
    this.time = 0;
  }

  spawn(count, nearX, nearZ) {
    for (let i = 0; i < count; i++) this.spawnOne(nearX, nearZ);
  }

  spawnOne(nearX, nearZ) {
    const type = TRAFFIC_TYPES[Math.floor(Math.random() * TRAFFIC_TYPES.length)];
    // Find a road point near the player (or anywhere if no anchor).
    let x, z, axis, dir;
    for (let tries = 0; tries < 12; tries++) {
      const p = this.city.randomPointOnRoad();
      if (nearX === undefined || Math.hypot(p.x - nearX, p.z - nearZ) < 160) {
        x = p.x; z = p.z; break;
      }
    }
    if (x === undefined) { const p = this.city.randomPointOnRoad(); x = p.x; z = p.z; }
    axis = Math.abs(x - this.city.nearestRoadCoord(x)) < Math.abs(z - this.city.nearestRoadCoord(z)) ? 'z' : 'x';
    dir = Math.random() < 0.5 ? 1 : -1;
    const snap = this.city.snapToRoad(x, z);
    const lane = CITY.lane;
    let px, pz, heading;
    if (snap.axis === 'x') {
      // Travelling along x on road z = snap.z.
      heading = dir > 0 ? 0 : Math.PI;
      px = snap.x; pz = snap.z + (dir > 0 ? lane : -lane);
    } else {
      heading = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      px = snap.x + (dir > 0 ? -lane : lane); pz = snap.z;
    }
    const car = new Car(this.scene, type, px, pz, heading);
    car.cruise = rand(8, 14);
    if (type === 'truck') car.cruise = rand(7, 10);
    if (type === 'sports') car.cruise = rand(12, 16);
    car.axis = snap.axis;
    car.dir = dir;
    car.nextIntersection = this.nextIntersection(px, pz, snap.axis, dir);
    this.cars.push(car);
  }

  nextIntersection(x, z, axis, dir) {
    // The next road crossing along the car's travel direction.
    if (axis === 'x') {
      const roads = CITY.roads.filter(r => dir > 0 ? r > x + 2 : r < x - 2);
      const r = roads.length ? (dir > 0 ? Math.min(...roads) : Math.max(...roads)) : (dir > 0 ? 240 : -240);
      return { x: r, z };
    }
    const roads = CITY.roads.filter(r => dir > 0 ? r > z + 2 : r < z - 2);
    const r = roads.length ? (dir > 0 ? Math.min(...roads) : Math.max(...roads)) : (dir > 0 ? 240 : -240);
    return { x, z: r };
  }

  // Pick a new direction at an intersection (never a U-turn).
  turnAtIntersection(car) {
    const opts = [];
    const fwd = { axis: car.axis, dir: car.dir };
    opts.push(fwd);
    opts.push({ axis: car.axis === 'x' ? 'z' : 'x', dir: Math.random() < 0.5 ? 1 : -1 });
    opts.push({ axis: car.axis === 'x' ? 'z' : 'x', dir: Math.random() < 0.5 ? 1 : -1 });
    const choice = opts[Math.floor(Math.random() * opts.length)];
    car.axis = choice.axis;
    car.dir = choice.dir;
    const lane = CITY.lane;
    if (car.axis === 'x') {
      car.z = this.city.nearestRoadCoord(car.z) + (car.dir > 0 ? lane : -lane);
      car.heading = car.dir > 0 ? 0 : Math.PI;
    } else {
      car.x = this.city.nearestRoadCoord(car.x) + (car.dir > 0 ? -lane : lane);
      car.heading = car.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    car.nextIntersection = this.nextIntersection(car.x, car.z, car.axis, car.dir);
  }

  carAhead(car, allCars) {
    // Any car within 11 m ahead in the same lane.
    const f = car.forward();
    let best = null;
    for (const o of allCars) {
      if (o === car || o.dead) continue;
      const dx = o.x - car.x, dz = o.z - car.z;
      const along = dx * f.x + dz * f.z;
      const side = Math.abs(dx * (-f.z) + dz * f.x);
      if (along > 0 && along < 12 && side < 2.6) {
        if (!best || along < best) best = along;
      }
    }
    return best;
  }

  update(dt, playerCar, allCars) {
    this.time += dt;
    const px = playerCar ? playerCar.x : 0;
    const pz = playerCar ? playerCar.z : 0;
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      const distToPlayer = Math.hypot(car.x - px, car.z - pz);
      if (distToPlayer > 260) {
        // Recycle far cars to a road near the player.
        car.remove();
        this.cars.splice(i, 1);
        this.spawnOne(px, pz);
        continue;
      }
      // Approaching the next intersection?
      const toNext = Math.hypot(car.nextIntersection.x - car.x, car.nextIntersection.z - car.z);
      let targetSpeed = car.cruise;
      if (toNext < 16) {
        const lightGreen = this.city.lightGreenFor(car.axis, this.time);
        if (!lightGreen) targetSpeed = 0; // red light: stop before the crossing
        else if (toNext < 6) targetSpeed = car.cruise * 0.8;
      }
      const ahead = this.carAhead(car, allCars);
      if (ahead !== null && ahead < 11) targetSpeed = Math.min(targetSpeed, 0);
      else if (ahead !== null && ahead < 20) targetSpeed = Math.min(targetSpeed, car.cruise * 0.4);
      // Simple throttle/brake toward target speed, heading snaps to lane.
      const desiredHeading = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      let dh = desiredHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += clamp(dh, -1.6 * dt, 1.6 * dt);
      const fwd = car.forward();
      const fSpeed = car.velX * fwd.x + car.velZ * fwd.z;
      const throttle = fSpeed < targetSpeed ? 1 : (fSpeed > targetSpeed + 1 ? -1 : 0);
      const input = { throttle, steer: 0, handbrake: false };
      car.step(dt, input, this.city, 1);
      // Snap back onto the lane (traffic never leaves the road).
      if (car.axis === 'x') {
        const laneZ = this.city.nearestRoadCoord(car.z) + (car.dir > 0 ? CITY.lane : -CITY.lane);
        car.z += clamp(laneZ - car.z, -2 * dt, 2 * dt);
      } else {
        const laneX = this.city.nearestRoadCoord(car.x) + (car.dir > 0 ? -CITY.lane : CITY.lane);
        car.x += clamp(laneX - car.x, -2 * dt, 2 * dt);
      }
      if (toNext < 3) this.turnAtIntersection(car);
      // Fleeing traffic: if the player rams a car it swerves a little.
      if (car.hp < car.stats.hp * 0.5 && Math.random() < dt * 0.5) {
        car.cruise = Math.min(car.cruise + 6, 22);
      }
    }
  }

  count() { return this.cars.length; }
}
