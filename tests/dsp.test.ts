import { describe, expect, it } from "vitest";
import { fft, magnitudeSpectrum } from "../src/dsp/fft";
import { detectPitch } from "../src/dsp/pitch";
import { midiToFreq, noteFromFrequency } from "../src/dsp/notes";

const SR = 44100;

function sine(freq: number, n: number, sr = SR, amp = 0.5): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++)
    out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sr);
  return out;
}

/** Harmonic-rich tone, like a plucked string. */
function harmonic(freq: number, n: number): Float64Array {
  const out = new Float64Array(n);
  for (let h = 1; h <= 5; h++) {
    const s = sine(freq * h, n, SR, 0.4 / h);
    for (let i = 0; i < n; i++) out[i]! += s[i]!;
  }
  return out;
}

describe("fft", () => {
  it("matches a naive DFT", () => {
    const n = 16;
    const x = Array.from({ length: n }, (_, i) => Math.sin(i * 1.3) + 0.2 * i);
    const re = Float64Array.from(x);
    const im = new Float64Array(n);
    fft(re, im);
    for (let k = 0; k < n; k++) {
      let r = 0;
      let m = 0;
      for (let t = 0; t < n; t++) {
        r += x[t]! * Math.cos((2 * Math.PI * k * t) / n);
        m -= x[t]! * Math.sin((2 * Math.PI * k * t) / n);
      }
      expect(re[k]).toBeCloseTo(r, 9);
      expect(im[k]).toBeCloseTo(m, 9);
    }
  });

  it("rejects non power-of-two lengths", () => {
    expect(() => fft(new Float64Array(12), new Float64Array(12))).toThrow();
  });

  it("puts a sine's energy in the right bin", () => {
    const n = 4096;
    const bin = 100;
    const spec = magnitudeSpectrum(sine((bin * SR) / n, n));
    const peak = spec.indexOf(Math.max(...spec));
    expect(peak).toBe(bin);
  });
});

describe("notes", () => {
  it("maps A4 to 440 Hz exactly", () => {
    const n = noteFromFrequency(440);
    expect(n).toMatchObject({ name: "A", octave: 4, midi: 69 });
    expect(n.cents).toBeCloseTo(0, 9);
  });

  it("handles C4, low and high octaves", () => {
    expect(noteFromFrequency(261.6256)).toMatchObject({ name: "C", octave: 4 });
    expect(noteFromFrequency(82.4069)).toMatchObject({ name: "E", octave: 2 });
    expect(noteFromFrequency(27.5)).toMatchObject({ name: "A", octave: 0 });
  });

  it("reports cents offset", () => {
    const sharp = noteFromFrequency(440 * Math.pow(2, 20 / 1200));
    expect(sharp.name).toBe("A");
    expect(sharp.cents).toBeCloseTo(20, 6);
    expect(noteFromFrequency(440 * Math.pow(2, -30 / 1200)).cents).toBeCloseTo(
      -30,
      6,
    );
  });

  it("respects a different reference tuning", () => {
    expect(noteFromFrequency(432, 432)).toMatchObject({ name: "A", octave: 4 });
    expect(midiToFreq(69, 432)).toBe(432);
  });

  it("rejects invalid input", () => {
    expect(() => noteFromFrequency(0)).toThrow(RangeError);
    expect(() => noteFromFrequency(NaN)).toThrow(RangeError);
  });
});

describe("detectPitch (YIN)", () => {
  it.each([82.41, 110, 196, 261.63, 440, 880, 1318.5])(
    "finds %f Hz sine",
    (f) => {
      const r = detectPitch(sine(f, 4096), SR);
      expect(r).not.toBeNull();
      // within 2 cents
      expect(Math.abs(1200 * Math.log2(r!.frequency / f))).toBeLessThan(2);
      expect(r!.clarity).toBeGreaterThan(0.9);
    },
  );

  it("finds the fundamental, not a harmonic, of a rich tone", () => {
    const r = detectPitch(harmonic(196, 4096), SR);
    expect(Math.abs(1200 * Math.log2(r!.frequency / 196))).toBeLessThan(3);
  });

  it("is robust to moderate noise", () => {
    let seed = 42;
    const rnd = () =>
      (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32 - 0.5;
    const s = sine(330, 4096);
    for (let i = 0; i < s.length; i++) s[i]! += 0.1 * rnd();
    const r = detectPitch(s, SR);
    expect(Math.abs(1200 * Math.log2(r!.frequency / 330))).toBeLessThan(5);
  });

  it("returns null for silence and for white noise", () => {
    expect(detectPitch(new Float64Array(4096), SR)).toBeNull();
    let seed = 7;
    const noise = new Float64Array(4096).map(
      () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32 - 0.5,
    );
    expect(detectPitch(noise, SR)).toBeNull();
  });
});
