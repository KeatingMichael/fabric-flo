import { createWorker, PSM, type Worker } from "tesseract.js";

/** Characters we expect on rental-house stickers and Sharpie labels. */
const LABEL_CHAR_WHITELIST =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,/Xx-'\"#";

type OcrAttempt = {
  text: string;
  confidence: number;
};

/** Scale up, boost contrast, and binarize — helps blue ink on lined paper. */
export function preprocessLabelCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const targetLongEdge = 1800;
  const scale = Math.max(1.5, targetLongEdge / Math.max(source.width, source.height));
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;

  ctx.drawImage(source, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;
    gray = (gray - 128) * 2.1 + 128;
    gray = Math.max(0, Math.min(255, gray));
    const bit = gray < 145 ? 0 : 255;
    data[i] = bit;
    data[i + 1] = bit;
    data[i + 2] = bit;
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function scoreCleanedLine(line: string): number {
  const trimmed = line.trim();
  if (!trimmed) return 0;
  const alnum = trimmed.replace(/[^A-Za-z0-9]/g, "").length;
  if (alnum < 2) return 0;
  const ratio = alnum / trimmed.length;
  let score = ratio * 100;
  if (/^\d{4,}$/.test(trimmed.replace(/\s/g, ""))) score += 25;
  if (/solid|duvet|velvet|muslin|bounce|chroma|black|white/i.test(trimmed)) score += 20;
  if (/\d+\s*[xX×]\s*\d+/.test(trimmed)) score += 20;
  return score;
}

/** Drop OCR noise; keep lines that look like sticker IDs, fabric names, or sizes. */
export function cleanLabelOcrText(raw: string): string {
  const normalized = raw
    .replace(/\r/g, "\n")
    .replace(/[×]/g, "X")
    .replace(/[''´`]/g, "'");

  const lineCandidates = normalized
    .split(/\n/)
    .map((line) =>
      line
        .replace(/[^A-Za-z0-9 .,'"Xx\-/]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);

  const kept = lineCandidates.filter((line) => scoreCleanedLine(line) >= 45);

  if (kept.length >= 1) {
    return kept.join(" / ");
  }

  const blob = normalized.replace(/\s+/g, " ");
  const tokens: string[] = [];
  const digitRuns = blob.match(/\d{3,}/g);
  if (digitRuns) tokens.push(...digitRuns);
  const words = blob.match(/[A-Za-z]{4,}/g);
  if (words) {
    for (const w of words) {
      if (/^(SOLID|DUVET|VELVET|MUSLIN|BOUNCE|CHROMA|BLACK|WHITE|FOAM)$/i.test(w)) {
        tokens.push(w.toUpperCase());
      }
    }
  }
  const sizeMatch = blob.match(/\d+\s*[xX]\s*\d+/);
  if (sizeMatch) tokens.push(sizeMatch[0].replace(/\s+/g, " ").toUpperCase());

  if (tokens.length) return tokens.join(" / ");

  const fallback = blob
    .replace(/[^A-Za-z0-9 .,'"Xx\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return fallback.length >= 3 ? fallback : "";
}

async function runOcrPass(
  worker: Worker,
  source: HTMLCanvasElement,
  psm: PSM
): Promise<OcrAttempt> {
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    tessedit_char_whitelist: LABEL_CHAR_WHITELIST,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });
  const {
    data: { text, confidence },
  } = await worker.recognize(source);
  const cleaned = cleanLabelOcrText(text);
  return {
    text: cleaned,
    confidence: cleaned ? confidence : 0,
  };
}

function pickBestAttempt(attempts: OcrAttempt[]): string {
  const viable = attempts.filter((a) => a.text.length >= 3);
  if (!viable.length) return "";
  viable.sort((a, b) => {
    const scoreA = a.confidence + a.text.length * 2;
    const scoreB = b.confidence + b.text.length * 2;
    return scoreB - scoreA;
  });
  return viable[0]!.text;
}

/** Run OCR on a captured label photo (canvas, image, or data URL). */
export async function recognizeLabelFromImage(
  source: HTMLCanvasElement | HTMLImageElement | string
): Promise<string> {
  let canvas: HTMLCanvasElement;
  if (typeof source === "string") {
    const img = await loadImage(source);
    canvas = imageToCanvas(img);
  } else if (source instanceof HTMLImageElement) {
    canvas = imageToCanvas(source);
  } else {
    canvas = source;
  }

  const preprocessed = preprocessLabelCanvas(canvas);
  const worker = await createWorker("eng", 1, { logger: () => {} });

  try {
    const attempts = await Promise.all([
      runOcrPass(worker, preprocessed, PSM.SINGLE_BLOCK),
      runOcrPass(worker, preprocessed, PSM.SINGLE_COLUMN),
      runOcrPass(worker, preprocessed, PSM.SPARSE_TEXT),
      runOcrPass(worker, canvas, PSM.SINGLE_BLOCK),
    ]);
    return pickBestAttempt(attempts);
  } finally {
    await worker.terminate();
  }
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
