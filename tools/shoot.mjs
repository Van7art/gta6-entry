// Screenshot shooter for Porto Verde R3.1: stages the 4 scenes and saves JPEGs.
// Usage: node tools/shoot.mjs [root] — writes screenshots/1-chase.jpg etc.
import { serve, launchBrowser, connect, sleep } from './cdp.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFile } from 'node:fs/promises';

const ROOT = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8472;
const DBG = 9224;
const SCENES = [
  ['1-chase', 'chase'],
  ['2-drive', 'drive'],
  ['3-garage', 'garage'],
  ['4-foot', 'foot'],
];

const server = await serve(ROOT, PORT);
let failures = 0;
for (const [name, scene] of SCENES) {
  const { chrome, wsUrl } = await launchBrowser(DBG, `http://127.0.0.1:${PORT}/game/index.html?scene=${scene}`);
  const cdp = await connect(wsUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  try {
    await cdp.waitFor(`window.__pvReady === true`, 15000);
    await sleep(700);
    let quality = 88;
    let buf = await shot(cdp, quality);
    for (let tries = 0; buf.length > 262144 && tries < 3; tries++) {
      quality -= 12;
      buf = await shot(cdp, quality);
    }
    const out = join(ROOT, 'screenshots', `${name}.jpg`);
    await writeFile(out, buf);
    console.log(`${name}.jpg  ${buf.length} bytes  quality=${quality}  ${buf.length <= 262144 ? 'OK' : 'OVER 256KiB'}`);
    if (buf.length > 262144) failures += 1;
  } catch (e) {
    console.log(`FAIL ${name}: ${e.message}`);
    failures += 1;
  } finally {
    cdp.close();
    chrome.kill();
    await sleep(300);
  }
}
server.close();
console.log(failures ? `${failures} screenshot(s) failed` : 'all 4 screenshots saved');
process.exit(failures ? 1 : 0);

async function shot(cdp, quality) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality });
  return Buffer.from(r.data, 'base64');
}
