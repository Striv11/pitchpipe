import { freqToMidi, midiToFreq } from "./notes";

export interface StringTarget {
  label: string;
  midi: number;
}

export interface Preset {
  id: string;
  name: string;
  strings: StringTarget[];
}

const s = (label: string, midi: number): StringTarget => ({ label, midi });

export const PRESETS: Preset[] = [
  {
    id: "chromatic",
    name: "Chromatic",
    strings: [],
  },
  {
    id: "guitar",
    name: "Guitar",
    strings: [
      s("E2", 40),
      s("A2", 45),
      s("D3", 50),
      s("G3", 55),
      s("B3", 59),
      s("E4", 64),
    ],
  },
  {
    id: "bass",
    name: "Bass",
    strings: [s("E1", 28), s("A1", 33), s("D2", 38), s("G2", 43)],
  },
  {
    id: "ukulele",
    name: "Ukulele",
    strings: [s("G4", 67), s("C4", 60), s("E4", 64), s("A4", 69)],
  },
  {
    id: "violin",
    name: "Violin",
    strings: [s("G3", 55), s("D4", 62), s("A4", 69), s("E5", 76)],
  },
];

export const A4_MIN = 415;
export const A4_MAX = 466;

export function clampA4(a4: number): number {
  if (!Number.isFinite(a4)) return 440;
  return Math.min(A4_MAX, Math.max(A4_MIN, a4));
}

export interface StringMatch {
  string: StringTarget;
  targetFrequency: number;
  /** Signed deviation from the target string in cents (+ = sharp). */
  cents: number;
}

/** Nearest string by pitch distance; null for presets without strings. */
export function nearestString(
  freq: number,
  preset: Preset,
  a4 = 440,
): StringMatch | null {
  if (preset.strings.length === 0 || !(freq > 0)) return null;
  const m = freqToMidi(freq, a4);
  let best = preset.strings[0]!;
  for (const st of preset.strings) {
    if (Math.abs(st.midi - m) < Math.abs(best.midi - m)) best = st;
  }
  return {
    string: best,
    targetFrequency: midiToFreq(best.midi, a4),
    cents: (m - best.midi) * 100,
  };
}
