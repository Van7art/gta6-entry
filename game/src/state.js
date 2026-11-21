// Shared constants and the fresh game state for Porto Verde.
// Nothing here is copied from any earlier entry: values and structure are new.

export const WORLD_W = 2400;
export const WORLD_H = 1800;

// Road centre lines. Vertical roads run north-south, horizontal east-west.
export const ROAD_X = [200, 600, 1000, 1400, 1800, 2200];
export const ROAD_Y = [200, 600, 1000, 1400];
export const ROAD_W = 96;
export const BEACH_Y = 1520; // sand starts here
export const SEA_Y = 1690; // sea starts here

export const RANKS = [
  { name: 'ROOKIE', at: 0 },
  { name: 'WHEELMAN', at: 25 },
  { name: 'HUSTLER', at: 50 },
  { name: 'STREET KING', at: 100 },
];

export function rankFor(rep) {
  let r = RANKS[0];
  for (const cand of RANKS) if (rep >= cand.at) r = cand;
  return r.name;
}

export function rankIndexFor(rep) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (rep >= RANKS[i].at) idx = i;
  return idx;
}

export const PAINTS = [
  { name: 'Sunset Red', color: '#d43a2a', price: 0 },
  { name: 'Ocean Blue', color: '#2a6fd4', price: 300 },
  { name: 'Taxi Gold', color: '#f1c40f', price: 300 },
  { name: 'Palm Green', color: '#2fae5f', price: 300 },
  { name: 'Vice Purple', color: '#8e44ad', price: 300 },
  { name: 'Midnight', color: '#1c2733', price: 400 },
  { name: 'Coral Pink', color: '#ff7f9e', price: 400 },
  { name: 'Sandstorm', color: '#e0c188', price: 400 },
  { name: 'Arctic White', color: '#eef2f5', price: 400 },
];

export const WHEELS = [
  { name: 'Standard', price: 0, need: 0 },
  { name: 'Sport', price: 400, need: 1 },
  { name: 'Chrome', price: 700, need: 2 },
];

export const WEAPONS = [
  { name: 'PISTOL', dmg: 34, mag: 12, rate: 0.22, spread: 0.03, pellets: 1, speed: 900 },
  { name: 'SMG', dmg: 16, mag: 30, rate: 0.085, spread: 0.09, pellets: 1, speed: 950 },
  { name: 'SHOTGUN', dmg: 14, mag: 6, rate: 0.7, spread: 0.16, pellets: 5, speed: 800 },
];

export const STATIONS = [
  { name: 'VERDE FM', show: 'Sunset Drive', mood: 'mellow' },
  { name: 'PLAYA 104', show: 'Beach Beats', mood: 'drive' },
  { name: 'DOCK RADIO', show: 'Night Shift', mood: 'night' },
];

export const GARAGE = {
  engine: [
    { stage: 1, price: 0, top: 340, label: 'Stage 1 — stock' },
    { stage: 2, price: 800, top: 410, label: 'Stage 2 — tuned (+21% top speed)' },
    { stage: 3, price: 2500, top: 490, label: 'Stage 3 — race (+44% top speed)', need: 2 },
  ],
  armour: [
    { stage: 1, price: 0, hp: 100, label: 'Stage 1 — stock' },
    { stage: 2, price: 1200, hp: 175, label: 'Stage 2 — plated (+75 max HP)' },
    { stage: 3, price: 2200, hp: 250, label: 'Stage 3 — vault (+150 max HP)', need: 3 },
  ],
  spoiler: { price: 350, need: 1 },
};

// The garage bay sits on the Downtown block corner.
export const GARAGE_POS = { x: 1000, y: 600 };

export function createGame() {
  return {
    mode: 'menu', // menu | playing | paused | garage | busted | wasted
    time: 0,
    clockMin: 18 * 60 + 47, // golden hour, 18:47
    cash: 150,
    rep: 0,
    wanted: 0,
    wantedHeat: 0, // 0..1, fills toward next star
    hiddenTimer: 0,
    player: null, // {x,y,angle,hp,onFoot,car}
    car: null, // player car entity when driving
    cars: [], // traffic cars
    cops: [],
    heli: null,
    roadblocks: [],
    strips: [],
    peds: [],
    bullets: [],
    pickups: [],
    particles: [],
    mission: null, // active mission state
    missionIndex: 0, // next mission to offer
    missionsDone: [],
    garage: { engine: 1, armour: 1, paint: 0, wheels: 0, spoiler: false, ownedPaints: [0] },
    weapons: { slot: 0, mags: [12, 30, 6], reserve: 60, owned: [true, true, true] },
    radio: { station: 0, muted: false },
    camera: { x: 1000, y: 600, zoom: 1 },
    input: {},
    mouse: { x: 640, y: 400, down: false },
    scene: null, // staged scene name for screenshots
    stats: { shots: 0, hits: 0, carjacks: 0, busted: 0 },
    toastTimer: 0,
    saveTimer: 0,
    rngSeed: 20261121,
  };
}
