import { magnitudeSpectrum } from "./fft";
import { freqToMidi } from "./notes";

export interface ChromaOptions {
  /** Lowest frequency considered, Hz. */
  minFreq?: number;
  /** Highest frequency considered, Hz. */
  maxFreq?: number;
  /** Reference tuning for A4. */
  a4?: number;
  /** Peaks below this fraction of the strongest peak are ignored. */
  peakFloor?: number;
  /** Frames whose RMS is below this are treated as silence. */
  silenceRms?: number;
}

/**
 * 12-bin chroma vector (index 0 = C) of a frame, or null for silence.
 *
 * Spectral peaks (parabolically interpolated) are mapped to pitch classes on a
 * log-frequency axis and weighted by a 1/(1+f/f0) roll-off, so upper
 * harmonics, which fold onto the fifth/third of the fundamental, count for
 * less than the fundamentals. The result is sqrt-compressed and scaled so the
 * largest bin is 1.
 */
export function chroma(
  signal: ArrayLike<number>,
  sampleRate: number,
  opts: ChromaOptions = {},
): Float64Array | null {
  const {
    minFreq = 60,
    maxFreq = 2000,
    a4 = 440,
    peakFloor = 0.05,
    silenceRms = 1e-3,
  } = opts;
  const n = signal.length;
  let energy = 0;
  for (let i = 0; i < n; i++) energy += signal[i]! * signal[i]!;
  if (Math.sqrt(energy / n) < silenceRms) return null;

  const mag = magnitudeSpectrum(signal);
  const binHz = sampleRate / n;
  const lo = Math.max(2, Math.floor(minFreq / binHz));
  const hi = Math.min(mag.length - 2, Math.ceil(maxFreq / binHz));

  let maxMag = 0;
  for (let k = lo; k <= hi; k++) if (mag[k]! > maxMag) maxMag = mag[k]!;
  if (maxMag === 0) return null;

  const out = new Float64Array(12);
  for (let k = lo; k <= hi; k++) {
    const m = mag[k]!;
    if (m < peakFloor * maxMag || m < mag[k - 1]! || m <= mag[k + 1]!) continue;
    // parabolic interpolation of the peak position
    const a = mag[k - 1]!;
    const c = mag[k + 1]!;
    const denom = a - 2 * m + c;
    const delta = denom === 0 ? 0 : (0.5 * (a - c)) / denom;
    const freq = (k + delta) * binHz;
    if (freq < minFreq || freq > maxFreq) continue;
    const pc = (((Math.round(freqToMidi(freq, a4)) % 12) + 12) % 12) | 0;
    out[pc] = out[pc]! + m / (1 + freq / 500);
  }

  let top = 0;
  for (let i = 0; i < 12; i++) {
    out[i] = Math.sqrt(out[i]!);
    if (out[i]! > top) top = out[i]!;
  }
  if (top === 0) return null;
  for (let i = 0; i < 12; i++) out[i] = out[i]! / top;
  return out;
}

/** Exponential moving average over chroma frames; null frames decay the state. */
export class ChromaSmoother {
  private state = new Float64Array(12);
  private has = false;
  constructor(private readonly alpha = 0.4) {
    if (!(alpha > 0 && alpha <= 1))
      throw new RangeError("alpha must be in (0, 1]");
  }

  push(frame: Float64Array | null): Float64Array | null {
    if (frame === null) {
      for (let i = 0; i < 12; i++)
        this.state[i] = this.state[i]! * (1 - this.alpha);
      if (Math.max(...this.state) < 0.05) this.reset();
    } else if (!this.has) {
      this.state.set(frame);
      this.has = true;
    } else {
      for (let i = 0; i < 12; i++)
        this.state[i] =
          this.alpha * frame[i]! + (1 - this.alpha) * this.state[i]!;
    }
    return this.has ? Float64Array.from(this.state) : null;
  }

  reset(): void {
    this.state.fill(0);
    this.has = false;
  }
}
