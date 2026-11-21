import { describe, expect, it } from "vitest";
import { analyzeChords, mixToMono } from "../src/analyze";
import { chroma } from "../src/dsp/chroma";
import { chordScores } from "../src/dsp/chords";
import { midiToFreq } from "../src/dsp/notes";

const SR = 22050;

function tone(midis: number[], seconds: number): Float32Array {
  const s = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < s.length; i++) {
    let v = 0;
    for (const m of midis)
      for (let h = 1; h <= 2; h++)
        v += (1 / h) * Math.sin((2 * Math.PI * midiToFreq(m) * h * i) / SR);
    s[i] = 0.1 * v;
  }
  return s;
}

function concat(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

describe("analyzeChords", () => {
  it("recovers a C - F - G progression with sensible times", () => {
    const audio = concat(
      tone([48, 52, 55], 2),
      tone([53, 57, 60], 2),
      tone([55, 59, 62], 2),
    );
    const segs = analyzeChords(audio, SR);
    expect(segs.map((s) => s.name)).toEqual(["C", "F", "G"]);
    expect(Math.abs(segs[1]!.start - 2)).toBeLessThan(0.5);
    expect(Math.abs(segs[2]!.start - 4)).toBeLessThan(0.5);
    for (const s of segs) expect(s.end).toBeGreaterThan(s.start);
  });

  it("splits segments around silence", () => {
    const audio = concat(
      tone([48, 52, 55], 1.5),
      new Float32Array(SR * 2),
      tone([48, 52, 55], 1.5),
    );
    const segs = analyzeChords(audio, SR);
    expect(segs.map((s) => s.name)).toEqual(["C", "C"]);
    expect(segs[1]!.start).toBeGreaterThan(segs[0]!.end);
  });

  it("returns nothing for silence and for clips shorter than a frame", () => {
    expect(analyzeChords(new Float32Array(SR * 2), SR)).toEqual([]);
    expect(analyzeChords(new Float32Array(100), SR)).toEqual([]);
  });

  it("rejects bad parameters and over-long audio", () => {
    expect(() => analyzeChords(new Float32Array(10), 0)).toThrow(RangeError);
    expect(() =>
      analyzeChords(new Float32Array(SR * 3), SR, { maxSeconds: 2 }),
    ).toThrow(RangeError);
  });
});

describe("mixToMono", () => {
  it("averages channels", () => {
    const m = mixToMono([Float32Array.of(1, 0), Float32Array.of(0, 1)]);
    expect(Array.from(m)).toEqual([0.5, 0.5]);
  });
  it("rejects empty or ragged input", () => {
    expect(() => mixToMono([])).toThrow(RangeError);
    expect(() => mixToMono([new Float32Array(2), new Float32Array(3)])).toThrow(
      RangeError,
    );
  });
});

describe("benchmark", () => {
  it("analyses one 8192-sample chord frame in under 5 ms (median)", () => {
    const frame = tone([48, 52, 55], 8192 / SR + 0.01).subarray(0, 8192);
    const times: number[] = [];
    for (let i = 0; i < 40; i++) {
      const t0 = performance.now();
      const c = chroma(frame, SR);
      if (c) chordScores(c);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    expect(times[20]!).toBeLessThan(5);
  });
});
