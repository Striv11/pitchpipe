import { NOTE_NAMES, freqToMidi, type NoteInfo } from "./notes";

export interface SmootherOptions {
  /** Median window length in frames (odd values work best). */
  window?: number;
  /** A new note replaces the current one only once the smoothed pitch is
   *  further than this many cents from the current note's centre. */
  hysteresisCents?: number;
  /** Consecutive null frames tolerated before the display is cleared. */
  holdFrames?: number;
  a4?: number;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function toNote(midiFloat: number, midi: number): NoteInfo {
  return {
    name: NOTE_NAMES[((midi % 12) + 12) % 12]!,
    octave: Math.floor(midi / 12) - 1,
    midi,
    cents: (midiFloat - midi) * 100,
  };
}

/**
 * Stabilises a stream of raw frequency estimates: a median filter removes
 * single-frame outliers (e.g. octave errors), and hysteresis stops the
 * displayed note flickering between neighbours when the pitch sits near a
 * semitone boundary.
 */
export class PitchSmoother {
  private readonly window: number;
  private readonly hysteresis: number;
  private readonly hold: number;
  private a4: number;
  private history: number[] = [];
  private current: number | null = null;
  private misses = 0;

  constructor(opts: SmootherOptions = {}) {
    this.window = Math.max(1, opts.window ?? 5);
    this.hysteresis = opts.hysteresisCents ?? 65;
    this.hold = opts.holdFrames ?? 3;
    this.a4 = opts.a4 ?? 440;
  }

  setA4(a4: number): void {
    this.a4 = a4;
    this.reset();
  }

  reset(): void {
    this.history = [];
    this.current = null;
    this.misses = 0;
  }

  /** Feed a frequency in Hz (or null for no pitch). Returns the smoothed note. */
  push(freq: number | null): NoteInfo | null {
    if (freq === null || !(freq > 0) || !Number.isFinite(freq)) {
      if (++this.misses > this.hold) this.reset();
      return this.output();
    }
    this.misses = 0;
    this.history.push(freqToMidi(freq, this.a4));
    if (this.history.length > this.window) this.history.shift();
    const m = median(this.history);
    if (
      this.current === null ||
      Math.abs(m - this.current) * 100 > this.hysteresis
    ) {
      this.current = Math.round(m);
    }
    return toNote(m, this.current);
  }

  private output(): NoteInfo | null {
    if (this.current === null || this.history.length === 0) return null;
    return toNote(median(this.history), this.current);
  }
}
