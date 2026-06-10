import { Capacitor } from "@capacitor/core";
import {
  prepareLabelScanCanvas,
  prepareRawGuideForOcr,
  preprocessLabelBinarize,
  rotateCanvas,
  scaleWhiteLabel,
} from "@/lib/labelOcrImage";
import {
  joinLabelFields,
  looksLikeWeakFabricLine,
  looksLikeWeakJobLine,
  looksLikeWeakSizeLine,
  pickBestFieldsFromOcrTexts,
  polishLabelFields,
  scoreParsedLabelFields,
  type LabelOcrFields,
} from "@/lib/labelOcr";
import { recognizeLabelOnDevice } from "@/lib/labelOcrNative";
import { hasAnyLabelField, stripBase64Payload } from "@/lib/labelOcrQuick";
import { FunctionsHttpError, getSupabase } from "@/lib/supabase";

type OcrCandidate = { text?: string; provider?: string };

type LabelOcrResponse = {
  text?: string;
  error?: string;
  rawText?: string;
  provider?: string;
  detail?: string;
  candidates?: OcrCandidate[];
  fields?: LabelOcrFields;
};

type LabelOcrRequest = {
  imageBase64: string;
  altImageBase64?: string;
  extraImagesBase64?: string[];
  stripsBase64?: string[];
  mode?: "fast" | "full";
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
  provider?: string;
};

export type LabelScanOutcome = LabelOcrCloudOutcome & { message: string };

export type ScanReadPhase = "native" | "cloud" | "phone";

const CLOUD_FAST_TIMEOUT_MS = 12_000;
const CLOUD_FULL_TIMEOUT_MS = 18_000;
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
  if (!hasAnyLabelField(fields)) return "no_text";
  const weak =
    looksLikeWeakJobLine(fields.job) ||
    looksLikeWeakFabricLine(fields.fabric) ||
    looksLikeWeakSizeLine(fields.size);
  if (weak) return "partial";
  if (scoreParsedLabelFields(fields) < 75) return "partial";
  return "success";
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

function sanitizeLabelFields(fields: LabelOcrFields, rawText = ""): LabelOcrFields {
  const polished = rawText ? polishLabelFields(rawText, fields) : fields;
  const job = polished.job.replace(/\D/g, "");
  const fabric = polished.fabric.trim();
  const size = polished.size.trim();
  return {
    job: job.length >= 4 ? job : "",
    fabric: fabric.length >= 3 && !/^\d+$/.test(fabric) ? fabric : "",
    size: looksLikeWeakSizeLine(size) ? "" : size,
  };
}

function fieldsFromPayload(payload: LabelOcrResponse | null): LabelOcrFields {
  if (payload?.fields && hasAnyLabelField(payload.fields)) {
    const raw = payload.text?.trim() || payload.rawText?.trim() || collectOcrTexts(payload)[0] || "";
    const polished = polishLabelFields(raw, payload.fields);
    const sanitized = sanitizeLabelFields(polished, raw);
    if (hasAnyLabelField(sanitized)) return sanitized;
    return polished;
  }
  const texts = collectOcrTexts(payload);
  if (!texts.length) return EMPTY_FIELDS;
  const parsed = pickBestFieldsFromOcrTexts(texts);
  const sanitized = sanitizeLabelFields(parsed, texts.join("\n"));
  if (hasAnyLabelField(sanitized)) return sanitized;
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
  if (!hasAnyLabelField(fields)) {
    const fromCandidates = pickBestFieldsFromOcrTexts(collectOcrTexts(payload));
    if (hasAnyLabelField(fromCandidates)) {
      return {
        fields: fromCandidates,
        status: scoreFields(fromCandidates),
        detail: payload.detail,
        provider: payload.provider,
      };
    }
    return {
      fields: EMPTY_FIELDS,
      status: "no_text",
      detail: payload.detail ?? payload.error,
    };
  }
  return {
    fields,
    status: scoreFields(fields),
    detail: payload.detail,
    provider: payload.provider,
  };
}

function toBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", 0.85).replace(/^data:image\/\w+;base64,/, "");
}

/** Single raw frame — fast Gemini (~2–4s). */
function prepareCloudRequestFast(source: HTMLCanvasElement): LabelOcrRequest {
  const raw = prepareRawGuideForOcr(source, SCAN_CLOUD_MAX_EDGE);
  return {
    mode: "fast",
    imageBase64: toBase64(raw),
  };
}

/** Contrast + rotated + strips — only when fast pass misses. */
function prepareCloudRequestFull(source: HTMLCanvasElement): LabelOcrRequest {
  const raw = prepareRawGuideForOcr(source, SCAN_CLOUD_MAX_EDGE);
  const white = scaleWhiteLabel(source, SCAN_CLOUD_MAX_EDGE);
  const contrast = prepareLabelScanCanvas(source, SCAN_CLOUD_MAX_EDGE);
  const rotated = rotateCanvas(raw, 90);
  return {
    mode: "full",
    imageBase64: toBase64(contrast),
    altImageBase64: toBase64(rotated),
    extraImagesBase64: [toBase64(preprocessLabelBinarize(white))],
    stripsBase64: stripBase64Payload(white),
  };
}

function mergeIfBetter(current: LabelOcrFields, next: LabelOcrFields): LabelOcrFields {
  const currentScore = scoreParsedLabelFields(current);
  const nextScore = scoreParsedLabelFields(next);
  if (nextScore >= currentScore + 8) return next;
  return current;
}

function finalizeScanOutcome(outcome: LabelOcrCloudOutcome): LabelScanOutcome {
  if (hasAnyLabelField(outcome.fields) && outcome.status === "no_text") {
    outcome = { ...outcome, status: scoreFields(outcome.fields) };
  }
  return {
    ...outcome,
    message: labelScanStatusMessage(outcome.status, outcome.detail),
  };
}

/** Fast cloud Gemini → full cloud → native Vision on device. No slow Tesseract. */
export async function scanLabelFromCapture(
  source: HTMLCanvasElement,
  _jpegDataUrl?: string,
  onPhase?: (phase: ScanReadPhase) => void
): Promise<LabelScanOutcome> {
  onPhase?.("cloud");
  let outcome = await recognizeLabelFieldsCloudWithStatus(
    prepareCloudRequestFast(source),
    CLOUD_FAST_TIMEOUT_MS
  );

  if (!hasAnyLabelField(outcome.fields) && outcome.status !== "not_signed_in") {
    onPhase?.("cloud");
    const full = await recognizeLabelFieldsCloudWithStatus(
      prepareCloudRequestFull(source),
      CLOUD_FULL_TIMEOUT_MS
    );
    if (hasAnyLabelField(full.fields) || full.status === "not_signed_in") {
      outcome = full;
    } else if (hasAnyLabelField(outcome.fields)) {
      outcome.fields = mergeIfBetter(outcome.fields, full.fields);
      outcome.status = scoreFields(outcome.fields);
      outcome.provider = full.provider ?? outcome.provider;
    } else {
      outcome = full;
    }
  }

  if (
    Capacitor.isNativePlatform() &&
    hasAnyLabelField(outcome.fields) === false &&
    outcome.status !== "not_signed_in" &&
    outcome.status !== "offline"
  ) {
    onPhase?.("native");
    const rawBase64 = toBase64(prepareRawGuideForOcr(source, 1800));
    const nativeFields = await recognizeLabelOnDevice(rawBase64);
    if (nativeFields && hasAnyLabelField(nativeFields)) {
      const rawContext = joinLabelFields(nativeFields.job, nativeFields.fabric, nativeFields.size);
      const merged = sanitizeLabelFields(nativeFields, rawContext);
      outcome = {
        fields: merged,
        status: scoreFields(merged),
        provider: "native-vision",
        detail: outcome.detail,
      };
    }
  }

  return finalizeScanOutcome(outcome);
}

export async function recognizeLabelFieldsCloudWithStatus(
  request: LabelOcrRequest | string,
  timeoutMs = CLOUD_FULL_TIMEOUT_MS
): Promise<LabelOcrCloudOutcome> {
  if (!navigator.onLine) {
    return { fields: EMPTY_FIELDS, status: "offline" };
  }
  const payload =
    typeof request === "string"
      ? { imageBase64: request.replace(/^data:image\/\w+;base64,/, ""), mode: "fast" as const }
      : request;
  return withTimeout(recognizeLabelFieldsCloudInner(payload), timeoutMs, {
    fields: EMPTY_FIELDS,
    status: "timeout",
  });
}

async function recognizeLabelFieldsCloudInner(request: LabelOcrRequest): Promise<LabelOcrCloudOutcome> {
  const sb = getSupabase();
  if (!sb) {
    return { fields: EMPTY_FIELDS, status: "error", detail: "cloud_not_configured" };
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
  if (detail === "gemini_not_configured") {
    return "Add GEMINI_API_KEY in Supabase for best label reads, or fix fields below.";
  }
  switch (status) {
    case "offline":
      return "Offline — type or fix the fields below.";
    case "not_signed_in":
      return "Sign in from Home to read labels with the camera.";
    case "timeout":
      return "Slow connection — tap Scan again or type the three lines below.";
    case "error":
      if (detail === "cloud_not_configured") {
        return "App missing Supabase settings — type the three lines below.";
      }
      return "Couldn’t read — tap Scan again or type the three lines below.";
    case "no_text":
      if (detail === "gemini_not_configured") {
        return "Add GEMINI_API_KEY in Supabase for handwriting, or type the three lines below.";
      }
      if (detail === "ocr_miss") {
        return "Couldn’t read this label — type the three lines below.";
      }
      return "No text detected — type the three lines below.";
    case "partial":
      return "Got some lines — fix any field below, then Add to Log.";
    case "success":
      return "Label read — pick a place and Add to Log.";
  }
}
