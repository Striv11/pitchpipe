import { NOTE_NAMES } from "./notes";

export interface ChordQuality {
  id: string;
  /** Suffix appended to the root name ("" for major). */
  suffix: string;
  /** Pitch-class intervals above the root with template weights. */
  tones: ReadonlyArray<readonly [number, number]>;
}

/** Chord qualities recognised. Weights favour root, then third, then fifth. */
export const QUALITIES: readonly ChordQuality[] = [
  {
    id: "maj",
    suffix: "",
    tones: [
      [0, 1],
      [4, 0.9],
      [7, 0.8],
    ],
  },
  {
    id: "min",
    suffix: "m",
    tones: [
      [0, 1],
      [3, 0.9],
      [7, 0.8],
    ],
  },
  {
    id: "7",
    suffix: "7",
    tones: [
      [0, 1],
      [4, 0.9],
      [7, 0.7],
      [10, 0.8],
    ],
  },
  {
    id: "maj7",
    suffix: "maj7",
    tones: [
      [0, 1],
      [4, 0.9],
      [7, 0.7],
      [11, 0.8],
    ],
  },
  {
    id: "min7",
    suffix: "m7",
    tones: [
      [0, 1],
      [3, 0.9],
      [7, 0.7],
      [10, 0.8],
    ],
  },
  {
    id: "dim",
    suffix: "dim",
    tones: [
      [0, 1],
      [3, 0.9],
      [6, 0.9],
    ],
  },
  {
    id: "sus4",
    suffix: "sus4",
    tones: [
      [0, 1],
      [5, 0.9],
      [7, 0.8],
    ],
  },
];

export interface Chord {
  /** Pitch class of the root, 0 = C. */
  root: number;
  quality: string;
  /** Display name, e.g. "F#m7". */
  name: string;
}

interface Template {
  chord: Chord;
  vec: Float64Array;
}

function buildTemplates(): Template[] {
  const out: Template[] = [];
  for (const q of QUALITIES) {
    for (let root = 0; root < 12; root++) {
      const vec = new Float64Array(12);
      for (const [iv, w] of q.tones) vec[(root + iv) % 12] = w;
      const norm = Math.hypot(...vec);
      for (let i = 0; i < 12; i++) vec[i] = vec[i]! / norm;
      out.push({
        chord: { root, quality: q.id, name: NOTE_NAMES[root]! + q.suffix },
        vec,
      });
    }
  }
  return out;
}

const TEMPLATES = buildTemplates();

/** Number of chord states (12 roots x qualities). */
export const NUM_CHORDS = TEMPLATES.length;

export function chordAt(index: number): Chord {
  const t = TEMPLATES[index];
  if (!t) throw new RangeError("chord index out of range");
  return t.chord;
}

/** Cosine similarity of a chroma vector against every template. */
export function chordScores(c: ArrayLike<number>): Float64Array {
  if (c.length !== 12) throw new RangeError("chroma must have 12 bins");
  let norm = 0;
  for (let i = 0; i < 12; i++) norm += c[i]! * c[i]!;
  norm = Math.sqrt(norm);
  const out = new Float64Array(NUM_CHORDS);
  if (norm === 0) return out;
  for (let t = 0; t < NUM_CHORDS; t++) {
    let dot = 0;
    const v = TEMPLATES[t]!.vec;
    for (let i = 0; i < 12; i++) dot += v[i]! * c[i]!;
    out[t] = dot / norm;
  }
  return out;
}

export interface ChordMatch {
  chord: Chord;
  index: number;
  /** Cosine similarity of the best template, 0..1. */
  score: number;
}

/** Best-matching chord, or null if the chroma is empty or fits nothing well. */
export function recognizeChord(
  c: ArrayLike<number> | null,
  minScore = 0.7,
): ChordMatch | null {
  if (!c) return null;
  const s = chordScores(c);
  let best = 0;
  for (let i = 1; i < s.length; i++) if (s[i]! > s[best]!) best = i;
  if (s[best]! < minScore) return null;
  return { chord: TEMPLATES[best]!.chord, index: best, score: s[best]! };
}

export interface HmmOptions {
  /** Probability of staying on the same chord between frames. */
  selfProb?: number;
  /** Sharpness of the score-to-likelihood mapping. */
  beta?: number;
}

function logParams({ selfProb = 0.9, beta = 6 }: HmmOptions) {
  if (!(selfProb > 0 && selfProb < 1))
    throw new RangeError("selfProb must be in (0, 1)");
  return {
    beta,
    logStay: Math.log(selfProb),
    logMove: Math.log((1 - selfProb) / (NUM_CHORDS - 1)),
  };
}

/**
 * Offline Viterbi decoding of per-frame chord scores (from `chordScores`)
 * into the most likely chord-index sequence, with a sticky transition model.
 * Frames that are null (silence) are treated as uninformative.
 */
export function viterbi(
  frames: ReadonlyArray<Float64Array | null>,
  opts: HmmOptions = {},
): number[] {
  const { beta, logStay, logMove } = logParams(opts);
  const T = frames.length;
  if (T === 0) return [];
  const back: Uint8Array[] = [];
  let prev = new Float64Array(NUM_CHORDS);
  for (let t = 0; t < T; t++) {
    const f = frames[t] ?? null;
    const cur = new Float64Array(NUM_CHORDS);
    const bp = new Uint8Array(NUM_CHORDS);
    // best previous state, for the "switch" branch
    let bestPrev = 0;
    for (let j = 1; j < NUM_CHORDS; j++)
      if (prev[j]! > prev[bestPrev]!) bestPrev = j;
    for (let i = 0; i < NUM_CHORDS; i++) {
      const emit = f ? beta * f[i]! : 0;
      if (t === 0) {
        cur[i] = emit;
        continue;
      }
      const stay = prev[i]! + logStay;
      const move = prev[bestPrev]! + logMove;
      if (stay >= move || bestPrev === i) {
        cur[i] = stay + emit;
        bp[i] = i;
      } else {
        cur[i] = move + emit;
        bp[i] = bestPrev;
      }
    }
    back.push(bp);
    prev = cur;
  }
  let state = 0;
  for (let i = 1; i < NUM_CHORDS; i++) if (prev[i]! > prev[state]!) state = i;
  const path = new Array<number>(T);
  for (let t = T - 1; t >= 0; t--) {
    path[t] = state;
    state = back[t]![state]!;
  }
  return path;
}

/**
 * Online (causal) counterpart for live use: forward filtering of the same
 * HMM. Each push returns the currently most probable chord.
 */
export class ChordTracker {
  private logp = new Float64Array(NUM_CHORDS);
  private readonly p: ReturnType<typeof logParams>;
  constructor(opts: HmmOptions = {}) {
    this.p = logParams(opts);
  }

  push(scores: Float64Array | null): number {
    const { beta, logStay, logMove } = this.p;
    let max = -Infinity;
    for (let j = 0; j < NUM_CHORDS; j++) max = Math.max(max, this.logp[j]!);
    // log-sum-exp of all previous states for the "switch" mass
    let sum = 0;
    for (let j = 0; j < NUM_CHORDS; j++) sum += Math.exp(this.logp[j]! - max);
    const total = max + Math.log(sum);
    const next = new Float64Array(NUM_CHORDS);
    let best = 0;
    for (let i = 0; i < NUM_CHORDS; i++) {
      const a = this.logp[i]! + logStay;
      const b = total + logMove;
      const m = Math.max(a, b);
      next[i] =
        m +
        Math.log(Math.exp(a - m) + Math.exp(b - m)) +
        (scores ? beta * scores[i]! : 0);
      if (next[i]! > next[best]!) best = i;
    }
    // normalise to keep numbers bounded
    const top = next[best]!;
    for (let i = 0; i < NUM_CHORDS; i++) next[i] = next[i]! - top;
    this.logp = next;
    return best;
  }

  reset(): void {
    this.logp.fill(0);
  }
}
