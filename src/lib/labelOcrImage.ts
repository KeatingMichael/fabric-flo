/** Label image prep for cloud scan — no tesseract (keeps Scan off the heavy OCR chunk). */

const GUIDE_INSET_TOP = 0.08;
const GUIDE_INSET_BOTTOM = 0.08;
const GUIDE_INSET_LEFT = 0.08;
const GUIDE_INSET_RIGHT = 0.08;

/** Crop camera frame to the on-screen viewfinder guide (accounts for object-fit: cover). */
export function cropVideoFrameToGuide(video: HTMLVideoElement): HTMLCanvasElement {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = video.clientWidth || vw;
  const ch = video.clientHeight || vh;

  const videoAspect = vw / vh;
  const containerAspect = cw / ch;

  let visibleX: number;
  let visibleY: number;
  let visibleW: number;
  let visibleH: number;

  if (videoAspect > containerAspect) {
    visibleH = vh;
    visibleW = vh * containerAspect;
    visibleX = (vw - visibleW) / 2;
    visibleY = 0;
  } else {
    visibleW = vw;
    visibleH = vw / containerAspect;
    visibleX = 0;
    visibleY = (vh - visibleH) / 2;
  }

  const cropX = visibleX + visibleW * GUIDE_INSET_LEFT;
  const cropY = visibleY + visibleH * GUIDE_INSET_TOP;
  const cropW = visibleW * (1 - GUIDE_INSET_LEFT - GUIDE_INSET_RIGHT);
  const cropH = visibleH * (1 - GUIDE_INSET_TOP - GUIDE_INSET_BOTTOM);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cropW));
  canvas.height = Math.max(1, Math.round(cropH));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not crop frame.");
  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Tight crop to ink on a light surface — skips rug, table, and case background. */
export function autoCropLabelRegion(source: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = source.getContext("2d");
  if (!ctx) return source;
  const { data, width, height } = ctx.getImageData(0, 0, source.width, source.height);

  const grayAt = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
  };

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grayAt(x, y) >= 118) continue;

      let neighSum = 0;
      let neighN = 0;
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          neighSum += grayAt(nx, ny);
          neighN++;
        }
      }
      if (!neighN || neighSum / neighN < 145) continue;

      found = true;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (!found || maxX - minX < 24 || maxY - minY < 16) return source;

  const padX = Math.round((maxX - minX) * 0.1);
  const padY = Math.round((maxY - minY) * 0.12);
  const x = Math.max(0, minX - padX);
  const y = Math.max(0, minY - padY);
  const w = Math.min(width - x, maxX - minX + padX * 2);
  const h = Math.min(height - y, maxY - minY + padY * 2);

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(source, x, y, w, h, 0, 0, w, h);
  return out;
}

/** Crop to the white/cream paper label — skips rug and table around it. */
export function cropToWhiteLabel(source: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = source.getContext("2d");
  if (!ctx) return source;
  const { data, width, height } = ctx.getImageData(0, 0, source.width, source.height);

  const isPaper = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    return r > 145 && g > 145 && b > 135 && r + g + b > 430;
  };

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let paperPixels = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 400));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (!isPaper(x, y)) continue;
      paperPixels++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (paperPixels < 80 || maxX - minX < 48 || maxY - minY < 48) return source;

  const padX = Math.round((maxX - minX) * 0.04);
  const padY = Math.round((maxY - minY) * 0.05);
  const x = Math.max(0, minX - padX);
  const y = Math.max(0, minY - padY);
  const w = Math.min(width - x, maxX - minX + padX * 2);
  const h = Math.min(height - y, maxY - minY + padY * 2);

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(source, x, y, w, h, 0, 0, w, h);
  return out;
}

/** Guide crop → white label crop → scale for cloud OCR. */
export function prepareLabelScanCanvas(source: HTMLCanvasElement, targetLongEdge: number): HTMLCanvasElement {
  const label = cropToWhiteLabel(source);
  return scaleCanvas(label, targetLongEdge);
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);
  return canvas;
}

export function scaleCanvas(source: HTMLCanvasElement, targetLongEdge: number): HTMLCanvasElement {
  const scale = Math.max(1, targetLongEdge / Math.max(source.width, source.height));
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

export function scaleCanvasWidth(source: HTMLCanvasElement, widthFactor: number): HTMLCanvasElement {
  const w = Math.max(1, Math.round(source.width * widthFactor));
  const h = source.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

export function averageLuminance(source: HTMLCanvasElement): number {
  const ctx = source.getContext("2d");
  if (!ctx) return 180;
  const { data } = ctx.getImageData(0, 0, source.width, source.height);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 16) {
    sum += 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    count++;
  }
  return count ? sum / count : 180;
}

function otsuThreshold(histogram: Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i]!;
  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += histogram[t]!;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * histogram[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) ** 2;
    if (variance > maxVar) {
      maxVar = variance;
      threshold = t;
    }
  }
  return threshold;
}

function removeRuledLines(imageData: ImageData): void {
  const { data, width, height } = imageData;

  for (let y = 0; y < height; y++) {
    let lineLike = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const isInk = gray < 115;
      const isRuled =
        !isInk && gray > 145 && gray < 235 && (b > r + 8 || Math.abs(r - g) < 18);
      if (isRuled) lineLike++;
    }
    if (lineLike / width > 0.45) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const gray = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
        if (gray > 130) {
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
        }
      }
    }
  }
}

type ToneAdjust = {
  contrast?: number;
  invert?: boolean;
  removeRuled?: boolean;
  binarize?: boolean;
};

export function preprocessLabelContrast(source: HTMLCanvasElement): HTMLCanvasElement {
  return applyTonePipeline(source, { contrast: 2.2, binarize: false });
}

export function preprocessLabelBinarize(
  source: HTMLCanvasElement,
  removeRuled = false
): HTMLCanvasElement {
  return applyTonePipeline(source, { contrast: 2.4, binarize: true, removeRuled });
}

export function preprocessLabelInverted(source: HTMLCanvasElement): HTMLCanvasElement {
  return applyTonePipeline(source, { contrast: 2.3, invert: true, binarize: true });
}

export function preprocessLabelCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  return preprocessLabelContrast(source);
}

function applyTonePipeline(source: HTMLCanvasElement, tone: ToneAdjust): HTMLCanvasElement {
  const scaled = scaleCanvas(source, 4000);
  const canvas = cloneCanvas(scaled);
  const ctx = canvas.getContext("2d");
  if (!ctx) return scaled;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  if (tone.removeRuled) removeRuledLines(imageData);

  const contrast = tone.contrast ?? 2.2;
  const histogram = new Uint32Array(256);
  const grays = new Uint8Array(data.length / 4);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;
    if (tone.invert) gray = 255 - gray;
    gray = (gray - 128) * contrast + 128;
    gray = Math.max(0, Math.min(255, gray));
    grays[p] = gray;
    histogram[Math.round(gray)]!++;
  }

  const threshold = Math.min(otsuThreshold(histogram, grays.length), tone.binarize ? 165 : 255);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const value = tone.binarize ? (grays[p]! < threshold ? 0 : 255) : grays[p]!;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/** Crop a horizontal band — rental labels use top/middle/bottom lines. */
export function cropVerticalBand(
  source: HTMLCanvasElement,
  yStartFraction: number,
  heightFraction: number
): HTMLCanvasElement {
  const y = Math.max(0, Math.round(source.height * yStartFraction));
  const h = Math.max(1, Math.round(source.height * heightFraction));
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = Math.min(h, source.height - y);
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, y, source.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/** Standard three-band split for rental-house sticker layout. */
export function rentalLabelStrips(source: HTMLCanvasElement): [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement] {
  return [
    cropVerticalBand(source, 0.04, 0.30),
    cropVerticalBand(source, 0.32, 0.36),
    cropVerticalBand(source, 0.62, 0.36),
  ];
}

/** Keep cloud OCR images under OCR.space free-tier size limit (~1 MB). */
export function shrinkJpegForCloud(canvas: HTMLCanvasElement, preferred?: string): string {
  const maxBase64 = 900_000;
  const tryUrls = preferred ? [preferred] : [];
  for (const q of [0.92, 0.85, 0.75, 0.65, 0.55]) {
    tryUrls.push(canvas.toDataURL("image/jpeg", q));
  }
  for (const url of tryUrls) {
    const base64 = url.replace(/^data:image\/\w+;base64,/, "");
    if (base64.length <= maxBase64) return url;
  }
  return canvas.toDataURL("image/jpeg", 0.5);
}
