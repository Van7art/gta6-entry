// Headless probe for Porto Verde R3.1: drives every system and reports pass/fail.
// Usage: node tools/probe.mjs [root] — root defaults to this entry's directory.
import { serve, launchBrowser, connect, sleep } from './cdp.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8471;
const DBG = 9223;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : ''));
}

const server = await serve(ROOT, PORT);
const { chrome, wsUrl } = await launchBrowser(DBG, `http://127.0.0.1:${PORT}/game/index.html`);
const cdp = await connect(wsUrl);
await cdp.send('Runtime.enable');
await cdp.send('Page.enable');
await cdp.send('Log.enable');

try {
  await cdp.waitFor(`window.__pv && window.__pvTest`, 15000);
  check('page loads, probe hooks present', true);

  const errs = cdp.events.filter((e) =>
    (e.method === 'Runtime.exceptionThrown') ||
    (e.method === 'Log.entryAdded' && e.params?.entry?.level === 'error'));
  check('no page errors on load', errs.length === 0, errs.slice(0, 2).map((e) => JSON.stringify(e.params).slice(0, 200)).join(' | '));

  // --- new game ---
  await cdp.eval(`__pvTest.newGame()`);
  await sleep(600);
  check('new game starts playing', await cdp.eval(`__pv.mode === 'playing'`));
  check('player on foot at garage', await cdp.eval(`__pv.player.onFoot && Math.abs(__pv.player.x - 1000) < 80 && Math.abs(__pv.player.y - 560) < 80`));
  check('traffic + peds spawned', await cdp.eval(`__pv.cars.length >= 20 && __pv.peds.length >= 30`), await cdp.eval(`'cars=' + __pv.cars.length + ' peds=' + __pv.peds.length`));

  // --- carjack + drive ---
  await cdp.eval(`__pv.cars[0].x = __pv.player.x + 40; __pv.cars[0].y = __pv.player.y; __pv.cars[0].speed = 0;`);
  await cdp.eval(`__pvTest.tryEnterCar()`);
  check('carjack enters car, wanted +1', await cdp.eval(`!!__pv.car && __pv.wanted === 1`));
  await cdp.eval(`__pv.input.up = true;`);
  await sleep(2000);
  await cdp.eval(`__pv.input.up = false;`);
  const speed = await cdp.eval(`Math.abs(__pv.car.speed)`);
  check('car accelerates', speed > 100, `speed=${Math.round(speed)}`);
  const angleBefore = await cdp.eval(`__pv.car.angle`);
  await cdp.eval(`__pv.input.left = true;`);
  await sleep(500);
  await cdp.eval(`__pv.input.left = false;`);
  const angleAfter = await cdp.eval(`__pv.car.angle`);
  check('car steers', angleAfter < angleBefore - 0.15, `angle ${angleBefore.toFixed(2)} -> ${angleAfter.toFixed(2)}`);

  // --- weapons ---
  await cdp.eval(`__pvTest.switchWeapon(2)`);
  await cdp.eval(`__pv.mouse.x = 900; __pv.mouse.y = 200; __pvTest.fireWeapon()`);
  await sleep(200);
  check('shotgun fires, mag drops, bullet exists', await cdp.eval(`__pv.weapons.mags[2] === 5 && __pv.bullets.length > 0`));
  await cdp.eval(`__pvTest.reloadWeapon()`);
  check('reload refills mag from reserve', await cdp.eval(`__pv.weapons.mags[2] === 6 && __pv.weapons.reserve < 60`));

  // --- missions 1-8 ---
  await cdp.eval(`__pvTest.startMission(0)`);
  check('mission 1 starts', await cdp.eval(`__pv.mission && __pv.mission.idx === 0`));
  await cdp.eval(`__pv.car.x = 1000; __pv.car.y = 600; __pv.player.x = 1000; __pv.player.y = 600;`);
  await sleep(400);
  check('mission 1 completes at garage (+150, +25 REP)', await cdp.eval(`__pv.cash >= 300 && __pv.rep === 25 && __pv.mission === null`), await cdp.eval(`'cash=' + __pv.cash + ' rep=' + __pv.rep`));

  await cdp.eval(`__pvTest.startMission(1)`);
  check('mission 2 timer 150s', await cdp.eval(`__pv.mission && __pv.mission.timer > 140`));
  await cdp.eval(`__pv.player.x = 1200; __pv.player.y = 1560; if (__pv.car) { __pv.car.x = 1200; __pv.car.y = 1560; }`);
  await sleep(400);
  check('mission 2 completes at beach', await cdp.eval(`__pv.rep === 50 && __pv.mission === null`));

  await cdp.eval(`__pvTest.startMission(2)`);
  check('mission 3 spawns the Comet', await cdp.eval(`__pv.mission.extra.comet && !__pv.mission.extra.comet.dead`));
  await cdp.eval(`__pvTest.exitCar(); __pv.player.x = __pv.mission.extra.comet.x + 30; __pv.player.y = __pv.mission.extra.comet.y; __pvTest.tryEnterCar()`);
  await sleep(300);
  check('stealing Comet raises wanted to 2', await cdp.eval(`__pv.car === __pv.mission.extra.comet && __pv.wanted >= 2`), `wanted=${await cdp.eval(`__pv.wanted`)}`);
  await cdp.eval(`__pv.car.x = 1000; __pv.car.y = 600; __pv.player.x = 1000; __pv.player.y = 600;`);
  await sleep(400);
  check('mission 3 completes at garage', await cdp.eval(`__pv.rep === 75 && __pv.mission === null`));

  await cdp.eval(`__pvTest.startMission(3)`);
  check('mission 4 spawns Rico sedan', await cdp.eval(`!!__pv.mission.extra.sedan`));
  // Chase the fleeing sedan down: steer at it with the throttle held, up to 8s.
  await cdp.eval(`__pv.input.up = true;`);
  let rammed = false;
  for (let i = 0; i < 80; i++) {
    const done = await cdp.eval(`__pv.mission === null && __pv.rep === 100`);
    if (done) { rammed = true; break; }
    await cdp.eval(`(() => { const s = __pv.mission ? __pv.mission.extra.sedan : null; if (!s || !__pv.car) return; __pv.car.angle = Math.atan2(s.y - __pv.car.y, s.x - __pv.car.x); __pv.car.x = s.x - Math.cos(__pv.car.angle) * 60; __pv.car.y = s.y - Math.sin(__pv.car.angle) * 60; __pv.car.speed = 280; })()`);
    await sleep(100);
  }
  await cdp.eval(`__pv.input.up = false;`);
  check('ramming wrecks the sedan, mission 4 completes', rammed, `rep=${await cdp.eval(`__pv.rep`)}`);

  await cdp.eval(`__pvTest.startMission(4)`);
  await cdp.eval(`__pv.player.x = 200; __pv.player.y = 200; if (__pv.car) { __pv.car.x = 200; __pv.car.y = 200; }`);
  await sleep(400);
  await cdp.eval(`__pv.player.x = 2200; __pv.player.y = 600; if (__pv.car) { __pv.car.x = 2200; __pv.car.y = 600; }`);
  await sleep(400);
  await cdp.eval(`__pv.player.x = 600; __pv.player.y = 1400; if (__pv.car) { __pv.car.x = 600; __pv.car.y = 1400; }`);
  await sleep(400);
  check('mission 5 completes after 3 drops', await cdp.eval(`__pv.mission === null && __pv.rep === 125`));

  await cdp.eval(`__pvTest.startMission(5)`);
  await sleep(600);
  check('mission 6 sets 4 stars + roadblocks', await cdp.eval(`__pv.wanted === 4 && __pv.roadblocks.length >= 1`), `rb=${await cdp.eval(`__pv.roadblocks.length`)}`);
  await cdp.eval(`__pv.player.x = 200; __pv.player.y = 200; if (__pv.car) { __pv.car.x = 200; __pv.car.y = 200; }`);
  await sleep(400);
  check('mission 6 completes at hideout', await cdp.eval(`__pv.mission === null && __pv.rep === 150`));

  await cdp.eval(`__pvTest.startMission(6)`);
  check('mission 7 spawns 3 guards + van', await cdp.eval(`__pv.mission.extra.guards.length === 3`));
  // Stand beside the guards (clear of the van) so the pistol reaches them,
  // and pin the camera so the aim point does not drift while it settles.
  await cdp.eval(`__pv.player.x = 1700; __pv.player.y = 960; if (__pv.car) { __pv.car.x = 1700; __pv.car.y = 960; __pv.car.speed = 0; } __pv.camera.x = 1700; __pv.camera.y = 960;`);
  await sleep(300);
  // Shoot the guards: re-aim before every shot and fire until each one is gone.
  for (let gi = 0; gi < 3; gi++) {
    for (let s = 0; s < 14; s++) {
      const gone = await cdp.eval(`!__pv.mission || !__pv.mission.extra.guards[${gi}] || __pv.mission.extra.guards[${gi}].hp <= 0 || !__pv.peds.includes(__pv.mission.extra.guards[${gi}])`);
      if (gone) break;
      await cdp.eval(`(() => { const gp = __pv.mission.extra.guards[${gi}]; if (!gp || gp.hp <= 0) return; __pv.mouse.x = gp.x - __pv.camera.x + 640; __pv.mouse.y = gp.y - __pv.camera.y + 400; __pvTest.switchWeapon(0); __pvTest.fireWeapon(); })()`);
      await sleep(260);
    }
  }
  await sleep(400);
  check('guards shot down, vault cash appears', await cdp.eval(`__pv.mission && __pv.mission.extra.cash && __pv.pickups.includes(__pv.mission.extra.cash)`));
  await cdp.eval(`__pv.mission.extra.cash.x = __pv.player.x; __pv.mission.extra.cash.y = __pv.player.y;`);
  await sleep(400);
  check('vault cash picked up', await cdp.eval(`__pv.mission.extra.cash.taken === true`));
  await cdp.eval(`__pv.player.x = 1000; __pv.player.y = 600; if (__pv.car) { __pv.car.x = 1000; __pv.car.y = 600; }`);
  await sleep(400);
  check('mission 7 completes at garage', await cdp.eval(`__pv.mission === null && __pv.rep === 175`));

  await cdp.eval(`__pvTest.startMission(7)`);
  await sleep(800);
  check('mission 8 sets 5 stars + Air One', await cdp.eval(`__pv.wanted === 5 && !!__pv.heli`), `heli=${await cdp.eval(`!!__pv.heli`)}`);
  await cdp.eval(`__pv.stripTimer = 0;`);
  await sleep(600);
  check('spike strip armed at 5 stars', await cdp.eval(`__pv.strips.length >= 1 && __pv.strips[0].armed`));
  await cdp.eval(`const s = __pv.strips[0]; __pv.car.x = s.x; __pv.car.y = s.y; __pv.player.x = s.x; __pv.player.y = s.y;`);
  await sleep(300);
  check('spike strip slows the car', await cdp.eval(`__pv.car.slowTimer > 0`), `slow=${await cdp.eval(`__pv.car.slowTimer`)}`);
  await cdp.eval(`__pv.player.x = 2250; __pv.player.y = 1560; if (__pv.car) { __pv.car.x = 2250; __pv.car.y = 1560; }`);
  await sleep(400);
  check('mission 8 completes, STREET KING, wanted cleared', await cdp.eval(`__pv.mission === null && __pv.rep === 200 && __pv.wanted === 0`), `rep=${await cdp.eval(`__pv.rep`)}`);

  // --- garage shop ---
  await cdp.eval(`__pv.cash = 5000; __pv.player.x = 1000; __pv.player.y = 600;`);
  await cdp.eval(`__pvTest.openShop()`);
  await sleep(300);
  check('garage opens with items', await cdp.eval(`__pv.mode === 'garage' && document.querySelectorAll('#shop-items .shop-item').length >= 10`), await cdp.eval(`'items=' + document.querySelectorAll('#shop-items .shop-item').length`));
  await cdp.eval(`[...document.querySelectorAll('#shop-items .shop-item')].find(el => el.textContent.includes('Engine · Stage 2')).click()`);
  await sleep(300);
  check('engine stage 2 bought', await cdp.eval(`__pv.garage.engine === 2 && __pv.cash === 4200`));
  await cdp.eval(`__pvTest.closeShop()`);
  check('garage closes', await cdp.eval(`__pv.mode === 'playing'`));

  // --- save / load ---
  await cdp.eval(`__pvTest.saveGame()`);
  check('save writes localStorage', await cdp.eval(`!!localStorage.getItem('portoVerdeSaveV1')`));
  const saved = await cdp.eval(`JSON.parse(localStorage.getItem('portoVerdeSaveV1'))`);
  check('save holds cash/rep/missions', saved && saved.cash === 4200 && saved.rep === 200 && saved.missionsDone.length === 8, JSON.stringify(saved).slice(0, 160));

  // --- wanted decay ---
  await cdp.eval(`__pv.wanted = 1; __pv.cops = []; __pv.heli = null; __pv.hiddenTimer = 11.5;`);
  await sleep(1200);
  check('hiding sheds a star after 12s', await cdp.eval(`__pv.wanted === 0`), `wanted=${await cdp.eval(`__pv.wanted`)}`);

  // --- busted ---
  await cdp.eval(`__pv.wanted = 2; __pv.cops = []; const cop = { x: __pv.player.x + 30, y: __pv.player.y, angle: 0, speed: 0, color: '#1c2733', kind: 'cop', hp: 120, maxHp: 120, isPlayer: false, isCop: true, driver: true, top: 380, accel: 380, cruise: 150, wp: null, wait: 0, dead: false, smoke: 0, paint: 0, wheels: 0, spoiler: false, slowTimer: 0 }; __pv.cops.push(cop); if (__pv.car) __pv.car.speed = 0;`);
  await sleep(3200);
  check('busted after 2.5s next to a cop', await cdp.eval(`__pv.mode === 'busted'`), `mode=${await cdp.eval(`__pv.mode`)}`);
  await cdp.eval(`__pvTest.respawn()`);
  check('retry respawns at garage', await cdp.eval(`__pv.mode === 'playing' && __pv.player.hp === 100 && __pv.wanted === 0`));

  // --- radio ---
  await cdp.eval(`__pvTest.newGame()`);
  const audioOk = await cdp.eval(`__pv.audio.ok`);
  await cdp.eval(`__pv.audio.setStation(1)`);
  check('radio station switches', await cdp.eval(`__pv.audio.station === 1`), `audioCtxOk=${audioOk}`);

  // --- render sanity: canvas not blank ---
  const px = await cdp.eval(`(() => { const c = document.getElementById('game'); const x = c.getContext('2d'); const d = x.getImageData(0, 0, 1280, 800).data; let sum = 0; for (let i = 0; i < d.length; i += 401) sum += d[i]; return sum; })()`);
  check('canvas renders non-blank pixels', px > 100000, `sampleSum=${px}`);
} catch (e) {
  console.log('PROBE ERROR: ' + e.message);
  results.push({ name: 'probe crashed', ok: false, detail: e.message });
} finally {
  const fails = results.filter((r) => !r.ok);
  console.log(`\n== ${results.length - fails.length}/${results.length} checks passed ==`);
  cdp.close();
  chrome.kill();
  server.close();
  process.exit(fails.length ? 1 : 0);
}
