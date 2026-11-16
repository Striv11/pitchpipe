import { detectPitch } from "./dsp/pitch";
import { noteFromFrequency, type NoteInfo } from "./dsp/notes";

export interface Reading {
  frequency: number;
  clarity: number;
  note: NoteInfo;
}

/** Starts microphone capture; calls onReading ~20x/s. Returns a stop function. */
export async function startMic(
  onReading: (r: Reading | null) => void,
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 4096;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    const p = detectPitch(buf, ctx.sampleRate);
    onReading(p && { ...p, note: noteFromFrequency(p.frequency) });
  }, 50);
  return () => {
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };
}
