// city.js — builds the whole of Solmar Bay: ground, road grid, buildings with
// procedurally painted facades, beach and ocean, palms, street lights, the
// marina pier, and the story landmarks (garage, hotel, mall, warehouse,
// harbour, safehouse, hospital, police station). All art is generated in code.
import * as THREE from 'three';
import { BLOCK, ROAD, GRID, PITCH, CITY_HALF, BEACH_Z, PALETTE, mulberry32 } from './config.js';
import { G } from './state.js';

export const LANDMARKS = {};

export function blockCenter(i, j) {
  return { x: (i - (GRID - 1) / 2) * PITCH, z: (j - (GRID - 1) / 2) * PITCH };
}

function facadeTexture(baseColor, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 256);
  // window grid
  for (let y = 14; y < 244; y += 26) {
    for (let x = 12; x < 116; x += 24) {
      const lit = Math.random() < litRatio;
      ctx.fillStyle = lit ? '#ffe9a8' : '#2c3e55';
      ctx.fillRect(x, y, 14, 16);
    }
  }
  // neon shop sign strip at the bottom
  ctx.fillStyle = PALETTE.neon[Math.floor(Math.random() * PALETTE.neon.length)];
  ctx.fillRect(0, 232, 128, 24);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hexCss(n) { return '#' + n.toString(16).padStart(6, '0'); }

export function buildCity(scene) {
  const rand = mulberry32(20261117);
  G.colliders.length = 0;

  // --- sky, sun, fog -------------------------------------------------------
  scene.background = new THREE.Color(PALETTE.skyBottom);
  scene.fog = new THREE.Fog(0xf6c98a, 180, 620);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.1);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffe0b3, 0.35));

  // --- ground: grass base, then road strips, sidewalks, sand, sea ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 320, CITY_HALF * 2 + 320),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
  for (let i = 0; i <= GRID; i++) {
    const p = -CITY_HALF - ROAD / 2 + i * PITCH;
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2 + ROAD, ROAD), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = horizontal ? 0 : Math.PI / 2;
      road.position.set(horizontal ? 0 : p, 0, horizontal ? p : 0);
      road.receiveShadow = true;
      scene.add(road);
      // dashed centre line
      for (let d = -CITY_HALF; d < CITY_HALF; d += 12) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = horizontal ? 0 : Math.PI / 2;
        dash.position.set(horizontal ? d : p, 0.02, horizontal ? p : d);
        scene.add(dash);
      }
    }
  }

  // beach + ocean on the south edge
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 320, 60),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.01, BEACH_Z + 10);
  sand.receiveShadow = true;
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 320, 220),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, BEACH_Z + 140);
  scene.add(sea);

  // --- buildings -----------------------------------------------------------
  const plaza = { i: 4, j: 4 };
  const skipBlocks = new Set(['4,4', '4,8', '0,8', '8,8', '2,2', '6,6']);
  const facadeMats = PALETTE.building.map((col) => new THREE.MeshLambertMaterial({
    map: facadeTexture(hexCss(col), 0.35),
  }));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6b5d4f });
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      if (skipBlocks.has(`${i},${j}`)) continue;
      const c = blockCenter(i, j);
      const n = 1 + Math.floor(rand() * 3);
      for (let b = 0; b < n; b++) {
        const w = 12 + rand() * 14;
        const d = 12 + rand() * 14;
        const h = 10 + rand() * rand() * 46;
        const ox = (rand() - 0.5) * (BLOCK - w - 4);
        const oz = (rand() - 0.5) * (BLOCK - d - 4);
        const mat = facadeMats[Math.floor(rand() * facadeMats.length)];
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(c.x + ox, h / 2, c.z + oz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), roofMat);
        roof.position.set(c.x + ox, h + 0.4, c.z + oz);
        scene.add(roof);
        // rooftop AC box for silhouette variety
        if (h > 24) {
          const ac = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 3), roofMat);
          ac.position.set(c.x + ox + w / 4, h + 1.6, c.z + oz);
          scene.add(ac);
        }
        G.colliders.push({
          minX: c.x + ox - w / 2, maxX: c.x + ox + w / 2,
          minZ: c.z + oz - d / 2, maxZ: c.z + oz + d / 2,
        });
      }
    }
  }

  // --- central plaza: fountain + palms --------------------------------------
  const plazaC = blockCenter(plaza.i, plaza.j);
  const plazaFloor = new THREE.Mesh(
    new THREE.CircleGeometry(20, 24),
    new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk }),
  );
  plazaFloor.rotation.x = -Math.PI / 2;
  plazaFloor.position.set(plazaC.x, 0.02, plazaC.z);
  plazaFloor.receiveShadow = true;
  scene.add(plazaFloor);
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 6, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0x7fb3d5 }),
  );
  fountain.position.set(plazaC.x, 0.6, plazaC.z);
  fountain.castShadow = true;
  scene.add(fountain);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(4.4, 20),
    new THREE.MeshLambertMaterial({ color: 0x3fa8d8 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(plazaC.x, 1.25, plazaC.z);
  scene.add(water);

  // --- palms along the beach and plaza --------------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 7, 6), trunkMat);
    trunk.position.y = 3.5;
    trunk.castShadow = true;
    g.add(trunk);
    for (let k = 0; k < 6; k++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 4), leafMat);
      const a = (k / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.4, 7.2, Math.sin(a) * 1.4);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    scene.add(g);
  }
  for (let x = -CITY_HALF; x <= CITY_HALF; x += 26) {
    palm(x, BEACH_Z - 8);
    if (Math.abs(x) % 52 < 26) palm(x + 8, plazaC.z + 16);
  }

  // --- marina pier ----------------------------------------------------------
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(10, 1, 60),
    new THREE.MeshLambertMaterial({ color: 0x9a7b52 }),
  );
  pier.position.set(-60, 0.5, BEACH_Z + 34);
  pier.castShadow = true;
  scene.add(pier);
  for (let k = 0; k < 3; k++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(4, 1.6, 12),
      new THREE.MeshLambertMaterial({ color: [0xffffff, 0xff5da2, 0x37e6c8][k] }),
    );
    hull.position.y = 0.4;
    boat.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1.6, 4),
      new THREE.MeshLambertMaterial({ color: 0x2c3e55 }),
    );
    cabin.position.set(0, 1.8, -1);
    boat.add(cabin);
    boat.position.set(-72 + k * 12, 0.2, BEACH_Z + 62 + (k % 2) * 14);
    boat.rotation.y = (rand() - 0.5) * 0.3;
    scene.add(boat);
  }

  // --- street lights ---------------------------------------------------------
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j += 2) {
      const x = -CITY_HALF - ROAD / 2 + i * PITCH;
      const z = -CITY_HALF - ROAD / 2 + j * PITCH;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), poleMat);
      pole.position.set(x + 8, 3.5, z + 8);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(x + 8, 7.1, z + 8);
      scene.add(lamp);
    }
  }

  // --- landmarks (story locations) ------------------------------------------
  function landmark(name, i, j, label, color) {
    const c = blockCenter(i, j);
    const pos = new THREE.Vector3(c.x, 0, c.z);
    LANDMARKS[name] = { pos, label };
    // a glowing sign board on posts so the place reads from a distance
    const postMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
    for (const sx of [-6, 6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5, 6), postMat);
      post.position.set(c.x + sx, 2.5, c.z - BLOCK / 2 + 1);
      scene.add(post);
    }
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(14, 2.4, 0.6),
      new THREE.MeshBasicMaterial({ color }),
    );
    sign.position.set(c.x, 6, c.z - BLOCK / 2 + 1);
    scene.add(sign);
    return pos;
  }
  landmark('garage', 2, 2, 'Sunset Garage — Mara Voss', 0xff5da2);
  landmark('hotel', 6, 2, 'Neon Palms Hotel', 0x37e6c8);
  landmark('mall', 6, 6, 'Coral Mall', 0xffc93c);
  landmark('warehouse', 1, 6, 'Kells Warehouse', 0xff6a3c);
  landmark('harbor', 8, 8, 'Harbor Docks', 0x7c5cff);
  landmark('safehouse', 0, 4, 'Rex Safehouse', 0x9db98a);
  landmark('hospital', 4, 0, 'Solmar General', 0xffffff);
  landmark('police', 8, 4, 'SBPD Central', 0x4a7fd8);
  landmark('marina', 4, 8, 'Marina Pier — meet Mara', 0xff5da2);
  LANDMARKS.marina.pos = new THREE.Vector3(-60, 0, BEACH_Z + 8);

  // Safehouse hut + garage forecourt props
  const hut = new THREE.Mesh(
    new THREE.BoxGeometry(10, 5, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b48a }),
  );
  hut.position.set(LANDMARKS.safehouse.pos.x, 2.5, LANDMARKS.safehouse.pos.z);
  hut.castShadow = true;
  scene.add(hut);
  G.colliders.push({
    minX: LANDMARKS.safehouse.pos.x - 5, maxX: LANDMARKS.safehouse.pos.x + 5,
    minZ: LANDMARKS.safehouse.pos.z - 4, maxZ: LANDMARKS.safehouse.pos.z + 4,
  });
  const garageBlock = new THREE.Mesh(
    new THREE.BoxGeometry(18, 7, 14),
    new THREE.MeshLambertMaterial({ color: 0xc96f5a }),
  );
  garageBlock.position.set(LANDMARKS.garage.pos.x, 3.5, LANDMARKS.garage.pos.z);
  garageBlock.castShadow = true;
  scene.add(garageBlock);
  G.colliders.push({
    minX: LANDMARKS.garage.pos.x - 9, maxX: LANDMARKS.garage.pos.x + 9,
    minZ: LANDMARKS.garage.pos.z - 7, maxZ: LANDMARKS.garage.pos.z + 7,
  });

  return LANDMARKS;
}

// A tall glowing beacon marking the current objective; missions.js moves it.
export function makeMarkerBeacon(scene) {
  const group = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 30;
  group.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3, 0.25, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc93c }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  group.add(ring);
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 3, 4),
    new THREE.MeshBasicMaterial({ color: 0xffc93c }),
  );
  arrow.rotation.x = Math.PI;
  arrow.position.y = 10;
  group.add(arrow);
  group.visible = false;
  scene.add(group);
  G.markerGroup = group;
  return group;
}

export function moveMarker(pos) {
  if (!G.markerGroup) return;
  if (!pos) { G.markerGroup.visible = false; return; }
  G.markerGroup.visible = true;
  G.markerGroup.position.set(pos.x, 0, pos.z);
}

export function nearestRoadPoint(x, z) {
  // Snap a point to the nearest road centre line.
  const px = Math.round((x + CITY_HALF + ROAD / 2) / PITCH) * PITCH - CITY_HALF - ROAD / 2;
  const pz = Math.round((z + CITY_HALF + ROAD / 2) / PITCH) * PITCH - CITY_HALF - ROAD / 2;
  return Math.abs(x - px) < Math.abs(z - pz)
    ? { x: px, z }
    : { x, z: pz };
}
