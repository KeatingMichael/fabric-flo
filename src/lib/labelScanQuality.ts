/** Plan B — frame quality gate before OCR (scanner-style auto-capture). */

import { cropVideoFrameToGuide } from "@/lib/labelOcrImage";

export type LabelFrameQuality = {
  score: number;
  sharpness: number;
  brightEnough: boolean;
  labelPresent: boolean;
};

let sampleCanvas: HTMLCanvasElement | null = null;
let lastSampleAt = 0;

/** Laplacian variance + paper detection on viewfinder crop. */
export function assessLabelFrameQuality(video: HTMLVideoElement): LabelFrameQuality {
  if (!video.videoWidth || !video.videoHeight) {
    return { score: 0, sharpness: 0, brightEnough: false, labelPresent: false };
  }

  if (!sampleCanvas) sampleCanvas = document.createElement("canvas");
  const canvas = sampleCanvas;
  const sampleW = 160;
  const sampleH = 120;
  canvas.width = sampleW;
  canvas.height = sampleH;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { score: 0, sharpness: 0, brightEnough: false, labelPresent: false };
  }

  const guide = cropVideoFrameToGuide(video);
  ctx.drawImage(guide, 0, 0, sampleW, sampleH);
  const { data } = ctx.getImageData(0, 0, sampleW, sampleH);

  let lumSum = 0;
  let paperPixels = 0;
  const gray = new Float32Array(sampleW * sampleH);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[p] = l;
    lumSum += l;
    if (r > 145 && g > 145 && b > 135 && r + g + b > 430) paperPixels++;
  }

  const n = gray.length;
  const mean = lumSum / n;
  const brightEnough = mean >= 95 && mean <= 230;
  const labelPresent = paperPixels / n > 0.18;

  let lapSum = 0;
  let lapCount = 0;
  for (let y = 1; y < sampleH - 1; y++) {
    for (let x = 1; x < sampleW - 1; x++) {
      const c = gray[y * sampleW + x]!;
      const lap = Math.abs(
        -4 * c +
          gray[y * sampleW + (x - 1)]! +
          gray[y * sampleW + (x + 1)]! +
          gray[(y - 1) * sampleW + x]! +
          gray[(y + 1) * sampleW + x]!
      );
      lapSum += lap;
      lapCount++;
    }
  }

  const sharpness = lapCount ? lapSum / lapCount : 0;
  let score = 0;
  if (brightEnough) score += 30;
  if (labelPresent) score += 35;
  score += Math.min(35, sharpness * 1.8);

  return { score, sharpness, brightEnough, labelPresent };
}

/** Throttle quality checks to ~5 Hz. */
export function assessLabelFrameQualityThrottled(video: HTMLVideoElement): LabelFrameQuality | null {
  const now = Date.now();
  if (now - lastSampleAt < 180) return null;
  lastSampleAt = now;
  return assessLabelFrameQuality(video);
}

export const AUTO_CAPTURE_QUALITY_THRESHOLD = 68;
export const AUTO_CAPTURE_STABLE_MS = 320;
