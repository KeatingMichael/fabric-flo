import {
  autoCropLabelRegion,
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
import {
  hasAnyLabelField,
  mergeLabelFields,
  readLabelOnPhone,
  stripBase64Payload,
} from "@/lib/labelOcrQuick";
import { FunctionsHttpError, getSupabase } from "@/lib/supabase";

type LabelOcrResponse = {
  text?: string;
  error?: string;
  rawText?: string;
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
};

export type LabelScanOutcome = LabelOcrCloudOutcome & { message: string };

export type ScanReadPhase = "cloud" | "phone";

const CLOUD_OCR_TIMEOUT_MS = 12_000;
const PHONE_OCR_TIMEOUT_MS = 6_000;
const SCAN_CLOUD_MAX_EDGE = 2600;
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

function prepareCloudRequest(
  source: HTMLCanvasElement,
  jpegDataUrl?: string
): LabelOcrRequest {
  const cropped = autoCropLabelRegion(source);
  const scaled = scaleCanvas(cropped, SCAN_CLOUD_MAX_EDGE);
  const imageBase64 = shrinkJpegForCloud(scaled, jpegDataUrl).replace(/^data:image\/\w+;base64,/, "");
  const stripsBase64 = stripBase64Payload(scaled);
  return { imageBase64, stripsBase64 };
}

function mergeOutcomes(cloud: LabelOcrCloudOutcome, phone: LabelOcrFields): LabelOcrCloudOutcome {
  const fields = mergeLabelFields(cloud.fields, phone);
  if (!hasAnyLabelField(fields)) {
    return { fields: EMPTY_FIELDS, status: cloud.status === "not_signed_in" ? "not_signed_in" : "no_text" };
  }
  return { fields, status: scoreFields(fields) };
}

function labelFieldsComplete(fields: LabelOcrFields): boolean {
  return Boolean(fields.job && fields.fabric && fields.size);
}

/** Cloud first; phone OCR only when cloud misses, both capped by timeout. */
export async function scanLabelFromCapture(
  source: HTMLCanvasElement,
  jpegDataUrl?: string,
  onPhase?: (phase: ScanReadPhase) => void
): Promise<LabelScanOutcome> {
  const cropped = autoCropLabelRegion(source);
  const request = prepareCloudRequest(source, jpegDataUrl);

  onPhase?.("cloud");
  const cloudOutcome = await recognizeLabelFieldsCloudWithStatus(request);

  let phoneFields = EMPTY_FIELDS;
  const cloudComplete =
    labelFieldsComplete(cloudOutcome.fields) ||
    cloudOutcome.status === "success" ||
    (cloudOutcome.status === "partial" && hasAnyLabelField(cloudOutcome.fields));

  if (!cloudComplete) {
    onPhase?.("phone");
    phoneFields = await withTimeout(readLabelOnPhone(cropped), PHONE_OCR_TIMEOUT_MS, EMPTY_FIELDS);
  }

  const outcome = mergeOutcomes(cloudOutcome, phoneFields);

  return {
    ...outcome,
    message: labelScanStatusMessage(outcome.status),
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

export function labelScanStatusMessage(status: LabelOcrCloudStatus): string {
  switch (status) {
    case "offline":
      return "Offline — phone read only. Fix fields below if needed.";
    case "not_signed_in":
      return "Sign in from Home for cloud read — phone read may still fill fields.";
    case "timeout":
      return "Slow connection — check the fields below.";
    case "error":
      return "Cloud missed — phone read may have filled fields. Tap to fix.";
    case "no_text":
      return "Couldn’t read the sticker — hold the white label in frame and Scan again.";
    case "partial":
      return "Got some lines — fix any field below, then Add to Log.";
    case "success":
      return "Label read — pick a place and Add to Log.";
  }
}
