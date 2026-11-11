/**
 * OWL audio engine.
 * Every sound in the phone is synthesised at runtime with the Web Audio API.
 * No samples, no copyrighted music — only oscillators and noise.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function unlockAudio() {
  audioContext();
}

function tone(
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain = 0.18,
  slideTo?: number
) {
  const ac = audioContext();
  if (!ac || !master) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + Math.min(0.012, duration * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g);
  g.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise(start: number, duration: number, gain = 0.14, hp = 1200) {
  const ac = audioContext();
  if (!ac || !master) return;
  const len = Math.max(1, Math.floor(ac.sampleRate * duration));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = hp;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(start);
}

/* ----------------------------- UI sounds ----------------------------- */

export function keyClick(volume = 0.5) {
  const ac = audioContext();
  if (!ac || volume <= 0) return;
  const t = ac.currentTime;
  tone(2100 + Math.random() * 380, t, 0.018, 'triangle', 0.05 * volume);
  noise(t, 0.02, 0.05 * volume, 2600);
}

export function navBlip(volume = 0.5) {
  const ac = audioContext();
  if (!ac) return;
  tone(880, ac.currentTime, 0.045, 'square', 0.035 * volume);
}

export function successChime(volume = 0.6) {
  const ac = audioContext();
  if (!ac) return;
  const t = ac.currentTime;
  [660, 880, 1320].forEach((f, i) => tone(f, t + i * 0.075, 0.16, 'triangle', 0.07 * volume));
}

export function errorBuzz(volume = 0.6) {
  const ac = audioContext();
  if (!ac) return;
  const t = ac.currentTime;
  tone(200, t, 0.12, 'sawtooth', 0.06 * volume);
  tone(150, t + 0.13, 0.16, 'sawtooth', 0.06 * volume);
}

export function shutterSound(volume = 0.7) {
  const ac = audioContext();
  if (!ac) return;
  const t = ac.currentTime;
  noise(t, 0.035, 0.16 * volume, 900);
  noise(t + 0.06, 0.05, 0.11 * volume, 1600);
}

export function tickSound(volume = 0.4) {
  const ac = audioContext();
  if (!ac) return;
  tone(1500, ac.currentTime, 0.012, 'square', 0.03 * volume);
}

/* ----------------------------- Ringtones ----------------------------- */

export interface Ringtone {
  id: string;
  name: string;
  /** [frequency, beatOffset, durationInBeats, wave] */
  notes: [number, number, number, OscillatorType?][];
  tempo: number; // BPM
  loopBeats: number;
}

const R = (id: string, name: string, tempo: number, loopBeats: number, notes: Ringtone['notes']): Ringtone => ({
  id, name, tempo, loopBeats, notes,
});

export const RINGTONES: Ringtone[] = [
  R('owl-call', 'Owl Call', 132, 8, [
    [523, 0, 0.5], [659, 0.5, 0.5], [784, 1, 0.8], [659, 2, 0.4], [523, 2.5, 1.2],
    [440, 4, 0.5], [523, 4.5, 0.5], [659, 5, 1.4], [0, 6.6, 0.6],
  ]),
  R('midnight-tuft', 'Midnight Tuft', 108, 8, [
    [330, 0, 1, 'triangle'], [392, 1, 1, 'triangle'], [494, 2, 2, 'triangle'],
    [392, 4, 1, 'triangle'], [330, 5, 2.4, 'triangle'],
  ]),
  R('amber-eye', 'Amber Eye', 148, 8, [
    [880, 0, 0.25, 'square'], [1174, 0.25, 0.25, 'square'], [880, 0.5, 0.25, 'square'],
    [1318, 0.75, 0.5, 'square'], [0, 1.4, 0.6], [988, 2, 0.25, 'square'], [784, 2.25, 0.25, 'square'],
    [988, 2.5, 0.8, 'square'], [0, 3.5, 1],
  ]),
  R('barn-owl', 'Barn Owl', 120, 8, [
    [440, 0, 0.3], [554, 0.35, 0.3], [659, 0.7, 0.3], [880, 1.05, 0.6],
    [659, 2, 0.3], [554, 2.35, 0.3], [440, 2.7, 0.9], [330, 4, 1.6],
  ]),
  R('glide', 'Silent Glide', 96, 8, [
    [196, 0, 1.5, 'sine'], [294, 1.5, 1.5, 'sine'], [247, 3, 1.5, 'sine'], [330, 4.5, 2.4, 'sine'],
  ]),
  R('chrome-bell', 'Chrome Bell', 132, 8, [
    [1046, 0, 0.5, 'sine'], [1318, 0.2, 0.6, 'sine'], [1568, 0.4, 1.2, 'sine'],
    [1046, 2.5, 0.4, 'sine'], [1568, 2.7, 1.4, 'sine'],
  ]),
  R('pixel-owl', 'Pixel Owl', 160, 8, [
    [523, 0, 0.15, 'square'], [523, 0.2, 0.15, 'square'], [784, 0.4, 0.3, 'square'],
    [659, 0.8, 0.15, 'square'], [784, 1, 0.5, 'square'], [0, 2, 0.4],
    [880, 2.4, 0.15, 'square'], [784, 2.6, 0.15, 'square'], [659, 2.8, 0.6, 'square'],
  ]),
  R('deep-woods', 'Deep Woods', 84, 8, [
    [147, 0, 2, 'triangle'], [220, 2, 2, 'triangle'], [185, 4, 2, 'triangle'], [147, 6, 2, 'triangle'],
  ]),
  R('night-hunt', 'Night Hunt', 144, 8, [
    [392, 0, 0.2, 'sawtooth'], [587, 0.2, 0.2, 'sawtooth'], [784, 0.4, 0.4, 'sawtooth'],
    [0, 1, 0.5], [659, 1.5, 0.2, 'sawtooth'], [523, 1.7, 0.2, 'sawtooth'], [392, 1.9, 0.7, 'sawtooth'],
  ]),
  R('solar-wind', 'Solar Wind', 112, 8, [
    [262, 0, 1, 'triangle'], [330, 1, 1, 'triangle'], [392, 2, 1, 'triangle'], [523, 3, 2, 'triangle'],
    [392, 5, 1, 'triangle'], [330, 6, 2, 'triangle'],
  ]),
  R('alert-seven', 'Alert Seven', 176, 8, [
    [1200, 0, 0.1, 'square'], [0, 0.16, 0.1], [1200, 0.32, 0.1, 'square'], [0, 0.48, 0.1],
    [1200, 0.64, 0.1, 'square'], [900, 0.8, 0.3, 'square'],
  ]),
  R('soft-chime', 'Soft Chime', 100, 8, [
    [698, 0, 1.2, 'sine'], [880, 1.2, 1.2, 'sine'], [1046, 2.4, 2.2, 'sine'], [880, 5, 2.4, 'sine'],
  ]),
];

const toneById = Object.fromEntries(RINGTONES.map((r) => [r.id, r]));

let ringStop: (() => void) | null = null;

/** Play a ringtone (looping until stop() is called). Returns a stop function. */
export function playRingtone(id: string, volume = 0.7, loops = Infinity): () => void {
  const ac = audioContext();
  if (!ac) return () => {};
  stopRingtone();
  const rt = toneById[id] || RINGTONES[0];
  const beat = 60 / rt.tempo;
  const loopLen = rt.loopBeats * beat;
  let stopped = false;
  let timer: number | undefined;

  const schedule = (at: number) => {
    if (stopped) return;
    rt.notes.forEach(([f, off, dur, wave]) => {
      if (f <= 0) return;
      tone(f, at + off * beat, dur * beat, wave || 'sine', 0.13 * volume);
      tone(f * 2, at + off * beat, dur * beat * 0.5, 'sine', 0.045 * volume);
    });
  };

  let count = 0;
  const run = () => {
    if (stopped) return;
    schedule(ac.currentTime + 0.05);
    count += 1;
    if (count >= loops) return;
    timer = window.setTimeout(run, loopLen * 1000);
  };
  run();

  ringStop = () => {
    stopped = true;
    if (timer) window.clearTimeout(timer);
    if (ringStop === stopFn) ringStop = null;
  };
  const stopFn = ringStop;
  return stopFn;
}

export function stopRingtone() {
  if (ringStop) {
    ringStop();
    ringStop = null;
  }
}

export function playToneOnce(id: string, volume = 0.7) {
  playRingtone(id, volume, 1);
}

export function messageTone(id: string, volume = 0.7) {
  const ac = audioContext();
  if (!ac) return;
  const rt = toneById[id] || RINGTONES[0];
  const beat = 60 / rt.tempo;
  rt.notes.slice(0, 6).forEach(([f, off, dur, wave]) => {
    if (f > 0) tone(f, ac.currentTime + 0.03 + off * beat, Math.min(dur * beat, 0.4), wave || 'sine', 0.1 * volume);
  });
}

/* ----------------------------- Game SFX ----------------------------- */

export type GameSfx = 'eat' | 'bonus' | 'die' | 'hit' | 'brick' | 'shoot' | 'flip' | 'win' | 'click' | 'jump' | 'drop' | 'tick' | 'error';

const SFX: Record<GameSfx, (t: number, v: number) => void> = {
  eat: (t, v) => { tone(880, t, 0.07, 'square', 0.09 * v); tone(1320, t + 0.06, 0.09, 'square', 0.07 * v); },
  bonus: (t, v) => { [880, 1108, 1318, 1760].forEach((f, i) => tone(f, t + i * 0.055, 0.1, 'triangle', 0.09 * v)); },
  die: (t, v) => { tone(440, t, 0.5, 'sawtooth', 0.1 * v, 80); noise(t, 0.3, 0.08 * v, 200); },
  error: (t, v) => { tone(180, t, 0.12, 'square', 0.07 * v); tone(140, t + 0.1, 0.16, 'square', 0.06 * v); },
  hit: (t, v) => { tone(240, t, 0.09, 'square', 0.09 * v, 120); },
  brick: (t, v) => { tone(660, t, 0.05, 'square', 0.08 * v); tone(990, t + 0.02, 0.05, 'square', 0.05 * v); },
  shoot: (t, v) => { tone(1400, t, 0.07, 'sawtooth', 0.06 * v, 500); },
  flip: (t, v) => { tone(720, t, 0.05, 'sine', 0.07 * v); },
  win: (t, v) => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, t + i * 0.09, 0.2, 'triangle', 0.09 * v)); },
  click: (t, v) => { tone(1100, t, 0.03, 'square', 0.05 * v); },
  jump: (t, v) => { tone(400, t, 0.12, 'sine', 0.07 * v, 900); },
  drop: (t, v) => { tone(300, t, 0.1, 'triangle', 0.07 * v, 120); },
  tick: (t, v) => { tone(1800, t, 0.02, 'square', 0.03 * v); },
};

export function gameSfx(name: GameSfx, volume = 0.6) {
  const ac = audioContext();
  if (!ac) return;
  SFX[name]?.(ac.currentTime, volume);
}

/* ----------------------------- Ring/vibrate helpers ----------------------------- */

export function vibrate(pattern: number | number[]) {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern as any);
  } catch { /* ignore */ }
}
