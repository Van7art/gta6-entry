// shoot.mjs — headless-Chrome playtest + screenshot harness for Porto Verde.
// Usage: node tools/shoot.mjs <variantDir> [port]
// Serves <variantDir>/game with the entry's own serve.ts, then drives the
// Hatch Chromium over the DevTools pipe. Local-network navigations are
// blocked by Chrome's LNA checks when initiated by CDP, so each scene is
// opened through a file:// redirector (a file page counts as a local
// initiator). For every scene it reports window.__pv (ready/state/errors),
// FPS, a synthetic-drive probe, and writes a 1280x800 JPEG to screenshots/.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 8123);
const CHROME = '/opt/meta-chromium/chrome';
const POLICY_FILE = '/home/hatch/workspace/.tmp/pol-c.txt';
const POLICY_SHA = '8097045f0459c96c4cdc76e3a1af4e0f43f640b4b59c43d6db35e3641c0264c6';
const PROBE = '/tmp/pv-probe.html';
const W = 1280, H = 800;

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
    if (r.exceptionDetails) return { error: r.exceptionDetails.text };
    return r.result.value;
  }
}

async function main() {
  const server = spawn('node', ['serve.ts', '--port', String(port)], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  await sleep(1200);
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-debugging-pipe', `--window-size=${W},${H}`,
    '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    '--user-data-dir=/home/hatch/workspace/.tmp/chrome-shoot',
    `--hatch-webgl-allowed-domains-file=${POLICY_FILE}`,
    `--hatch-webgl-allowed-domains-sha256=${POLICY_SHA}`,
    '--no-proxy-server', '--mute-audio', 'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'] });
  const cdp = new PipeCDP(chrome);
  await sleep(1500);

  const scenes = [
    ['1-cover.jpg', 'chase'], ['2-drive.jpg', 'drive'],
    ['3-race.jpg', 'race'], ['4-foot.jpg', 'foot'],
  ];
  for (const [file, scene] of scenes) {
    const gameUrl = `http://127.0.0.1:${port}/?autostart=1&scene=${scene}&scale=1`;
    const tgt = await cdp.send('Target.createTarget', { url: `file://${PROBE}?u=${encodeURIComponent(gameUrl)}` });
    const att = await cdp.send('Target.attachToTarget', { targetId: tgt.targetId, flatten: true });
    const sid = att.sessionId;
    await cdp.send('Page.enable', {}, sid);
    await cdp.send('Runtime.enable', {}, sid);
    await cdp.send('Log.enable', {}, sid);
    await sleep(7000);
    const pv = await cdp.eval(`(()=>{const g=window.__pv&&window.__pv.game; if(!window.__pv) return {ready:false}; return {ready:window.__pv.ready, state:window.__pv.state, errors:window.__pv.errors, stars:g?g.police.stars:null, px:g?Math.round(g.player.x):null, pz:g?Math.round(g.player.z):null, inCar:g?!!g.player.car:null, traffic:g?g.traffic.cars.length:null, peds:g?g.peds.peds.length:null, mission:g&&g.missions.active?g.missions.mission.title:null};})()`, sid);
    const fps = await cdp.eval(`new Promise((res)=>{let n=0; const t0=performance.now(); const tick=()=>{n++; if(performance.now()-t0<2000) requestAnimationFrame(tick); else res(Math.round(n/2));}; requestAnimationFrame(tick);})`, sid);
    let moved = null;
    if (scene !== 'foot') {
      const before = await cdp.eval(`(()=>{const g=window.__pv.game; return {x:g.player.x, z:g.player.z, s:g.player.car?g.player.car.speed:0};})()`, sid);
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 }, sid);
      await sleep(2500);
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 }, sid);
      const after = await cdp.eval(`(()=>{const g=window.__pv.game; return {x:g.player.x, z:g.player.z, s:g.player.car?g.player.car.speed:0};})()`, sid);
      moved = { d: Math.round(Math.hypot(after.x - before.x, after.z - before.z)), speed: Math.round(after.s * 10) / 10 };
    }
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 }, sid);
    writeFileSync(join(dir, 'screenshots', file), Buffer.from(shot.data, 'base64'));
    console.log(JSON.stringify({ scene, file, pv, fps, moved }));
    await cdp.send('Target.closeTarget', { targetId: tgt.targetId });
  }
  const errs = cdp.events.filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error').map((e) => e.params.entry.text);
  const exc = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown').map((e) => e.params.exceptionDetails.text);
  console.log(JSON.stringify({ pageErrors: errs.slice(0, 5), exceptions: exc.slice(0, 5) }));
  chrome.kill('SIGKILL'); server.kill('SIGKILL');
  process.exit(0);
}
main().catch((e) => { console.error('HARNESS FAIL:', e.message); process.exit(1); });
