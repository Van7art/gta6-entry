// shots.js — screenshot staging: ?shot=cover|drive|mission|foot starts the
// game immediately in a composed scene so the screenshots are real renders of
// the game itself, showing several systems at once (chase + wanted + minimap
// + mission objective on the cover). Normal play never passes ?shot=.
import * as THREE from 'three';
import { G } from './state.js';
import { LANDMARKS } from './city.js';
import { spawnCar, spawnPolice } from './vehicles.js';
import { startMission, enterStep } from './missions.js';
import { spawnEnemy } from './combat.js';

export function shotParam() {
  return new URLSearchParams(window.location.search).get('shot');
}

export function applyShotStaging(mode, startGame) {
  if (!mode) return false;
  startGame();
  const p = G.player;
  if (mode === 'cover') {
    // Downtown chase: player in the gold Comet GT, wanted 3, police on his tail,
    // mission 5 in progress, traffic all around.
    p.pos.set(20, 0, -40);
    const car = spawnCar('comet', 20, -40, Math.PI, { parked: true });
    p.inCar = car;
    car.stolen = true;
    car.speed = 30;
    G.wanted = 3;
    G.wantedHeat = 0.5;
    spawnPolice(3);
    // pull the interceptors in close behind the car for the chase shot
    const carRef = p.inCar;
    G.police.forEach((cop, i) => {
      const back = 14 + i * 9;
      cop.x = carRef.x - Math.sin(carRef.heading) * back + (i - 1) * 6;
      cop.z = carRef.z - Math.cos(carRef.heading) * back;
      cop.heading = carRef.heading;
      cop.speed = 26;
    });
    startMission(4);
  } else if (mode === 'drive') {
    // Coastal cruise at golden hour, mission 2 running: east along the
    // beachfront road (z = 236 is a road line), palms and sea on the right.
    p.pos.set(-40, 0, 236);
    const car = spawnCar('sunset', -40, 236, Math.PI / 2, { parked: true });
    p.inCar = car;
    car.stolen = true;
    car.speed = 24;
    p.camYaw = Math.PI / 2 + Math.PI;
    startMission(1);
  } else if (mode === 'mission') {
    // On-foot shootout at the Harbor Docks, mission 5 kill step. The harbour
    // block has no buildings and no through-road, so the crew is visible in
    // the open and no traffic car can drive through the shot.
    const h = LANDMARKS.harbor.pos;
    p.pos.set(h.x, 0, h.z + 26);
    p.camYaw = 0; // camera south of the player, looking north at the crew
    startMission(4);
    G.missionStep = 1;
    enterStep();
    // line the crew up in the open ground in front of the player
    G.enemies.forEach((e, i) => {
      e.x = h.x - 14 + i * 6;
      e.z = h.z + 12;
      e.mesh.position.set(e.x, 0, e.z);
    });
    G.wanted = 1;
    spawnPolice(1);
  } else if (mode === 'foot') {
    // On foot in the central plaza, mission 1, pedestrians and traffic around.
    const c = LANDMARKS.marina.pos;
    p.pos.set(-30, 0, 180);
    p.camYaw = Math.PI * 0.85;
    startMission(0);
  }
  // face the action
  if (p.inCar) p.camYaw = p.inCar.heading + Math.PI;
  return true;
}
