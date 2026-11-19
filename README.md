# pitchpipe

> A tuner and chord detector that listens through your microphone, built from scratch (FFT, YIN, chroma) and running entirely in your browser.

![CI](https://github.com/Striv11/pitchpipe/actions/workflows/ci.yml/badge.svg)

**Live demo:** https://striv11.github.io/pitchpipe/ (deployed from `main` by GitHub Pages; Day 1 shows the basic tuner)

## Problem

Musicians practising alone want to tune quickly and to find out which chords a song uses. Existing apps are ad-heavy, need accounts, or upload audio to a server.

## Motivation

Pitch and chord detection is a compact tour of practical DSP: no libraries, every stage is tested against synthetic signals with known ground truth. It explores:

- radix-2 FFT and windowing
- the YIN algorithm for monophonic pitch (sub-cent interpolation, octave-error avoidance)
- chroma features and template-based chord recognition with Viterbi smoothing

## Architecture

```
mic -> AudioContext/AnalyserNode -> Float32 frames
                                     |-> YIN (time domain) -> frequency -> note + cents   (tuner)
                                     '-> Hann + FFT -> chroma(12) -> templates -> Viterbi (chords)
```

Everything under `src/dsp/` is pure TypeScript with no DOM dependency, so it is unit-tested with synthetic signals. `src/mic.ts` is the only code that touches Web Audio.

Invariants: DSP functions never allocate unbounded memory, return `null` rather than guessing on silence/noise, and nothing leaves the device.

## Setup

Requires Node 22+.

```bash
npm ci
npm run dev      # local dev server
bash check.sh    # format check, lint, typecheck, tests, build
```

## Demo

**Status: partially available (Day 2).** Run `npm run dev`, open the page, press _Start listening_ and hum or play a note. Expect the note name (e.g. `A4`), its frequency, a needle gauge of the offset in cents, and, with an instrument preset selected, the nearest string and how sharp or flat it is. A4 is adjustable from 415 to 466 Hz. Chord mode and file input are planned (see [PLAN.md](PLAN.md)).

## Design decisions & trade-offs

- **YIN over FFT peak picking** for the tuner: robust to strong harmonics and accurate to ~1 cent with parabolic interpolation, at O(N·τ) cost that is fine for 4096-sample frames.
- **Chroma from spectral peaks, not raw bins**: interpolated peaks are mapped to pitch classes on a log-frequency axis and down-weighted with frequency, so harmonics (which fold onto fifths and thirds) matter less than fundamentals.
- **Cosine-similarity templates + sticky HMM** for chords: 7 qualities x 12 roots (sus4 only, since sus2 is another root's sus4). Per-frame cosine scores feed a Viterbi decoder (offline) or forward filter (live) with a 0.9 self-transition probability, so a single glitch frame does not change the chord. Known limit: harmonic leakage makes G vs Gmaj7 close (the 3rd harmonic of B is F#), so ambiguous input can settle on the seventh.
- **No audio libraries**: the point is to understand and test each stage.
- **Median filter + hysteresis** for display stability: the median drops one-frame octave glitches; a note only changes once the pitch is >65 cents from the current note's centre, so a pitch on a semitone boundary does not flicker.
- Echo cancellation, noise suppression and AGC are disabled on the mic stream because they distort pitch.

## Roadmap

- [x] Day 1: FFT, YIN, note mapping, minimal mic tuner
- [x] Tuner gauge, smoothing, instrument presets
- [x] Chroma features (`src/dsp/chroma.ts`)
- [x] Chord recognition (`src/dsp/chords.ts`)
- [ ] Product UI, shortcuts, light/dark
- [ ] Audio file analysis and Playwright e2e
- [ ] Screenshots, accessibility and performance budgets

## License

MIT. See [LICENSE](LICENSE).
