import { startMic } from "./mic";
import { detectPitch } from "./dsp/pitch";
import { PitchSmoother } from "./dsp/smoothing";
import { ChordEngine } from "./dsp/chordEngine";
import { A4_MAX, A4_MIN, PRESETS, clampA4, nearestString } from "./dsp/presets";
import { ChordHistory } from "./history";
import { resolveShortcut } from "./shortcuts";
import { micErrorMessage } from "./errors";
import { analyzeChords, mixToMono } from "./analyze";

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
const tunerSection = $("tuner");
const chordsSection = $("chords");
const chordEl = $("chord");
const chordDetailEl = $("chord-detail");
const historyEl = $("history");
const modeButtons = { tuner: $("mode-tuner"), chords: $("mode-chords") };

const IN_TUNE_CENTS = 5;
const MIN_SEGMENT_MS = 300;
const smoother = new PitchSmoother();
const engine = new ChordEngine();
const history = new ChordHistory();
let stop: (() => void) | null = null;
let starting = false;
let a4 = 440;
let mode: "tuner" | "chords" = "tuner";

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

function idleTuner(message: string): void {
  noteEl.textContent = "–";
  detailEl.textContent = message;
  targetEl.textContent = "";
  showCents(null);
}

function idleChord(message: string): void {
  chordEl.textContent = "–";
  chordDetailEl.textContent = message;
}

function renderHistory(): void {
  const segs = history.segments(MIN_SEGMENT_MS).slice(-12);
  historyEl.replaceChildren();
  if (segs.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Chords you play will appear here.";
    historyEl.append(li);
    return;
  }
  for (const s of segs) {
    const li = document.createElement("li");
    li.textContent = s.name;
    li.title = `${((s.end - s.start) / 1000).toFixed(1)} s`;
    historyEl.append(li);
  }
}

function tunerFrame(frame: Float32Array, sampleRate: number): void {
  // YIN is O(N·tau): the newest 4096 samples are plenty.
  const p = detectPitch(frame.subarray(frame.length - 4096), sampleRate);
  const note = smoother.push(p ? p.frequency : null);
  if (!note || !p) return idleTuner("Listening…");
  const preset = PRESETS.find((x) => x.id === presetEl.value)!;
  const match = nearestString(p.frequency, preset, a4);
  noteEl.textContent = `${note.name}${note.octave}`;
  const c = Math.round(note.cents);
  detailEl.textContent = `${p.frequency.toFixed(1)} Hz · ${c > 0 ? "+" : ""}${c} cents`;
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
}

function chordFrame(frame: Float32Array, sampleRate: number): void {
  const r = engine.push(frame, sampleRate);
  history.push(r ? r.chord.name : null, performance.now());
  if (r) {
    chordEl.textContent = r.chord.name;
    chordDetailEl.textContent = `${Math.round(r.score * 100)}% match`;
  } else {
    idleChord("Listening…");
  }
  renderHistory();
}

function setMode(next: "tuner" | "chords"): void {
  if (next === mode) return;
  mode = next;
  tunerSection.hidden = mode !== "tuner";
  chordsSection.hidden = mode !== "chords";
  for (const [k, b] of Object.entries(modeButtons))
    b.setAttribute("aria-pressed", String(k === mode));
  smoother.reset();
  engine.reset();
  idleTuner(stop ? "Listening…" : "Press start and play a single note.");
  idleChord(stop ? "Listening…" : "Press start and play a chord or a song.");
}

function setButton(label: string, disabled = false): void {
  button.replaceChildren(label + " ");
  const kbd = document.createElement("kbd");
  kbd.textContent = "Space";
  button.append(kbd);
  button.disabled = disabled;
}

async function toggle(): Promise<void> {
  if (starting) return;
  if (stop) {
    stop();
    stop = null;
    smoother.reset();
    engine.reset();
    setButton("Start listening");
    idleTuner("Press start and play a single note.");
    idleChord("Press start and play a chord or a song.");
    return;
  }
  errorEl.hidden = true;
  starting = true;
  setButton("Waiting for microphone…", true);
  try {
    stop = await startMic((frame, sr) =>
      mode === "tuner" ? tunerFrame(frame, sr) : chordFrame(frame, sr),
    );
    setButton("Stop");
    idleTuner("Listening…");
    idleChord("Listening…");
  } catch (err) {
    errorEl.textContent = micErrorMessage(err);
    errorEl.hidden = false;
    setButton("Start listening");
  } finally {
    starting = false;
  }
}

button.addEventListener("click", () => void toggle());
modeButtons.tuner.addEventListener("click", () => setMode("tuner"));
modeButtons.chords.addEventListener("click", () => setMode("chords"));
document.addEventListener("keydown", (e) => {
  const action = resolveShortcut({
    key: e.key,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
    target: e.target as HTMLElement | null,
  });
  if (!action) return;
  e.preventDefault();
  if (action === "toggle") void toggle();
  else setMode(action);
});

const fileInput = $<HTMLInputElement>("file");
const dropEl = $("drop");
const fileStatus = $("file-status");
const fileResult = $("file-result");

const fmt = (t: number) =>
  `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

async function analyseFile(file: File): Promise<void> {
  fileResult.replaceChildren();
  fileStatus.textContent = `Analysing ${file.name}…`;
  let ctx: AudioContext | null = null;
  try {
    ctx = new AudioContext();
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const mono = mixToMono(
      Array.from({ length: buf.numberOfChannels }, (_, i) =>
        buf.getChannelData(i),
      ),
    );
    // Yield once so the status text paints before the synchronous analysis.
    await new Promise((r) => setTimeout(r, 0));
    const segs = analyzeChords(mono, buf.sampleRate);
    fileStatus.textContent = segs.length
      ? `${segs.length} chord segments in ${fmt(buf.duration)}.`
      : "No chords recognised in this file.";
    for (const s of segs) {
      const li = document.createElement("li");
      li.textContent = `${s.name} ${fmt(s.start)}`;
      li.title = `${s.start.toFixed(1)}–${s.end.toFixed(1)} s`;
      fileResult.append(li);
    }
  } catch (err) {
    fileStatus.textContent =
      err instanceof RangeError
        ? err.message.replace(/^/, "Cannot analyse: ")
        : "Could not decode this file. Try a WAV, MP3 or OGG.";
  } finally {
    void ctx?.close();
  }
}

fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (f) void analyseFile(f);
});
dropEl.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropEl.classList.add("over");
});
dropEl.addEventListener("dragleave", () => dropEl.classList.remove("over"));
dropEl.addEventListener("drop", (e) => {
  e.preventDefault();
  dropEl.classList.remove("over");
  const f = e.dataTransfer?.files[0];
  if (f) void analyseFile(f);
});
