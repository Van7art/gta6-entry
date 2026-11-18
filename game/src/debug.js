// debug.js — screenshot scene setup. Reads URL parameters (?autostart=1,
// ?scene=chase|drive|race|foot|beach) and arranges a real, playable state
// of the game so the screenshots show live systems. This only ever drives
// the game's own public actions — no fake rendering.
import { Car } from './vehicles.js';

export function applyDebugScene(game, params) {
  const scene = params.get('scene');
  if (!scene) return;
  const { player, police, missions, traffic, peds, city } = game;
  if (scene === 'chase') {
    // Player in a sports car, 3-star heat, cruisers closing in from ahead
    // (visible in the chase camera) and behind. East of the park so the
    // chase stays on the road.
    const car = new Car(game.scene, 'sports', 60, 3.5, 0, 0xd94f30);
    game.parkedCars.push(car);
    player.setPosition(60, 3.5, 0);
    player.enterCar(car);
    car.velX = 18; car.velZ = 0;
    police.setStars(3);
    const c1 = new Car(game.scene, 'police', 95, 3.5, Math.PI);
    const c2 = new Car(game.scene, 'police', 115, -3.5, Math.PI);
    const c3 = new Car(game.scene, 'police', 35, -3.5, 0);
    police.cars.push(c1, c2, c3);
    game.camYaw = 0;
    // A mission in progress as well, so the HUD shows a live objective and
    // timer next to the wanted stars: chase + mission + minimap in one shot.
    missions.start(4, game.ctx);
  } else if (scene === 'drive') {
    // Cruising east through Downtown on the -120 road, tall towers around.
    const car = new Car(game.scene, 'sports', -60, -116.5, 0, 0x2e86c1);
    game.parkedCars.push(car);
    player.setPosition(-60, -116.5, 0);
    player.enterCar(car);
    car.velX = 22; car.velZ = 0;
    game.camYaw = 0;
    // Living traffic in frame: three cars ahead in the player's lane, one
    // oncoming, all on the traffic system so they drive and stop at lights.
    for (const [tx, type, cruise] of [[-28, 'sedan', 11], [8, 'taxi', 12], [44, 'van', 9]]) {
      const t = new Car(game.scene, type, tx, -116.5, 0);
      t.cruise = cruise; t.axis = 'x'; t.dir = 1;
      t.nextIntersection = { x: 240, z: -116.5 };
      traffic.cars.push(t);
    }
    const oncoming = new Car(game.scene, 'sedan', 30, -123.5, Math.PI);
    oncoming.cruise = 12; oncoming.axis = 'x'; oncoming.dir = -1;
    oncoming.nextIntersection = { x: -240, z: -123.5 };
    traffic.cars.push(oncoming);
  } else if (scene === 'race') {
    // Mid-race: mission 4 with rivals on the road and gates ahead.
    player.setPosition(0, -238, 0);
    missions.start(3, game.ctx);
    const car = new Car(game.scene, 'sports', 0, -236.5, 0, 0xd94f30);
    game.parkedCars.push(car);
    player.enterCar(car);
    car.velX = 20; car.velZ = 0;
    game.camYaw = 0;
  } else if (scene === 'foot') {
    // Mid-sand, facing east toward the sea: peds, umbrellas and the water
    // in frame, the boardwalk wall behind the camera instead of in the shot.
    player.setPosition(310, 60, 0);
    game.camYaw = -0.7;
    for (const [px, pz] of [[316, 42], [318, 58], [314, 74], [320, 88]]) {
      if (peds.spawnOneAt) peds.spawnOneAt(px, pz);
    }
  } else if (scene === 'taxi') {
    // Taxi mission in progress: fare aboard, heading downtown.
    player.setPosition(-90, 74, 0);
    missions.start(1, game.ctx);
    const taxi = missions.missionCars['taxi'];
    if (taxi) player.enterCar(taxi);
    game.camYaw = Math.PI / 2;
  } else if (scene === 'harbour') {
    const car = new Car(game.scene, 'pickup', 60, 250, Math.PI, 0x27ae60);
    game.parkedCars.push(car);
    player.setPosition(60, 250, Math.PI);
    player.enterCar(car);
    car.velX = 0; car.velZ = -14;
    game.camYaw = Math.PI;
  }
  game.hud.clearToast();
}
