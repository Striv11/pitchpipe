import { describe, expect, it } from "vitest";
import { PitchSmoother } from "../src/dsp/smoothing";
import {
  A4_MAX,
  A4_MIN,
  PRESETS,
  clampA4,
  nearestString,
} from "../src/dsp/presets";
import { midiToFreq } from "../src/dsp/notes";

const preset = (id: string) => PRESETS.find((p) => p.id === id)!;

describe("PitchSmoother", () => {
  it("rejects a single octave-error outlier", () => {
    const s = new PitchSmoother();
    for (let i = 0; i < 4; i++) s.push(220);
    const n = s.push(440);
    expect(n?.name).toBe("A");
    expect(n?.octave).toBe(3);
  });

  it("does not flicker between neighbours near a semitone boundary", () => {
    const s = new PitchSmoother({ window: 1 });
    const base = 69;
    const names = new Set<string>();
    // alternate +/-10 cents around the A/A# boundary (A + 50 cents)
    for (let i = 0; i < 20; i++) {
      const cents = 50 + (i % 2 ? 10 : -10);
      const n = s.push(midiToFreq(base + cents / 100));
      names.add(n!.name);
    }
    expect(names.size).toBe(1);
  });

  it("switches note once the pitch clearly moves", () => {
    const s = new PitchSmoother({ window: 1 });
    s.push(midiToFreq(69));
    const n = s.push(midiToFreq(71));
    expect(n?.name).toBe("B");
    expect(Math.abs(n!.cents)).toBeLessThan(1);
  });

  it("holds through short dropouts then clears", () => {
    const s = new PitchSmoother({ holdFrames: 2 });
    s.push(440);
    expect(s.push(null)).not.toBeNull();
    expect(s.push(null)).not.toBeNull();
    expect(s.push(null)).toBeNull();
  });

  it("honours an adjusted A4 reference", () => {
    const s = new PitchSmoother({ window: 1, a4: 432 });
    const n = s.push(432);
    expect(n?.name).toBe("A");
    expect(Math.abs(n!.cents)).toBeLessThan(0.01);
    s.setA4(415);
    const m = s.push(415);
    expect(m?.name).toBe("A");
  });
});

describe("presets", () => {
  it("picks the nearest guitar string with signed cents", () => {
    const m = nearestString(
      midiToFreq(45) * 2 ** (10 / 1200),
      preset("guitar"),
    );
    expect(m?.string.label).toBe("A2");
    expect(m!.cents).toBeCloseTo(10, 5);
    expect(m!.targetFrequency).toBeCloseTo(110, 5);
  });

  it("detects a flat violin E string", () => {
    const m = nearestString(
      midiToFreq(76) * 2 ** (-20 / 1200),
      preset("violin"),
    );
    expect(m?.string.label).toBe("E5");
    expect(m!.cents).toBeCloseTo(-20, 5);
  });

  it("uses re-entrant ukulele tuning (G4 above C4)", () => {
    expect(nearestString(392, preset("ukulele"))?.string.label).toBe("G4");
    expect(nearestString(261.63, preset("ukulele"))?.string.label).toBe("C4");
  });

  it("scales targets with A4", () => {
    const m = nearestString(432 / 8, preset("bass"), 432);
    expect(m?.string.label).toBe("A1");
    expect(Math.abs(m!.cents)).toBeLessThan(0.01);
  });

  it("returns null for chromatic mode", () => {
    expect(nearestString(440, preset("chromatic"))).toBeNull();
  });

  it("clamps A4 to 415-466 Hz", () => {
    expect(clampA4(300)).toBe(A4_MIN);
    expect(clampA4(500)).toBe(A4_MAX);
    expect(clampA4(442)).toBe(442);
    expect(clampA4(NaN)).toBe(440);
  });
});
