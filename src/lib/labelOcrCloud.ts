import {
  scaleCanvas,
  shrinkJpegForCloud,
} from "@/lib/labelOcrImage";
import {
  looksLikeWeakFabricLine,
  looksLikeWeakJobLine,
  looksLikeWeakSizeLine,
  parseRawTextToLabelFields,
  splitLabelIntoFields,
  type LabelOcrFields,
} from "@/lib/labelOcr";
import {
  hasAnyLabelField,
  stripBase64Payload,
} from "@/lib/labelOcrQuick";
import { FunctionsHttpError, getSupabase } from "@/lib/supabase";

type LabelOcrResponse = {
  text?: string;
  error?: string;
  rawText?: string;
  provider?: string;
  detail?: string;
};

type LabelOcrRequest = {
  imageBase64: string;
  stripsBase64?: string[];
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
  detail?: string;
};

export type LabelScanOutcome = LabelOcrCloudOutcome & { message: string };

export type ScanReadPhase = "cloud" | "phone";

const CLOUD_OCR_TIMEOUT_MS = 15_000;
const SCAN_CLOUD_MAX_EDGE = 1800;
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
  const parsed = parseRawTextToLabelFields(raw);
  if (hasAnyLabelField(parsed)) return parsed;
  const split = splitLabelIntoFields(raw.replace(/\n/g, " / "));
  if (hasAnyLabelField(split)) return split;
  return parsed;
}

function outcomeFromPayload(payload: LabelOcrResponse | null): LabelOcrCloudOutcome {
  if (!payload) {
    return { fields: EMPTY_FIELDS, status: "error" };
  }
  if (payload.error === "vision_not_configured") {
    return { fields: EMPTY_FIELDS, status: "error", detail: payload.detail };
  }
  const fields = fieldsFromPayload(payload);
  if (payload.error === "no_text_detected" || !hasAnyLabelField(fields)) {
    return { fields: EMPTY_FIELDS, status: "no_text", detail: payload.detail };
  }
  return { fields, status: scoreFields(fields), detail: payload.detail };
}

function prepareCloudRequest(
  source: HTMLCanvasElement,
  _jpegDataUrl?: string
): LabelOcrRequest {
  // Guide crop only — autoCrop was often trimming handwritten lines on set photos.
  const scaled = scaleCanvas(source, SCAN_CLOUD_MAX_EDGE);
  const stripsBase64 = stripBase64Payload(scaled);
  const imageBase64 = shrinkJpegForCloud(scaled).replace(/^data:image\/\w+;base64,/, "");
  return { imageBase64, stripsBase64 };
}

/** Fast cloud-only label read — target ~5s end-to-end. */
export async function scanLabelFromCapture(
  source: HTMLCanvasElement,
  jpegDataUrl?: string,
  onPhase?: (phase: ScanReadPhase) => void
): Promise<LabelScanOutcome> {
  const request = prepareCloudRequest(source, jpegDataUrl);

  onPhase?.("cloud");
  const outcome = await recognizeLabelFieldsCloudWithStatus(request);

  return {
    ...outcome,
    message: labelScanStatusMessage(outcome.status, outcome.detail),
  };
}

export async function recognizeLabelFieldsCloudWithStatus(
  request: LabelOcrRequest | string
): Promise<LabelOcrCloudOutcome> {
  if (!navigator.onLine) {
    return { fields: EMPTY_FIELDS, status: "offline" };
  }
  const payload = typeof request === "string" ? { imageBase64: request.replace(/^data:image\/\w+;base64,/, "") } : request;
  return withTimeout(recognizeLabelFieldsCloudInner(payload), CLOUD_OCR_TIMEOUT_MS, {
    fields: EMPTY_FIELDS,
    status: "timeout",
  });
}

async function recognizeLabelFieldsCloudInner(request: LabelOcrRequest): Promise<LabelOcrCloudOutcome> {
  const sb = getSupabase();
  if (!sb) {
    return { fields: EMPTY_FIELDS, status: "error" };
  }

  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session?.user) {
    return { fields: EMPTY_FIELDS, status: "not_signed_in" };
  }

  if (!request.imageBase64) {
    return { fields: EMPTY_FIELDS, status: "error" };
  }

  const invokeOnce = () =>
    sb.functions.invoke<LabelOcrResponse>("label-ocr", {
      body: request,
    });

  try {
    let { data, error } = await invokeOnce();

    if (error) {
      const msg = typeof error.message === "string" ? error.message : "";
      if (msg.includes("401") || msg.includes("not_authenticated")) {
        await sb.auth.refreshSession();
        ({ data, error } = await invokeOnce());
      }
    }

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

export function labelScanStatusMessage(status: LabelOcrCloudStatus, detail?: string): string {
  if (detail === "google_billing") {
    return "Google Vision billing is not enabled — check Google Cloud billing, then Scan again.";
  }
  switch (status) {
    case "offline":
      return "Offline — type or fix the fields below.";
    case "not_signed_in":
      return "Sign in from Home to read labels with the camera.";
    case "timeout":
      return "Slow connection — tap Scan again or fix fields below.";
    case "error":
      return "Couldn’t read — tap Scan again or fix fields below.";
    case "no_text":
      return "Couldn’t read the sticker — hold the white label in frame and Scan again.";
    case "partial":
      return "Got some lines — fix any field below, then Add to Log.";
    case "success":
      return "Label read — pick a place and Add to Log.";
  }
}
