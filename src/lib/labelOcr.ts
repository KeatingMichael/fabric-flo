import { createWorker, PSM, type Worker } from "tesseract.js";

const LABEL_CHAR_WHITELIST =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,/Xx-'\"#";
const DIGIT_WHITELIST = "0123456789";
const LETTER_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ";
const SIZE_WHITELIST = "0123456789Xx'\" ";

const SOLID_ALIASES = new Set([
  "OB",
  "OOB",
  "OOL",
  "SOUD",
  "SOID",
  "SOLD",
  "S0LID",
  "SO0D",
  "5OLID",
  "SOL1D",
  "SOLID",
]);

const FABRIC_KEYWORDS = [
  "SOLID",
  "DUVET",
  "VELVET",
  "MUSLIN",
  "BOUNCE",
  "CHROMA",
  "BLACK",
  "WHITE",
  "FOAM",
  "GRID",
  "SILK",
  "SATIN",
  "SCRIM",
  "NET",
];

const GUIDE_INSET_TOP = 0.12;
const GUIDE_INSET_BOTTOM = 0.12;
const GUIDE_INSET_LEFT = 0.1;
const GUIDE_INSET_RIGHT = 0.1;

type OcrAttempt = {
  text: string;
  confidence: number;
  labelScore: number;
};

export type LabelOcrFields = {
  job: string;
  fabric: string;
  size: string;
};

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

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);
  return canvas;
}

function scaleCanvas(source: HTMLCanvasElement, targetLongEdge: number): HTMLCanvasElement {
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

function scaleCanvasWidth(source: HTMLCanvasElement, widthFactor: number): HTMLCanvasElement {
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

function averageLuminance(source: HTMLCanvasElement): number {
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

function buildLabelVariants(source: HTMLCanvasElement): HTMLCanvasElement[] {
  const scaled = scaleCanvas(source, 4000);
  const dark = averageLuminance(scaled) < 95;
  const variants = [
    preprocessLabelBinarize(source),
    preprocessLabelContrast(source),
    scaled,
    preprocessLabelBinarize(source, true),
  ];
  if (dark) variants.unshift(preprocessLabelInverted(source));
  return variants;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[m]![n]!;
}

function normalizeLine(raw: string): string {
  return raw
    .replace(/\r/g, "\n")
    .replace(/[×]/g, "X")
    .replace(/[''´`]/g, "'")
    .replace(/[^A-Za-z0-9 .,'"Xx\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreReadableLine(line: string): number {
  const trimmed = line.trim();
  if (trimmed.length < 2) return 0;
  const alnum = trimmed.replace(/[^A-Za-z0-9]/g, "").length;
  if (alnum < 2) return 0;
  const ratio = alnum / trimmed.length;
  if (ratio < 0.45) return 0;
  let score = ratio * 70;
  if (trimmed.length >= 3 && trimmed.length <= 36) score += 12;
  if (/^\d{3,}$/.test(trimmed.replace(/\s/g, ""))) score += 18;
  if (/^[A-Za-z]{3,}$/.test(trimmed.replace(/\s/g, ""))) score += 12;
  return score;
}

function findInkLineBands(source: HTMLCanvasElement): { y: number; h: number }[] {
  const prepped = preprocessLabelBinarize(source);
  const ctx = prepped.getContext("2d");
  if (!ctx) return [];
  const { data, width, height } = ctx.getImageData(0, 0, prepped.width, prepped.height);
  const rowInk = new Uint32Array(height);
  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4]! < 128) count++;
    }
    rowInk[y] = count;
  }

  const minInk = Math.max(4, Math.floor(width * 0.008));
  const raw: { start: number; end: number }[] = [];
  let inBand = false;
  let start = 0;
  for (let y = 0; y < height; y++) {
    if (rowInk[y]! >= minInk) {
      if (!inBand) {
        inBand = true;
        start = y;
      }
    } else if (inBand) {
      inBand = false;
      if (y - start >= Math.max(10, height * 0.035)) raw.push({ start, end: y });
    }
  }
  if (inBand && height - start >= 10) raw.push({ start, end: height });

  const merged: { start: number; end: number }[] = [];
  for (const band of raw) {
    const last = merged[merged.length - 1];
    if (last && band.start - last.end < height * 0.035) {
      last.end = band.end;
    } else {
      merged.push({ ...band });
    }
  }

  return merged
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .slice(0, 4)
    .sort((a, b) => a.start - b.start)
    .map((band) => ({
      y: Math.max(0, band.start - Math.round(height * 0.02)),
      h: Math.min(
        height - band.start,
        band.end - band.start + Math.round(height * 0.04)
      ),
    }));
}

function cropInkBand(source: HTMLCanvasElement, band: { y: number; h: number }): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = Math.max(1, band.h);
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, band.y, source.width, band.h, 0, 0, out.width, out.height);
  return out;
}

function thickenBinary(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;
  const src = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      if (src[i]! >= 128) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = ((y + dy) * width + (x + dx)) * 4;
          data[j] = 0;
          data[j + 1] = 0;
          data[j + 2] = 0;
        }
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function cropVerticalBand(
  source: HTMLCanvasElement,
  yStartFraction: number,
  heightFraction: number
): HTMLCanvasElement {
  const y = Math.round(source.height * yStartFraction);
  const h = Math.max(1, Math.round(source.height * heightFraction));
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = Math.min(h, source.height - y);
  out.getContext("2d")!.drawImage(source, 0, y, source.width, out.height, 0, 0, source.width, out.height);
  return out;
}

function isPlausibleJobDigits(digits: string): boolean {
  if (digits.length < 4 || digits.length > 8) return false;
  const unique = new Set(digits).size;
  if (digits.length >= 6 && unique <= 2) return false;
  if (/^(\d{1,4})\1{2,}/.test(digits)) return false;
  return true;
}

function extractBestJobNumber(text: string): string | null {
  const normalized = text.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1");
  const runs = (normalized.match(/\d+/g) ?? []).filter(isPlausibleJobDigits);
  runs.sort((a, b) => scoreJobDigits(b) - scoreJobDigits(a));
  if (runs[0]) return runs[0];
  return lettersToJobDigits(text);
}

function lettersToJobDigits(line: string): string | null {
  const compact = line.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{4,8}$/.test(compact)) return null;
  const map: Record<string, string> = {
    O: "0",
    Q: "0",
    D: "0",
    I: "1",
    L: "1",
    N: "1",
    M: "1",
    T: "1",
    Z: "2",
    E: "3",
    A: "4",
    S: "5",
    B: "8",
    G: "6",
    P: "9",
  };
  let out = "";
  for (const ch of compact) {
    out += map[ch] ?? ch;
  }
  if (/^\d{4,8}$/.test(out)) return out;
  return null;
}

function repairJobLine(line: string): string {
  const trimmed = normalizeLine(line);
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 4 && digits.length <= 8) return digits;
  const fromLetters = lettersToJobDigits(trimmed);
  if (fromLetters) return fromLetters;
  return trimmed;
}

function normalizeFabricLine(line: string): string {
  const trimmed = normalizeLine(line).replace(/^\d+\s+/, "");
  if (!trimmed) return "";
  const upper = trimmed.toUpperCase().replace(/\s+/g, " ").trim();
  const compact = upper.replace(/[^A-Z]/g, "");
  if (SOLID_ALIASES.has(compact)) return "SOLID";
  return upper;
}

function repairFabricLine(line: string): string {
  const normalized = normalizeFabricLine(line);
  if (normalized.includes(" ") && normalized.length >= 5) return normalized;
  const compact = normalized.replace(/[^A-Z]/g, "");
  if (SOLID_ALIASES.has(compact)) return "SOLID";
  if (/^O+L+$|^SO?L+$|^SOU?D$|^S0LID$|^OB$|^OOB$/i.test(compact)) return "SOLID";
  const keyword = extractFabricKeyword(normalized);
  if (keyword && levenshtein(compact, keyword) <= 1) return keyword;
  return normalized;
}

function repairSizeLineStrict(line: string): string {
  const trimmed = normalizeLine(line);
  return extractDimensions(trimmed) ?? trimmed;
}

function repairSizeLine(line: string, rawContext = ""): string {
  const trimmed = normalizeLine(line);
  let direct = extractDimensions(trimmed);
  if (direct) {
    const matched = direct.match(/^(\d+)' X (\d+)'$/);
    if (matched && matched[1] === matched[2] && matched[1]!.length === 1 && Number(matched[1]!) <= 3) {
      const ctxSize = extractDimensions(rawContext);
      if (ctxSize) {
        const ctxMatched = ctxSize.match(/^(\d+)' X (\d+)'$/);
        if (ctxMatched && ctxMatched[1] !== ctxMatched[2]) return ctxSize;
        if (ctxMatched && ctxMatched[1]!.length >= 2) return ctxSize;
      }
    }
    return direct;
  }

  const partial = trimmed.match(/^(\d)\s*'?\s*[xX]\s*'?\s*(\d{1,2})'?$/);
  if (partial) {
    const tail = partial[2]!;
    if (tail.length === 2) return `${tail}' X ${tail}'`;
    return `${partial[1]}' X ${tail}'`;
  }

  const digits = trimmed.match(/\d+/g);
  if (digits?.length === 2 && digits[0] === digits[1]) {
    return `${digits[0]}' X ${digits[1]}'`;
  }

  return trimmed;
}

function extractJobNumber(text: string): string | null {
  return extractBestJobNumber(text);
}

function extractFabricKeyword(text: string): string | null {
  const upper = text.toUpperCase();
  const compact = upper.replace(/[^A-Z]/g, "");
  for (const kw of FABRIC_KEYWORDS) {
    if (upper.includes(kw) || compact.includes(kw)) return kw;
  }
  for (const kw of FABRIC_KEYWORDS) {
    if (kw.length < 4) continue;
    for (let i = 0; i <= compact.length - kw.length; i++) {
      const slice = compact.slice(i, i + kw.length);
      if (levenshtein(slice, kw) <= 1) return kw;
    }
  }
  const words = upper.match(/[A-Z]{3,}/g) ?? [];
  for (const word of words) {
    for (const kw of FABRIC_KEYWORDS) {
      if (levenshtein(word, kw) <= 1) return kw;
    }
  }
  return null;
}

function extractDimensions(text: string): string | null {
  const normalized = text.replace(/[×]/g, "X").replace(/[''´`]/g, "'");
  const direct = normalized.match(/(\d{1,3})\s*'?\s*[xX]\s*'?\s*(\d{1,3})/);
  if (direct) {
    const a = direct[1]!;
    const b = direct[2]!;
    if (a.length === 1 && b.length === 2 && Number(b) >= 8) {
      return `${b}' X ${b}'`;
    }
    return `${a}' X ${b}'`;
  }
  const spaced = normalized.match(/\b(\d{1,2})\s+(\d{1,2})\b/);
  if (spaced) {
    return `${spaced[1]}' X ${spaced[2]}'`;
  }
  return null;
}

function scoreLabelText(text: string): number {
  if (!text.trim()) return 0;
  let score = 0;
  const parts = text.split("/").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (/^\d{4,8}$/.test(part.replace(/\s/g, ""))) score += 45;
    if (FABRIC_KEYWORDS.includes(part.toUpperCase())) score += 40;
    if (/\d+\s*'?\s*X\s*\d+'?/i.test(part)) score += 40;
    score += scoreReadableLine(part) * 0.35;
  }
  if (parts.length >= 2) score += 15;
  if (parts.length >= 3) score += 10;
  for (const part of parts) {
    if (part.length === 2 && !FABRIC_KEYWORDS.includes(part.toUpperCase())) score -= 25;
  }
  const noiseWords = parts.join(" ").match(/\b[A-Za-z]{2,3}\b/g) ?? [];
  score -= noiseWords.length * 8;
  return score;
}

/** Pull structured sticker fields out of noisy OCR text. */
export function extractLabelFields(raw: string): string {
  const blob = normalizeLine(raw.replace(/\n/g, " "));
  const tokens: string[] = [];

  const job = extractJobNumber(blob);
  if (job) tokens.push(job);

  const fabric = extractFabricKeyword(blob);
  if (fabric && !tokens.includes(fabric)) tokens.push(fabric);

  const size = extractDimensions(blob);
  if (size && !tokens.includes(size)) tokens.push(size);

  return tokens.join(" / ");
}

function repairLabelParts(lines: string[], rawContext = ""): string {
  if (!lines.length && !rawContext) return "";

  if (lines.length >= 3) {
    return [
      repairJobLine(lines[0]!),
      repairFabricLine(lines[1]!),
      repairSizeLine(lines[2]!, rawContext),
    ].join(" / ");
  }

  if (lines.length === 2) {
    const secondIsSize = Boolean(extractDimensions(lines[1]!) || /\d/.test(lines[1]!));
    if (secondIsSize) {
      return [repairJobLine(lines[0]!), repairSizeLine(lines[1]!, rawContext)].join(" / ");
    }
    return [repairJobLine(lines[0]!), repairFabricLine(lines[1]!)].join(" / ");
  }

  const context = `${rawContext}\n${lines.join("\n")}`;
  const tokens: string[] = [];

  const job =
    extractBestJobNumber(context) ??
    (lines[0] ? repairJobLine(lines[0]) : null);
  if (job && job.replace(/\D/g, "").length >= 4) tokens.push(job.replace(/\D/g, ""));

  const fabric =
    extractFabricKeyword(context) ??
    (lines[1] ? repairFabricLine(lines[1]) : lines[0] ? repairFabricLine(lines[0]) : null);
  if (fabric && !tokens.includes(fabric)) tokens.push(fabric);

  const size =
    extractDimensions(context) ??
    (lines[2] ? repairSizeLine(lines[2]) : lines[1] ? repairSizeLine(lines[1]) : null);
  if (size && !tokens.includes(size)) tokens.push(size);

  if (tokens.length >= 2) return tokens.join(" / ");

  const repaired = lines.map((line, index) => {
    if (index === 0) return repairJobLine(line);
    if (index === 1 && lines.length >= 2) return repairFabricLine(line);
    if (index >= 2) return repairSizeLine(line);
    return normalizeLine(line);
  });
  return repaired.filter(Boolean).join(" / ");
}

function joinReadableLines(lines: string[]): string {
  const kept = lines
    .map((line) => normalizeLine(line))
    .filter((line) => scoreReadableLine(line) >= 28);
  if (kept.length >= 2) return repairLabelParts(kept, "");
  if (kept.length === 1 && kept[0]!.length >= 3) return kept[0]!;
  return "";
}

/** Drop OCR noise; keep lines that look like human writing or rental sticker fields. */
export function cleanLabelOcrText(raw: string): string {
  const structured = extractLabelFields(raw);
  if (scoreLabelText(structured) >= 70) return structured;

  const normalized = raw
    .replace(/\r/g, "\n")
    .replace(/[×]/g, "X")
    .replace(/[''´`]/g, "'");

  const lineCandidates = normalized
    .split(/\n/)
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  const readableLines = joinReadableLines(lineCandidates);
  if (readableLines && scoreLabelText(readableLines) >= 40) return readableLines;

  const kept = lineCandidates.filter((line) => scoreReadableLine(line) >= 35);
  if (kept.length >= 1) {
    return repairLabelParts(kept);
  }

  if (structured) return structured;

  const fallback = normalizeLine(normalized.replace(/\n/g, " "));
  return fallback.length >= 3 ? fallback : "";
}

function splitIntoStrips(source: HTMLCanvasElement, count: number): HTMLCanvasElement[] {
  const strips: HTMLCanvasElement[] = [];
  const overlap = Math.round(source.height * 0.08);
  const stripH = Math.ceil(source.height / count);
  const bg = averageLuminance(source) < 128 ? "#000" : "#fff";

  for (let i = 0; i < count; i++) {
    const y = Math.max(0, i * stripH - (i > 0 ? overlap : 0));
    const h = Math.min(source.height - y, stripH + (i > 0 ? overlap : 0) + overlap);
    const strip = document.createElement("canvas");
    strip.width = source.width;
    strip.height = Math.max(1, h);
    const ctx = strip.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, strip.width, strip.height);
    ctx.drawImage(source, 0, y, source.width, h, 0, 0, source.width, h);
    strips.push(strip);
  }
  return strips;
}

async function ensembleDigitRead(worker: Worker, strip: HTMLCanvasElement): Promise<string> {
  const variants = [
    preprocessLabelBinarize(strip),
    thickenBinary(preprocessLabelBinarize(strip)),
    preprocessLabelContrast(strip),
    preprocessLabelBinarize(strip, true),
  ];
  const results: string[] = [];
  for (const variant of variants) {
    const digits = (await recognizeStripRaw(worker, variant, DIGIT_WHITELIST)).replace(/\D/g, "");
    if (digits.length >= 3) results.push(digits);
  }
  results.sort((a, b) => scoreJobDigits(b) - scoreJobDigits(a));
  return results.find((r) => isPlausibleJobDigits(r)) ?? "";
}

async function recognizeStripRaw(
  worker: Worker,
  source: HTMLCanvasElement,
  whitelist: string,
  psm: PSM = PSM.SINGLE_LINE
): Promise<string> {
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    tessedit_char_whitelist: whitelist,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });
  const {
    data: { text },
  } = await worker.recognize(source);
  return normalizeLine(text);
}

function bandVariants(band: HTMLCanvasElement): HTMLCanvasElement[] {
  return [
    band,
    scaleCanvasWidth(band, 1.8),
    scaleCanvas(band, 3200),
    preprocessLabelContrast(band),
    preprocessLabelBinarize(band),
    thickenBinary(preprocessLabelBinarize(band)),
  ];
}

function scoreFabricCandidate(text: string): number {
  const compact = text.toUpperCase().replace(/[^A-Z]/g, "");
  if (compact.length < 3) return 0;
  if (SOLID_ALIASES.has(compact)) return 100;
  for (const kw of FABRIC_KEYWORDS) {
    if (compact === kw) return 92;
    if (levenshtein(compact, kw) <= 1) return 82;
    if (levenshtein(compact, kw) === 2) return 55;
  }
  return scoreReadableLine(text);
}

function scoreJobDigits(digits: string): number {
  if (!isPlausibleJobDigits(digits)) return 0;
  let score = digits.length * 12;
  if (digits.length >= 5 && digits.length <= 6) score += 25;
  if (digits.length === 4) score += 8;
  return score;
}

function scoreSizeCandidate(size: string): number {
  const matched = size.match(/^(\d+)' X (\d+)'$/);
  if (!matched) return scoreReadableLine(size);
  let score = 30;
  if (matched[1] !== matched[2]) score += 20;
  if (matched[1] === matched[2]) score += 10;
  if (matched[1]!.length >= 2) score += 10;
  return score;
}

function pickBestJobFromCandidates(candidates: string[], rawContext: string): string {
  const digitRuns: string[] = [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if (isPlausibleJobDigits(digits)) digitRuns.push(digits);
    const fromLetters = lettersToJobDigits(candidate);
    if (fromLetters && isPlausibleJobDigits(fromLetters)) digitRuns.push(fromLetters);
  }
  const fromContext = extractBestJobNumber(rawContext);
  if (fromContext && isPlausibleJobDigits(fromContext)) digitRuns.push(fromContext);

  if (digitRuns.length) {
    digitRuns.sort((a, b) => scoreJobDigits(b) - scoreJobDigits(a));
    return digitRuns[0]!;
  }

  const labelReads = candidates.map(repairJobLine).filter(Boolean);
  for (const read of labelReads) {
    const digits = read.replace(/\D/g, "");
    if (isPlausibleJobDigits(digits)) return digits;
  }
  return labelReads[0] ?? "";
}

function pickBestFabricFromCandidates(candidates: string[]): string {
  const votes = new Map<string, number>();
  for (const candidate of candidates) {
    const repaired = repairFabricLine(candidate);
    const key = repaired.toUpperCase();
    votes.set(key, (votes.get(key) ?? 0) + scoreFabricCandidate(candidate));
  }
  let best = "";
  let bestScore = 0;
  for (const [fabric, score] of votes) {
    if (score > bestScore) {
      bestScore = score;
      best = fabric;
    }
  }
  return best || repairFabricLine(candidates[0] ?? "");
}

function pickBestSizeFromCandidates(candidates: string[], rawContext: string): string {
  const options = new Map<string, number>();
  for (const candidate of candidates) {
    const repaired = repairSizeLine(candidate, `${rawContext}\n${candidate}`);
    if (!repaired) continue;
    options.set(
      repaired,
      (options.get(repaired) ?? 0) + scoreSizeCandidate(repaired) + scoreReadableLine(candidate)
    );
  }
  const fromContext = extractDimensions(rawContext);
  if (fromContext) {
    options.set(fromContext, (options.get(fromContext) ?? 0) + scoreSizeCandidate(fromContext) + 15);
  }

  let best = "";
  let bestScore = 0;
  for (const [size, score] of options) {
    if (score > bestScore) {
      bestScore = score;
      best = size;
    }
  }
  return best || repairSizeLine(candidates[0] ?? "", rawContext);
}

async function readBandDigits(worker: Worker, band: HTMLCanvasElement): Promise<string[]> {
  const results: string[] = [];
  for (const variant of bandVariants(band)) {
    for (const psm of [PSM.SINGLE_LINE, PSM.SINGLE_WORD, PSM.RAW_LINE]) {
      const text = await recognizeStripRaw(worker, variant, DIGIT_WHITELIST, psm);
      const digits = text.replace(/\D/g, "");
      if (isPlausibleJobDigits(digits)) results.push(digits);
    }
    const ensemble = await ensembleDigitRead(worker, variant);
    if (ensemble.length >= 3) results.push(ensemble);
    const labelRead = await recognizeStripRaw(worker, variant, LABEL_CHAR_WHITELIST);
    if (labelRead) results.push(labelRead);
  }
  return results;
}

async function readBandFabric(worker: Worker, band: HTMLCanvasElement): Promise<string[]> {
  const results: string[] = [];
  for (const variant of bandVariants(band)) {
    const letters = await recognizeStripRaw(worker, variant, LETTER_WHITELIST);
    if (letters.length >= 3) results.push(letters);
    const gentle = await recognizeStripRaw(worker, preprocessLabelContrast(variant), LETTER_WHITELIST);
    if (gentle.length >= 3) results.push(gentle);
  }
  return results;
}

async function readBandSize(worker: Worker, band: HTMLCanvasElement): Promise<string[]> {
  const results: string[] = [];
  for (const variant of bandVariants(band)) {
    const size = await recognizeStripRaw(worker, variant, SIZE_WHITELIST);
    if (size.length >= 2) results.push(size);
    const digits = (await recognizeStripRaw(worker, variant, DIGIT_WHITELIST)).replace(/\D/g, "");
    if (digits.length >= 2) results.push(digits);
    const label = await recognizeStripRaw(worker, variant, LABEL_CHAR_WHITELIST);
    if (label) results.push(label);
  }
  return results;
}

async function runBandFieldOcr(
  worker: Worker,
  canvas: HTMLCanvasElement
): Promise<{ fields: LabelOcrFields; rawContext: string }> {
  const prepped = preprocessLabelContrast(scaleCanvas(canvas, 4000));
  const bands = findInkLineBands(prepped);
  const rawParts: string[] = [];

  let jobCandidates: string[] = [];
  let fabricCandidates: string[] = [];
  let sizeCandidates: string[] = [];

  if (bands.length >= 2) {
    const jobBand = cropInkBand(prepped, bands[0]!);
    jobCandidates = await readBandDigits(worker, jobBand);
    rawParts.push(...jobCandidates);

    if (bands.length >= 2) {
      const fabricBand = cropInkBand(prepped, bands[1]!);
      fabricCandidates = await readBandFabric(worker, fabricBand);
      rawParts.push(...fabricCandidates);
    }

    if (bands.length >= 3) {
      const sizeBand = cropInkBand(prepped, bands[2]!);
      sizeCandidates = await readBandSize(worker, sizeBand);
      rawParts.push(...sizeCandidates);
    }
  }

  const jobBandFallback = cropVerticalBand(canvas, 0, 0.36);
  jobCandidates.push(...(await readBandDigits(worker, jobBandFallback)));

  const fabricBandFallback = cropVerticalBand(canvas, 0.28, 0.36);
  fabricCandidates.push(...(await readBandFabric(worker, fabricBandFallback)));

  const sizeBandFallback = cropVerticalBand(canvas, 0.58, 0.38);
  sizeCandidates.push(...(await readBandSize(worker, sizeBandFallback)));

  const rawContext = rawParts.join("\n");
  return {
    rawContext,
    fields: {
      job: pickBestJobFromCandidates(jobCandidates, rawContext),
      fabric: pickBestFabricFromCandidates(fabricCandidates),
      size: pickBestSizeFromCandidates(sizeCandidates, rawContext),
    },
  };
}

async function ocrStripLine(
  worker: Worker,
  strip: HTMLCanvasElement,
  index: number,
  total: number
): Promise<string> {
  const candidates: string[] = [await recognizeStripRaw(worker, strip, LABEL_CHAR_WHITELIST)];

  if (index === 0) {
    const ensemble = await ensembleDigitRead(worker, strip);
    if (ensemble.length >= 4) candidates.push(ensemble);
  }

  if (index === 0) {
    const digits = (await recognizeStripRaw(worker, strip, DIGIT_WHITELIST)).replace(/\D/g, "");
    if (digits.length >= 4) candidates.push(digits);
  }

  if (index === 1 || (total === 2 && index === 0)) {
    const letters = await recognizeStripRaw(worker, strip, LETTER_WHITELIST);
    if (letters.length >= 3) candidates.push(letters);
  }

  if (index >= total - 1) {
    const size = await recognizeStripRaw(worker, strip, SIZE_WHITELIST);
    if (size.length >= 3) candidates.push(size);
  }

  const normalized = candidates.map((c) => normalizeLine(c)).filter(Boolean);
  if (!normalized.length) return "";

  if (index === 0) {
    return normalized
      .map(repairJobLine)
      .sort((a, b) => b.replace(/\D/g, "").length - a.replace(/\D/g, "").length)[0]!;
  }

  if (index === 1 && total >= 2) {
    const repaired = normalized.map(repairFabricLine);
    repaired.sort((a, b) => {
      const aKw = FABRIC_KEYWORDS.includes(a.toUpperCase()) ? 1 : 0;
      const bKw = FABRIC_KEYWORDS.includes(b.toUpperCase()) ? 1 : 0;
      return bKw - aKw || scoreReadableLine(b) - scoreReadableLine(a);
    });
    return repaired[0]!;
  }

  if (index >= 2) {
    const repaired = normalized.map((line) => repairSizeLine(line));
    repaired.sort((a, b) => scoreLabelText(b) - scoreLabelText(a));
    return repaired[0]!;
  }

  return normalized.sort((a, b) => scoreReadableLine(b) - scoreReadableLine(a))[0]!;
}

async function runOcrPass(
  worker: Worker,
  source: HTMLCanvasElement,
  psm: PSM,
  rawOnly = false
): Promise<OcrAttempt & { raw: string }> {
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    tessedit_char_whitelist: LABEL_CHAR_WHITELIST,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });
  const {
    data: { text, confidence },
  } = await worker.recognize(source);
  const cleaned = rawOnly ? normalizeLine(text) : cleanLabelOcrText(text);
  const labelScore = scoreLabelText(cleaned) + (rawOnly ? 0 : scoreLabelText(extractLabelFields(text)));
  return {
    text: cleaned,
    confidence: cleaned ? confidence : 0,
    labelScore,
    raw: text,
  };
}

async function runStripOcr(
  worker: Worker,
  processed: HTMLCanvasElement,
  stripCount: number
): Promise<OcrAttempt> {
  const bands = findInkLineBands(processed);
  const strips =
    bands.length >= 2
      ? bands.map((band) => cropInkBand(processed, band))
      : splitIntoStrips(processed, stripCount);
  const lines: string[] = [];

  for (let i = 0; i < strips.length; i++) {
    const strip = strips[i]!;
    const line = await ocrStripLine(worker, strip, i, strips.length);
    if (line.length >= 2) lines.push(line);
  }

  const text = repairLabelParts(lines, "");
  return {
    text,
    confidence: text ? 75 : 0,
    labelScore: scoreLabelText(text),
  };
}

function pickBestAttempt(attempts: OcrAttempt[]): string {
  const viable = attempts.filter((a) => a.text.length >= 2);
  if (!viable.length) return "";
  viable.sort((a, b) => {
    const scoreA = a.labelScore * 3 + a.confidence + a.text.length;
    const scoreB = b.labelScore * 3 + b.confidence + b.text.length;
    return scoreB - scoreA;
  });
  const best = viable[0]!.text;
  const parts = best.split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const repaired = repairLabelParts(parts, best);
    if (scoreLabelText(repaired) >= scoreLabelText(best)) return repaired;
  }
  const structured = extractLabelFields(best);
  return scoreLabelText(structured) > scoreLabelText(best) ? structured : best;
}

/** Run OCR on a captured label photo; returns the three sticker lines separately. */
export async function recognizeLabelFieldsFromImage(
  source: HTMLCanvasElement | HTMLImageElement | string,
  jpegDataUrl?: string
): Promise<LabelOcrFields> {
  let canvas: HTMLCanvasElement;
  if (typeof source === "string") {
    const img = await loadImage(source);
    canvas = imageToCanvas(img);
  } else if (source instanceof HTMLImageElement) {
    canvas = imageToCanvas(source);
  } else {
    canvas = source;
  }

  canvas = autoCropLabelRegion(canvas);
  const dataUrl = jpegDataUrl ?? canvas.toDataURL("image/jpeg", 0.95);

  const cloudDataUrl = shrinkJpegForCloud(canvas, dataUrl);

  if (typeof navigator !== "undefined" && navigator.onLine) {
    const { recognizeLabelFieldsCloud } = await import("@/lib/labelOcrCloud");
    const cloud = await recognizeLabelFieldsCloud(cloudDataUrl);
    if (cloud && (cloud.job || cloud.fabric || cloud.size)) {
      const cloudLooksGood =
        !looksLikeWeakFabricLine(cloud.fabric) && !looksLikeWeakSizeLine(cloud.size);
      if (looksLikeWeakJobLine(cloud.job) && cloudLooksGood) {
        const localJob = await recognizeJobDigitsLocal(canvas);
        const localDigits = localJob.replace(/\D/g, "");
        if (isPlausibleJobDigits(localDigits)) {
          cloud.job = localDigits;
        }
      }
      return cloud;
    }
  }

  return recognizeLabelFieldsLocal(canvas);
}

/** Keep cloud OCR images under OCR.space free-tier size limit (~1 MB). */
function shrinkJpegForCloud(canvas: HTMLCanvasElement, preferred?: string): string {
  const maxBase64 = 1_300_000;
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

/** Digit-only pass on the top sticker line (local Tesseract). */
async function recognizeJobDigitsLocal(canvas: HTMLCanvasElement): Promise<string> {
  const worker = await createWorker("eng", 1, { logger: () => {} });
  try {
    const jobBand = cropVerticalBand(canvas, 0, 0.4);
    const candidates: string[] = [];
    for (const variant of [
      jobBand,
      scaleCanvasWidth(jobBand, 2),
      preprocessLabelBinarize(jobBand),
      thickenBinary(preprocessLabelBinarize(jobBand)),
      preprocessLabelContrast(jobBand),
    ]) {
      for (const psm of [PSM.SINGLE_LINE, PSM.SINGLE_WORD, PSM.RAW_LINE]) {
        const digits = (await recognizeStripRaw(worker, variant, DIGIT_WHITELIST, psm)).replace(
          /\D/g,
          ""
        );
        if (digits.length >= 4) candidates.push(digits);
      }
      const ensemble = await ensembleDigitRead(worker, variant);
      if (ensemble.length >= 4) candidates.push(ensemble);
    }
    return pickBestJobFromCandidates(candidates, candidates.join("\n"));
  } finally {
    await worker.terminate();
  }
}

async function recognizeLabelFieldsLocal(canvas: HTMLCanvasElement): Promise<LabelOcrFields> {
  const variants = buildLabelVariants(canvas);
  const worker = await createWorker("eng", 1, { logger: () => {} });
  const attempts: OcrAttempt[] = [];
  const rawChunks: string[] = [];

  try {
    const bandResult = await runBandFieldOcr(worker, canvas);
    rawChunks.push(bandResult.rawContext);

    const jobBand = cropVerticalBand(canvas, 0, 0.38);
    for (const variant of [
      preprocessLabelBinarize(jobBand),
      thickenBinary(preprocessLabelBinarize(jobBand)),
      preprocessLabelContrast(jobBand),
    ]) {
      const digits = (await recognizeStripRaw(worker, variant, DIGIT_WHITELIST)).replace(/\D/g, "");
      rawChunks.push(digits);
      if (digits.length >= 4) {
        attempts.push({
          text: digits,
          confidence: 80,
          labelScore: scoreLabelText(digits),
        });
      }
    }

    for (const variant of variants) {
      const strip3 = await runStripOcr(worker, variant, 3);
      attempts.push(strip3);
      rawChunks.push(strip3.text);

      const block = await runOcrPass(worker, variant, PSM.SINGLE_BLOCK);
      attempts.push(block);
      rawChunks.push(block.raw);

      if (attempts.length <= 4) {
        attempts.push(await runStripOcr(worker, variant, 4));
      }
    }

    const allRaw = rawChunks.join("\n");
    const merged = pickBestAttempt(attempts);
    const mergedParts = splitLabelIntoFields(merged, allRaw);

    const fields: LabelOcrFields = {
      job:
        pickBestJobFromCandidates(
          [bandResult.fields.job, mergedParts.job, ...rawChunks],
          allRaw
        ) || bandResult.fields.job,
      fabric:
        pickBestFabricFromCandidates([
          bandResult.fields.fabric,
          mergedParts.fabric,
          ...attempts.flatMap((a) => a.text.split("/").map((p) => p.trim())),
        ]) || bandResult.fields.fabric,
      size:
        pickBestSizeFromCandidates(
          [bandResult.fields.size, mergedParts.size, ...rawChunks],
          allRaw
        ) || bandResult.fields.size,
    };

    if (!fields.job && !fields.fabric && !fields.size) {
      return bandResult.fields;
    }
    return fields;
  } finally {
    await worker.terminate();
  }
}

/** Run OCR on a captured label photo (canvas, image, or data URL). */
export async function recognizeLabelFromImage(
  source: HTMLCanvasElement | HTMLImageElement | string
): Promise<string> {
  const fields = await recognizeLabelFieldsFromImage(source);
  return joinLabelFields(fields.job, fields.fabric, fields.size);
}

function scoreParsedLabelFields(fields: LabelOcrFields): number {
  let score = 0;
  const jobDigits = fields.job.replace(/\D/g, "");
  if (isPlausibleJobDigits(jobDigits)) score += 50;
  if (fields.fabric.length >= 3) score += 35;
  if (extractDimensions(fields.size)) score += 35;
  return score;
}

function assignLinesByContent(lines: string[]): LabelOcrFields {
  const sizeLine = lines.find((line) => extractDimensions(line));
  const jobLine = lines.find((line) => {
    const digits = line.replace(/\D/g, "");
    return isPlausibleJobDigits(digits);
  });
  const fabricParts = lines.filter((line) => line !== sizeLine && line !== jobLine);

  return {
    job: jobLine ? pickBestJobFromCandidates([jobLine], jobLine) : "",
    fabric: fabricParts.map(normalizeFabricLine).filter(Boolean).join(" ").trim(),
    size: sizeLine ? repairSizeLineStrict(sizeLine) : "",
  };
}

/** Parse multi-line OCR (e.g. Google Vision) into sticker fields. */
export function parseRawTextToLabelFields(rawText: string): LabelOcrFields {
  const lines = rawText
    .split(/\n/)
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  if (lines.length >= 3) {
    const positional: LabelOcrFields = {
      job: pickBestJobFromCandidates([lines[0]!], lines[0]!),
      fabric: normalizeFabricLine(lines[1]!),
      size: repairSizeLineStrict(lines[2]!),
    };
    const byContent = assignLinesByContent(lines);
    return scoreParsedLabelFields(byContent) > scoreParsedLabelFields(positional)
      ? byContent
      : positional;
  }

  if (lines.length === 2) {
    return assignLinesByContent(lines);
  }

  if (lines.length === 1) {
    return assignLinesByContent(lines);
  }

  return { job: "", fabric: "", size: "" };
}

/** True when line 1 probably still needs a human fix. */
export function looksLikeWeakJobLine(job: string): boolean {
  return !isPlausibleJobDigits(job.replace(/\D/g, ""));
}

export function looksLikeWeakFabricLine(fabric: string): boolean {
  return fabric.trim().length < 3;
}

export function looksLikeWeakSizeLine(size: string): boolean {
  return !extractDimensions(size);
}

/** Split combined label OCR into the three common sticker lines. */
export function splitLabelIntoFields(
  text: string,
  _rawContext = ""
): { job: string; fabric: string; size: string } {
  const parts = text.split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return {
      job: pickBestJobFromCandidates([parts[0]!], parts[0]!),
      fabric: normalizeFabricLine(parts[1]!),
      size: repairSizeLineStrict(parts[2]!),
    };
  }
  return {
    job: pickBestJobFromCandidates(parts.length ? [parts[0]!] : [], parts[0] ?? ""),
    fabric: parts[1] ? normalizeFabricLine(parts[1]) : "",
    size: parts[2] ? repairSizeLineStrict(parts.slice(2).join(" ")) : "",
  };
}

export function joinLabelFields(job: string, fabric: string, size: string): string {
  return [job, fabric, size]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" / ");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image."));
    img.src = src;
  });
}

function imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare image.");
  ctx.drawImage(img, 0, 0);
  return canvas;
}
