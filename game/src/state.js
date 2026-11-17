// state.js — the single shared game state object. Every module reads and
// writes this one object instead of passing a dozen arguments around, and the
// play-test hook (window.__game) exposes it for debugging and screenshots.
import { TUNING } from './config.js';

export const G = {
  // three.js handles, filled by main.js
  scene: null,
  camera: null,
  renderer: null,
  clock: null,
  // run flags
  started: false,
  paused: false,
  over: false,
  overReason: '',
  time: 0, // seconds since the run started
  dayTime: 0.42, // 0..1 fraction of the day; 0.42 = golden afternoon
  // player (on foot)
  player: {
    pos: null, // THREE.Vector3, set by main.js
    velY: 0,
    heading: 0, // radians, facing direction
    camYaw: 0,
    camPitch: 0.32,
    camDist: 9,
    onGround: true,
    health: TUNING.playerHealth,
    maxHealth: TUNING.playerHealth,
    inCar: null, // car object when driving, else null
    weapon: 'pistol',
    shootCooldown: 0,
    speed: 0,
  },
  // economy + progression
  money: TUNING.startMoney,
  respect: 0, // 0..100, "Street Rep"
  wanted: 0, // 0..5 stars
  wantedHeat: 0, // 0..1, fills toward the next star / drains to lose stars
  wantedTimer: 0,
  bustTimer: 0,
  kills: 0,
  carsStolen: 0,
  missionsDone: 0,
  // mission state
  missionIndex: 0, // index into MISSIONS; MISSIONS.length means story complete
  missionStep: 0,
  missionActive: false,
  missionObjective: '',
  missionMarker: null, // THREE.Vector3 or null
  missionTimer: 0,
  dialog: [], // lines waiting to be shown as subtitles
  dialogTimer: 0,
  banner: '', // big centre-screen announcement
  bannerTimer: 0,
  // world collections
  cars: [], // every drivable car (player + traffic + police + parked)
  traffic: [],
  police: [],
  peds: [],
  enemies: [],
  coins: [],
  pickups: [],
  colliders: [], // {minX,maxX,minZ,maxZ} building AABBs
  markers: [], // mission marker meshes
  // per-frame input (filled by input.js)
  keys: {},
  mouseDX: 0,
  mouseDY: 0,
  mouseDown: false,
  pointerLocked: false,
  // flags the HUD and tests read
  flags: {
    shotFired: false,
    carEntered: false,
    missionStarted: false,
    missionCompleted: false,
    coinCollected: false,
  },
  // callbacks wired by main.js
  onMissionComplete: null,
  onWasted: null,
  onBusted: null,
};
