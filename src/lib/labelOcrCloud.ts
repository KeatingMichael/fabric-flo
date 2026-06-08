import { autoCropLabelRegion, scaleCanvas, shrinkJpegForCloud } from "@/lib/labelOcrImage";
import {
  looksLikeWeakFabricLine,
  looksLikeWeakJobLine,
  looksLikeWeakSizeLine,
  parseRawTextToLabelFields,
  type LabelOcrFields,
} from "@/lib/labelOcr";
import {
  hasAnyLabelField,
  mergeLabelFields,
  quickLocalLabelRead,
} from "@/lib/labelOcrQuick";
import { FunctionsHttpError, getSupabase } from "@/lib/supabase";

type LabelOcrResponse = {
  text?: string;
  error?: string;
  rawText?: string;
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

export type ScanReadPhase = "cloud" | "phone";

const CLOUD_OCR_TIMEOUT_MS = 12_000;
const SCAN_CLOUD_MAX_EDGE = 2400;
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
  if (!hasAnyLabelField(fields)) return "no_text";
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

async function readInvokePayload(
  data: LabelOcrResponse | null | undefined,
  error: unknown
): Promise<LabelOcrResponse | null> {
  if (data && (data.text !== undefined || data.error !== undefined || data.rawText !== undefined)) {
    return data;
  }
  if (error instanceof FunctionsHttpError) {
    try {
      return (await error.context.json()) as LabelOcrResponse;
    } catch {
      return null;
    }
  }
  return data ?? null;
}

function fieldsFromPayload(payload: LabelOcrResponse | null): LabelOcrFields {
  if (!payload) return EMPTY_FIELDS;
  const raw = payload.text?.trim() || payload.rawText?.trim() || "";
  if (!raw) return EMPTY_FIELDS;
  return parseRawTextToLabelFields(raw);
}

function outcomeFromPayload(payload: LabelOcrResponse | null): LabelOcrCloudOutcome {
  if (!payload) {
    return { fields: EMPTY_FIELDS, status: "error" };
  }
  if (payload.error === "vision_not_configured") {
    return { fields: EMPTY_FIELDS, status: "error" };
  }
  const fields = fieldsFromPayload(payload);
  if (payload.error === "no_text_detected" || !hasAnyLabelField(fields)) {
    return { fields: EMPTY_FIELDS, status: "no_text" };
  }
  return { fields, status: scoreFields(fields) };
}

function prepareCloudJpeg(source: HTMLCanvasElement, jpegDataUrl?: string): string {
  const cropped = autoCropLabelRegion(source);
  const scaled = scaleCanvas(cropped, SCAN_CLOUD_MAX_EDGE);
  return shrinkJpegForCloud(scaled, jpegDataUrl);
}

/** Cloud + on-phone fallback label read for Scan. */
export async function scanLabelFromCapture(
  source: HTMLCanvasElement,
  jpegDataUrl?: string,
  onPhase?: (phase: ScanReadPhase) => void
): Promise<LabelScanOutcome> {
  const cropped = autoCropLabelRegion(source);
  const cloudDataUrl = prepareCloudJpeg(source, jpegDataUrl);

  onPhase?.("cloud");
  let outcome = await recognizeLabelFieldsCloudWithStatus(cloudDataUrl);

  const needsFallback =
    outcome.status === "no_text" ||
    outcome.status === "error" ||
    outcome.status === "timeout" ||
    (outcome.status === "partial" && !outcome.fields.job);

  if (needsFallback && navigator.onLine) {
    onPhase?.("phone");
    const local = await quickLocalLabelRead(cropped);
    if (local && hasAnyLabelField(local)) {
      const merged = mergeLabelFields(outcome.fields, local);
      outcome = { fields: merged, status: scoreFields(merged) };
    }
  }

  return {
    ...outcome,
    message: labelScanStatusMessage(outcome.status),
  };
}

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

async function recognizeLabelFieldsCloudInner(jpegDataUrl: string): Promise<LabelOcrCloudOutcome> {
  const sb = getSupabase();
  if (!sb) {
    return { fields: EMPTY_FIELDS, status: "error" };
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return { fields: EMPTY_FIELDS, status: "not_signed_in" };
  }

  await sb.auth.refreshSession();

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
      const fromError = await readInvokePayload(data, error);
      if (fromError) return outcomeFromPayload(fromError);
      return { fields: EMPTY_FIELDS, status: "error" };
    }

    return outcomeFromPayload(data);
  } catch (e) {
    console.warn("label-ocr exception:", e);
    if (isInvokeTransportError(e)) {
      return { fields: EMPTY_FIELDS, status: "error" };
    }
    return { fields: EMPTY_FIELDS, status: "error" };
  }
}

export function labelScanStatusMessage(status: LabelOcrCloudStatus): string {
  switch (status) {
    case "offline":
      return "Offline — type the three lines from the sticker.";
    case "not_signed_in":
      return "Sign in from Home to use camera fill-in, or type below.";
    case "timeout":
      return "Slow connection — type the sticker below.";
    case "error":
      return "Camera fill-in missed — type the sticker below.";
    case "no_text":
      return "Couldn't read it — type job, fabric, and size below.";
    case "partial":
      return "Filled what we could — check the three fields.";
    case "success":
      return "Filled from sticker — tap Add to Log.";
  }
}
