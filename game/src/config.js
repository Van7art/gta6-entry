// config.js — every tunable constant of Porto Verde: city layout, districts,
// vehicle stats, wanted rules and mission rewards. One place to tune the game.
export const CITY = {
  pitch: 60, // distance between road centrelines
  road: 14, // road width
  block: 46, // block width (pitch - road)
  roads: [-240, -180, -120, -60, 0, 60, 120, 180, 240],
  half: 240, // last road centreline
  groundHalf: 320, // ground plane half-size (includes beach + harbour apron)
  lane: 3.5, // lane offset from a road centreline
};

export const DISTRICTS = {
  downtown: { name: 'Downtown', minH: 34, maxH: 92, color: [0x8fa3b8, 0x7d94a8, 0x9fb0c0, 0x6e8296] },
  beach: { name: 'Playa Dorada', minH: 12, maxH: 30, color: [0xe8d9b0, 0xf0e2c0, 0xdcc898, 0xe8d0a0] },
  harbour: { name: 'Porto Docks', minH: 8, maxH: 13, color: [0x9a8f7a, 0x8a7f6e, 0xa89a82, 0x7c7263] },
  oldtown: { name: 'Barrio Viejo', minH: 6, maxH: 10, color: [0xd8a070, 0xc89060, 0xe0b088, 0xb87850] },
  midtown: { name: 'Midtown', minH: 12, maxH: 26, color: [0xb0a890, 0xa09880, 0xc0b8a0, 0x988e78] },
};

// Block (bx, bz) in -4..4 -> district key.
export function districtFor(bx, bz) {
  if (bx >= 3) return 'beach';
  if (bz >= 3) return 'harbour';
  if (bx <= -2) return 'oldtown';
  if (bz <= -2 && Math.abs(bx) <= 1) return 'downtown';
  return 'midtown';
}

export const VEHICLE_STATS = {
  sedan: { accel: 14, maxSpeed: 34, maxReverse: 10, turn: 1.9, grip: 6.5, hp: 100, mass: 1.0 },
  sports: { accel: 19, maxSpeed: 46, maxReverse: 11, turn: 2.1, grip: 7.5, hp: 90, mass: 0.9 },
  taxi: { accel: 13, maxSpeed: 33, maxReverse: 10, turn: 1.9, grip: 6.5, hp: 100, mass: 1.0 },
  truck: { accel: 9, maxSpeed: 27, maxReverse: 8, turn: 1.4, grip: 5.5, hp: 160, mass: 1.8 },
  van: { accel: 11, maxSpeed: 29, maxReverse: 9, turn: 1.6, grip: 6.0, hp: 120, mass: 1.3 },
  police: { accel: 17, maxSpeed: 42, maxReverse: 11, turn: 2.0, grip: 7.0, hp: 140, mass: 1.1 },
  pickup: { accel: 15, maxSpeed: 36, maxReverse: 10, turn: 1.8, grip: 6.2, hp: 110, mass: 1.1 },
};

export const WANTED = {
  maxStars: 5,
  decaySeconds: 9, // seconds unseen before one star drops
  bustSeconds: 3, // seconds pinned by police before busted
  finePerStar: 150,
  resprayCost: 200,
  // how many police cars hunt the player per star level
  policePerStar: [0, 2, 3, 4, 5, 6],
};

export const PLAYER_STATS = {
  walkSpeed: 6,
  sprintSpeed: 10,
  health: 100,
  pistolDamage: 34,
  pistolRange: 60,
  pistolAmmo: 12,
  punchDamage: 12,
};

export const ECONOMY = {
  startCash: 150,
  repairCostPerHp: 2,
  coinValue: 50,
  missionRewards: [400, 650, 900, 1200, 1500, 3000],
};

export const SAVE_KEY = 'porto-verde-save-v1';
export const GAME_TITLE = 'Porto Verde: Full Throttle';
export const CITY_NAME = 'Porto Verde';
