# Plan

Seven-day arc. Every milestone has acceptance criteria that can be checked by a test or a command.

| Day | Milestone                    | Acceptance criteria                                                                                                                                                                                     | Status |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Scaffold + DSP core          | Vite/TS/vitest/eslint/prettier pass `check.sh`; radix-2 FFT matches a naive DFT; YIN finds sines within 2 cents (80 Hz–1.3 kHz) and returns null for silence/noise; frequency→note+cents mapping tested | [x]    |
| 2   | Tuner mode                   | Smoothed pitch (median filter + hysteresis) with unit tests; needle/cents gauge UI; instrument presets (guitar, bass, ukulele, violin) pick nearest string; adjustable A4 (415–466 Hz)                  | [x]    |
| 3   | Chroma features              | 12-bin chroma from FFT with log-frequency mapping and harmonic weighting; synthetic C-major triad yields C/E/G as top-3 bins in tests; temporal smoothing                                               | [x]    |
| 4   | Chord recognition            | Template matching for maj/min/7/maj7/min7/dim/sus over 12 roots; ≥90% accuracy on a generated synthetic chord corpus (with noise); Viterbi smoothing reduces flicker (tested)                           | [x]    |
| 5   | Product UI                   | Landing section, empty state, light/dark design tokens, responsive on 360px, loading/error/permission-denied states, keyboard shortcuts (Space start/stop, T/C mode), chord history timeline            | [x]    |
| 6   | Audio-file input + e2e       | Drop an audio file to analyse offline (decodeAudioData); Playwright e2e with a fake audio device covers tuner and chord flows; benchmark asserts frame analysis < 5 ms                                  | [ ]    |
| 7   | Polish, screenshots, release | README screenshots and live link, accessibility pass (axe, focus order), performance budget in CI, v0.1.0 tag, roadmap updated                                                                          | [ ]    |

## Stretch

- Capo / transposition display, chord diagrams for guitar
- Key detection from the chord history
- PWA install and offline support
