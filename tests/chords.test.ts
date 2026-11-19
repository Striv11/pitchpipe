import { describe, expect, it } from "vitest";
import { chroma } from "../src/dsp/chroma";
import {
  chordAt,
  chordScores,
  ChordTracker,
  NUM_CHORDS,
  QUALITIES,
  recognizeChord,
  viterbi,
} from "../src/dsp/chords";
import { midiToFreq } from "../src/dsp/notes";

const SR = 44100;
const N = 8192;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function render(midis: number[], noise: number, rand: () => number) {
  const s = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    let v = 0;
    for (const m of midis)
      for (let h = 1; h <= 4; h++)
        v += (1 / h) * Math.sin((2 * Math.PI * midiToFreq(m) * h * i) / SR);
    s[i] = 0.1 * v + noise * (rand() - 0.5);
  }
  return s;
}

/** Root in octave 3 (48..59), tones stacked upward. */
function voicing(root: number, qi: number) {
  const base = 48 + root;
  return QUALITIES[qi]!.tones.map(([iv]) => base + iv);
}

describe("chord templates", () => {
  it("has 7 qualities x 12 roots with readable names", () => {
    expect(NUM_CHORDS).toBe(84);
    const names = new Set(
      Array.from({ length: NUM_CHORDS }, (_, i) => chordAt(i).name),
    );
    expect(names.size).toBe(84);
    expect(names).toContain("F#m7");
    expect(names).toContain("Gsus4");
    expect(names).toContain("Bdim");
  });

  it("rejects bad input", () => {
    expect(() => chordScores(new Float64Array(5))).toThrow(RangeError);
    expect(() => chordAt(999)).toThrow(RangeError);
    expect(recognizeChord(null)).toBeNull();
    expect(recognizeChord(new Float64Array(12))).toBeNull();
  });

  it("identifies an exact C major chroma", () => {
    const c = new Float64Array(12);
    c[0] = c[4] = c[7] = 1;
    expect(recognizeChord(c)!.chord.name).toBe("C");
  });
});

describe("synthetic chord corpus", () => {
  it("is recognised with >= 90% accuracy under noise", () => {
    const rand = rng(7);
    let total = 0;
    let correct = 0;
    const misses: string[] = [];
    for (let qi = 0; qi < QUALITIES.length; qi++) {
      for (let root = 0; root < 12; root++) {
        for (const noise of [0, 0.05]) {
          const c = chroma(render(voicing(root, qi), noise, rand), SR);
          const m = recognizeChord(c);
          total++;
          if (
            m &&
            m.chord.root === root &&
            m.chord.quality === QUALITIES[qi]!.id
          )
            correct++;
          else misses.push(`${root}:${QUALITIES[qi]!.id}->${m?.chord.name}`);
        }
      }
    }
    expect(correct / total, misses.join(" ")).toBeGreaterThanOrEqual(0.9);
  });
});

describe("Viterbi smoothing", () => {
  // C major for 20 frames then G major for 20, with every 4th frame corrupted.
  const rand = rng(99);
  const cIdx = 0;
  const gIdx = 7;
  const frames: Float64Array[] = [];
  const truth: number[] = [];
  for (let t = 0; t < 40; t++) {
    const idx = t < 20 ? cIdx : gIdx;
    truth.push(idx);
    const wrong = t % 4 === 3;
    const root = wrong ? 1 : idx; // C# major glitch (shares no pitch class with C, G or their 7ths)
    frames.push(chordScores(chroma(render(voicing(root, 0), 0.02, rand), SR)!));
  }
  const argmax = (s: Float64Array) => s.indexOf(Math.max(...s));
  const flickers = (p: number[]) =>
    p.filter((v, i) => i > 0 && v !== p[i - 1]).length;

  it("reduces chord flicker and recovers the true sequence", () => {
    const raw = frames.map(argmax);
    const smooth = viterbi(frames);
    expect(flickers(raw)).toBeGreaterThan(10);
    expect(flickers(smooth)).toBe(1);
    expect(smooth).toEqual(truth);
  });

  it("online tracker also suppresses isolated glitches", () => {
    const tr = new ChordTracker();
    const out = frames.map((f) => tr.push(f));
    expect(flickers(out)).toBeLessThanOrEqual(2);
    expect(out[19]).toBe(cIdx);
    expect(out[39]).toBe(gIdx);
  });

  it("handles empty input, silence frames and bad params", () => {
    expect(viterbi([])).toEqual([]);
    const withGap = [frames[0]!, null, null, frames[1]!];
    expect(new Set(viterbi(withGap)).size).toBe(1);
    expect(() => viterbi(frames, { selfProb: 1 })).toThrow(RangeError);
    expect(() => new ChordTracker({ selfProb: 0 })).toThrow(RangeError);
  });
});
