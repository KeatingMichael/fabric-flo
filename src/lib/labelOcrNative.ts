/** Plan E — on-device label OCR (Capacitor native app). */

import { Capacitor, registerPlugin } from "@capacitor/core";
import {
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

async function nativeAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { available } = await FabricLabelOcr.isAvailable();
    return available;
  } catch {
    return false;
  }
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
    if (!hasAny(fields)) return null;
    return fields;
  } catch {
    return null;
  }
}

function hasAny(fields: LabelOcrFields): boolean {
  return Boolean(fields.job || fields.fabric || fields.size);
}
