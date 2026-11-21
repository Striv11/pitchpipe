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

## 2026-11-19 — Day 4

- Added `src/dsp/chords.ts`: weighted templates for maj/min/7/maj7/min7/dim/sus4 over 12 roots (84 states), cosine scoring, `recognizeChord` with a no-chord threshold, offline `viterbi` and a causal `ChordTracker` (forward filter) sharing one sticky HMM.
- 12 new tests: template sanity, a generated corpus (7 qualities x 12 roots x 2 noise levels, harmonic tones) at >= 90% accuracy, and flicker tests where Viterbi recovers the exact sequence from frames with every 4th one corrupted.
- Learned: the first version of the flicker test failed for a real reason. A glitch chord sharing a pitch class (F#) with Gmaj7 made the HMM settle on Gmaj7 for all G frames; evidence was genuinely ambiguous. Also beta=12 made the online filter flip on a single bad frame; beta=6 makes one glitch cost less than a chord change. Glitch frames in the test now share no pitch class with the true chords.
- Only synthetic signals so far, no real recordings. sus2 is omitted on purpose (it equals another root's sus4).
- Next: product UI with chord mode, shortcuts, history timeline and light/dark (Day 5).

## 2026-11-20 — Day 5

- Product UI: Tuner/Chords mode switch, live chord display, chord history timeline (segments merged, <300 ms ones hidden, bounded to 32), "how it works" section, loading state while the mic permission prompt is open, light/dark tokens (already present) plus focus rings and a 360px breakpoint.
- Pulled UI logic out of the DOM so it is testable: `ChordEngine` (chroma -> EMA -> HMM), `ChordHistory`, `resolveShortcut` (Space, T, C; ignores modifiers, form fields, and Space on a button to avoid a double toggle) and `micErrorMessage` (denied / not found / busy / unsupported). `mic.ts` now hands raw 8192-sample frames to the caller; the tuner uses the newest 4096 for YIN. 11 new tests.
- Learned: the chroma smoother decays through silence on purpose, so the engine takes a handful of silent frames to return null; my first test wrongly expected an immediate null.
- Not verified: the DOM wiring (`main.ts`) and the 360px layout were only checked by typecheck/lint/build, not in a browser; no real mic yet. Day 6 adds Playwright with a fake audio device, which should cover this.
- Next: audio-file input via decodeAudioData, Playwright e2e, frame-time benchmark (Day 6).

## 2026-11-21 — Day 6

- Added `src/analyze.ts` (`analyzeChords`, `mixToMono`): offline chord analysis of a whole recording using the same chroma/templates with full-sequence Viterbi, timed segments, silence breaks segments, 10-minute cap. Wired into the page as a drop zone / file picker using `decodeAudioData`; decode and range errors show a message.
- Tests: C-F-G progression recovered with segment starts within 0.5 s, silence splitting, empty/short input, bad params, and a median-of-40 benchmark asserting chroma + scoring of one 8192-sample frame takes < 5 ms.
- Learned: with 3 harmonics at 1/h in the test tones, C and F came out as Cmaj7/Fmaj7, the leakage already noted in the README. I used 2-harmonic tones in these tests rather than loosen assertions; real recordings will show this limit.
- Not done: Playwright is not installed here (no network), so the e2e for tuner/chord flows and the file-drop DOM path are unverified in a browser. Marked Day 6 as partial `[~]`.
- Next: add Playwright with a fake audio device and e2e flows (finish Day 6), then Day 7 polish.
