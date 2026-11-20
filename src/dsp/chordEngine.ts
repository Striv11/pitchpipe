import { chroma, ChromaSmoother, type ChromaOptions } from "./chroma";
import { ChordTracker, chordAt, chordScores, type Chord } from "./chords";

export interface ChordReading {
  chord: Chord;
  /** Cosine similarity of the tracked chord with the smoothed chroma, 0..1. */
  score: number;
}

/**
 * Live chord pipeline: frame -> chroma -> EMA smoothing -> cosine scores ->
 * causal HMM. Returns null while the input is silent or fits no chord.
 */
export class ChordEngine {
  private readonly smoother = new ChromaSmoother();
  private readonly tracker = new ChordTracker();

  constructor(
    private readonly opts: ChromaOptions = {},
    private readonly minScore = 0.6,
  ) {}

  push(frame: ArrayLike<number>, sampleRate: number): ChordReading | null {
    const c = this.smoother.push(chroma(frame, sampleRate, this.opts));
    if (!c) {
      this.tracker.reset();
      return null;
    }
    const scores = chordScores(c);
    const idx = this.tracker.push(scores);
    const score = scores[idx]!;
    return score < this.minScore ? null : { chord: chordAt(idx), score };
  }

  reset(): void {
    this.smoother.reset();
    this.tracker.reset();
  }
}
