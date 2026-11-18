# Work log

Newest entries at the bottom. Each entry records what actually changed, what was learned, and what comes next.

## 2026-11-16 — Day 1

- Chose a ★ consumer idea (chord & pitch detector) in TypeScript; picked the name `pitchpipe`.
- Scaffolded Vite + TypeScript + vitest + eslint + prettier; `check.sh` runs format check, lint, typecheck, tests and a production build. CI and a GitHub Pages workflow are in place.
- Implemented radix-2 FFT, Hann window, YIN pitch detection with parabolic interpolation, and frequency→note/cents mapping, with 18 tests on synthetic signals (sines, harmonic tones, noise, silence).
- Added a minimal mic tuner page to prove the pipeline end to end.
- Not yet verified in a real browser with a real microphone; Day 6 adds Playwright with a fake audio device.
- Next: smoothing, gauge UI, instrument presets and adjustable A4 (Day 2).

## 2026-11-17 — Day 2

- Added `PitchSmoother` (median filter, hysteresis, dropout hold) and instrument presets (guitar, bass, ukulele, violin, chromatic) with nearest-string matching and an A4 clamp to 415–466 Hz; 11 new tests.
- Tuner page now has a cents needle gauge (`role="meter"`, reduced-motion aware), preset select and A4 input.
- Learned: ukulele's re-entrant tuning means "nearest string" must use pitch distance, not string order. I also fumbled a test's expected frequency (A1 is 432/8 Hz), which is a reminder to derive targets from `midiToFreq`.
- Still not verified with a real microphone in a browser; the gauge was only checked by typecheck and build. Day 6 adds Playwright.
- Next: chroma features from the FFT (Day 3).

## 2026-11-18 — Day 3

- Added `chroma()` (Hann + FFT, peak picking with parabolic interpolation, log-frequency pitch-class mapping, 1/(1+f/500) harmonic roll-off, sqrt compression, null on silence) and `ChromaSmoother` (EMA, decays on silent frames); 8 new tests including C major / A minor triads with harmonics, noise and A4=432.
- Learned: peak picking on an 8192-point frame (5.4 Hz bins) is enough for low-register chord tones only because of interpolation; plain bin summing would smear semitones below ~C3.
- Not yet tested on real recordings, only synthetic signals.
- Next: chord templates, synthetic corpus and Viterbi smoothing (Day 4).
