/**
 * Starts microphone capture; calls onFrame ~20x/s with the latest 8192
 * samples. Returns a stop function. This is the only module that touches
 * Web Audio.
 */
export const FRAME_SIZE = 8192;

export async function startMic(
  onFrame: (frame: Float32Array, sampleRate: number) => void,
): Promise<() => void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error("getUserMedia unavailable"), {
      name: "UnsupportedError",
    });
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = FRAME_SIZE;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    onFrame(buf, ctx.sampleRate);
  }, 50);
  return () => {
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };
}
