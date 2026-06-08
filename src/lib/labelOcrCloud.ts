import {
  autoCropLabelRegion,
  preprocessLabelContrast,
  scaleCanvas,
  shrinkJpegForCloud,
} from "@/lib/labelOcrImage";
import {
  looksLikeWeakFabricLine,
  looksLikeWeakJobLine,
  looksLikeWeakSizeLine,
  parseRawTextToLabelFields,
  type LabelOcrFields,
} from "@/lib/labelOcr";
import { getSupabase } from "@/lib/supabase";

type LabelOcrResponse = {
  text?: string;
  error?: string;
};

export type LabelOcrCloudStatus =
  | "success"
  | "partial"
  | "no_text"
  | "timeout"
  | "not_signed_in"
  | "offline"
  | "error";

export type LabelOcrCloudOutcome = {
  fields: LabelOcrFields;
  status: LabelOcrCloudStatus;
};

export type LabelScanOutcome = LabelOcrCloudOutcome & { message: string };

const CLOUD_OCR_TIMEOUT_MS = 10_000;
const SCAN_CLOUD_MAX_EDGE = 1600;
const EMPTY_FIELDS: LabelOcrFields = { job: "", fabric: "", size: "" };

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      window.setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

function scoreFields(fields: LabelOcrFields): LabelOcrCloudStatus {
  const hasAny = Boolean(fields.job || fields.fabric || fields.size);
  if (!hasAny) return "no_text";
  const weak =
    looksLikeWeakJobLine(fields.job) ||
    looksLikeWeakFabricLine(fields.fabric) ||
    looksLikeWeakSizeLine(fields.size);
  return weak ? "partial" : "success";
}

function isInvokeTransportError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("MIME type") ||
    msg.includes("Failed to fetch") ||
    msg.includes("Load failed") ||
    msg.includes("NetworkError")
  );
}

/** Fast cloud-only label read for Scan — bundled here (no lazy chunk). */
export async function scanLabelFromCapture(
  source: HTMLCanvasElement,
  jpegDataUrl?: string
): Promise<LabelScanOutcome> {
  const canvas = autoCropLabelRegion(source);
  const ocrCanvas = preprocessLabelContrast(scaleCanvas(canvas, SCAN_CLOUD_MAX_EDGE));
  const cloudDataUrl = shrinkJpegForCloud(
    ocrCanvas,
    jpegDataUrl ?? ocrCanvas.toDataURL("image/jpeg", 0.88)
  );
  const outcome = await recognizeLabelFieldsCloudWithStatus(cloudDataUrl);
  return {
    ...outcome,
    message: labelScanStatusMessage(outcome.status, outcome.fields),
  };
}

/** Cloud label OCR with explicit status — used by Scan (no slow phone-side OCR). */
export async function recognizeLabelFieldsCloudWithStatus(
  jpegDataUrl: string
): Promise<LabelOcrCloudOutcome> {
  if (!navigator.onLine) {
    return { fields: EMPTY_FIELDS, status: "offline" };
  }
  return withTimeout(recognizeLabelFieldsCloudInner(jpegDataUrl), CLOUD_OCR_TIMEOUT_MS, {
    fields: EMPTY_FIELDS,
    status: "timeout",
  });
}

/** @deprecated Use recognizeLabelFieldsCloudWithStatus */
export async function recognizeLabelFieldsCloud(jpegDataUrl: string): Promise<LabelOcrFields | null> {
  const outcome = await recognizeLabelFieldsCloudWithStatus(jpegDataUrl);
  if (outcome.status === "not_signed_in" || outcome.status === "offline" || outcome.status === "timeout") {
    return null;
  }
  if (!outcome.fields.job && !outcome.fields.fabric && !outcome.fields.size) {
    return null;
  }
  return outcome.fields;
}

async function recognizeLabelFieldsCloudInner(jpegDataUrl: string): Promise<LabelOcrCloudOutcome> {
  const sb = getSupabase();
  if (!sb) {
    return { fields: EMPTY_FIELDS, status: "error" };
  }

  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) {
    return { fields: EMPTY_FIELDS, status: "not_signed_in" };
  }

  const base64 = jpegDataUrl.replace(/^data:image\/\w+;base64,/, "");
  if (!base64) {
    return { fields: EMPTY_FIELDS, status: "error" };
  }

  try {
    const { data, error } = await sb.functions.invoke<LabelOcrResponse>("label-ocr", {
      body: { imageBase64: base64 },
    });

    if (error) {
      console.warn("label-ocr invoke error:", error);
      if (isInvokeTransportError(error)) {
        return { fields: EMPTY_FIELDS, status: "error" };
      }
      const msg = typeof error.message === "string" ? error.message : "";
      if (msg.includes("401") || msg.includes("not_authenticated")) {
        return { fields: EMPTY_FIELDS, status: "not_signed_in" };
      }
      return { fields: EMPTY_FIELDS, status: "error" };
    }
    if (data?.error === "vision_not_configured") return { fields: EMPTY_FIELDS, status: "error" };
    if (!data?.text?.trim()) return { fields: EMPTY_FIELDS, status: "no_text" };

    const fields = parseRawTextToLabelFields(data.text);
    return { fields, status: scoreFields(fields) };
  } catch (e) {
    if (isInvokeTransportError(e)) {
      return { fields: EMPTY_FIELDS, status: "error" };
    }
    return { fields: EMPTY_FIELDS, status: "error" };
  }
}

export function labelScanStatusMessage(
  status: LabelOcrCloudStatus,
  fields: LabelOcrFields
): string {
  switch (status) {
    case "offline":
      return "You're offline — type the label below.";
    case "not_signed_in":
      return "Sign in from Home for camera reading, or type below.";
    case "timeout":
      return "That took too long. Try Scan again with the label filling the frame.";
    case "error":
      return "Couldn't read the label. Refresh the page or type it below.";
    case "no_text":
      return "No text spotted — brighter light helps, or type it below.";
    case "partial": {
      const parts = [fields.job, fields.fabric, fields.size].filter(Boolean);
      return parts.length
        ? `Got some of it — double-check the fields below.`
        : "Almost — fill in the fields below.";
    }
    case "success": {
      const parts = [fields.job, fields.fabric, fields.size].filter(Boolean);
      return parts.length
        ? `Nice — looks good. Tap Add to Log when ready.`
        : "Check the fields below, then add to log.";
    }
  }
}
