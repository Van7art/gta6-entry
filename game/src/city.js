// Porto Verde itself: road grid, blocks, buildings, beach, docks, garage bay.
// All layout values are fresh; the city is generated from a seed each load.
import { ROAD_X, ROAD_Y, ROAD_W, WORLD_W, WORLD_H, BEACH_Y, SEA_Y, GARAGE_POS } from './state.js';
import { mulberry32, pick, clamp } from './util.js';

const BUILDING_COLORS = ['#b98a5e', '#a87c50', '#c49a6b', '#96704a', '#c8a06a', '#8f6b4d', '#b0825a', '#d0aa72'];

export function buildCity(g) {
  const rng = mulberry32(g.rngSeed);
  g.buildings = [];
  g.palms = [];
  g.containers = [];
  // One or two buildings per block, skipping the beach strip and the garage block.
  for (let i = 0; i < ROAD_X.length - 1; i++) {
    for (let j = 0; j < ROAD_Y.length - 1; j++) {
      const x0 = ROAD_X[i] + ROAD_W / 2 + 14;
      const x1 = ROAD_X[i + 1] - ROAD_W / 2 - 14;
      const y0 = ROAD_Y[j] + ROAD_W / 2 + 14;
      const y1 = ROAD_Y[j + 1] - ROAD_W / 2 - 14;
      if (y0 > BEACH_Y - 120) continue;
      const isGarageBlock = Math.abs((x0 + x1) / 2 - GARAGE_POS.x) < 260 && Math.abs((y0 + y1) / 2 - GARAGE_POS.y) < 260;
      if (isGarageBlock) continue;
      const n = 1 + Math.floor(rng() * 2);
      for (let k = 0; k < n; k++) {
        const w = 90 + rng() * 130;
        const h = 80 + rng() * 110;
        const bx = x0 + rng() * Math.max(1, x1 - x0 - w);
        const by = y0 + rng() * Math.max(1, y1 - y0 - h);
        g.buildings.push({
          x: bx, y: by, w, h,
          color: pick(rng, BUILDING_COLORS),
          roof: rng() < 0.5 ? '#7a5a3a' : '#5d4a35',
          hgt: 26 + rng() * 40,
        });
      }
    }
  }
  // Palms along the beach and a few on the marina walk.
  for (let i = 0; i < 26; i++) {
    g.palms.push({ x: 60 + rng() * (WORLD_W - 120), y: BEACH_Y + 14 + rng() * 90, lean: (rng() - 0.5) * 0.5 });
  }
  // Shipping containers at the east docks.
  for (let i = 0; i < 10; i++) {
    g.containers.push({
      x: 2120 + (i % 5) * 52, y: 240 + Math.floor(i / 5) * 90,
      w: 44, h: 76, color: pick(rng, ['#c25e3a', '#3a7ec2', '#4da24a', '#c2a23a']),
    });
  }
  // Pickups: cash, ammo and repair kits scattered on the map.
  g.pickups = [];
  const spots = [
    { x: 600, y: 200, kind: 'cash' }, { x: 1400, y: 1000, kind: 'ammo' },
    { x: 1800, y: 600, kind: 'cash' }, { x: 2200, y: 1400, kind: 'health' },
    { x: 200, y: 1000, kind: 'ammo' }, { x: 1000, y: 1400, kind: 'cash' },
    { x: 600, y: 1400, kind: 'health' }, { x: 1800, y: 200, kind: 'cash' },
    { x: 1400, y: 200, kind: 'ammo' }, { x: 300, y: 1560, kind: 'cash' },
    { x: 1200, y: 1560, kind: 'health' }, { x: 2000, y: 1560, kind: 'ammo' },
  ];
  for (const s of spots) g.pickups.push({ ...s, taken: false, respawn: 0 });
}

export function onRoad(g, x, y) {
  for (const rx of ROAD_X) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROAD_Y) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

export function inBeach(g, x, y) {
  return y >= BEACH_Y && y < SEA_Y;
}

export function inSea(g, x, y) {
  return y >= SEA_Y;
}

export function buildingAt(g, x, y) {
  for (const b of g.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  for (const c of g.containers) {
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return c;
  }
  return null;
}

// Push a circle out of buildings/containers; returns true if it hit something.
export function collideBuildings(g, ent, r) {
  let hit = false;
  for (const b of [...g.buildings, ...g.containers]) {
    const cx = clamp(ent.x, b.x, b.x + b.w);
    const cy = clamp(ent.y, b.y, b.y + b.h);
    const dx = ent.x - cx;
    const dy = ent.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        ent.x = cx + (dx / d) * r;
        ent.y = cy + (dy / d) * r;
      } else {
        ent.x += r;
      }
    }
  }
  return hit;
}

export function nearestRoadPoint(g, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROAD_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y }; }
  }
  for (const ry of ROAD_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry }; }
  }
  return best;
}

export function drawCity(ctx, g, view) {
  const { x0, y0, x1, y1 } = view;
  // Ground: dry grass lots, warm in the dusk.
  ctx.fillStyle = '#8a7a4d';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Beach sand and sea.
  ctx.fillStyle = '#e8cf96';
  ctx.fillRect(Math.max(x0, 0), Math.max(y0, BEACH_Y), Math.min(x1, WORLD_W) - Math.max(x0, 0), SEA_Y - Math.max(y0, BEACH_Y));
  ctx.fillStyle = '#2f7f9e';
  ctx.fillRect(Math.max(x0, 0), Math.max(y0, SEA_Y), Math.min(x1, WORLD_W) - Math.max(x0, 0), WORLD_H - Math.max(y0, SEA_Y));
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let wy = SEA_Y + 26; wy < WORLD_H; wy += 52) {
    ctx.fillRect(Math.max(x0, 0), wy, Math.min(x1, WORLD_W) - Math.max(x0, 0), 3);
  }
  // Roads.
  ctx.fillStyle = '#3a3a40';
  for (const rx of ROAD_X) ctx.fillRect(rx - ROAD_W / 2, Math.max(y0, 0), ROAD_W, Math.min(y1, BEACH_Y) - Math.max(y0, 0));
  for (const ry of ROAD_Y) ctx.fillRect(Math.max(x0, 0), ry - ROAD_W / 2, Math.min(x1, WORLD_W) - Math.max(x0, 0), ROAD_W);
  // Warm centre dashes, stretched by the low sun.
  ctx.fillStyle = '#f7c948';
  for (const rx of ROAD_X) {
    for (let y = 40; y < BEACH_Y; y += 90) ctx.fillRect(rx - 2, y, 4, 42);
  }
  for (const ry of ROAD_Y) {
    for (let x = 40; x < WORLD_W; x += 90) ctx.fillRect(x, ry - 2, 42, 4);
  }
  // Garage forecourt.
  ctx.fillStyle = '#5d5d66';
  ctx.fillRect(GARAGE_POS.x - 150, GARAGE_POS.y - 110, 300, 220);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 20px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CROSS MOTORS', GARAGE_POS.x, GARAGE_POS.y - 122);
  ctx.fillStyle = '#3a3a40';
  ctx.fillRect(GARAGE_POS.x - 150, GARAGE_POS.y - 110, 300, 8);
  // Buildings with long dusk shadows to the east.
  for (const b of g.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = 'rgba(40,20,5,0.35)';
    ctx.fillRect(b.x + b.hgt * 0.9, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,220,130,0.5)';
    for (let wx = b.x + 16; wx < b.x + b.w - 14; wx += 30) {
      for (let wy = b.y + 16; wy < b.y + b.h - 14; wy += 30) ctx.fillRect(wx, wy, 10, 8);
    }
  }
  for (const c of g.containers) {
    ctx.fillStyle = 'rgba(40,20,5,0.35)';
    ctx.fillRect(c.x + 14, c.y + 6, c.w, c.h);
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(c.x, c.y + c.h / 2 - 2, c.w, 4);
  }
  // Palms.
  for (const p of g.palms) {
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    ctx.strokeStyle = '#6b4a26';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + p.lean * 20, p.y - 26);
    ctx.stroke();
    ctx.fillStyle = '#3f8f4f';
    for (let f = 0; f < 5; f++) {
      const a = (f / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(p.x + p.lean * 20 + Math.cos(a) * 12, p.y - 26 + Math.sin(a) * 7, 13, 5, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Pickups.
  for (const pk of g.pickups) {
    if (pk.taken) continue;
    if (pk.x < x0 || pk.x > x1 || pk.y < y0 || pk.y > y1) continue;
    const bob = Math.sin(g.time * 3 + pk.x) * 3;
    ctx.font = 'bold 22px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    if (pk.kind === 'cash') { ctx.fillStyle = '#7dff8a'; ctx.fillText('$', pk.x, pk.y + bob); }
    else if (pk.kind === 'ammo') { ctx.fillStyle = '#ffd76a'; ctx.fillText('▣', pk.x, pk.y + bob); }
    else { ctx.fillStyle = '#ff8a8a'; ctx.fillText('+', pk.x, pk.y + bob); }
  }
}
