export interface PitchResult {
  /** Fundamental frequency in Hz. */
  frequency: number;
  /** 0..1, where 1 is a perfectly periodic signal (1 - YIN aperiodicity). */
  clarity: number;
}

export interface YinOptions {
  /** Absolute threshold on the normalized difference function. Default 0.15. */
  threshold?: number;
  minFreq?: number;
  maxFreq?: number;
}

/**
 * YIN pitch estimator (de Cheveigne & Kawahara, 2002).
 * Returns null when no sufficiently periodic pitch is found (silence, noise).
 */
export function detectPitch(
  buf: ArrayLike<number>,
  sampleRate: number,
  opts: YinOptions = {},
): PitchResult | null {
  const { threshold = 0.15, minFreq = 30, maxFreq = 2000 } = opts;
  const half = Math.floor(buf.length / 2);
  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq));
  const tauMax = Math.min(half - 1, Math.ceil(sampleRate / minFreq));
  if (tauMax <= tauMin) return null;

  // Silence gate: avoids dividing by ~0 in the normalization step.
  let energy = 0;
  for (let i = 0; i < buf.length; i++) energy += buf[i]! * buf[i]!;
  if (energy / buf.length < 1e-8) return null;

  // Step 1-2: difference function and cumulative mean normalized difference.
  const d = new Float64Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < half; i++) {
      const diff = buf[i]! - buf[i + tau]!;
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  const dn = new Float64Array(tauMax + 1);
  dn[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau]!;
    dn[tau] = running === 0 ? 1 : (d[tau]! * tau) / running;
  }

  // Step 3: first dip under the threshold, descend to its local minimum.
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (dn[t]! < threshold) {
      while (t + 1 <= tauMax && dn[t + 1]! < dn[t]!) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;

  // Step 4: parabolic interpolation around the minimum.
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const s0 = dn[tau - 1]!;
    const s1 = dn[tau]!;
    const s2 = dn[tau + 1]!;
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) better = tau + (s2 - s0) / denom;
  }
  return { frequency: sampleRate / better, clarity: Math.max(0, 1 - dn[tau]!) };
}
