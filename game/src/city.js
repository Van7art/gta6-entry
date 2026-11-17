// city.js — builds Porto Verde: the ground texture (roads, sidewalks, beach,
// harbour concrete), the district buildings, palms, streetlights, traffic
// lights, harbour containers and the ocean. Exports the collision boxes and
// the road graph the traffic, police and pedestrians drive and walk on.
import * as THREE from 'three';
import { CITY, DISTRICTS, districtFor } from './config.js';
import { mulberry32, rand } from './util.js';

const WORLD = 640; // ground plane spans -320..320

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function toPx(x) { return ((x + WORLD / 2) / WORLD) * 2048; }

function drawGroundTexture() {
  const c = makeCanvas(2048, 2048);
  const g = c.getContext('2d');
  // Base: dry grass / dirt.
  g.fillStyle = '#7d9b5a'; g.fillRect(0, 0, 2048, 2048);
  // Block interiors: pavement tint per district, drawn before roads.
  for (let bx = -4; bx <= 4; bx++) {
    for (let bz = -4; bz <= 4; bz++) {
      const d = DISTRICTS[districtFor(bx, bz)];
      const cx = bx * CITY.pitch + CITY.pitch / 2;
      const cz = bz * CITY.pitch + CITY.pitch / 2;
      g.fillStyle = '#' + new THREE.Color(d.color[0]).offsetHSL(0, 0, 0.12).getHexString();
      g.fillRect(toPx(cx - 23), toPx(cz - 23), toPx(46) - toPx(0), toPx(46) - toPx(0));
    }
  }
  // Harbour apron (south) and beach sand (east, past the beachfront hotels).
  g.fillStyle = '#8f8a80'; g.fillRect(0, toPx(248), 2048, 2048 - toPx(248));
  g.fillStyle = '#e8d9a8'; g.fillRect(toPx(293), 0, 2048 - toPx(293), 2048);
  // Sidewalks (light) then asphalt.
  for (const r of CITY.roads) {
    g.fillStyle = '#b9b4a8';
    g.fillRect(0, toPx(r - 11), 2048, toPx(22) - toPx(0));
    g.fillRect(toPx(r - 11), 0, toPx(22) - toPx(0), 2048);
    g.fillStyle = '#3c3c40';
    g.fillRect(0, toPx(r - 7), 2048, toPx(14) - toPx(0));
    g.fillRect(toPx(r - 7), 0, toPx(14) - toPx(0), 2048);
  }
  // Lane dashes.
  g.fillStyle = '#e8e0b0';
  for (const r of CITY.roads) {
    for (let x = -320; x < 320; x += 12) {
      g.fillRect(toPx(x), toPx(r - 0.4), toPx(6) - toPx(0), toPx(0.8) - toPx(0));
      g.fillRect(toPx(r - 0.4), toPx(x), toPx(0.8) - toPx(0), toPx(6) - toPx(0));
    }
  }
  // Crosswalks at every intersection.
  g.fillStyle = '#e8e8e8';
  for (const rx of CITY.roads) {
    for (const rz of CITY.roads) {
      for (let i = -3; i <= 3; i++) {
        g.fillRect(toPx(rx + i * 1.8 - 0.5), toPx(rz - 9), toPx(1) - toPx(0), toPx(2) - toPx(0));
        g.fillRect(toPx(rx + i * 1.8 - 0.5), toPx(rz + 7), toPx(1) - toPx(0), toPx(2) - toPx(0));
        g.fillRect(toPx(rx - 9), toPx(rz + i * 1.8 - 0.5), toPx(2) - toPx(0), toPx(1) - toPx(0));
        g.fillRect(toPx(rx + 7), toPx(rz + i * 1.8 - 0.5), toPx(2) - toPx(0), toPx(1) - toPx(0));
      }
    }
  }
  // Central park block (block 0,0): green + paths.
  g.fillStyle = '#5d8a4a'; g.fillRect(toPx(-23), toPx(-23), toPx(46) - toPx(0), toPx(46) - toPx(0));
  g.fillStyle = '#c8b890'; g.fillRect(toPx(-1), toPx(-23), toPx(2) - toPx(0), toPx(46) - toPx(0));
  g.fillRect(toPx(-23), toPx(-1), toPx(46) - toPx(0), toPx(2) - toPx(0));
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeWindowTexture() {
  const c = makeCanvas(128, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#2a3542';
  for (let y = 12; y < 248; y += 22) {
    for (let x = 10; x < 120; x += 22) {
      g.fillRect(x, y, 14, 12);
    }
  }
  // A few lit windows for the golden hour.
  g.fillStyle = '#ffd98a';
  for (let i = 0; i < 14; i++) {
    g.fillRect(10 + Math.floor(Math.random() * 5) * 22, 12 + Math.floor(Math.random() * 11) * 22, 14, 12);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeTextSpriteTexture(text, fg, bg) {
  const c = makeCanvas(512, 128);
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg;
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // {minX,maxX,minZ,maxZ}
    this.trafficLights = []; // {x,z,axis}
    this.palmPositions = [];
    this.rng = mulberry32(20261117);
    this.buildGround();
    this.buildBuildings();
    this.buildProps();
    this.buildOcean();
  }

  buildGround() {
    const tex = drawGroundTexture();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD, WORLD),
      new THREE.MeshLambertMaterial({ map: tex })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  buildOcean() {
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(700, WORLD + 200),
      new THREE.MeshLambertMaterial({ color: 0x2e7fa8 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(320 + 350, -0.4, 0);
    this.scene.add(ocean);
    // Boardwalk strip between the hotels and the sand.
    const walk = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.3, WORLD),
      new THREE.MeshLambertMaterial({ color: 0xc8a878 })
    );
    walk.position.set(293, 0.15, 0);
    this.scene.add(walk);
  }

  buildBuildings() {
    this.windowTex = makeWindowTexture();
    this.boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.materialCache = new Map();
    const rng = this.rng;
    for (let bx = -4; bx <= 4; bx++) {
      for (let bz = -4; bz <= 4; bz++) {
        if (bx === 0 && bz === 0) continue; // central park
        if (bx === -2 && bz === 1) continue; // Cross Motors garage block
        const cx = bx * CITY.pitch + CITY.pitch / 2;
        const cz = bz * CITY.pitch + CITY.pitch / 2;
        const district = districtFor(bx, bz);
        if (district === 'harbour') { this.buildHarbourBlock(cx, cz, rng); continue; }
        if (district === 'beach' && bx === 4) { this.buildBeachBlock(cx, cz, rng); continue; }
        this.buildBlock(cx, cz, district, rng);
      }
    }
    this.buildGarage();
  }

  materialFor(colorHex, windows) {
    const key = colorHex + (windows ? 'w' : '');
    if (!this.materialCache.has(key)) {
      const mat = new THREE.MeshLambertMaterial({
        color: colorHex,
        map: windows ? this.windowTex : null,
      });
      this.materialCache.set(key, mat);
    }
    return this.materialCache.get(key);
  }

  addBuilding(cx, cz, w, d, h, districtKey) {
    const dist = DISTRICTS[districtKey];
    const color = dist.color[Math.floor(this.rng() * dist.color.length)];
    // One material per building so the window texture repeats to the
    // building's own size instead of stretching across a tower.
    let mat;
    if (h > 10) {
      const tex = this.windowTex.clone();
      tex.needsUpdate = true;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 6)));
      mat = new THREE.MeshLambertMaterial({ color, map: tex });
    } else {
      mat = this.materialFor(color, false);
    }
    const mesh = new THREE.Mesh(this.boxGeo, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    // Rooftop box for tall towers.
    if (h > 40) {
      const top = new THREE.Mesh(this.boxGeo, this.materialFor(0x5a6a7a, false));
      top.scale.set(w * 0.25, 6, d * 0.25);
      top.position.set(cx, h + 3, cz);
      top.castShadow = true;
      this.scene.add(top);
    }
    return mesh;
  }

  buildBlock(cx, cz, districtKey, rng) {
    const d = DISTRICTS[districtKey];
    const count = districtKey === 'oldtown' ? 4 : (districtKey === 'downtown' ? 1 : 2);
    if (count === 1) {
      const h = d.minH + rng() * (d.maxH - d.minH);
      this.addBuilding(cx, cz, 34, 34, h, districtKey);
    } else if (count === 2) {
      const h1 = d.minH + rng() * (d.maxH - d.minH);
      const h2 = d.minH + rng() * (d.maxH - d.minH);
      this.addBuilding(cx - 11, cz, 20, 36, h1, districtKey);
      this.addBuilding(cx + 11, cz, 20, 36, h2, districtKey);
    } else {
      // Four small houses with gaps (driveable gaps stay on the block edge).
      for (const ox of [-11, 11]) {
        for (const oz of [-11, 11]) {
          const h = d.minH + rng() * (d.maxH - d.minH);
          this.addBuilding(cx + ox, cz + oz, 18, 16, h, districtKey);
        }
      }
    }
  }

  buildBeachBlock(cx, cz, rng) {
    // Hotels facing the sea, with palm-lined frontage.
    const h = 14 + rng() * 16;
    this.addBuilding(cx - 6, cz, 26, 36, h, 'beach');
    for (let i = -1; i <= 1; i++) {
      this.palmPositions.push([cx + 18, cz + i * 14]);
    }
  }

  buildHarbourBlock(cx, cz, rng) {
    // Warehouses + stacked shipping containers.
    const wh = new THREE.Mesh(this.boxGeo, this.materialFor(0x8a7f6e, false));
    wh.scale.set(30, 9, 18);
    wh.position.set(cx - 4, 4.5, cz);
    wh.castShadow = true;
    this.scene.add(wh);
    this.colliders.push({ minX: cx - 19, maxX: cx + 11, minZ: cz - 9, maxZ: cz + 9 });
    const colors = [0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d, 0x7d3c98];
    for (let i = 0; i < 5; i++) {
      const col = colors[Math.floor(rng() * colors.length)];
      const stack = 1 + Math.floor(rng() * 2);
      for (let s = 0; s < stack; s++) {
        const box = new THREE.Mesh(this.boxGeo, this.materialFor(col, false));
        box.scale.set(12, 2.6, 2.6);
        box.position.set(cx + 14, 1.3 + s * 2.6, cz - 14 + i * 7);
        this.scene.add(box);
      }
      this.colliders.push({ minX: cx + 8, maxX: cx + 20, minZ: cz - 15.4 + i * 7, maxZ: cz - 12.6 + i * 7 });
    }
  }

  buildGarage() {
    // Cross Motors — the player's garage / respray shop at block (-2, 1).
    const cx = -90, cz = 90;
    const base = new THREE.Mesh(this.boxGeo, this.materialFor(0x3a4a5a, false));
    base.scale.set(34, 8, 30);
    base.position.set(cx, 4, cz);
    base.castShadow = true;
    this.scene.add(base);
    this.colliders.push({ minX: cx - 17, maxX: cx - 6, minZ: cz - 15, maxZ: cz + 15 });
    this.colliders.push({ minX: cx + 6, maxX: cx + 17, minZ: cz - 15, maxZ: cz + 15 });
    this.colliders.push({ minX: cx - 17, maxX: cx + 17, minZ: cz + 9, maxZ: cz + 15 });
    // Open front bay (drive in from the north side, z = cz - 15).
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 6.5),
      new THREE.MeshBasicMaterial({ map: makeTextSpriteTexture('CROSS MOTORS', '#ffd24a', '#20242c') })
    );
    sign.position.set(cx, 9.5, cz - 15.2);
    sign.rotation.y = Math.PI;
    this.scene.add(sign);
    this.garage = { x: cx, z: cz - 4, radius: 10 };
  }

  buildProps() {
    // Streetlights along every road, traffic lights at intersections, palms.
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 7, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
    const lampGeo = new THREE.SphereGeometry(0.35, 8, 6);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const r of CITY.roads) {
      for (let k = -3; k <= 3; k++) {
        const p = k * 60 + 30;
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(r + 8.5, 3.5, p);
        this.scene.add(pole);
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(r + 8.5, 7, p);
        this.scene.add(lamp);
        const pole2 = new THREE.Mesh(poleGeo, poleMat);
        pole2.position.set(p, 3.5, r + 8.5);
        this.scene.add(pole2);
        const lamp2 = new THREE.Mesh(lampGeo, lampMat);
        lamp2.position.set(p, 7, r + 8.5);
        this.scene.add(lamp2);
      }
    }
    // Traffic light posts at intersections (visual; state lives in lightPhase()).
    const postGeo = new THREE.CylinderGeometry(0.15, 0.15, 5.5, 6);
    const headGeo = new THREE.BoxGeometry(0.7, 1.6, 0.7);
    for (const rx of CITY.roads) {
      for (const rz of CITY.roads) {
        const post = new THREE.Mesh(postGeo, poleMat);
        post.position.set(rx + 8, 2.75, rz + 8);
        this.scene.add(post);
        const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: 0x222222 }));
        head.position.set(rx + 8, 5.8, rz + 8);
        this.scene.add(head);
        this.trafficLights.push({ x: rx, z: rz });
      }
    }
    // Palms on the beach road and around the park.
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
    const crownGeo = new THREE.IcosahedronGeometry(2.2, 0);
    const crownMat = new THREE.MeshLambertMaterial({ color: 0x3f8a3a });
    const palmSpots = [...this.palmPositions];
    for (let z = -240; z <= 240; z += 30) palmSpots.push([244, z]);
    for (let z = -220; z <= 220; z += 60) palmSpots.push([300, z]);
    for (const [ox, oz] of [[-20, -20], [20, -20], [-20, 20], [20, 20], [0, -18], [0, 18]]) {
      palmSpots.push([ox, oz]);
    }
    for (const [x, z] of palmSpots) {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 3.5, z);
      this.scene.add(trunk);
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.position.set(x, 7.6, z);
      crown.scale.y = 0.6;
      this.scene.add(crown);
    }
    // Beach umbrellas on the sand.
    const umbGeo = new THREE.ConeGeometry(2.2, 1.2, 8);
    for (let i = 0; i < 10; i++) {
      const umb = new THREE.Mesh(umbGeo, new THREE.MeshLambertMaterial({
        color: [0xe74c3c, 0xf1c40f, 0x3498db, 0xffffff][i % 4],
      }));
      umb.position.set(302 + rand(0, 12), 2.2, -220 + i * 48 + rand(-8, 8));
      this.scene.add(umb);
    }
  }

  // --- Road graph helpers -------------------------------------------------
  nearestRoadCoord(v) {
    let best = CITY.roads[0];
    for (const r of CITY.roads) if (Math.abs(r - v) < Math.abs(best - v)) best = r;
    return best;
  }

  // Snap any point to the nearest road centreline (keeps the axis it is on).
  snapToRoad(x, z) {
    const dx = Math.abs(x - this.nearestRoadCoord(x));
    const dz = Math.abs(z - this.nearestRoadCoord(z));
    if (dx <= dz) return { x: this.nearestRoadCoord(x), z, axis: 'z' };
    return { x, z: this.nearestRoadCoord(z), axis: 'x' };
  }

  randomRoadPoint() {
    const r1 = CITY.roads[Math.floor(Math.random() * CITY.roads.length)];
    const r2 = CITY.roads[Math.floor(Math.random() * CITY.roads.length)];
    return { x: r1, z: r2 };
  }

  randomPointOnRoad() {
    const axis = Math.random() < 0.5 ? 'x' : 'z';
    const r = CITY.roads[Math.floor(Math.random() * CITY.roads.length)];
    const along = rand(-235, 235);
    return axis === 'x' ? { x: along, z: r } : { x: r, z: along };
  }

  // Circle (x,z,r) vs every building AABB. Returns push-out or null.
  collideCircle(x, z, r) {
    for (const b of this.colliders) {
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx, dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          return { nx: dx / d, nz: dz / d, depth: r - d };
        }
        return { nx: 0, nz: -1, depth: r };
      }
    }
    return null;
  }

  // Is (x,z) on a road, on the beach, or in the harbour apron (drivable)?
  drivable(x, z) {
    if (x > 293 && x < 320) return true; // beach sand
    if (z > 246 && z < 320 && x > -250 && x < 250) return true; // harbour apron
    const rx = Math.abs(x - this.nearestRoadCoord(x));
    const rz = Math.abs(z - this.nearestRoadCoord(z));
    return rx <= 8.5 || rz <= 8.5;
  }

  // Off-road slowdown factor: 1 on road, 0.55 on grass/sand.
  surfaceFactor(x, z) {
    if (x > 290) return 0.6; // sand
    const rx = Math.abs(x - this.nearestRoadCoord(x));
    const rz = Math.abs(z - this.nearestRoadCoord(z));
    if (rx <= 8.5 || rz <= 8.5) return 1;
    return 0.55;
  }

  // Traffic light: NS roads green while phase < 0.5, EW roads green after.
  lightGreenFor(axis, timeSec) {
    const cycle = (timeSec % 14) / 14;
    return axis === 'z' ? cycle < 0.5 : cycle >= 0.5;
  }
}
