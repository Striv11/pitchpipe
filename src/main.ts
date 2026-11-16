import { startMic } from "./mic";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const noteEl = $("note");
const detailEl = $("detail");
const button = $<HTMLButtonElement>("toggle");
const errorEl = $("error");

let stop: (() => void) | null = null;

button.addEventListener("click", async () => {
  if (stop) {
    stop();
    stop = null;
    button.textContent = "Start listening";
    noteEl.textContent = "–";
    detailEl.textContent = "Press start and play a single note.";
    return;
  }
  errorEl.hidden = true;
  try {
    stop = await startMic((r) => {
      if (!r) return void (detailEl.textContent = "Listening…");
      noteEl.textContent = `${r.note.name}${r.note.octave}`;
      const c = Math.round(r.note.cents);
      detailEl.textContent = `${r.frequency.toFixed(1)} Hz · ${c > 0 ? "+" : ""}${c} cents`;
    });
    button.textContent = "Stop";
    detailEl.textContent = "Listening…";
  } catch {
    errorEl.textContent =
      "Microphone unavailable. Allow access in your browser and try again.";
    errorEl.hidden = false;
  }
});
