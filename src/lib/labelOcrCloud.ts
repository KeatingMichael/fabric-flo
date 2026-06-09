import {
  prepareLabelScanCanvas,
  prepareLabelScanVariants,
  shrinkJpegForCloud,
} from "@/lib/labelOcrImage";
import {
  looksLikeWeakFabricLine,
  looksLikeWeakJobLine,
  looksLikeWeakSizeLine,
  pickBestFieldsFromOcrTexts,
  scoreParsedLabelFields,
  type LabelOcrFields,
} from "@/lib/labelOcr";
import {
  hasAnyLabelField,
  readLabelOnPhone,
  stripBase64Payload,
} from "@/lib/labelOcrQuick";
import { FunctionsHttpError, getSupabase } from "@/lib/supabase";

type OcrCandidate = { text?: string; provider?: string };

type LabelOcrResponse = {
  text?: string;
  error?: string;
  rawText?: string;
  provider?: string;
  detail?: string;
  candidates?: OcrCandidate[];
};

type LabelOcrRequest = {
  imageBase64: string;
  altImageBase64?: string;
  extraImagesBase64?: string[];
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

const CLOUD_OCR_TIMEOUT_MS = 22_000;
const PHONE_OCR_TIMEOUT_MS = 12_000;
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

function collectOcrTexts(payload: LabelOcrResponse | null): string[] {
  if (!payload) return [];
  const texts: string[] = [];
  for (const candidate of payload.candidates ?? []) {
    const t = candidate.text?.trim();
    if (t) texts.push(t);
  }
  const primary = payload.text?.trim() || payload.rawText?.trim();
  if (primary) texts.unshift(primary);
  return texts;
}

function fieldsFromPayload(payload: LabelOcrResponse | null): LabelOcrFields {
  const texts = collectOcrTexts(payload);
  if (!texts.length) return EMPTY_FIELDS;
  return pickBestFieldsFromOcrTexts(texts);
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

function toBase64(canvas: HTMLCanvasElement): string {
  return shrinkJpegForCloud(canvas).replace(/^data:image\/\w+;base64,/, "");
}

function prepareCloudRequest(
  source: HTMLCanvasElement,
  _jpegDataUrl?: string
): LabelOcrRequest {
  const { natural, binarized, rotated } = prepareLabelScanVariants(source, SCAN_CLOUD_MAX_EDGE);
  return {
    imageBase64: toBase64(natural),
    altImageBase64: toBase64(binarized),
    extraImagesBase64: [toBase64(rotated)],
    stripsBase64: stripBase64Payload(natural),
  };
}

function pickBetterFields(a: LabelOcrFields, b: LabelOcrFields): LabelOcrFields {
  return scoreParsedLabelFields(b) > scoreParsedLabelFields(a) ? b : a;
}

/** Cloud OCR with on-phone block read fallback when cloud misses or is weak. */
export async function scanLabelFromCapture(
  source: HTMLCanvasElement,
  jpegDataUrl?: string,
  onPhase?: (phase: ScanReadPhase) => void
): Promise<LabelScanOutcome> {
  const request = prepareCloudRequest(source, jpegDataUrl);

  onPhase?.("cloud");
  let outcome = await recognizeLabelFieldsCloudWithStatus(request);

  const cloudWeak =
    !hasAnyLabelField(outcome.fields) ||
    outcome.status === "partial" ||
    outcome.status === "timeout" ||
    outcome.status === "error";

  if (cloudWeak) {
    onPhase?.("phone");
    const phoneCanvas = prepareLabelScanCanvas(source, 2200);
    const phoneFields = await withTimeout(readLabelOnPhone(phoneCanvas), PHONE_OCR_TIMEOUT_MS, EMPTY_FIELDS);
    if (hasAnyLabelField(phoneFields)) {
      const merged = pickBetterFields(outcome.fields, phoneFields);
      outcome = {
        fields: merged,
        status: scoreFields(merged),
        detail: outcome.detail,
      };
    }
  }

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
  const payload =
    typeof request === "string"
      ? { imageBase64: request.replace(/^data:image\/\w+;base64,/, "") }
      : request;
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
    return "Enable Google Cloud billing for Vision, or tap the fields below to type.";
  }
  if (detail === "google_api_disabled") {
    return "Enable Cloud Vision API in Google Cloud, then Scan again.";
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
      if (detail === "google_billing") {
        return "Enable Google Cloud billing for Vision, or type the three lines below.";
      }
      if (detail === "google_api_disabled") {
        return "Enable Cloud Vision API in Google Cloud, or type the three lines below.";
      }
      return "No text detected — type the three lines below, or Scan again in brighter light.";
    case "partial":
      return "Got some lines — fix any field below, then Add to Log.";
    case "success":
      return "Label read — pick a place and Add to Log.";
  }
}
