import { describe, expect, it } from "vitest";
import { chroma, ChromaSmoother } from "../src/dsp/chroma";
import { midiToFreq } from "../src/dsp/notes";

const SR = 44100;
const N = 8192;

function tone(midis: number[], harmonics = 4, noise = 0): Float64Array {
  const s = new Float64Array(N);
  let seed = 12345;
  for (let i = 0; i < N; i++) {
    let v = 0;
    for (const m of midis)
      for (let h = 1; h <= harmonics; h++)
        v += (1 / h) * Math.sin((2 * Math.PI * midiToFreq(m) * h * i) / SR);
    seed = (seed * 1664525 + 1013904223) >>> 0;
    s[i] = 0.1 * v + noise * (seed / 2 ** 32 - 0.5);
  }
  return s;
}

const top = (c: Float64Array, k: number) =>
  [...c.keys()]
    .sort((a, b) => c[b]! - c[a]!)
    .slice(0, k)
    .sort((a, b) => a - b);

describe("chroma", () => {
  it("returns null for silence", () => {
    expect(chroma(new Float64Array(N), SR)).toBeNull();
  });

  it("C major triad with harmonics gives C, E, G as top 3", () => {
    const c = chroma(tone([60, 64, 67]), SR)!;
    expect(c).toHaveLength(12);
    expect(top(c, 3)).toEqual([0, 4, 7]);
    expect(Math.max(...c)).toBeCloseTo(1);
  });

  it("is transposition-equivariant (A minor: A, C, E)", () => {
    const c = chroma(tone([57, 60, 64]), SR)!;
    expect(top(c, 3)).toEqual([0, 4, 9]);
  });

  it("survives moderate noise", () => {
    const c = chroma(tone([62, 66, 69], 4, 0.05), SR)!;
    expect(top(c, 3)).toEqual([2, 6, 9]);
  });

  it("follows a4 tuning", () => {
    const s = new Float64Array(N);
    for (let i = 0; i < N; i++)
      s[i] = 0.2 * Math.sin((2 * Math.PI * 432 * i) / SR);
    expect(top(chroma(s, SR, { a4: 432 })!, 1)).toEqual([9]);
  });
});

describe("ChromaSmoother", () => {
  const a = Float64Array.from({ length: 12 }, (_, i) => (i === 0 ? 1 : 0));
  const b = Float64Array.from({ length: 12 }, (_, i) => (i === 7 ? 1 : 0));

  it("reduces a one-frame glitch", () => {
    const s = new ChromaSmoother(0.4);
    s.push(a);
    s.push(a);
    const out = s.push(b)!;
    expect(out[0]).toBeGreaterThan(out[7]!);
  });

  it("decays on null frames and resets when quiet", () => {
    const s = new ChromaSmoother(0.5);
    s.push(a);
    expect(s.push(null)![0]).toBeCloseTo(0.5);
    for (let i = 0; i < 6; i++) s.push(null);
    expect(s.push(null)).toBeNull();
  });

  it("rejects bad alpha", () => {
    expect(() => new ChromaSmoother(0)).toThrow();
  });
});
