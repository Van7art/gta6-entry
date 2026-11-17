// missions.js — the story of Solmar Bay: six chained missions with original
// characters, dialogue, objectives and rewards. Each mission is a list of
// steps; a step completes when the player reaches a place, enters a car,
// defeats all enemies, or loses the wanted level. Completing a mission pays
// cash, raises Street Rep, saves the game and unlocks the next one.
import { G } from './state.js';
import { LANDMARKS, moveMarker } from './city.js';
import { spawnCar, spawnPolice } from './vehicles.js';
import { spawnEnemy, clearEnemies } from './combat.js';
import { sound } from './audio.js';

export const MISSIONS = [
  {
    id: 'first-light',
    title: 'Misi 1 — First Light',
    brief: 'Rex Marlowe walks out of the Marina lockup with $150 and a name: Mara Voss.',
    reward: 300,
    rep: 10,
    steps: [
      { type: 'goto', pos: () => LANDMARKS.marina.pos, radius: 6, objective: 'Temui Mara Voss di Marina Pier', say: ['MARA: Rex! Masih hidup rupanya. Aku butuh sopir yang tidak banyak tanya.', 'REX: Aku butuh uang. Kita cocok.'] },
      { type: 'goto', pos: () => LANDMARKS.garage.pos, radius: 8, objective: 'Antar Mara ke Sunset Garage (naik mobil, tekan E)', say: ['MARA: Garasiku di Sunset Avenue. Bawa aku ke sana, pelan-pelan saja.', 'TESSA (radio): Selamat datang kembali, Rex. Jangan bikin gara-gara dulu.'] },
      { type: 'talk', pos: () => LANDMARKS.garage.pos, radius: 8, objective: 'Bicara dengan Mara di garasi (tekan E)', say: ['MARA: Bagus. Mulai sekarang kau kerja untukku. Uangmu ada di dasbor.', 'MARA: Dario Kells menguasai pelabuhan. Kita akan ambil alih, satu pekerjaan demi satu.'] },
    ],
  },
  {
    id: 'the-courier',
    title: 'Misi 2 — The Courier',
    brief: 'A package at the docks, a drop at the Neon Palms. Simple — until it is not.',
    reward: 600,
    rep: 15,
    steps: [
      { type: 'goto', pos: () => LANDMARKS.harbor.pos, radius: 9, objective: 'Ambil paket di Harbor Docks', say: ['MARA: Paket di dermaga delapan. Jangan dibuka. Jangan ditanya.', 'REX: Sejak kapan aku banyak tanya?'] },
      { type: 'goto', pos: () => LANDMARKS.hotel.pos, radius: 9, objective: 'Antar paket ke Neon Palms Hotel — polisi mengawasi!', say: ['TESSA: Rex, ada patroli di belakangmu. Jangan ngebut, jangan panik.', 'REX: Aku tidak pernah panik. Aku hanya cepat.'] },
      { type: 'talk', pos: () => LANDMARKS.hotel.pos, radius: 9, objective: 'Serahkan paket (tekan E)', say: ['MARA: Paket diterima. Kells mulai curiga — bagus. Orang curiga itu ceroboh.'] },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Misi 3 — Hot Wheels',
    brief: 'Dario Kells keeps a gold Comet GT at the Coral Mall. It would look better in Mara’s garage.',
    reward: 900,
    rep: 20,
    steps: [
      { type: 'goto', pos: () => LANDMARKS.mall.pos, radius: 10, objective: 'Pergi ke Coral Mall — mobil emas Kells ada di sana', say: ['MARA: Comet GT emas. Milik Kells. Ambil. Bawa pulang.', 'TESSA: Alarmnya mati pukul tiga. Jangan sampai ketahuan... terlalu ketahuan.'] },
      { type: 'steal', carId: 'comet', pos: () => LANDMARKS.mall.pos, radius: 12, objective: 'Curi Comet GT emas (tekan E di dekat mobil)', say: ['REX: Cantik sekali. Maaf, Tuan Kells. Ini sekarang punyaku.'] },
      { type: 'goto', pos: () => LANDMARKS.garage.pos, radius: 9, objective: 'Bawa Comet GT ke Sunset Garage', say: ['MARA: Ha! Wajah Kells pasti merah padam. Mobil ini sekarang milik kita.'] },
    ],
  },
  {
    id: 'the-shakedown',
    title: 'Misi 4 — The Shakedown',
    brief: 'Kells’ crew is shaking down the warehouse district. Rex is going to shake back.',
    reward: 1200,
    rep: 25,
    steps: [
      { type: 'goto', pos: () => LANDMARKS.warehouse.pos, radius: 10, objective: 'Pergi ke Kells Warehouse', say: ['MARA: Anak buah Kells memalak gudang itu tiap Jumat. Hari ini Jumat.', 'REX: Kalau begitu aku datang tepat waktu.'] },
      { type: 'kill', count: 4, pos: () => LANDMARKS.warehouse.pos, radius: 14, objective: 'Usir 4 anak buah Kells (klik mouse untuk menembak)', say: ['KELLS CREW: Siapa kau?!', 'REX: Orang yang mengakhiri pungutan liar di sini.'] },
      { type: 'goto', pos: () => LANDMARKS.garage.pos, radius: 9, objective: 'Kembali ke Sunset Garage', say: ['MARA: Gudang itu aman sekarang. Para pedagang akan mengingat namamu, Rex.'] },
    ],
  },
  {
    id: 'harbor-lights',
    title: 'Misi 5 — Harbor Lights',
    brief: 'A ledger that can sink Kells is changing hands at the harbour tonight — in the middle of a gunfight.',
    reward: 1800,
    rep: 30,
    steps: [
      { type: 'goto', pos: () => LANDMARKS.harbor.pos, radius: 10, objective: 'Pergi ke Harbor Docks — malam ini ada transaksi', say: ['TESSA: Buku besar Kells ada di kontainer biru. Ambil sebelum orangnya datang.', 'REX: Dan kalau orangnya datang duluan? TESSA: Maka kau tembak duluan.'] },
      { type: 'kill', count: 6, pos: () => LANDMARKS.harbor.pos, radius: 16, objective: 'Rebut buku besar — kalahkan 6 penjaga Kells', say: ['KELLS CREW: Buku itu milik Bos Kells!', 'REX: Sekarang milik Mara.'] },
      { type: 'escape', wanted: 0, objective: 'Lolos dari polisi, lalu kembali ke garasi', say: ['TESSA: Polisi menuju pelabuhan! Hilang dari radar, Rex!'] },
      { type: 'goto', pos: () => LANDMARKS.garage.pos, radius: 9, objective: 'Bawa buku besar ke Sunset Garage', say: ['MARA: Dengan buku ini, Kells selesai. Kau sudah bukan sopir lagi, Rex. Kau partner.'] },
    ],
  },
  {
    id: 'the-big-score',
    title: 'Misi 6 — The Big Score',
    brief: 'The final job: stop Kells’ armoured van, take the harbour money, and vanish into the Solmar night.',
    reward: 4000,
    rep: 40,
    steps: [
      { type: 'goto', pos: () => LANDMARKS.hotel.pos, radius: 10, objective: 'Temui Tessa di Neon Palms — rencana terakhir', say: ['TESSA: Van lapis baja Kells lewat Marina Boulevard tiap sore. Satu van, dua pengawal.', 'REX: Kita hentikan van itu. Kita ambil uangnya. Kita selesai.'] },
      { type: 'kill', count: 3, pos: () => LANDMARKS.police.pos, radius: 18, objective: 'Hentikan konvoi Kells di SBPD Central — kalahkan 3 pengawal', say: ['KELLS CREW: Bos tidak akan membiarkan ini!', 'REX: Bosmu sudah kalah. Dia hanya belum tahu.'] },
      { type: 'escape', wanted: 0, objective: 'Lolos dari kejaran polisi (wanted 3)!', say: ['TESSA: Seluruh kota mengejarmu, Rex! Jangan berhenti!'] },
      { type: 'goto', pos: () => LANDMARKS.safehouse.pos, radius: 9, objective: 'Bawa uangnya ke Safehouse Rex', say: ['MARA: Selesai. Kells jatuh, pelabuhan bebas, dan Solmar Bay milik kita.', 'REX: Bukan milik kita, Mara. Milik orang-orangnya. Kita hanya menjaganya.'] },
    ],
  },
];

export function currentMission() {
  return MISSIONS[G.missionIndex] || null;
}

export function missionLabel() {
  const m = currentMission();
  return m ? m.title : 'Cerita selesai — Free Roam';
}

function stepPos(step) {
  return typeof step.pos === 'function' ? step.pos() : step.pos;
}

export function showDialog(lines) {
  G.dialog = [...lines];
  G.dialogTimer = 0;
}

export function setObjective(text) {
  G.missionObjective = text;
}

export function startMission(index) {
  const m = MISSIONS[index];
  if (!m) return false;
  G.missionIndex = index;
  G.missionStep = 0;
  G.missionActive = true;
  G.flags.missionStarted = true;
  G.banner = '';
  G.bannerTimer = 0;
  clearEnemies();
  sound.missionStart();
  sound.phone();
  showDialog([`${m.title}`, m.brief]);
  enterStep();
  return true;
}

export function enterStep() {
  const m = currentMission();
  if (!m) return;
  const step = m.steps[G.missionStep];
  if (!step) { completeMission(); return; }
  setObjective(step.objective);
  if (step.say) showDialog(step.say);
  const pos = stepPos(step);
  G.missionMarker = pos ? { x: pos.x, z: pos.z } : null;
  moveMarker(G.missionMarker);
  if (step.type === 'kill') {
    const base = stepPos(step);
    for (let i = 0; i < step.count; i++) {
      spawnEnemy(base.x + (Math.random() - 0.5) * 18, base.z + (Math.random() - 0.5) * 18);
    }
    step.spawned = step.count;
    step.killedAtStart = G.kills;
  }
  if (step.type === 'steal') {
    const base = stepPos(step);
    const car = spawnCar(step.carId, base.x + 8, base.z + 4, 0.6, { parked: true });
    step.targetCar = car;
    car.mesh.rotation.y = 0.6;
  }
  if (step.type === 'escape') {
    G.wanted = 3;
    G.wantedHeat = 0.4;
    spawnPolice(2);
  }
}

export function advanceStep() {
  const m = currentMission();
  if (!m) return;
  G.missionStep += 1;
  if (G.missionStep >= m.steps.length) completeMission();
  else enterStep();
}

export function completeMission() {
  const m = currentMission();
  if (!m) return;
  G.missionActive = false;
  G.missionObjective = '';
  G.missionMarker = null;
  moveMarker(null);
  clearEnemies();
  G.money += m.reward;
  G.respect = Math.min(100, G.respect + m.rep);
  G.missionsDone += 1;
  G.missionIndex += 1;
  G.flags.missionCompleted = true;
  sound.missionComplete();
  showDialog([`MISI SELESAI — ${m.title}`, `Hadiah: $${m.reward}  •  Rep +${m.rep}`]);
  G.banner = `MISI SELESAI  +$${m.reward}`;
  G.bannerTimer = 3.5;
  if (G.onMissionComplete) G.onMissionComplete(m);
  if (G.missionIndex >= MISSIONS.length) {
    G.banner = 'SOLMAR BAY MILIKMU — Cerita Selesai!';
    showDialog(['MARA: Kau legenda sekarang, Rex. Solmar Bay tidak akan melupakanmu.', 'Free roam: koin emas, mobil, dan kota ini milikmu.']);
  }
}

export function updateMissions(dt) {
  if (!G.missionActive) return;
  const m = currentMission();
  if (!m) return;
  const step = m.steps[G.missionStep];
  if (!step) return;
  const p = G.player.pos;
  const inCar = !!G.player.inCar;
  const pos = stepPos(step);
  if (step.type === 'goto' || step.type === 'talk') {
    if (pos && Math.hypot(p.x - pos.x, p.z - pos.z) < step.radius) {
      if (step.type === 'talk') {
        // talk needs E; the HUD prompts, main.js calls tryTalk()
        return;
      }
      advanceStep();
    }
  } else if (step.type === 'steal') {
    if (step.targetCar && G.player.inCar === step.targetCar) advanceStep();
  } else if (step.type === 'kill') {
    const killed = G.kills - (step.killedAtStart || 0);
    const left = step.count - killed;
    setObjective(`${step.objective}  (${Math.max(0, left)} tersisa)`);
    if (left <= 0 && G.enemies.length === 0) advanceStep();
  } else if (step.type === 'escape') {
    setObjective(`${step.objective}  (Wanted: ${'★'.repeat(G.wanted)}${'☆'.repeat(5 - G.wanted)})`);
    if (G.wanted === 0) advanceStep();
  }
  // marker pulse handled by main loop via G.markerGroup
}

export function tryTalk() {
  if (!G.missionActive) return false;
  const m = currentMission();
  if (!m) return false;
  const step = m.steps[G.missionStep];
  if (!step || step.type !== 'talk') return false;
  const pos = stepPos(step);
  if (pos && Math.hypot(G.player.pos.x - pos.x, G.player.pos.z - pos.z) < step.radius + 4) {
    advanceStep();
    return true;
  }
  return false;
}

// Called when the player presses M in free roam.
export function startNextMission() {
  if (G.missionActive) return 'already';
  if (G.missionIndex >= MISSIONS.length) return 'done';
  startMission(G.missionIndex);
  return 'started';
}
