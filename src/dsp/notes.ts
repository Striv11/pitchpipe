export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export interface NoteInfo {
  /** Note name without octave, e.g. "A#". */
  name: (typeof NOTE_NAMES)[number];
  octave: number;
  /** MIDI note number (A4 = 69). */
  midi: number;
  /** Deviation from the nearest equal-tempered note, in cents (-50..50). */
  cents: number;
}

/** Fractional MIDI number for a frequency; a4 is the reference tuning. */
export function freqToMidi(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4);
}

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function noteFromFrequency(freq: number, a4 = 440): NoteInfo {
  if (!(freq > 0) || !Number.isFinite(freq))
    throw new RangeError("frequency must be positive");
  const exact = freqToMidi(freq, a4);
  const midi = Math.round(exact);
  return {
    name: NOTE_NAMES[((midi % 12) + 12) % 12]!,
    octave: Math.floor(midi / 12) - 1,
    midi,
    cents: (exact - midi) * 100,
  };
}
