/**
 * Game audio, synthesised with the Web Audio API.
 *
 * There are no sound files: every effect is a short oscillator envelope built on demand, so
 * the game ships no audio to download, nothing to license, and no dependency for it. The
 * whole module is a few hundred bytes of generated signal.
 *
 * Autoplay rules mean an AudioContext cannot start until the player has interacted with the
 * page, so the context is created lazily on the first gesture and resumed afterwards. Every
 * entry point is safe to call before that: it either does nothing or queues the resume.
 */

export type Sfx =
  | 'collect'
  | 'jump'
  | 'hit'
  | 'checkpoint'
  | 'gameOver'
  | 'victory'
  | 'uiStart'
  | 'uiPause'
  | 'uiResume';

const STORAGE_KEY = 'neonrush:sound';

type AudioContextCtor = new () => AudioContext;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/** Set once a gesture has been seen, so the first effect can start the context. */
let unlocked = false;

/**
 * The shortest gap between two collect sounds. Treats arrive in short runs, and without this
 * a single pickup can stack six overlapping chimes into a click.
 */
const COLLECT_MIN_GAP_MS = 55;
let lastCollectAt = 0;

function readStoredPreference(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Default to on. Sound is part of the game, and a player can turn it off.
    return raw === null ? true : raw === 'on';
  } catch {
    // Storage can be blocked, in which case just play.
    return true;
  }
}

let enabled = typeof localStorage === 'undefined' ? true : readStoredPreference();

export function isSoundEnabled(): boolean {
  return enabled;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // A blocked storage must not break the toggle.
  }
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  persist();
  applyGain();
}

export function toggleSound(): boolean {
  setSoundEnabled(!enabled);
  return enabled;
}

/** True when the browser has no Web Audio at all, so the UI can say sound is unavailable. */
export function isAudioSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window.AudioContext ?? (window as { webkitAudioContext?: unknown }).webkitAudioContext) ===
      'function'
  );
}

function applyGain() {
  if (!ctx || !master) return;
  // Ramp rather than jump, so toggling does not click.
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(enabled ? 0.9 : 0, now + 0.05);
}

/**
 * Returns a live context, or null when audio is unavailable or switched off.
 *
 * Safe on a browser with no AudioContext, and inside try/catch because some browsers throw
 * rather than returning undefined when too many contexts are open.
 */
function context(): AudioContext | null {
  if (!enabled) return null;
  if (ctx) return ctx;

  const ctor =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ?? (window as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext);
  if (!ctor) return null;

  try {
    ctx = new ctor();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    return ctx;
  } catch {
    ctx = null;
    master = null;
    return null;
  }
}

/**
 * Call from a real user gesture so the browser lets audio start.
 *
 * Safe to call repeatedly; only the first attempt resumes.
 */
export function unlockAudio(): void {
  if (unlocked) return;
  const c = context();
  if (!c) return;
  unlocked = true;
  if (c.state === 'suspended') void c.resume().catch(() => {});
}

/** Pause the context when the tab is hidden, so nothing plays in the background. */
export function suspendAudio(): void {
  if (ctx && ctx.state === 'running') void ctx.suspend().catch(() => {});
}

interface ToneOptions {
  /** Start frequency in Hz. */
  from: number;
  /** End frequency, for a sweep. Defaults to `from`. */
  to?: number;
  type?: OscillatorType;
  /** Seconds. */
  duration: number;
  /** Peak gain, before the master volume. */
  peak?: number;
  /** Seconds to wait before starting. */
  delay?: number;
  /** Detune in cents, for a bit of thickness. */
  detune?: number;
}

/**
 * One oscillator with an exponential decay, which is enough for every effect here and keeps
 * nodes short-lived so nothing accumulates.
 */
function tone(c: AudioContext, out: AudioNode, options: ToneOptions): void {
  const { from, to = from, type = 'sine', duration, peak = 0.25, delay = 0, detune = 0 } = options;
  const start = c.currentTime + delay;

  const osc = c.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(from, start);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);

  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(env).connect(out);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** A short filtered noise burst, used for the impact. */
function noise(c: AudioContext, out: AudioNode, duration: number, peak: number): void {
  const frames = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  // Deterministic noise: Math.random is fine here, but a fixed pattern keeps the tone
  // identical run to run, which makes it easier to tune by ear.
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1;
  }

  const src = c.createBufferSource();
  src.buffer = buffer;

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2400, c.currentTime);
  filter.frequency.exponentialRampToValueAtTime(180, c.currentTime + duration);

  const env = c.createGain();
  env.gain.setValueAtTime(peak, c.currentTime);
  env.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);

  src.connect(filter).connect(env).connect(out);
  src.start();
  src.stop(c.currentTime + duration + 0.02);
}

/**
 * Plays one effect. Silently does nothing when sound is off, the browser has no Web Audio,
 * or the context cannot be created.
 */
export function play(sfx: Sfx): void {
  if (!enabled) return;

  // Treats arrive in bursts; keep the chime from stacking up into noise.
  if (sfx === 'collect') {
    const now =
      typeof performance === 'undefined' ? Date.now() : performance.now();
    if (now - lastCollectAt < COLLECT_MIN_GAP_MS) return;
    lastCollectAt = now;
  }

  const c = context();
  if (!c || !master) return;
  // A context can still be suspended if the browser refused the first resume.
  if (c.state === 'suspended') void c.resume().catch(() => {});

  const out = master;

  switch (sfx) {
    // Bright two-note chime, the classic pickup sound.
    case 'collect':
      tone(c, out, { from: 1180, type: 'triangle', duration: 0.16, peak: 0.2 });
      tone(c, out, { from: 1760, type: 'sine', duration: 0.2, peak: 0.14, delay: 0.03 });
      break;

    // Quick upward sweep: light and futuristic rather than a heavy cartoon hop.
    case 'jump':
      tone(c, out, { from: 300, to: 900, type: 'square', duration: 0.11, peak: 0.13 });
      break;

    // Impact: a filtered noise thump with a falling body underneath.
    case 'hit':
      noise(c, out, 0.26, 0.4);
      tone(c, out, { from: 190, to: 52, type: 'sawtooth', duration: 0.3, peak: 0.28 });
      break;

    // Rising major arpeggio: unmistakably positive.
    case 'checkpoint':
      tone(c, out, { from: 660, type: 'triangle', duration: 0.12, peak: 0.16 });
      tone(c, out, { from: 880, type: 'triangle', duration: 0.12, peak: 0.16, delay: 0.09 });
      tone(c, out, { from: 1320, type: 'sine', duration: 0.26, peak: 0.18, delay: 0.18 });
      break;

    // Falling minor pair, short and deflated.
    case 'gameOver':
      tone(c, out, { from: 420, to: 150, type: 'sawtooth', duration: 0.6, peak: 0.2 });
      tone(c, out, { from: 210, to: 80, type: 'sine', duration: 0.7, peak: 0.16, delay: 0.06 });
      break;

    // Longer celebratory run, with a shimmer on top.
    case 'victory':
      [523, 659, 784, 1047].forEach((f, i) => {
        tone(c, out, { from: f, type: 'triangle', duration: 0.3, peak: 0.18, delay: i * 0.11 });
      });
      tone(c, out, { from: 2093, type: 'sine', duration: 0.7, peak: 0.12, delay: 0.5 });
      break;

    // UI blips. Start rises, pause falls, resume rises again.
    case 'uiStart':
      tone(c, out, { from: 520, to: 780, type: 'square', duration: 0.09, peak: 0.12 });
      break;
    case 'uiPause':
      tone(c, out, { from: 700, to: 420, type: 'square', duration: 0.09, peak: 0.11 });
      break;
    case 'uiResume':
      tone(c, out, { from: 480, to: 760, type: 'square', duration: 0.09, peak: 0.12 });
      break;
  }
}