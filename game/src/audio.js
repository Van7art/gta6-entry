// WebAudio radio (3 synth stations) and sound effects. Everything is synthesized:
// no audio files, no network.
import { STATIONS } from './state.js';

function note(semi) {
  return 440 * Math.pow(2, semi / 12);
}

// Chord roots (semitones from A4) and step patterns per station mood.
const PATTERNS = {
  mellow: {
    bpm: 76,
    chords: [[-4, 0, 3, 7], [-8, -4, -1, 3], [0, 4, 7, 11], [-2, 2, 5, 9]],
    bass: [-16, -20, -12, -14],
    lead: [12, 9, 7, 12, 16, 12, 9, 7],
  },
  drive: {
    bpm: 126,
    chords: [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-2, 2, 5]],
    bass: [-12, -12, -9, -12, -12, -12, -7, -10],
    lead: [12, 15, 19, 15, 12, 15, 19, 24],
  },
  night: {
    bpm: 100,
    chords: [[-4, 0, 3], [-8, -4, 0], [-11, -7, -4], [-2, 2, 5]],
    bass: [-16, -16, -23, -14],
    lead: [8, 11, 15, 11, 8, 3, 7, 11],
  },
};

export function createAudio() {
  const api = {
    ctx: null, master: null, station: 0, muted: false,
    step: 0, nextTime: 0, timer: null,
    ok: false,
  };
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    api.ctx = new AC();
    api.master = api.ctx.createGain();
    api.master.gain.value = 0.42;
    api.master.connect(api.ctx.destination);
    api.ok = true;
  } catch (e) {
    api.ok = false;
  }

  api.tone = function tone(freq, when, dur, type, vol, cutoff) {
    if (!api.ok || api.muted) return;
    const o = api.ctx.createOscillator();
    const gn = api.ctx.createGain();
    o.type = type || 'triangle';
    o.frequency.value = freq;
    gn.gain.setValueAtTime(0.0001, when);
    gn.gain.linearRampToValueAtTime(vol, when + 0.02);
    gn.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    let node = o;
    if (cutoff) {
      const f = api.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      o.connect(f);
      node = f;
    }
    node.connect(gn);
    gn.connect(api.master);
    o.start(when);
    o.stop(when + dur + 0.05);
  };

  api.setStation = function setStation(i) {
    api.station = ((i % 3) + 3) % 3;
    api.step = 0;
    if (api.ctx) api.nextTime = api.ctx.currentTime + 0.1;
  };

  api.toggleMute = function toggleMute() {
    api.muted = !api.muted;
    if (api.master) api.master.gain.value = api.muted ? 0 : 0.42;
    return api.muted;
  };

  api.schedule = function schedule() {
    if (!api.ok || api.muted) return;
    const mood = STATIONS[api.station].mood;
    const pat = PATTERNS[mood];
    const spb = 60 / pat.bpm / 2; // eighth notes
    const ahead = api.ctx.currentTime + 0.18;
    while (api.nextTime < ahead) {
      const s = api.step;
      const bar = Math.floor(s / 8) % 4;
      const chord = pat.chords[bar];
      const t = api.nextTime;
      // Pad: chord tone on the bar start.
      if (s % 8 === 0) {
        for (const n of chord) api.tone(note(n - 12), t, spb * 8, 'triangle', 0.05, 900);
      }
      // Bass on every quarter.
      if (s % 2 === 0) api.tone(note(pat.bass[(s / 2) % 4] - 12), t, spb * 1.8, 'sine', 0.16);
      // Lead pluck on the pattern.
      if (s % 2 === 1) {
        const ln = pat.lead[s % 8];
        api.tone(note(ln), t, spb * 1.4, mood === 'night' ? 'sawtooth' : 'square', 0.045, mood === 'night' ? 1200 : 2400);
      }
      // Hat tick on off-beats for the drive station.
      if (mood === 'drive' && s % 2 === 1) api.tone(note(36), t, 0.03, 'square', 0.02, 6000);
      api.step += 1;
      api.nextTime += spb;
    }
  };

  api.start = function start() {
    if (!api.ok) return;
    if (api.ctx.state === 'suspended') api.ctx.resume();
    api.nextTime = api.ctx.currentTime + 0.1;
    if (api.timer) clearInterval(api.timer);
    api.timer = setInterval(() => api.schedule(), 60);
  };

  api.stop = function stop() {
    if (api.timer) { clearInterval(api.timer); api.timer = null; }
  };

  api.shoot = function shoot() {
    if (!api.ok || api.muted) return;
    api.tone(190, api.ctx.currentTime, 0.09, 'square', 0.14, 1800);
  };
  api.reload = function reload() {
    if (!api.ok || api.muted) return;
    const t = api.ctx.currentTime;
    api.tone(520, t, 0.05, 'square', 0.08);
    api.tone(700, t + 0.09, 0.05, 'square', 0.08);
  };
  api.punch = function punch() {
    if (!api.ok || api.muted) return;
    api.tone(90, api.ctx.currentTime, 0.12, 'sine', 0.22);
  };
  api.pickup = function pickup() {
    if (!api.ok || api.muted) return;
    const t = api.ctx.currentTime;
    api.tone(note(12), t, 0.09, 'triangle', 0.12);
    api.tone(note(19), t + 0.09, 0.12, 'triangle', 0.12);
  };
  api.mission = function mission() {
    if (!api.ok || api.muted) return;
    const t = api.ctx.currentTime;
    [0, 7, 12, 19].forEach((n, i) => api.tone(note(n), t + i * 0.1, 0.22, 'triangle', 0.12));
  };
  api.busted = function busted() {
    if (!api.ok || api.muted) return;
    const t = api.ctx.currentTime;
    [12, 7, 3, -2].forEach((n, i) => api.tone(note(n), t + i * 0.16, 0.3, 'sawtooth', 0.1, 900));
  };
  api.horn = function horn() {
    if (!api.ok || api.muted) return;
    const t = api.ctx.currentTime;
    api.tone(370, t, 0.25, 'square', 0.07, 1200);
    api.tone(466, t, 0.25, 'square', 0.07, 1200);
  };
  return api;
}
