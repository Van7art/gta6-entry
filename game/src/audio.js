// audio.js — all sound is synthesized with WebAudio. No audio files.
// Engine hum, tyre skid, police siren, gunshots, impacts, UI blips and three
// lo-fi radio stations (bass + chords + hats) scheduled on a look-ahead loop.
import { clamp } from './util.js';

const STATIONS = [
  { name: 'VERDE FM · Sunset Drive', bpm: 96, root: 55, minor: true, wave: 'sawtooth' },
  { name: 'PLAYA 104 · Beach Beats', bpm: 118, root: 65.41, minor: false, wave: 'triangle' },
  { name: 'DOCK RADIO · Night Shift', bpm: 80, root: 49, minor: true, wave: 'square' },
];

export const STATION_NAMES = STATIONS.map((s) => s.name);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.station = 0;
    this.musicOn = true;
    this.engineNodes = null;
    this.sirenNodes = null;
    this.skidNodes = null;
    this.nextNoteTime = 0;
    this.step = 0;
    this.radioLabel = null;
  }

  // Must be called from a user gesture (start button / first key).
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
    this.buildEngine();
    this.buildSiren();
    this.buildSkid();
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    setInterval(() => this.scheduleMusic(), 120);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  setStation(i) {
    this.station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
    if (this.radioLabel) this.radioLabel.textContent = '♪ ' + STATIONS[this.station].name;
  }

  // Q key / clicking the radio label: cycle to the next station.
  nextStation() {
    this.setStation(this.station + 1);
    return STATIONS[this.station].name;
  }

  stationName() { return STATIONS[this.station].name; }

  buildEngine() {
    const c = this.ctx;
    this.engineOsc = c.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineOsc2 = c.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 28;
    this.engineFilter = c.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = c.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);
    this.engineOsc.start();
    this.engineOsc2.start();
  }

  buildSiren() {
    const c = this.ctx;
    this.sirenOsc = c.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = c.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.sfxGain);
    this.sirenOsc.start();
    this.sirenPhase = 0;
  }

  buildSkid() {
    const c = this.ctx;
    const len = c.sampleRate * 1;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this.skidFilter = c.createBiquadFilter();
    this.skidFilter.type = 'bandpass';
    this.skidFilter.frequency.value = 900;
    this.skidFilter.Q.value = 1.2;
    this.skidGain = c.createGain();
    this.skidGain.gain.value = 0;
    src.connect(this.skidFilter);
    this.skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.sfxGain);
    src.start();
  }

  // Called every frame: speedRatio 0..1, drifting bool, wanted stars.
  updateEngine(speedRatio, drifting, wanted) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const rpm = 50 + speedRatio * 160;
    this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(rpm * 0.5 + 2, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(300 + speedRatio * 1400, t, 0.1);
    this.engineGain.gain.setTargetAtTime(0.05 + speedRatio * 0.075, t, 0.1);
    this.skidGain.gain.setTargetAtTime(drifting ? 0.14 : 0, t, 0.05);
    // Two-tone siren while the police are after the player.
    if (wanted > 0) {
      this.sirenPhase += 0.06;
      const f = (Math.sin(this.sirenPhase) > 0 ? 780 : 620);
      this.sirenOsc.frequency.setTargetAtTime(f, t, 0.03);
      this.sirenGain.gain.setTargetAtTime(0.035, t, 0.2);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, t, 0.2);
    }
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq || 660;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.15, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (dur || 0.09));
    o.connect(g); g.connect(this.sfxGain);
    o.start(); o.stop(c.currentTime + (dur || 0.09) + 0.02);
  }

  noiseBurst(dur, filterFreq, vol) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.3, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(); src.stop(c.currentTime + dur + 0.02);
  }

  gunshot() { this.noiseBurst(0.14, 2600, 0.5); this.blip(140, 0.08, 'square', 0.2); }
  crash(strength) { this.noiseBurst(0.25, 500, clamp(0.2 + strength * 0.4, 0, 0.7)); this.blip(70, 0.2, 'sine', 0.3); }
  honk() { this.blip(370, 0.22, 'square', 0.12); this.blip(466, 0.22, 'square', 0.1); }
  coin() { this.blip(988, 0.08, 'sine', 0.18); setTimeout(() => this.blip(1319, 0.14, 'sine', 0.18), 70); }
  missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.2), i * 110)); }
  missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.22), i * 120)); }
  busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.18), i * 160)); }
  click() { this.blip(880, 0.05, 'sine', 0.12); }

  // Simple step-sequenced radio: bass note + chord stab + hat each 8th note.
  scheduleMusic() {
    if (!this.ctx || this.muted || !this.musicOn) return;
    const st = STATIONS[this.station];
    const spb = 60 / st.bpm / 2; // 8th notes
    const scale = st.minor ? [1, 1.189, 1.335, 1.498, 1.782] : [1, 1.26, 1.335, 1.498, 1.682];
    while (this.nextNoteTime < this.ctx.currentTime + 0.35) {
      const t = this.nextNoteTime;
      const bar = Math.floor(this.step / 8) % 4;
      const chordRoot = st.root * [1, 0.891, 1.122, 0.794][bar];
      // Bass on beats 0 and 4.
      if (this.step % 4 === 0) this.note(chordRoot / 2, t, spb * 1.8, st.wave, 0.5);
      // Chord stab on off-beats.
      if (this.step % 2 === 1) {
        this.note(chordRoot * scale[1], t, spb * 0.9, 'triangle', 0.16);
        this.note(chordRoot * scale[3], t, spb * 0.9, 'triangle', 0.16);
      }
      // Hat tick.
      this.hat(t, 0.03);
      this.nextNoteTime += spb;
      this.step++;
    }
  }

  note(freq, t, dur, type, vol) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  hat(t, dur) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = c.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.musicGain);
    src.start(t); src.stop(t + dur + 0.02);
  }
}
