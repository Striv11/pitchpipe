# Work log

Newest entries at the bottom. Each entry records what actually changed, what was learned, and what comes next.

## 2026-11-16 — Day 1

- Chose a ★ consumer idea (chord & pitch detector) in TypeScript; picked the name `pitchpipe`.
- Scaffolded Vite + TypeScript + vitest + eslint + prettier; `check.sh` runs format check, lint, typecheck, tests and a production build. CI and a GitHub Pages workflow are in place.
- Implemented radix-2 FFT, Hann window, YIN pitch detection with parabolic interpolation, and frequency→note/cents mapping, with 18 tests on synthetic signals (sines, harmonic tones, noise, silence).
- Added a minimal mic tuner page to prove the pipeline end to end.
- Not yet verified in a real browser with a real microphone; Day 6 adds Playwright with a fake audio device.
- Next: smoothing, gauge UI, instrument presets and adjustable A4 (Day 2).
