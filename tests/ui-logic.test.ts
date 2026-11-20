import { describe, expect, it } from "vitest";
import { ChordHistory } from "../src/history";
import { resolveShortcut } from "../src/shortcuts";
import { micErrorMessage } from "../src/errors";
import { ChordEngine } from "../src/dsp/chordEngine";
import { midiToFreq } from "../src/dsp/notes";

const SR = 44100;
function tone(midis: number[], n = 8192) {
  const s = new Float64Array(n);
  for (let i = 0; i < n; i++)
    for (const m of midis)
      for (let h = 1; h <= 3; h++)
        s[i]! +=
          (0.3 / h) * Math.sin((2 * Math.PI * midiToFreq(m) * h * i) / SR);
  return s;
}

describe("ChordHistory", () => {
  it("merges consecutive identical chords and tracks duration", () => {
    const h = new ChordHistory();
    h.push("C", 0);
    h.push("C", 100);
    h.push("G", 200);
    h.push("G", 500);
    expect(h.segments()).toEqual([
      { name: "C", start: 0, end: 100 },
      { name: "G", start: 200, end: 500 },
    ]);
  });
  it("starts a new segment after silence even for the same chord", () => {
    const h = new ChordHistory();
    h.push("C", 0);
    h.push(null, 50);
    h.push("C", 100);
    expect(h.segments()).toHaveLength(2);
  });
  it("filters short segments and bounds memory", () => {
    const h = new ChordHistory(3);
    for (let i = 0; i < 10; i++) h.push(`X${i}`, i * 10);
    expect(h.segments()).toHaveLength(3);
    expect(h.segments()[2]!.name).toBe("X9");
    expect(h.segments(5)).toHaveLength(0);
    h.clear();
    expect(h.segments()).toHaveLength(0);
  });
});

describe("resolveShortcut", () => {
  it("maps keys to actions", () => {
    expect(resolveShortcut({ key: " ", target: { tagName: "BODY" } })).toBe(
      "toggle",
    );
    expect(resolveShortcut({ key: "t" })).toBe("tuner");
    expect(resolveShortcut({ key: "C" })).toBe("chords");
    expect(resolveShortcut({ key: "x" })).toBeNull();
  });
  it("ignores modifiers, form fields and Space on buttons", () => {
    expect(resolveShortcut({ key: "c", ctrlKey: true })).toBeNull();
    expect(
      resolveShortcut({ key: "t", target: { tagName: "input" } }),
    ).toBeNull();
    expect(
      resolveShortcut({ key: " ", target: { tagName: "SELECT" } }),
    ).toBeNull();
    expect(
      resolveShortcut({ key: " ", target: { tagName: "BUTTON" } }),
    ).toBeNull();
    expect(
      resolveShortcut({
        key: "c",
        target: { tagName: "DIV", isContentEditable: true },
      }),
    ).toBeNull();
  });
});

describe("micErrorMessage", () => {
  it("distinguishes permission denied, missing device and busy device", () => {
    const e = (name: string) => Object.assign(new Error("x"), { name });
    expect(micErrorMessage(e("NotAllowedError"))).toMatch(/permission/i);
    expect(micErrorMessage(e("NotFoundError"))).toMatch(/No microphone/);
    expect(micErrorMessage(e("NotReadableError"))).toMatch(/busy/);
    expect(micErrorMessage("weird")).toMatch(/Could not start/);
  });
});

describe("ChordEngine", () => {
  it("reports C major for a steady triad and null for silence", () => {
    const eng = new ChordEngine();
    const triad = tone([48, 52, 55]);
    let r = null;
    for (let i = 0; i < 6; i++) r = eng.push(triad, SR);
    expect(r?.chord.name).toBe("C");
    // chroma decays through short gaps, then clears
    let q = r;
    for (let i = 0; i < 10; i++) q = eng.push(new Float64Array(8192), SR);
    expect(q).toBeNull();
  });
  it("switches chord after sustained new input", () => {
    const eng = new ChordEngine();
    for (let i = 0; i < 6; i++) eng.push(tone([48, 52, 55]), SR);
    let r = null;
    for (let i = 0; i < 12; i++) r = eng.push(tone([55, 59, 62]), SR);
    expect(r?.chord.name).toBe("G");
  });
});
