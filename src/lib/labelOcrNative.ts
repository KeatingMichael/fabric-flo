/** Plan E — on-device label OCR (Capacitor native app). */

import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  looksLikeWeakFabricLine,
  looksLikeWeakJobLine,
  looksLikeWeakSizeLine,
  parseRawTextToLabelFields,
  polishLabelFields,
  type LabelOcrFields,
} from "@/lib/labelOcr";

export interface FabricLabelOcrPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  recognizeLabel(options: { base64: string }): Promise<{
    job: string;
    fabric: string;
    size: string;
    rawText: string;
  }>;
}

const FabricLabelOcr = registerPlugin<FabricLabelOcrPlugin>("FabricLabelOcr", {
  web: () => import("./labelOcrNative.web").then((m) => new m.FabricLabelOcrWeb()),
});

let availability: boolean | null = null;

async function nativeAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (availability !== null) return availability;
  try {
    const { available } = await FabricLabelOcr.isAvailable();
    availability = available;
    return available;
  } catch {
    availability = false;
    return false;
  }
}

function isStrongNativeFields(fields: LabelOcrFields): boolean {
  if (!fields.job && !fields.fabric && !fields.size) return false;
  return (
    !looksLikeWeakJobLine(fields.job) &&
    !looksLikeWeakFabricLine(fields.fabric) &&
    !looksLikeWeakSizeLine(fields.size)
  );
}

/** Run Apple Vision / ML Kit when the native app is installed. */
export async function recognizeLabelOnDevice(base64: string): Promise<LabelOcrFields | null> {
  if (!(await nativeAvailable())) return null;
  try {
    const result = await FabricLabelOcr.recognizeLabel({ base64 });
    const raw = result.rawText?.trim() || [result.job, result.fabric, result.size].filter(Boolean).join("\n");
    const parsed = parseRawTextToLabelFields(raw);
    const fields = polishLabelFields(raw, {
      job: result.job || parsed.job,
      fabric: result.fabric || parsed.fabric,
      size: result.size || parsed.size,
    });
    return isStrongNativeFields(fields) || hasAny(fields) ? fields : null;
  } catch {
    return null;
  }
}

function hasAny(fields: LabelOcrFields): boolean {
  return Boolean(fields.job || fields.fabric || fields.size);
}
