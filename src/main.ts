import { startMic } from "./mic";
import { PitchSmoother } from "./dsp/smoothing";
import { A4_MAX, A4_MIN, PRESETS, clampA4, nearestString } from "./dsp/presets";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const noteEl = $("note");
const detailEl = $("detail");
const targetEl = $("target");
const button = $<HTMLButtonElement>("toggle");
const errorEl = $("error");
const gauge = $("gauge");
const needle = $("needle");
const presetEl = $<HTMLSelectElement>("preset");
const a4El = $<HTMLInputElement>("a4");

const IN_TUNE_CENTS = 5;
const smoother = new PitchSmoother();
let stop: (() => void) | null = null;
let a4 = 440;

for (const p of PRESETS) presetEl.add(new Option(p.name, p.id));
a4El.min = String(A4_MIN);
a4El.max = String(A4_MAX);

a4El.addEventListener("change", () => {
  a4 = clampA4(Number(a4El.value));
  a4El.value = String(a4);
  smoother.setA4(a4);
});

function showCents(cents: number | null): void {
  gauge.classList.toggle("active", cents !== null);
  const c = cents === null ? 0 : Math.max(-50, Math.min(50, cents));
  gauge.classList.toggle(
    "in-tune",
    cents !== null && Math.abs(cents) <= IN_TUNE_CENTS,
  );
  needle.style.left = `${50 + c}%`;
  gauge.setAttribute("aria-valuenow", String(Math.round(c)));
}

function idle(message: string): void {
  noteEl.textContent = "–";
  detailEl.textContent = message;
  targetEl.textContent = "";
  showCents(null);
}

button.addEventListener("click", async () => {
  if (stop) {
    stop();
    stop = null;
    smoother.reset();
    button.textContent = "Start listening";
    idle("Press start and play a single note.");
    return;
  }
  errorEl.hidden = true;
  try {
    stop = await startMic((r) => {
      const note = smoother.push(r ? r.frequency : null);
      if (!note || !r) return idle("Listening…");
      const preset = PRESETS.find((p) => p.id === presetEl.value)!;
      const match = nearestString(r.frequency, preset, a4);
      noteEl.textContent = `${note.name}${note.octave}`;
      const c = Math.round(note.cents);
      detailEl.textContent = `${r.frequency.toFixed(1)} Hz · ${c > 0 ? "+" : ""}${c} cents`;
      if (match) {
        const mc = Math.round(match.cents);
        targetEl.textContent = `String ${match.string.label} (${match.targetFrequency.toFixed(1)} Hz): ${
          Math.abs(mc) <= IN_TUNE_CENTS
            ? "in tune"
            : mc > 0
              ? `${mc} cents sharp`
              : `${-mc} cents flat`
        }`;
        showCents(match.cents);
      } else {
        targetEl.textContent = "";
        showCents(note.cents);
      }
    });
    button.textContent = "Stop";
    detailEl.textContent = "Listening…";
  } catch {
    errorEl.textContent =
      "Microphone unavailable. Allow access in your browser and try again.";
    errorEl.hidden = false;
  }
});
