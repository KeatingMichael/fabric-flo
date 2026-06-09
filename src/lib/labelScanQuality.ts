/** Plan B — frame quality gate before OCR (scanner-style auto-capture). */

import { cropVideoFrameToGuide } from "@/lib/labelOcrImage";

export type LabelFrameQuality = {
  score: number;
  sharpness: number;
  brightEnough: boolean;
  labelPresent: boolean;
  /** White/cream paper as a fraction of the viewfinder (0–1). */
  paperFill: number;
  /** Label occupies too little of the frame — move closer. */
  labelTooFar: boolean;
  /** Label fills or touches frame edges — back up to avoid clipping. */
  labelTooClose: boolean;
  /** Safe to auto-capture or tap Scan. */
  readyToCapture: boolean;
};

export type LabelFrameHint =
  | "center"
  | "closer"
  | "back_up"
  | "hold_steady"
  | "tap_scan";

let sampleCanvas: HTMLCanvasElement | null = null;
let lastSampleAt = 0;

function isPaperPixel(r: number, g: number, b: number): boolean {
  return r > 118 && g > 118 && b > 108 && r + g + b > 360;
}

function isInkPixel(l: number): boolean {
  return l < 95;
}

/** Laplacian variance + paper bounds on viewfinder crop. */
export function assessLabelFrameQuality(video: HTMLVideoElement): LabelFrameQuality {
  if (!video.videoWidth || !video.videoHeight) {
    return emptyQuality();
  }

  if (!sampleCanvas) sampleCanvas = document.createElement("canvas");
  const canvas = sampleCanvas;
  const sampleW = 160;
  const sampleH = 120;
  canvas.width = sampleW;
  canvas.height = sampleH;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return emptyQuality();

  const guide = cropVideoFrameToGuide(video);
  ctx.drawImage(guide, 0, 0, sampleW, sampleH);
  const { data } = ctx.getImageData(0, 0, sampleW, sampleH);

  let lumSum = 0;
  let paperPixels = 0;
  let inkPixels = 0;
  let inkNearEdgeCount = 0;
  let minX = sampleW;
  let minY = sampleH;
  let maxX = 0;
  let maxY = 0;
  const gray = new Float32Array(sampleW * sampleH);
  const edgeMarginX = sampleW * 0.05;
  const edgeMarginY = sampleH * 0.05;

  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW; x++) {
      const i = (y * sampleW + x) * 4;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      const p = y * sampleW + x;
      gray[p] = l;
      lumSum += l;
      if (isPaperPixel(r, g, b)) {
        paperPixels++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      if (isInkPixel(l)) {
        inkPixels++;
        if (x <= edgeMarginX || x >= sampleW - edgeMarginX || y <= edgeMarginY || y >= sampleH - edgeMarginY) {
          inkNearEdgeCount++;
        }
      }
    }
  }

  const n = gray.length;
  const mean = lumSum / n;
  const brightEnough = mean >= 90 && mean <= 235;
  const paperFill = paperPixels / n;
  const labelPresent = paperFill > 0.12;

  const labelTooFar = labelPresent && paperFill < 0.16;
  const labelTooClose = labelPresent && inkPixels > 120 && inkNearEdgeCount > inkPixels * 0.22;

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
  const sharpEnough = sharpness >= 6;

  let score = 0;
  if (brightEnough) score += 28;
  if (labelPresent) score += 22;
  if (paperFill >= 0.22 && paperFill <= 0.75) score += 28;
  else if (paperFill >= 0.16) score += 18;
  score += Math.min(22, sharpness * 1.4);
  if (labelTooFar) score -= 25;
  if (labelTooClose) score -= 30;

  const readyToCapture =
    labelPresent &&
    brightEnough &&
    sharpEnough &&
    !labelTooFar &&
    !labelTooClose &&
    paperFill >= 0.18;

  return {
    score,
    sharpness,
    brightEnough,
    labelPresent,
    paperFill,
    labelTooFar,
    labelTooClose,
    readyToCapture,
  };
}

function emptyQuality(): LabelFrameQuality {
  return {
    score: 0,
    sharpness: 0,
    brightEnough: false,
    labelPresent: false,
    paperFill: 0,
    labelTooFar: false,
    labelTooClose: false,
    readyToCapture: false,
  };
}

export function hintForLabelFrameQuality(q: LabelFrameQuality): LabelFrameHint {
  if (!q.labelPresent) return "center";
  if (q.labelTooClose) return "back_up";
  if (q.labelTooFar) return "closer";
  if (q.readyToCapture) return "hold_steady";
  return "tap_scan";
}

export function hintTextForLabelFrame(hint: LabelFrameHint): string {
  switch (hint) {
    case "center":
      return "Center the white sticker in frame";
    case "closer":
      return "Move closer to the label";
    case "back_up":
      return "Back up slightly — keep all three lines in frame";
    case "hold_steady":
      return "Hold steady…";
    case "tap_scan":
      return "Tap Scan when all three lines are visible";
  }
}

/** Throttle quality checks to ~5 Hz. */
export function assessLabelFrameQualityThrottled(video: HTMLVideoElement): LabelFrameQuality | null {
  const now = Date.now();
  if (now - lastSampleAt < 180) return null;
  lastSampleAt = now;
  return assessLabelFrameQuality(video);
}

export const AUTO_CAPTURE_STABLE_MS = 320;
