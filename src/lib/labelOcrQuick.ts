import {
  preprocessLabelContrast,
  rentalLabelStrips,
  scaleCanvas,
} from "@/lib/labelOcrImage";
import { parseRawTextToLabelFields, type LabelOcrFields } from "@/lib/labelOcr";

const EMPTY: LabelOcrFields = { job: "", fabric: "", size: "" };
const DIGIT_WHITELIST = "0123456789";
const LETTER_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ";
const SIZE_WHITELIST = "0123456789Xx'\" ";

type TesseractModule = typeof import("tesseract.js");

async function loadTesseract(): Promise<TesseractModule> {
  return import("tesseract.js");
}

async function readStrip(
  worker: Awaited<ReturnType<TesseractModule["createWorker"]>>,
  PSM: TesseractModule["PSM"],
  strip: HTMLCanvasElement,
  whitelist: string
): Promise<string> {
  const enhanced = preprocessLabelContrast(scaleCanvas(strip, 1200));
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    tessedit_char_whitelist: whitelist,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });
  const {
    data: { text },
  } = await worker.recognize(enhanced);
  return text.replace(/\s+/g, " ").trim();
}

function fieldsFromStrips(jobRaw: string, fabricRaw: string, sizeRaw: string): LabelOcrFields {
  const fromLines = parseRawTextToLabelFields([jobRaw, fabricRaw, sizeRaw].filter(Boolean).join("\n"));
  const jobDigits = jobRaw.replace(/\D/g, "");
  return {
    job: jobDigits.length >= 4 ? jobDigits : fromLines.job || jobRaw.replace(/\D/g, ""),
    fabric: (fabricRaw || fromLines.fabric).toUpperCase().trim(),
    size: (sizeRaw || fromLines.size).trim(),
  };
}

/** Three-line rental sticker read — tuned for job / fabric / size rows. */
export async function threeLineLabelRead(source: HTMLCanvasElement): Promise<LabelOcrFields> {
  const { createWorker, PSM } = await loadTesseract();
  const scaled = scaleCanvas(source, 2600);
  const [jobStrip, fabricStrip, sizeStrip] = rentalLabelStrips(scaled);
  const worker = await createWorker("eng", 1, { logger: () => {} });

  try {
    const jobRaw = await readStrip(worker, PSM, jobStrip, DIGIT_WHITELIST);
    const fabricRaw = await readStrip(worker, PSM, fabricStrip, LETTER_WHITELIST);
    const sizeRaw = await readStrip(worker, PSM, sizeStrip, SIZE_WHITELIST);
    return fieldsFromStrips(jobRaw, fabricRaw, sizeRaw);
  } catch {
    return EMPTY;
  } finally {
    await worker.terminate();
  }
}

/** Block read fallback when strip layout fails. */
export async function blockLabelRead(source: HTMLCanvasElement): Promise<LabelOcrFields | null> {
  const { createWorker, PSM } = await loadTesseract();
  const scaled = scaleCanvas(source, 2400);
  const worker = await createWorker("eng", 1, { logger: () => {} });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });
    const {
      data: { text },
    } = await worker.recognize(preprocessLabelContrast(scaled));
    const fields = parseRawTextToLabelFields(text);
    if (!fields.job && !fields.fabric && !fields.size) return null;
    return fields;
  } catch {
    return null;
  } finally {
    await worker.terminate();
  }
}

export async function readLabelBlockFast(source: HTMLCanvasElement): Promise<LabelOcrFields> {
  const block = await blockLabelRead(source);
  return block ?? EMPTY;
}

export async function readLabelOnPhone(source: HTMLCanvasElement): Promise<LabelOcrFields> {
  const stripFields = await threeLineLabelRead(source);
  if (stripFields.job && stripFields.fabric && stripFields.size) return stripFields;
  return stripFields;
}

export function mergeLabelFields(primary: LabelOcrFields, fallback: LabelOcrFields | null): LabelOcrFields {
  if (!fallback) return primary;
  return {
    job: primary.job || fallback.job,
    fabric: primary.fabric || fallback.fabric,
    size: primary.size || fallback.size,
  };
}

export function hasAnyLabelField(fields: LabelOcrFields): boolean {
  return Boolean(fields.job || fields.fabric || fields.size);
}

export function stripBase64Payload(source: HTMLCanvasElement): string[] {
  return rentalLabelStrips(source).map((strip) => {
    const url = strip.toDataURL("image/jpeg", 0.88);
    return url.replace(/^data:image\/\w+;base64,/, "");
  });
}

export { EMPTY as EMPTY_LABEL_FIELDS };
