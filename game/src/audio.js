// audio.js — all sound and music is synthesised with WebAudio: no audio files,
// no network. Engine hum, gunshots, sirens, pickups and a small bassline loop
// are built from oscillators and filtered noise.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicTimer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOn = false;
    this.muted = false;
    this.musicStep = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startEngineLoop();
    this.startMusicLoop();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  gunshot() { this.noise(0.16, 0.5, 900); this.tone(160, 0.1, 'square', 0.18, 50); }
  enemyShot() { this.noise(0.12, 0.22, 700); }
  pickup() { this.tone(660, 0.09, 'sine', 0.22); setTimeout(() => this.tone(990, 0.14, 'sine', 0.22), 80); }
  coin() { this.tone(880, 0.08, 'triangle', 0.2); setTimeout(() => this.tone(1320, 0.16, 'triangle', 0.2), 70); }
  missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'triangle', 0.22), i * 90)); }
  missionComplete() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.24), i * 110)); }
  fail() { [330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'sawtooth', 0.14), i * 130)); }
  crash() { this.noise(0.25, 0.4, 500); }
  door() { this.tone(220, 0.07, 'square', 0.12, 140); }
  phone() { this.tone(1200, 0.12, 'sine', 0.15); setTimeout(() => this.tone(1200, 0.12, 'sine', 0.15), 180); }

  sirenTick(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOn) {
      this.sirenOn = true;
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain.gain.value = 0.045;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 280;
      lfo.connect(lfoGain).connect(this.sirenOsc.frequency);
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this.sirenLfo = lfo;
    } else if (!on && this.sirenOn) {
      this.sirenOn = false;
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (e) { /* already stopped */ }
    }
  }

  startEngineLoop() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
  }

  setEngine(speed01, inCar) {
    if (!this.engineOsc) return;
    const target = inCar ? 0.05 + speed01 * 0.11 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.08);
  }

  // A lazy two-bar bassline + hats, scheduled with setInterval. Small on purpose.
  startMusicLoop() {
    const bass = [55, 0, 55, 65.4, 0, 55, 49, 58.3, 55, 0, 55, 65.4, 73.4, 65.4, 49, 0];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted || document.hidden) return;
      const note = bass[this.musicStep % bass.length];
      if (note) this.tone(note, 0.24, 'triangle', 0.10);
      if (this.musicStep % 2 === 0) this.noise(0.03, 0.03, 6000);
      this.musicStep++;
    }, 240);
  }
}

export const sound = new SoundBank();
