import { Capacitor } from "@capacitor/core";
import {
  prepareLabelScanCanvas,
  prepareRawGuideForOcr,
  preprocessLabelBinarize,
  scaleCanvas,
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
  fields?: LabelOcrFields;
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
  provider?: string;
};

export type LabelScanOutcome = LabelOcrCloudOutcome & { message: string };

export type ScanReadPhase = "native" | "cloud" | "phone";

const CLOUD_OCR_TIMEOUT_MS = 14_000;
const PHONE_OCR_TIMEOUT_MS = 5_000;
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
  return sanitizeLabelFields(pickBestFieldsFromOcrTexts(texts));
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
  return canvas.toDataURL("image/jpeg", 0.82).replace(/^data:image\/\w+;base64,/, "");
}

function prepareCloudRequest(source: HTMLCanvasElement): LabelOcrRequest {
  const raw = prepareRawGuideForOcr(source, SCAN_CLOUD_MAX_EDGE);
  const white = scaleWhiteLabel(source, SCAN_CLOUD_MAX_EDGE);
  const contrast = prepareLabelScanCanvas(source, SCAN_CLOUD_MAX_EDGE);
  return {
    imageBase64: toBase64(raw),
    altImageBase64: toBase64(contrast),
    extraImagesBase64: [toBase64(preprocessLabelBinarize(white))],
    stripsBase64: stripBase64Payload(white),
  };
}

function shouldSkipPhoneFallback(outcome: LabelOcrCloudOutcome): boolean {
  // Phone Tesseract adds 5–15s and is weak on marker handwriting — rely on Gemini/cloud first.
  if (hasAnyLabelField(outcome.fields)) return true;
  if (outcome.status === "timeout" || outcome.status === "error") return true;
  if (outcome.provider?.includes("gemini") && outcome.status !== "no_text") return true;
  return scoreParsedLabelFields(outcome.fields) >= 20;
}

function mergeIfBetter(current: LabelOcrFields, next: LabelOcrFields): LabelOcrFields {
  const currentScore = scoreParsedLabelFields(current);
  const nextScore = scoreParsedLabelFields(next);
  if (nextScore >= currentScore + 12) return next;
  return current;
}

function outcomeFromFields(
  fields: LabelOcrFields,
  provider: string,
  detail?: string
): LabelOcrCloudOutcome {
  return {
    fields,
    status: scoreFields(fields),
    detail,
    provider,
  };
}

function mergeNativeAttempts(...attempts: Array<LabelOcrFields | null>): LabelOcrFields | null {
  let best: LabelOcrFields = EMPTY_FIELDS;
  let bestScore = 0;
  for (const attempt of attempts) {
    if (!attempt || !hasAnyLabelField(attempt)) continue;
    const score = scoreParsedLabelFields(attempt);
    if (score > bestScore) {
      best = attempt;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

/** Native + cloud (Gemini) in parallel → on-phone Tesseract fallback. */
export async function scanLabelFromCapture(
  source: HTMLCanvasElement,
  _jpegDataUrl?: string,
  onPhase?: (phase: ScanReadPhase) => void
): Promise<LabelScanOutcome> {
  const rawCanvas = prepareRawGuideForOcr(source, 2200);
  const prepCanvas = prepareLabelScanCanvas(source, 2200);
  const rawBase64 = toBase64(rawCanvas);
  const prepBase64 = toBase64(prepCanvas);

  onPhase?.("native");
  const nativePromise = Capacitor.isNativePlatform()
    ? Promise.all([
        recognizeLabelOnDevice(rawBase64),
        recognizeLabelOnDevice(prepBase64),
      ]).then((attempts) => mergeNativeAttempts(...attempts))
    : Promise.resolve(null);

  onPhase?.("cloud");
  const cloudPromise = recognizeLabelFieldsCloudWithStatus(prepareCloudRequest(source));

  const [nativeFields, cloudOutcome] = await Promise.all([nativePromise, cloudPromise]);

  if (nativeFields && scoreFields(nativeFields) === "success") {
    return {
      ...outcomeFromFields(nativeFields, "native-vision"),
      message: labelScanStatusMessage("success"),
    };
  }

  let outcome = cloudOutcome;
  if (nativeFields && hasAnyLabelField(nativeFields)) {
    const rawContext = [nativeFields.job, nativeFields.fabric, nativeFields.size].filter(Boolean).join("\n");
    const merged = mergeIfBetter(outcome.fields, sanitizeLabelFields(nativeFields, rawContext));
    outcome = {
      ...outcome,
      fields: merged,
      status: scoreFields(merged),
      provider: outcome.provider ?? "native-vision",
    };
  }

  if (!shouldSkipPhoneFallback(outcome)) {
    onPhase?.("phone");
    const phoneRaw = scaleCanvas(source, 1600);
    const phoneFields = await withTimeout(readLabelOnPhone(phoneRaw), PHONE_OCR_TIMEOUT_MS, EMPTY_FIELDS);
    if (hasAnyLabelField(phoneFields)) {
      const merged = mergeIfBetter(
        outcome.fields,
        sanitizeLabelFields(phoneFields, joinLabelFields(phoneFields.job, phoneFields.fabric, phoneFields.size))
      );
      outcome = {
        fields: merged,
        status: scoreFields(merged),
        detail: outcome.detail,
        provider: outcome.provider ?? "phone-tesseract",
      };
    }
  }

  if (hasAnyLabelField(outcome.fields) && outcome.status === "no_text") {
    outcome = { ...outcome, status: scoreFields(outcome.fields) };
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
  if (detail === "gemini_not_configured") {
    return "Add GEMINI_API_KEY in Supabase for best label reads, or fix fields below.";
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
      if (detail === "gemini_not_configured") {
        return "Add GEMINI_API_KEY in Supabase for handwriting, or type the three lines below.";
      }
      if (detail === "google_billing") {
        return "Enable Google Cloud billing for Vision, or type the three lines below.";
      }
      if (detail === "google_api_disabled") {
        return "Enable Cloud Vision API in Google Cloud, or type the three lines below.";
      }
      if (detail === "ocr_miss") {
        return "Couldn’t read this label — type the three lines below, or Scan again with the paper centered.";
      }
      return "No text detected — type the three lines below, or Scan again in brighter light.";
    case "partial":
      return "Got some lines — fix any field below, then Add to Log.";
    case "success":
      return "Label read — pick a place and Add to Log.";
  }
}
