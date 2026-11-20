export interface Segment {
  name: string;
  start: number;
  end: number;
}

/**
 * Timeline of recognised chords. Consecutive identical chords merge into one
 * segment; a null chord (silence / nothing recognised) closes the current one.
 * Memory is bounded by `max` segments.
 */
export class ChordHistory {
  private segs: Segment[] = [];
  private open = false;
  constructor(private readonly max = 32) {
    if (max < 1) throw new RangeError("max must be >= 1");
  }

  push(name: string | null, now: number): void {
    const last = this.segs[this.segs.length - 1];
    if (name === null) {
      this.open = false;
      return;
    }
    if (last && this.open && last.name === name) {
      last.end = now;
      return;
    }
    this.segs.push({ name, start: now, end: now });
    this.open = true;
    if (this.segs.length > this.max) this.segs.shift();
  }

  /** Segments oldest first, excluding ones shorter than `minMs`. */
  segments(minMs = 0): Segment[] {
    return this.segs
      .filter((s) => s.end - s.start >= minMs)
      .map((s) => ({ ...s }));
  }

  clear(): void {
    this.segs = [];
    this.open = false;
  }
}
