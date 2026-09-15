/* ==========================================================================
   audio.js - all sound is synthesised with the Web Audio API.
   No audio files to download, so the game still starts instantly on mobile.
   Want real sounds instead? Drop files in assets/audio/ and swap the bodies of
   the play* functions for `new Audio('assets/audio/x.mp3').play()`.
   ========================================================================== */

let ctx = null;
let master = null;
let musicGain = null;
let musicNodes = [];
let muted = false;
let musicOn = false;

let audioFailed = false;

function ensureContext() {
  if (ctx) return ctx;
  if (audioFailed) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { audioFailed = true; return null; }
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  } catch (error) {
    // No audio device, or the browser refused. The game carries on silently.
    audioFailed = true;
    console.warn('[Match The Player] audio unavailable:', error);
    return null;
  }
  return ctx;
}

/** iOS/Android only allow audio after a user gesture - call this on first tap. */
export function unlock() {
  const c = ensureContext();
  if (c && c.state === 'suspended') c.resume();
  if (musicOn) startMusic();
}

function blip({ freq = 440, type = 'sine', duration = 0.14, gain = 0.25, slideTo = null, delay = 0 }) {
  const c = ensureContext();
  if (!c || muted || !master) return;
  const t0 = c.currentTime + delay;

  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);

  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(env);
  env.connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/* ---------- the game's sound palette -------------------------------------- */

export const sfx = {
  tap() {
    blip({ freq: 520, type: 'triangle', duration: 0.07, gain: 0.14 });
  },

  /** Rising arpeggio - climbs higher the longer the streak runs. */
  correct(streak = 0) {
    const step = Math.min(streak, 8);
    const base = 523.25 * Math.pow(2, step / 24);
    [0, 0.06, 0.12].forEach((delay, i) => {
      blip({ freq: base * [1, 1.26, 1.5][i], type: 'triangle', duration: 0.18, gain: 0.2, delay });
    });
  },

  partial() {
    blip({ freq: 392, type: 'triangle', duration: 0.13, gain: 0.18 });
    blip({ freq: 466, type: 'triangle', duration: 0.16, gain: 0.16, delay: 0.07 });
  },

  wrong() {
    blip({ freq: 196, type: 'sawtooth', duration: 0.3, gain: 0.18, slideTo: 90 });
  },

  gameOver() {
    [523.25, 415.3, 349.23, 261.63].forEach((freq, i) => {
      blip({ freq, type: 'triangle', duration: 0.34, gain: 0.18, delay: i * 0.13 });
    });
  },

  /** Ticking urgency in the last seconds. */
  tick() {
    blip({ freq: 1200, type: 'square', duration: 0.035, gain: 0.05 });
  },
};

/* ---------- ambient music ------------------------------------------------- */
/* A slow, quiet chord pad. It's deliberately understated - a stadium hum,
   not a melody, so it can loop forever without getting annoying. */

function startMusic() {
  const c = ensureContext();
  if (!c || musicNodes.length) return;

  musicGain = c.createGain();
  musicGain.gain.value = 0;
  musicGain.gain.linearRampToValueAtTime(muted ? 0 : 0.06, c.currentTime + 2);

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 700;

  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.05;
  lfoGain.gain.value = 260;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();

  // A-minor-ish drone
  [110, 164.81, 220, 329.63].forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = i % 2 ? 'sine' : 'triangle';
    osc.frequency.value = freq;
    osc.detune.value = (i - 1.5) * 6;
    osc.connect(filter);
    osc.start();
    musicNodes.push(osc);
  });

  filter.connect(musicGain);
  musicGain.connect(master);
  musicNodes.push(lfo);
}

function stopMusic() {
  if (!musicNodes.length) return;
  musicNodes.forEach((node) => {
    try { node.stop(); } catch { /* already stopped */ }
  });
  musicNodes = [];
  musicGain = null;
}

/* ---------- controls ------------------------------------------------------ */

export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = muted ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

export function setMusic(value) {
  musicOn = value;
  if (value) startMusic();
  else stopMusic();
}

export function isMusicOn() {
  return musicOn;
}
