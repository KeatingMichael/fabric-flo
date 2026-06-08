import { scaleCanvas } from "@/lib/labelOcrImage";
import { parseRawTextToLabelFields, type LabelOcrFields } from "@/lib/labelOcr";

const EMPTY: LabelOcrFields = { job: "", fabric: "", size: "" };

/** One fast on-phone read when cloud OCR misses — lazy-loads tesseract only here. */
export async function quickLocalLabelRead(source: HTMLCanvasElement): Promise<LabelOcrFields | null> {
  const { createWorker, PSM } = await import("tesseract.js");
  const scaled = scaleCanvas(source, 2200);
  const worker = await createWorker("eng", 1, { logger: () => {} });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });
    const {
      data: { text },
    } = await worker.recognize(scaled);
    const fields = parseRawTextToLabelFields(text);
    if (!fields.job && !fields.fabric && !fields.size) return null;
    return fields;
  } catch {
    return null;
  } finally {
    await worker.terminate();
  }
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

export { EMPTY as EMPTY_LABEL_FIELDS };
