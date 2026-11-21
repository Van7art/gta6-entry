// probe.mjs — functional probes for the R3 variant-B systems, run in
// headless Chrome over the DevTools pipe (same file:// redirector trick
// as shoot.mjs). Adapted from the R2 probe tool; the R2 original is kept
// untouched as probe-r2.mjs.
// Usage: node tools/probe.mjs <variantDir> [port]
// Each check is an async snippet evaluated in the page; prints PASS/FAIL
// with evidence. Exits 1 if any check fails. The Chrome profile dir is
// wiped first so no stale localStorage save leaks into the run.
import { spawn, execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(process.argv[2]);
const port = Number(process.argv[3] || 8171);
const CHROME = '/opt/meta-chromium/chrome';
const POLICY_FILE = '/home/hatch/workspace/.tmp/pol-c.txt';
const POLICY_SHA = '8097045f0459c96c4cdc76e3a1af4e0f43f640b4b59c43d6db35e3641c0264c6';
const PROFILE = '/home/hatch/workspace/.tmp/chrome-probe-r3vb';
const PROBE = '/tmp/pv-probe.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
writeFileSync(PROBE, '<!doctype html><script>location.href=decodeURIComponent(location.search.slice(3));</script>');
try { execSync(`rm -rf ${PROFILE}`); } catch { /* first run */ }

class PipeCDP {
  constructor(proc) {
    this.proc = proc; this.id = 0; this.pending = new Map(); this.events = [];
    let buf = Buffer.alloc(0);
    proc.stdio[4].on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      let i;
      while ((i = buf.indexOf(0)) >= 0) {
        const msg = JSON.parse(buf.subarray(0, i).toString());
        buf = buf.subarray(i + 1);
        if (msg.id && this.pending.has(msg.id)) {
          const { res, rej } = this.pending.get(msg.id); this.pending.delete(msg.id);
          msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
        } else if (msg.method) this.events.push(msg);
      }
    });
  }
  send(method, params = {}, sessionId) {
    return new Promise((res, rej) => {
      const id = ++this.id; this.pending.set(id, { res, rej });
      this.proc.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
    });
  }
  async eval(expr, sid) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid);
    if (r.exceptionDetails) return { error: (r.exceptionDetails.exception?.description || r.exceptionDetails.text || '').slice(0, 300) };
    return r.result.value;
  }
}

const wait = `(ms)=>new Promise(r=>setTimeout(r,ms))`;

const CHECKS = [
  ['pause menu lists 8 missions', `(async()=>{ return {buttons: document.querySelectorAll('#mission-list button').length}; })()`],
  ['respect rank: REP 0 shows ROOKIE', `(async()=>{ return {repText: document.getElementById('rep').textContent}; })()`],
  ['respect rank: rep 50 HUSTLER, rep 100 STREET KING', `(async()=>{ const wait=${wait}; const g=window.__pv.game; g.rep=50; await wait(1500); const h=document.getElementById('rep').textContent; g.rep=100; await wait(1500); const s=document.getElementById('rep').textContent; return {hustler:h, king:s}; })()`],
  ['5 stars: Air One heli spawns + roadblocks + spike strip', `(async()=>{ const wait=${wait}; const g=window.__pv.game; const car=g.parkedCars[0]; g.player.enterCar(car); car.velX=20; car.velZ=0; g.police.setStars(5); await wait(2500); return {stars:g.police.stars, heli:!!g.police.heli, heliActive:g.police.heliActive, blocks:g.police.roadblocks.length, blockCars:g.police.roadblockCars().length, strip:!!g.police.spikeStrip, stripArmed:g.police.spikeStrip&&g.police.spikeStrip.armed}; })()`],
  ['spike strip bursts tyres on drive-over', `(async()=>{ const wait=${wait}; const g=window.__pv.game; for(const c of g.police.cars){c.x+=500;c.z+=500;} const s=g.police.spikeStrip; s.armed=true; s.cooldown=0; const car=g.player.car; car.x=s.x; car.z=s.z; car.velX=0; car.velZ=0; await wait(2000); return {slowTimer:+car.slowTimer.toFixed(1), hp:Math.round(car.hp), armed:s.armed}; })()`],
  ['radio: setStation switches HUD label, nextStation cycles', `(async()=>{ const g=window.__pv.game; g.police.clear(); g.audio.setStation(1); const a=document.getElementById('radio').textContent; g.audio.nextStation(); const b=document.getElementById('radio').textContent; g.audio.setStation(0); return {station1:a, station2:b, station:g.audio.station}; })()`],
  ['weapon wheel: SMG then shotgun, mags tracked, shot spends ammo', `(async()=>{ const g=window.__pv.game; const p=g.player; if(p.car) p.exitCar(); p.selectWeapon('smg'); const smgAmmo=p.ammo; p.selectWeapon('shotgun'); const sgAmmo=p.ammo; const r=p.shoot({x:p.x+10,z:p.z},[]); return {weapon:p.weapon, smgAmmo, sgAmmo, shot:!!r, ammoAfter:p.ammo, wheel:document.getElementById('wheel-shotgun').textContent}; })()`],
  ['garage: buy Taxi Gold paint, applied to car body', `(async()=>{ const g=window.__pv.game; g.cash=5000; g.rep=120; const car=g.parkedCars[0]; g.player.enterCar(car); car.x=-90; car.z=86; car.velX=0; car.velZ=0; const r=g.upgrades.buyPaint('Taxi Gold', g.cash); if(r.ok) g.cash-=r.cost; g.upgrades.applyTo(car); return {ok:r.ok, cost:r.cost, paint:g.upgrades.paint, bodyHex:'0x'+car.mesh.userData.body.material.color.getHexString(), cash:g.cash}; })()`],
  ['garage: engine tier 3 locked at rep 0, open at HUSTLER (50)', `(async()=>{ const g=window.__pv.game; g.upgrades.levels.engine=2; const locked=g.upgrades.buy('engine', 9000, 0); g.rep=50; const r=g.upgrades.buy('engine', 9000, g.rep); const car=g.player.car; const base=car._upgBase.maxSpeed; g.upgrades.applyTo(car); return {lockedOk:locked.ok, lockedMsg:locked.msg, ok:r.ok, cost:r.cost, level:g.upgrades.levels.engine, base, tuned:+car.stats.maxSpeed.toFixed(1)}; })()`],
  ['garage: armour tier 3 locked at HUSTLER, open at STREET KING (100)', `(async()=>{ const g=window.__pv.game; g.upgrades.levels.armor=2; const locked=g.upgrades.buy('armor', 9000, 50); g.rep=100; const r=g.upgrades.buy('armor', 9000, g.rep); const car=g.player.car; const base=car._upgBase.hp; g.upgrades.applyTo(car); return {lockedOk:locked.ok, lockedMsg:locked.msg, ok:r.ok, cost:r.cost, level:g.upgrades.levels.armor, base, tuned:car.stats.hp}; })()`],
  ['garage: Chrome wheels + spoiler fit and show', `(async()=>{ const g=window.__pv.game; g.cash=9000; g.rep=100; const rw=g.upgrades.buyWheels('Chrome', g.cash, g.rep); if(rw.ok) g.cash-=rw.cost; const rs=g.upgrades.buySpoiler(g.cash, g.rep); if(rs.ok) g.cash-=rs.cost; const car=g.player.car; g.upgrades.applyTo(car); return {wheelsOk:rw.ok, spoilerOk:rs.ok, wheels:g.upgrades.wheels, spoiler:g.upgrades.spoiler, wheelHex:'0x'+car.mesh.userData.wheels[0].material.color.getHexString()}; })()`],
  ['save/load round-trip keeps garage + weapons + station + cash', `(async()=>{ const wait=${wait}; const g=window.__pv.game; g.cash=4321; g.rep=100; g.player.selectWeapon('smg'); g.audio.setStation(2); g.saveGame(); const raw=JSON.parse(localStorage.getItem('porto-verde-save-v1')); await wait(500); g.startGame(false); await wait(1000); return {savedPaint:raw.upgrades.paint, savedWheels:raw.upgrades.wheels, savedSpoiler:raw.upgrades.spoiler, savedWeapon:raw.weapons.current, savedStation:raw.settings.station, savedCash:raw.cash, loadedPaint:g.upgrades.paint, loadedWeapon:g.player.weapon, loadedStation:g.audio.station, loadedCash:g.cash, continueVisible:document.getElementById('btn-continue').style.display}; })()`],
];

async function main() {
  const server = spawn('node', ['serve.ts', '--port', String(port)], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  await sleep(1200);
  // Preflight: make sure OUR server owns this port. Sibling variant agents
  // share this VM; if another variant's server already holds the port, our
  // spawn dies with EADDRINUSE and Chrome would silently load THEIR game
  // (that exact failure hit port 8151, owned by variant C). Abort loudly.
  // Retried: under memory pressure the server can be slow to bind.
  let idx = '';
  for (let i = 0; i < 10; i++) {
    idx = await fetch(`http://127.0.0.1:${port}/`).then((r) => r.text()).catch(() => '');
    if (idx) break;
    await sleep(1000);
  }
  if (!idx.includes('weapon-wheel') || !idx.includes('CROSS MOTORS')) {
    console.error('PREFLIGHT FAIL: port ' + port + ' is not serving variant B (wrong server or bind failed).');
    server.kill('SIGKILL');
    process.exit(2);
  }
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-debugging-pipe', '--window-size=1280,800',
    '--enable-unsafe-swiftshader',
    `--user-data-dir=${PROFILE}`,
    `--hatch-webgl-allowed-domains-file=${POLICY_FILE}`,
    `--hatch-webgl-allowed-domains-sha256=${POLICY_SHA}`,
    '--no-proxy-server', '--mute-audio', 'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'] });
  const cdp = new PipeCDP(chrome);
  await sleep(1500);
  const gameUrl = `http://127.0.0.1:${port}/?autostart=1&scale=1`;
  const tgt = await cdp.send('Target.createTarget', { url: `file://${PROBE}?u=${encodeURIComponent(gameUrl)}` });
  const att = await cdp.send('Target.attachToTarget', { targetId: tgt.targetId, flatten: true });
  const sid = att.sessionId;
  await cdp.send('Page.enable', {}, sid);
  await cdp.send('Runtime.enable', {}, sid);
  await sleep(6000);
  const ready = await cdp.eval(`window.__pv && window.__pv.ready && window.__pv.errors.length===0 ? 'READY' : JSON.stringify(window.__pv)`, sid);
  console.log('boot:', ready);
  let fail = 0;
  for (const [name, expr] of CHECKS) {
    const out = await cdp.eval(expr, sid);
    await sleep(300);
    // Per-check assertions beyond "no exception".
    let bad = !out || out.error;
    if (!bad) {
      if (name.startsWith('pause menu') && out.buttons !== 8) bad = true;
      if (name.startsWith('respect rank: REP 0') && !/ROOKIE/.test(out.repText || '')) bad = true;
      if (name.startsWith('respect rank: rep 50') && (!/HUSTLER/.test(out.hustler || '') || !/STREET KING/.test(out.king || ''))) bad = true;
      if (name.startsWith('5 stars') && (!out.heli || !out.heliActive || out.blocks < 2 || out.blockCars < 4 || !out.strip || !out.stripArmed)) bad = true;
      if (name.startsWith('spike strip bursts') && !(out.slowTimer > 0)) bad = true;
      if (name.startsWith('radio:') && (!/PLAYA 104/.test(out.station1 || '') || !/DOCK RADIO/.test(out.station2 || ''))) bad = true;
      if (name.startsWith('weapon wheel') && !(out.weapon === 'shotgun' && out.smgAmmo === 30 && out.sgAmmo === 6 && out.shot && out.ammoAfter === 5)) bad = true;
      if (name.startsWith('garage: buy Taxi') && !(out.ok && out.paint === 'Taxi Gold' && out.bodyHex === '0xf1c40f')) bad = true;
      if (name.startsWith('garage: engine tier 3') && !(out.lockedOk === false && /HUSTLER/.test(out.lockedMsg || '') && out.ok && out.cost === 2500 && out.level === 3 && Math.abs(out.tuned - out.base * 1.45) < 0.2)) bad = true;
      if (name.startsWith('garage: armour tier 3') && !(out.lockedOk === false && /STREET KING/.test(out.lockedMsg || '') && out.ok && out.cost === 2200 && out.level === 3 && out.tuned === out.base + 150)) bad = true;
      if (name.startsWith('garage: Chrome') && !(out.wheelsOk && out.spoilerOk && out.wheels === 'Chrome' && out.spoiler === true && out.wheelHex === '0xd8d8d8')) bad = true;
      if (name.startsWith('save/load') && !(out.savedPaint === 'Taxi Gold' && out.savedWheels === 'Chrome' && out.savedSpoiler === true && out.savedWeapon === 'smg' && out.savedStation === 2 && out.savedCash === 4321 && out.loadedPaint === 'Taxi Gold' && out.loadedWeapon === 'smg' && out.loadedStation === 2 && out.loadedCash === 4321)) bad = true;
    }
    console.log((bad ? 'FAIL' : 'PASS') + ' | ' + name + ' => ' + JSON.stringify(out));
    if (bad) fail++;
  }
  chrome.kill('SIGKILL'); server.kill('SIGKILL');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error('PROBE FAIL:', e.message); process.exit(1); });
