/**
 * Synthesized sound effects + a persisted mute store.
 *
 * All sounds are generated at runtime with the Web Audio API — no audio files
 * are bundled or fetched. The palette is tuned to feel *premium* rather than
 * casino-loud: short, soft, slightly musical blips with quick envelopes and a
 * low master gain. Reduced-motion users are respected by callers; sound has its
 * own mute toggle (persisted), separate from haptics.
 *
 * SSR-safe: nothing touches `window`/`AudioContext` at module load. The audio
 * graph is created lazily on the first `play()` after a user gesture (browsers
 * keep an AudioContext suspended until then).
 */

export type Sound =
  | "spin" // reels start rolling — a rising whoosh
  | "tick" // a reel ticking past a row
  | "reelStop" // a reel settles — a soft wooden thunk
  | "select" // a player is selected in the pool
  | "place" // a player is locked onto the roster
  | "cash" // a budget pick is bought — a clean register chime
  | "win" // the record lands as a win — a bright swish chord
  | "perfect" // an 82-0 perfect season — a triumphant arpeggio
  | "lose" // the record lands as a loss — a muted buzzer
  | "tap"; // generic UI press

const STORAGE_KEY = "ud:sound-muted";
const MASTER_GAIN = 0.16;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

/** Mute state, mirrored to localStorage. Read lazily so SSR never touches it. */
let muted: boolean | null = null;
const listeners = new Set<() => void>();

function readMuted(): boolean {
  if (muted !== null) return muted;
  try {
    muted = window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    muted = false;
  }
  return muted;
}

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);
    }
    // Autoplay policy: the context starts suspended until a user gesture. Every
    // play() runs inside one (tap/click), so a resume here is allowed.
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A single enveloped oscillator voice. */
function voice(
  ac: AudioContext,
  out: AudioNode,
  {
    type = "sine",
    freq,
    to,
    start = 0,
    dur,
    gain = 1,
    attack = 0.005,
  }: {
    type?: OscillatorType;
    freq: number;
    /** Optional glide target (Hz) over the note's duration. */
    to?: number;
    start?: number;
    dur: number;
    gain?: number;
    attack?: number;
  }
) {
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Short burst of filtered noise — used for swishes and the register "ka". */
function noise(
  ac: AudioContext,
  out: AudioNode,
  { start = 0, dur, gain = 1, freq = 2400, q = 0.7 }: { start?: number; dur: number; gain?: number; freq?: number; q?: number }
) {
  const t0 = ac.currentTime + start;
  const frames = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function render(sound: Sound, ac: AudioContext, out: AudioNode) {
  switch (sound) {
    case "spin":
      voice(ac, out, { type: "triangle", freq: 180, to: 720, dur: 0.45, gain: 0.5 });
      noise(ac, out, { dur: 0.4, gain: 0.12, freq: 1200, q: 0.5 });
      break;
    case "tick":
      voice(ac, out, { type: "square", freq: 1300, dur: 0.025, gain: 0.18 });
      break;
    case "reelStop":
      voice(ac, out, { type: "sine", freq: 220, to: 90, dur: 0.16, gain: 0.7 });
      voice(ac, out, { type: "triangle", freq: 440, to: 180, dur: 0.1, gain: 0.25 });
      break;
    case "select":
      voice(ac, out, { type: "sine", freq: 660, to: 880, dur: 0.09, gain: 0.5 });
      break;
    case "place":
      voice(ac, out, { type: "triangle", freq: 523.25, dur: 0.08, gain: 0.5 });
      voice(ac, out, { type: "triangle", freq: 783.99, start: 0.07, dur: 0.12, gain: 0.5 });
      break;
    case "cash":
      // Two bright bell partials + a short "ka" of noise — a clean register.
      voice(ac, out, { type: "triangle", freq: 1318.51, dur: 0.12, gain: 0.45 });
      voice(ac, out, { type: "triangle", freq: 1975.53, start: 0.02, dur: 0.16, gain: 0.35 });
      noise(ac, out, { dur: 0.05, gain: 0.1, freq: 3200, q: 1.2 });
      break;
    case "win": {
      // A bright major triad swish.
      const triad = [523.25, 659.25, 783.99];
      triad.forEach((f, i) => voice(ac, out, { type: "triangle", freq: f, start: i * 0.06, dur: 0.5, gain: 0.4 }));
      noise(ac, out, { dur: 0.35, gain: 0.1, freq: 3000, q: 0.6 });
      break;
    }
    case "perfect": {
      // Rising arpeggio that resolves an octave up — the jackpot.
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      notes.forEach((f, i) => voice(ac, out, { type: "triangle", freq: f, start: i * 0.1, dur: 0.6, gain: 0.42 }));
      break;
    }
    case "lose":
      voice(ac, out, { type: "sawtooth", freq: 196, to: 110, dur: 0.5, gain: 0.32 });
      break;
    case "tap":
      voice(ac, out, { type: "sine", freq: 440, dur: 0.04, gain: 0.3 });
      break;
  }
}

/** Play a sound, unless muted or audio is unavailable. No-op on the server. */
export function playSound(sound: Sound) {
  if (typeof window === "undefined" || readMuted()) return;
  const ac = ensureContext();
  if (!ac || !master) return;
  try {
    render(sound, ac, master);
  } catch {
    // Audio is best-effort; never let a sound failure break an interaction.
  }
}

export function isMuted(): boolean {
  return readMuted();
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // storage unavailable — the toggle still holds for this session
  }
  if (!value) {
    // Unmuting is a gesture — prime the context and confirm with a tap.
    ensureContext();
    playSound("tap");
  }
  listeners.forEach((l) => l());
}

export function toggleMuted() {
  setMuted(!readMuted());
}

/** Subscribe to mute changes (for `useSyncExternalStore`). */
export function subscribeMuted(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
