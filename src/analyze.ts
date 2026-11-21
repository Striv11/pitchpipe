import { chroma, ChromaSmoother } from "./dsp/chroma";
import { chordAt, chordScores, viterbi } from "./dsp/chords";

export interface TimedChord {
  name: string;
  /** Seconds from the start of the file. */
  start: number;
  end: number;
}

export interface AnalysisOptions {
  frameSize?: number;
  hop?: number;
  /** Chords whose best cosine score is below this are treated as no chord. */
  minScore?: number;
  /** Refuse inputs longer than this many seconds (bounds memory and time). */
  maxSeconds?: number;
}

/** Average all channels into one mono signal. */
export function mixToMono(channels: ArrayLike<number>[]): Float32Array {
  if (channels.length === 0) throw new RangeError("no channels");
  const n = channels[0]!.length;
  const out = new Float32Array(n);
  for (const ch of channels) {
    if (ch.length !== n) throw new RangeError("channel length mismatch");
    for (let i = 0; i < n; i++) out[i]! += ch[i]! / channels.length;
  }
  return out;
}

/**
 * Offline chord analysis of a whole recording: chroma per frame, EMA
 * smoothing, then Viterbi decoding over the full sequence (better than the
 * causal filter used live, because it can look ahead). Silent or unmatched
 * frames break segments.
 */
export function analyzeChords(
  samples: Float32Array,
  sampleRate: number,
  opts: AnalysisOptions = {},
): TimedChord[] {
  const {
    frameSize = 8192,
    hop = 4096,
    minScore = 0.6,
    maxSeconds = 600,
  } = opts;
  if (!(sampleRate > 0)) throw new RangeError("sampleRate must be > 0");
  if (hop < 1 || frameSize < 1) throw new RangeError("bad frame/hop size");
  if (samples.length / sampleRate > maxSeconds)
    throw new RangeError(`audio longer than ${maxSeconds} s`);

  const smoother = new ChromaSmoother();
  const frames: (Float64Array | null)[] = [];
  const best: number[] = [];
  for (let at = 0; at + frameSize <= samples.length; at += hop) {
    const c = smoother.push(
      chroma(samples.subarray(at, at + frameSize), sampleRate),
    );
    frames.push(c ? chordScores(c) : null);
  }
  const path = viterbi(frames);
  for (let t = 0; t < frames.length; t++) {
    const f = frames[t];
    best.push(f && f[path[t]!]! >= minScore ? path[t]! : -1);
  }

  const out: TimedChord[] = [];
  const frameEnd = (t: number) => (t * hop + frameSize) / sampleRate;
  let t = 0;
  while (t < best.length) {
    const idx = best[t]!;
    let u = t;
    while (u + 1 < best.length && best[u + 1] === idx) u++;
    if (idx >= 0)
      out.push({
        name: chordAt(idx).name,
        start: (t * hop) / sampleRate,
        end: frameEnd(u),
      });
    t = u + 1;
  }
  return out;
}
