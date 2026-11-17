// wanted.js — the wanted system: stars rise with crimes, police spawn and
// chase, stars cool down when the player hides, and being caught on foot
// means BUSTED while dying means WASTED. Both cost money and respawn the
// player at a landmark.
import { TUNING } from './config.js';
import { G } from './state.js';
import { LANDMARKS } from './city.js';
import { spawnPolice, removeCar } from './vehicles.js';
import { sound } from './audio.js';

export function updateWanted(dt) {
  // heat fills stars up, drains them down
  if (G.wantedHeat >= 1 && G.wanted < 5) {
    G.wanted += 1;
    G.wantedHeat = 0;
    G.wantedTimer = 0;
    spawnPolice(Math.min(2, G.wanted));
    sound.phone();
  }
  if (G.wanted > 0) {
    // hiding cools the heat; being in a fast chase keeps it hot
    const inCar = !!G.player.inCar;
    const speed = inCar ? Math.abs(G.player.inCar.speed) : 0;
    const nearestCop = nearestCopDistance();
    if (nearestCop > 55 && speed < 6) {
      G.wantedTimer += dt;
      if (G.wantedTimer > TUNING.wantedDecaySeconds / Math.max(1, G.wanted)) {
        G.wanted -= 1;
        G.wantedTimer = 0;
        G.wantedHeat = 0.5;
      }
    } else {
      G.wantedTimer = 0;
    }
    // sirens while any star is up
    sound.sirenTick(G.wanted > 0);
    // too many cops: keep the count matched to the stars
    const want = Math.min(TUNING.policeMax, 1 + G.wanted);
    if (G.police.length < want) spawnPolice(1);
    if (G.police.length > want + 2) removeCar(G.police[G.police.length - 1]);
    // BUSTED: a cop stands next to the player on foot
    if (!inCar && nearestCop < TUNING.bustDistance) {
      G.bustTimer += dt;
      if (G.bustTimer > TUNING.bustSeconds) {
        G.bustTimer = 0;
        if (G.onBusted) G.onBusted();
      }
    } else {
      G.bustTimer = 0;
    }
  } else {
    sound.sirenTick(false);
    G.wantedHeat = Math.max(0, G.wantedHeat - dt * 0.05);
    if (G.police.length > 0 && nearestCopDistance() > 120) {
      removeCar(G.police[0]);
    }
  }
}

export function nearestCopDistance() {
  let best = Infinity;
  for (const cop of G.police) {
    const d = Math.hypot(cop.x - G.player.pos.x, cop.z - G.player.pos.z);
    if (d < best) best = d;
  }
  return best;
}

export function clearWanted() {
  G.wanted = 0;
  G.wantedHeat = 0;
  G.wantedTimer = 0;
  G.bustTimer = 0;
  for (const cop of [...G.police]) removeCar(cop);
}

export function respawnAtHospital() {
  const h = LANDMARKS.hospital.pos;
  G.player.pos.set(h.x + 6, 0, h.z + 6);
  if (G.player.inCar) G.player.inCar = null;
  G.player.health = TUNING.playerHealth;
  G.money = Math.max(0, G.money - 200);
  clearWanted();
}

export function respawnAtPoliceStation() {
  const s = LANDMARKS.police.pos;
  G.player.pos.set(s.x - 8, 0, s.z - 8);
  if (G.player.inCar) G.player.inCar = null;
  G.player.health = TUNING.playerHealth;
  G.money = Math.max(0, G.money - 150);
  clearWanted();
}
