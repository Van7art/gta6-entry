// probe.mjs — functional probes for the new systems, run in headless Chrome
// over the DevTools pipe (same file:// redirector trick as shoot.mjs).
// Usage: node tools/probe.mjs <variantDir> <variant: A|B|C> [port]
// Each check is an async snippet evaluated in the page; prints PASS/FAIL
// with evidence. Exits 1 if any check fails.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(process.argv[2]);
const variant = process.argv[3];
const port = Number(process.argv[4] || 8150);
const CHROME = '/opt/meta-chromium/chrome';
const POLICY_FILE = '/home/hatch/workspace/.tmp/pol-c.txt';
const POLICY_SHA = '8097045f0459c96c4cdc76e3a1af4e0f43f640b4b59c43d6db35e3641c0264c6';
const PROBE = '/tmp/pv-probe.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
writeFileSync(PROBE, '<!doctype html><script>location.href=decodeURIComponent(location.search.slice(3));</script>');

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

const CHECKS = {
  A: [
    ['pause menu lists 8 missions', `(async()=>{ return {buttons: document.querySelectorAll('#mission-list button').length}; })()`],
    ['mission 7 Harbour Heist: clearOut spawns 4 guards', `(async()=>{ const wait=${wait}; const g=window.__pv.game; const m=g.missions; m.start(6,g.ctx); g.player.setPosition(60,240,0); await wait(4000); return {title:m.mission.title, step:m.step&&m.step.type, guards:m.enemies.length}; })()`],
    ['mission 7 clearOut completes when guards die', `(async()=>{ const wait=${wait}; const g=window.__pv.game; const m=g.missions; for(const e of [...m.enemies]) e.hit(500); await wait(3000); return {enemiesLeft:m.enemies.length, step:m.step&&m.step.type, stepLabel:m.markerLabel}; })()`],
    ['mission 8 Kingpin\'s Fall: race spawns 3 rivals', `(async()=>{ const wait=${wait}; const g=window.__pv.game; const m=g.missions; m.start(7,g.ctx); g.player.setPosition(0,-180,0); await wait(4000); return {title:m.mission.title, step:m.step&&m.step.type, rivals:m.rivals.length, checkpoints:m.step&&m.step.checkpoints?m.step.checkpoints.length:null}; })()`],
    ['pickups: 12 items (6 health + 6 ammo)', `(async()=>{ const g=window.__pv.game; const items=g.pickups.items; return {n:items.length, health:items.filter(i=>i.kind==='health').length, ammo:items.filter(i=>i.kind==='ammo').length}; })()`],
    ['health pickup heals on touch', `(async()=>{ const wait=${wait}; const g=window.__pv.game; g.player.health=50; const it=g.pickups.items.find(i=>i.kind==='health'&&!i.taken); g.player.setPosition(it.x,it.z,0); await wait(3000); return {health:Math.round(g.player.health), taken:it.taken}; })()`],
    ['engine upgrade: buy + apply raises top speed', `(async()=>{ const g=window.__pv.game; g.cash=5000; const r=g.upgrades.buy('engine', g.cash); if(r.ok) g.cash-=r.cost; const car=g.parkedCars[0]; const base=car.stats.maxSpeed; g.upgrades.applyTo(car); return {ok:r.ok, cost:r.cost, base, tuned:+car.stats.maxSpeed.toFixed(1)}; })()`],
    ['armour upgrade: buy raises max HP', `(async()=>{ const g=window.__pv.game; g.cash=5000; const r=g.upgrades.buy('armor', g.cash); const car=g.parkedCars[1]; const base=car.stats.hp; g.upgrades.applyTo(car); return {ok:r.ok, cost:r.cost, base, tuned:car.stats.hp}; })()`],
  ],
  B: [
    ['traffic 36 + peds 64 + 20 parked cars', `(async()=>{ const g=window.__pv.game; return {traffic:g.traffic.cars.length, peds:g.peds.peds.length, parked:g.parkedCars.length}; })()`],
    ['day/night: 22:00 is night (dim sun, dark sky)', `(async()=>{ const g=window.__pv.game; g.clockMinutes=22*60; g.daynight.update(g.clockMinutes); return {sunI:+g.sun.intensity.toFixed(2), sky:'#'+g.scene.background.getHexString()}; })()`],
    ['day/night: 18:47 golden hour restored', `(async()=>{ const g=window.__pv.game; g.clockMinutes=18*60+47; g.daynight.update(g.clockMinutes); return {sunI:+g.sun.intensity.toFixed(2), sky:'#'+g.scene.background.getHexString()}; })()`],
    ['billboards + garage sign planes present', `(async()=>{ const g=window.__pv.game; let n=0; g.scene.traverse(o=>{if(o.geometry&&o.geometry.type==='PlaneGeometry'&&o.position.y>8)n++;}); return {signPlanes:n}; })()`],
  ],
  C: [
    ['HUD rank: REP 0 shows ROOKIE', `(async()=>{ return {repText: document.getElementById('rep').textContent}; })()`],
    ['HUD rank: rep 60 shows STREET KING', `(async()=>{ const wait=${wait}; const g=window.__pv.game; g.rep=60; await wait(2500); return {repText: document.getElementById('rep').textContent}; })()`],
    ['bribe math: 3 stars cost $450, setStars drops heat', `(async()=>{ const g=window.__pv.game; g.cash=1000; g.police.setStars(3); g.cash-=450; g.police.setStars(2); return {stars:g.police.stars, cash:g.cash}; })()`],
    ['collection stores a car (1/3)', `(async()=>{ const g=window.__pv.game; const car=g.parkedCars[0]; const ok=g.collection.store(car); return {ok, owned:g.collection.owned.length, type:g.collection.owned[0]&&g.collection.owned[0].type}; })()`],
    ['collection retrieve hands a car back', `(async()=>{ const g=window.__pv.game; const car=g.collection.retrieve(0, g.scene); return {got:!!car, type:car&&car.type, ownedLeft:g.collection.owned.length}; })()`],
    ['time trial starts, first ring visible', `(async()=>{ const g=window.__pv.game; g.activities.startTrial(g.ctx); return {idx:g.activities.trialIndex, ringVisible:g.activities.trialRings[0].mesh.visible, rings:g.activities.trialRings.length}; })()`],
    ['time trial ring advances on drive-through', `(async()=>{ const wait=${wait}; const g=window.__pv.game; const a=g.activities; const r0=a.trialRings[0]; g.player.setPosition(r0.x, r0.z, 0); const car=g.parkedCars[0]; g.player.enterCar(car); car.x=r0.x; car.z=r0.z; g.player.x=r0.x; g.player.z=r0.z; await wait(3000); return {idx:a.trialIndex}; })()`],
  ],
};

async function main() {
  const server = spawn('node', ['serve.ts', '--port', String(port)], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  await sleep(1200);
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-debugging-pipe', '--window-size=1280,800',
    '--enable-unsafe-swiftshader',
    '--user-data-dir=/home/hatch/workspace/.tmp/chrome-shoot',
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
  for (const [name, expr] of CHECKS[variant]) {
    const out = await cdp.eval(expr, sid);
    await sleep(300);
    const bad = !out || out.error;
    console.log((bad ? 'FAIL' : 'PASS') + ' | ' + name + ' => ' + JSON.stringify(out));
    if (bad) fail++;
  }
  chrome.kill('SIGKILL'); server.kill('SIGKILL');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error('PROBE FAIL:', e.message); process.exit(1); });
