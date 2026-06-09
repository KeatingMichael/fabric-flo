/**
 * Handwriting OCR for rental labels (Supabase Edge Function).
 *
 * Deploy: supabase functions deploy label-ocr --project-ref YOUR_PROJECT_REF
 *
 * Secrets:
 *   GOOGLE_VISION_API_KEY  — Cloud Vision (billing + Vision API enabled)
 *   GEMINI_API_KEY         — optional Gemini Flash (Generative Language API)
 *   OCR_SPACE_API_KEY      — OCR.space fallback (always worth setting)
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
  stripsBase64?: string[];
};

type OcrAttempt = {
  text: string | null;
  provider?: string;
  detail?: string;
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
    const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
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
    const strips = body.stripsBase64?.filter((s) => s && s.length > 32) ?? [];

    const best = await runAllProviders(
      imageBase64,
      altImageBase64,
      strips,
      visionKey,
      geminiKey,
      ocrSpaceKey
    );

    if (best.text) {
      return json({
        text: best.text,
        rawText: best.text,
        provider: best.provider ?? "unknown",
      });
    }

    return json({
      text: "",
      rawText: "",
      error: "no_text_detected",
      detail: best.detail ?? "ocr_miss",
    });
  } catch (e) {
    return json({ text: "", error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

async function runAllProviders(
  imageBase64: string,
  altImageBase64: string | undefined,
  stripsBase64: string[],
  visionKey?: string,
  geminiKey?: string,
  ocrSpaceKey?: string
): Promise<OcrAttempt> {
  const images = [imageBase64, altImageBase64].filter(
    (img): img is string => Boolean(img && img.length > 32)
  );
  const tasks: Promise<OcrAttempt>[] = [];

  for (const img of images) {
    if (visionKey) {
      tasks.push(runGoogleVision(img, visionKey).then((r) => ({ ...r, provider: "google" })));
    }
    if (geminiKey) {
      tasks.push(runGeminiLabelRead(img, geminiKey).then((r) => ({ ...r, provider: "gemini" })));
    }
    if (ocrSpaceKey && img.length <= 1_350_000) {
      tasks.push(
        runOcrSpaceEngine(ocrSpaceKey, img, "2").then((text) => ({ text, provider: "ocrspace" }))
      );
      tasks.push(
        runOcrSpaceEngine(ocrSpaceKey, img, "1").then((text) => ({ text, provider: "ocrspace" }))
      );
    }
  }

  if (ocrSpaceKey) {
    for (const strip of stripsBase64.slice(0, 3)) {
      if (strip.length > 1_350_000) continue;
      tasks.push(
        runOcrSpaceEngine(ocrSpaceKey, strip, "2").then((text) => ({ text, provider: "ocrspace" }))
      );
    }
  }

  const results = await Promise.all(tasks);
  let best: OcrAttempt = { text: null, detail: "ocr_miss" };

  for (const result of results) {
    if (result.detail && !result.text && best.detail === "ocr_miss") {
      best.detail = result.detail;
    }
    if (!result.text) continue;
    const score = scoreText(result.text);
    const bestScore = best.text ? scoreText(best.text) : 0;
    if (score > bestScore) best = result;
  }

  return best;
}

function scoreText(text: string): number {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 2);
  let score = lines.length * 10;
  if (/\d{4,8}/.test(text)) score += 15;
  if (/blue foam|solid|muslin|duvet|velvet|chroma|foam|bounce/i.test(text)) score += 10;
  if (/\d+\s*['′]?\s*[xX×]\s*\d+/i.test(text)) score += 10;
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

async function runGeminiLabelRead(imageBase64: string, apiKey: string): Promise<OcrAttempt> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
                    "Read the white rental fabric label. Reply with exactly 3 lines: job number (digits), fabric name, size. Example:\n111023\nSOLID\n12' x 12'",
                },
                { inline_data: { mime_type: "image/jpeg", data: imageBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 80 },
        }),
      }
    );

    if (!res.ok) {
      console.warn("Gemini HTTP", res.status, await res.text());
      return { text: null };
    }

    const body = (await res.json()) as GeminiResponse;
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    return { text: text || null };
  } catch (e) {
    console.warn("Gemini error:", e);
    return { text: null };
  }
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
