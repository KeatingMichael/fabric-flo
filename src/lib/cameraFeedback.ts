/** Short camera-shutter click via Web Audio (works after a user tap). */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

export function playCameraShutter(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    void ctx.resume();

    const duration = 0.09;
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const click = Math.random() * 2 - 1;
      const envelope = Math.exp(-t * 55);
      const tone = Math.sin(2 * Math.PI * 920 * t) * Math.exp(-t * 80);
      data[i] = (click * 0.55 + tone * 0.45) * envelope;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.42;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } catch {
    /* ignore — silent fallback */
  }
}
