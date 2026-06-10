/**
 * Handwriting OCR for rental labels (Supabase Edge Function).
 *
 * Plan A: Gemini structured JSON (primary, fast)
 * Plan C: Three-band strip reads merged with full-label read
 * Fallback: Vision + OCR.space text candidates for client parsing
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type VisionResponse = {
  responses?: Array<{
    fullTextAnnotation?: { text?: string };
    error?: { message?: string };
  }>;
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

type OcrSpaceResponse = {
  OCRExitCode?: number;
  ErrorMessage?: string;
  ParsedResults?: Array<{ ParsedText?: string }>;
};

type LabelOcrBody = {
  imageBase64?: string;
  altImageBase64?: string;
  extraImagesBase64?: string[];
  stripsBase64?: string[];
};

type LabelFields = {
  job: string;
  fabric: string;
  size: string;
};

type OcrAttempt = {
  text: string | null;
  fields?: LabelFields | null;
  provider?: string;
  detail?: string;
};

type ScoredCandidate = {
  text: string;
  provider?: string;
  score: number;
};

const EMPTY_FIELDS: LabelFields = { job: "", fabric: "", size: "" };

const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];

const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    job: { type: "STRING", description: "Job number, digits only" },
    fabric: { type: "STRING", description: "Fabric type name in uppercase" },
    size: { type: "STRING", description: "Size like 40' x 60'" },
  },
  required: ["job", "fabric", "size"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "missing_authorization" }, 401);
    }

    const visionKey = Deno.env.get("GOOGLE_VISION_API_KEY")?.trim();
    const geminiKey =
      Deno.env.get("GEMINI_API_KEY")?.trim() || Deno.env.get("GOOGLE_VISION_API_KEY")?.trim();
    const ocrSpaceKey = Deno.env.get("OCR_SPACE_API_KEY")?.trim();
    if (!visionKey && !ocrSpaceKey && !geminiKey) {
      return json({ text: "", error: "vision_not_configured" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ error: "not_authenticated" }, 401);
    }

    const body = (await req.json()) as LabelOcrBody;
    const imageBase64 = body.imageBase64?.trim();
    if (!imageBase64 || imageBase64.length < 32) {
      return json({ error: "missing_image" }, 400);
    }
    if (imageBase64.length > 8_000_000) {
      return json({ error: "image_too_large" }, 413);
    }

    const altImageBase64 = body.altImageBase64?.trim();
    const extraImages = body.extraImagesBase64?.filter((s) => s && s.length > 32) ?? [];
    const strips = body.stripsBase64?.filter((s) => s && s.length > 32) ?? [];

    const images = [imageBase64, altImageBase64, ...extraImages].filter(
      (img): img is string => Boolean(img && img.length > 32)
    );

    let structuredFields: LabelFields | null = null;
    let structuredProvider = "gemini";
    let geminiDetail: string | undefined;

    if (geminiKey) {
      const geminiBest = await runGeminiBest(geminiKey, images, strips);
      structuredFields = geminiBest.fields;
      structuredProvider = geminiBest.provider;
      geminiDetail = geminiBest.detail;

      if (!structuredFields || !hasAnyField(structuredFields)) {
        for (const img of images.slice(0, 3)) {
          for (const model of GEMINI_MODELS) {
            const plain = await runGeminiPlainText(img, geminiKey, model);
            if (plain && hasAnyField(plain)) {
              structuredFields = normalizeStructuredFields(plain);
              structuredProvider = `gemini-plain:${model}`;
              break;
            }
          }
          if (structuredFields && hasAnyField(structuredFields)) break;
        }
      }
    }

    if (structuredFields && hasAnyField(structuredFields) && scoreFields(structuredFields) >= 15) {
      const text = fieldsToText(structuredFields);
      return json({
        text,
        rawText: text,
        fields: structuredFields,
        provider: structuredProvider,
        detail: geminiDetail,
        candidates: [{ text, provider: structuredProvider }],
      });
    }

    // Fallback: Vision + OCR.space on primary image only (fast)
    const { best, candidates } = await runAllProviders(
      images.slice(0, 1),
      strips.slice(0, 3),
      visionKey,
      ocrSpaceKey
    );

    const fallbackFields = pickBestFields(
      structuredFields,
      best.fields,
      best.text ? parseTextFields(best.text) : null
    );

    if (hasAnyField(fallbackFields ?? EMPTY_FIELDS)) {
      const text = best.text ?? fieldsToText(fallbackFields!);
      return json({
        text,
        rawText: text,
        fields: fallbackFields,
        provider: best.provider ?? structuredProvider,
        detail: best.detail ?? geminiDetail,
        candidates: candidates.slice(0, 10).map(({ text, provider }) => ({ text, provider })),
      });
    }

    return json({
      text: "",
      rawText: "",
      error: "no_text_detected",
      detail: geminiDetail ?? best.detail ?? (geminiKey ? "ocr_miss" : "gemini_not_configured"),
      candidates: [],
    });
  } catch (e) {
    return json({ text: "", error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function hasAnyField(fields: LabelFields): boolean {
  return Boolean(fields.job || fields.fabric || fields.size);
}

function isStrongFields(fields: LabelFields | null): boolean {
  if (!fields) return false;
  const jobDigits = fields.job.replace(/\D/g, "");
  const fabric = fields.fabric.trim();
  const size = fields.size.trim();
  return (
    jobDigits.length >= 5 &&
    jobDigits.length <= 7 &&
    fabric.length >= 3 &&
    !/^\d+$/.test(fabric) &&
    /\d+\s*['′]?\s*[xX×]\s*\d+/i.test(size)
  );
}

function pickBestFields(
  ...candidates: Array<LabelFields | null | undefined>
): LabelFields | null {
  let best: LabelFields | null = null;
  let bestScore = 0;
  for (const fields of candidates) {
    if (!fields || !hasAnyField(fields)) continue;
    const s = scoreFields(fields);
    if (s > bestScore) {
      bestScore = s;
      best = fields;
    }
  }
  return best;
}

function parseTextFields(text: string): LabelFields | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  const job = (lines[0] ?? "").replace(/\D/g, "");
  return {
    job: job.length >= 4 ? job : "",
    fabric: (lines[1] ?? "").toUpperCase(),
    size: lines[2] ?? "",
  };
}

async function runGeminiBest(
  apiKey: string,
  images: string[],
  strips: string[]
): Promise<{ fields: LabelFields | null; provider: string; detail?: string }> {
  if (!images[0]) return { fields: null, provider: "gemini" };

  const collected: LabelFields[] = [];
  let winnerModel = GEMINI_MODELS[0]!;

  for (const img of images.slice(0, 3)) {
    const primaryResults = await Promise.all(
      GEMINI_MODELS.map((model) =>
        runGeminiStructured(img, apiKey, "full", model).then((fields) => ({ fields, model }))
      )
    );

    for (const result of primaryResults) {
      if (result.fields && hasAnyField(result.fields)) {
        collected.push(result.fields);
        if (scoreFields(normalizeStructuredFields(result.fields)) >= 45) {
          winnerModel = result.model;
        }
      }
    }

    const mergedEarly = mergeBestGeminiFields(collected);
    if (mergedEarly) {
      const normalized = normalizeStructuredFields(mergedEarly);
      if (scoreFields(normalized) >= 45) {
        return { fields: normalized, provider: `gemini:${winnerModel}` };
      }
    }
  }

  let merged = mergeBestGeminiFields(collected);
  if (merged) {
    const normalized = normalizeStructuredFields(merged);
    if (scoreFields(normalized) >= 45) {
      return { fields: normalized, provider: `gemini:${winnerModel}` };
    }
  }

  if (strips.length >= 3) {
    const stripFields = await runGeminiStripMerge(strips.slice(0, 3), apiKey);
    if (stripFields) collected.push(stripFields);
    merged = mergeBestGeminiFields(collected);
  }

  if (merged && hasAnyField(merged)) {
    return { fields: normalizeStructuredFields(merged), provider: "gemini-merged" };
  }

  return { fields: null, provider: "gemini" };
}

function scoreJobField(job: string): number {
  const digits = job.replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 7) return digits.length >= 4 ? 15 : 0;
  return 40 + digits.length;
}

function scoreFabricField(fabric: string): number {
  const trimmed = fabric.trim().toUpperCase();
  const compact = trimmed.replace(/[^A-Z]/g, "");
  if (compact.length < 3) return 0;
  if (/^SO?L+I?D$|^SLD$|^SOUD$|^S0LID$|^5OLID$/i.test(compact)) return 95;
  if (trimmed.includes("BLUE") && trimmed.includes("FOAM")) return 95;
  if (trimmed.includes(" ")) return 80 + trimmed.length;
  if (/^(MUSLIN|DUVET|DUVETYNE|VELVET|CHROMA|BOUNCE|SCRIM|NET|SATIN|SILK|GRID|FOAM)$/i.test(compact)) {
    return 85;
  }
  if (compact.length <= 4) return 20;
  return 50;
}

function scoreSizeField(size: string): number {
  if (!/\d+\s*['′]?\s*[xX×]\s*\d+/i.test(size)) return 0;
  const matched = size.match(/(\d+)\s*['′]?\s*[xX×]\s*(\d+)/i);
  if (!matched) return 30;
  const a = Number(matched[1]);
  const b = Number(matched[2]);
  let score = 50;
  if (a >= 8 || b >= 8) score += 25;
  if (matched[1] !== matched[2]) score += 10;
  return score;
}

function mergeBestGeminiFields(candidates: LabelFields[]): LabelFields | null {
  let job = "";
  let fabric = "";
  let size = "";
  let jobScore = 0;
  let fabricScore = 0;
  let sizeScore = 0;

  for (const fields of candidates) {
    if (!fields) continue;
    const normalized = normalizeStructuredFields(fields);
    const js = scoreJobField(normalized.job);
    const fs = scoreFabricField(normalized.fabric);
    const ss = scoreSizeField(normalized.size);
    if (js > jobScore && normalized.job) {
      jobScore = js;
      job = normalized.job;
    }
    if (fs > fabricScore && normalized.fabric) {
      fabricScore = fs;
      fabric = normalized.fabric;
    }
    if (ss > sizeScore && normalized.size) {
      sizeScore = ss;
      size = normalized.size;
    }
  }

  return hasAnyField({ job, fabric, size }) ? { job, fabric, size } : null;
}

function scoreFields(fields: LabelFields | null): number {
  if (!fields) return 0;
  let score = 0;
  const jobDigits = fields.job.replace(/\D/g, "");
  if (jobDigits.length >= 5 && jobDigits.length <= 7) score += 40;
  if (fields.fabric.trim().length >= 3) score += 30;
  if (/\d+\s*['′]?\s*[xX×]\s*\d+/i.test(fields.size)) score += 30;
  if (/^\d+$/.test(fields.fabric.trim())) score -= 50;
  return score;
}

function fieldsToText(fields: LabelFields): string {
  return [fields.job, fields.fabric, fields.size].filter(Boolean).join("\n");
}

function normalizeStructuredFields(raw: LabelFields): LabelFields {
  return {
    job: raw.job.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").replace(/\D/g, "").slice(0, 8),
    fabric: repairFabric(raw.fabric),
    size: raw.size.trim().replace(/[×]/g, "x"),
  };
}

function repairFabric(fabric: string): string {
  const upper = fabric.trim().toUpperCase().replace(/\s+/g, " ");
  if (!upper) return "";
  const compact = upper.replace(/[^A-Z]/g, "");
  if (/^SO?L+I?D$|^SLD$|^SOUD$|^S0LID$|^SL1D$|^5OLID$|^SOLO$|^OB$|^OOB$/i.test(compact)) {
    return "SOLID";
  }
  if (compact.includes("BLUE") && compact.includes("FOAM")) return "BLUE FOAM";
  if (upper.includes("BLUE") && upper.includes("FOAM")) return "BLUE FOAM";
  return upper;
}

function parseGeminiJson(text: string): LabelFields | null {
  try {
    const obj = JSON.parse(text) as Partial<LabelFields>;
    if (!obj || typeof obj !== "object") return null;
    return normalizeStructuredFields({
      job: String(obj.job ?? ""),
      fabric: String(obj.fabric ?? ""),
      size: String(obj.size ?? ""),
    });
  } catch {
    return null;
  }
}

async function runGeminiStructured(
  imageBase64: string,
  apiKey: string,
  mode: "full" | "job" | "fabric" | "size",
  model = GEMINI_MODELS[0]!
): Promise<LabelFields | null> {
  const prompts: Record<typeof mode, string> = {
    full:
      "Read the white rental fabric label with exactly 3 handwritten lines: (1) job number digits like 111023 or 236998, (2) fabric name like SOLID or BLUE FOAM, (3) size like 12' x 12' or 40' x 60'. Return JSON only.",
    job: "This image is ONLY the top line of a rental label — the job number. Return JSON with job (digits only), fabric empty string, size empty string.",
    fabric:
      "This image is ONLY the middle line of a rental label — the fabric name. Return JSON with job empty, fabric name uppercase, size empty.",
    size: "This image is ONLY the bottom line of a rental label — the size like 40' x 60'. Return JSON with job and fabric empty, size filled.",
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompts[mode] },
                { inline_data: { mime_type: "image/jpeg", data: imageBase64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 120,
            responseMimeType: "application/json",
            responseSchema: GEMINI_SCHEMA,
          },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.warn("Gemini structured HTTP", model, res.status, errBody.slice(0, 300));
      if (res.status === 403) return null;
      return null;
    }

    const body = (await res.json()) as GeminiResponse;
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    return parseGeminiJson(text);
  } catch (e) {
    console.warn("Gemini structured error:", e);
    return null;
  }
}

async function runGeminiPlainText(
  imageBase64: string,
  apiKey: string,
  model: string
): Promise<LabelFields | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    "Read the rental fabric label in this photo. Reply with exactly 3 lines:\n1) job number (digits only)\n2) fabric name\n3) size like 40' x 60'",
                },
                { inline_data: { mime_type: "image/jpeg", data: imageBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 80 },
        }),
      }
    );

    if (!res.ok) return null;

    const body = (await res.json()) as GeminiResponse;
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    return parseTextFields(text) ?? parseGeminiJson(text);
  } catch {
    return null;
  }
}

async function runGeminiStripMerge(strips: string[], apiKey: string): Promise<LabelFields | null> {
  const modes: Array<"job" | "fabric" | "size"> = ["job", "fabric", "size"];
  const results = await Promise.all(
    strips.map((strip, index) =>
      runGeminiStructured(strip, apiKey, modes[index] ?? "full", GEMINI_MODELS[0]!)
    )
  );

  const merged: LabelFields = { job: "", fabric: "", size: "" };
  for (const result of results) {
    if (!result) continue;
    if (result.job) merged.job = result.job;
    if (result.fabric) merged.fabric = result.fabric;
    if (result.size) merged.size = result.size;
  }

  return hasAnyField(merged) ? merged : null;
}

async function runAllProviders(
  images: string[],
  stripsBase64: string[],
  visionKey?: string,
  ocrSpaceKey?: string
): Promise<{ best: OcrAttempt; candidates: ScoredCandidate[] }> {
  const tasks: Promise<OcrAttempt>[] = [];

  for (const img of images.slice(0, 1)) {
    if (visionKey) {
      tasks.push(runGoogleVision(img, visionKey).then((r) => ({ ...r, provider: "google" })));
    }
    if (ocrSpaceKey && img.length <= 1_350_000) {
      tasks.push(
        runOcrSpaceEngine(ocrSpaceKey, img, "2").then((text) => ({ text, provider: "ocrspace" }))
      );
    }
  }

  if (ocrSpaceKey) {
    for (const strip of stripsBase64.slice(0, 3)) {
      if (strip.length > 1_350_000) continue;
      tasks.push(
        runOcrSpaceEngine(ocrSpaceKey, strip, "2").then((text) => ({
          text,
          provider: "ocrspace-strip",
        }))
      );
    }
  }

  const results = await Promise.all(tasks);
  const scored: ScoredCandidate[] = [];
  const seen = new Set<string>();
  let best: OcrAttempt = { text: null, detail: "ocr_miss" };

  for (const result of results) {
    if (result.detail && !result.text && !result.fields && best.detail === "ocr_miss") {
      best.detail = result.detail;
    }
    if (result.fields && scoreFields(result.fields) > scoreFields(best.fields ?? null)) {
      best = { ...result, text: result.text ?? fieldsToText(result.fields) };
      continue;
    }
    if (!result.text) continue;

    const normalized = result.text.trim();
    if (!normalized || seen.has(normalized)) continue;
    const parsed = parseTextFields(normalized);
    if (parsed && scoreFields(parsed) > scoreFields(best.fields ?? null)) {
      best = { text: normalized, fields: parsed, provider: result.provider };
    }

    seen.add(normalized);
    const score = scoreText(normalized);
    scored.push({ text: normalized, provider: result.provider, score });

    const bestScore = best.text ? scoreText(best.text) : 0;
    if (score > bestScore && scoreFields(parseTextFields(normalized)) >= scoreFields(best.fields ?? null)) {
      best = result;
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return { best, candidates: scored };
}

function scoreText(text: string): number {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 1);

  let score = lines.length * 8;

  if (lines.length >= 3) {
    score += 25;
    const jobDigits = lines[0]!.replace(/\D/g, "");
    if (jobDigits.length >= 5 && jobDigits.length <= 7) score += 30;
    if (/[A-Za-z]{4,}/.test(lines[1]!)) score += 25;
    if (/\d+\s*['′]?\s*[xX×]\s*\d+/i.test(lines[2]!)) score += 30;
  }

  if (/\d{5,7}/.test(text)) score += 15;
  if (/blue foam|solid|muslin|duvet|velvet|chroma|foam|bounce/i.test(text)) score += 20;
  if (/\d+\s*['′]?\s*[xX×]\s*\d+/i.test(text)) score += 15;

  for (const line of lines) {
    if (/^\d$/.test(line)) score -= 40;
  }

  return score;
}

async function runGoogleVision(imageBase64: string, apiKey: string): Promise<OcrAttempt> {
  const visionRes = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBase64 },
            features: [
              { type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 },
              { type: "TEXT_DETECTION", maxResults: 1 },
            ],
            imageContext: { languageHints: ["en"] },
          },
        ],
      }),
    }
  );

  if (!visionRes.ok) {
    const errBody = await visionRes.text();
    console.warn("Google Vision HTTP", visionRes.status, errBody.slice(0, 400));
    if (/billing/i.test(errBody)) return { text: null, detail: "google_billing" };
    if (visionRes.status === 403) return { text: null, detail: "google_api_disabled" };
    return { text: null };
  }

  const vision = (await visionRes.json()) as VisionResponse;
  const block = vision.responses?.[0];
  if (block?.error?.message) {
    console.warn("Google Vision error:", block.error.message);
    return { text: null };
  }

  const text = block?.fullTextAnnotation?.text?.trim() ?? "";
  return { text: text || null };
}

async function runOcrSpaceEngine(
  apiKey: string,
  imageBase64: string,
  engine: string
): Promise<string | null> {
  const form = new URLSearchParams();
  form.set("apikey", apiKey);
  form.set("base64Image", `data:image/jpeg;base64,${imageBase64}`);
  form.set("language", "eng");
  form.set("OCREngine", engine);
  form.set("isOverlayRequired", "false");
  form.set("detectOrientation", "true");
  form.set("scale", "true");
  form.set("isTable", "false");

  const res = await fetch("https://api.ocr.space/parse", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (!res.ok) return null;

  const payload = (await res.json()) as OcrSpaceResponse;
  if (payload.OCRExitCode !== 1) {
    console.warn("OCR.space", engine, payload.ErrorMessage ?? payload.OCRExitCode);
    return null;
  }

  const text =
    payload.ParsedResults?.map((r) => r.ParsedText?.trim() ?? "").filter(Boolean).join("\n") ?? "";
  return text || null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
