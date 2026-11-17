// config.js — every tunable number and every proper name of Solmar Bay in one
// place, so balancing and renaming never means hunting through the game code.
// Nothing here is from any commercial game: the city, people, cars and story
// below are all original to this entry.
export const GAME_TITLE = 'SOLMAR BAY';
export const GAME_SUBTITLE = 'Streets of Gold';
export const SAVE_KEY = 'solmarbay-save-v1';

// City layout: a grid of square blocks separated by roads.
export const BLOCK = 40; // block side in world units
export const ROAD = 14; // road width
export const GRID = 9; // blocks per side (odd, so a plaza sits in the middle)
export const CITY_HALF = ((BLOCK + ROAD) * GRID) / 2; // ~243
export const PITCH = BLOCK + ROAD; // distance between block centres
export const BEACH_Z = CITY_HALF + 46; // ocean starts here (south edge)

// Palette: sun-soaked coastal city, warm afternoon light.
export const PALETTE = {
  skyTop: 0x2f7fc4,
  skyBottom: 0xffd9a0,
  sun: 0xfff2cf,
  road: 0x2e3138,
  roadLine: 0xf5d76e,
  sidewalk: 0x9aa0a3,
  sand: 0xe8cf9a,
  sea: 0x1f7fa8,
  grass: 0x5da24a,
  building: [0xe8b48a, 0xd98f6a, 0x7fb3d5, 0xf2e3c6, 0xc96f5a, 0x8fa8bf, 0xe6c25a, 0x9db98a],
  neon: [0xff5da2, 0x37e6c8, 0xffc93c, 0x7c5cff],
};

// Original characters of the story.
export const CHARACTERS = {
  player: { name: 'Rex Marlowe', role: 'wheelman, fresh out of the Marina lockup' },
  mara: { name: 'Mara Voss', role: 'fixer who runs the Sunset Garage' },
  dario: { name: 'Dario Kells', role: 'harbour boss who owns half the docks' },
  tessa: { name: 'Tessa Rook', role: 'lookout with a police scanner and a fast mouth' },
  officer: { name: 'Officer Hale', role: 'Solmar Bay PD, very keen on paperwork' },
};

// Original car models (names invented for this game).
export const CAR_MODELS = [
  { id: 'comet', name: 'Comet GT', color: 0xffc93c, top: 46, accel: 26, grip: 2.6, sport: true },
  { id: 'sunset', name: 'Sunset Coupe', color: 0xd84a4a, top: 38, accel: 20, grip: 2.2, sport: false },
  { id: 'marlin', name: 'Marlin Sedan', color: 0x4a7fd8, top: 34, accel: 17, grip: 2.0, sport: false },
  { id: 'dune', name: 'Dune Pickup', color: 0x7a9a4a, top: 32, accel: 16, grip: 1.8, sport: false },
  { id: 'taxi', name: 'Bay Cab', color: 0xf2c230, top: 33, accel: 16, grip: 2.0, sport: false },
  { id: 'police', name: 'SBPD Interceptor', color: 0x1c2733, top: 42, accel: 24, grip: 2.5, sport: true },
  { id: 'van', name: 'Harbor Van', color: 0xcccccc, top: 28, accel: 13, grip: 1.6, sport: false },
];

export const TUNING = {
  walkSpeed: 7,
  runSpeed: 11,
  jumpSpeed: 8.5,
  gravity: 22,
  playerRadius: 0.9,
  playerHealth: 100,
  pistolDamage: 34,
  pistolRange: 70,
  pistolCooldown: 0.22,
  enemyHealth: 68,
  trafficCount: 14,
  pedCount: 26,
  policeMax: 4,
  wantedDecaySeconds: 26,
  bustDistance: 2.6,
  bustSeconds: 2.5,
  coinCount: 12,
  coinValue: 100,
  startMoney: 150,
};

// Street names for the HUD location line (all invented).
export const STREET_NAMES = [
  'Marina Boulevard', 'Palm Row', 'Sunset Avenue', 'Coral Street',
  'Harbor Lane', 'Neon Mile', 'Cactus Drive', 'Bayfront Road',
];

export function streetNameAt(x, z) {
  const i = Math.abs(Math.floor(x / PITCH) + Math.floor(z / PITCH) * 3) % STREET_NAMES.length;
  return STREET_NAMES[i];
}

// Seeded random so the city layout is the same every run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
