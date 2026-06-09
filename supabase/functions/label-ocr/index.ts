/**
 * Handwriting OCR for rental labels (Supabase Edge Function).
 *
 * Deploy: supabase functions deploy label-ocr --project-ref YOUR_PROJECT_REF
 *
 * Recommended (fast + accurate):
 *   supabase secrets set GOOGLE_VISION_API_KEY=your_key
 *
 * Free fallback (slower):
 *   supabase secrets set OCR_SPACE_API_KEY=your_key
 *
 * If both are set, Google Vision runs first; OCR.space is fallback.
 * Requires Authorization: Bearer <user JWT>.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type VisionResponse = {
  responses?: Array<{
    fullTextAnnotation?: { text?: string };
    textAnnotations?: Array<{ description?: string }>;
    error?: { message?: string };
  }>;
};

type OcrSpaceResponse = {
  OCRExitCode?: number;
  ErrorMessage?: string;
  ParsedResults?: Array<{ ParsedText?: string }>;
};

type LabelOcrBody = {
  imageBase64?: string;
  stripsBase64?: string[];
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
    const ocrSpaceKey = Deno.env.get("OCR_SPACE_API_KEY")?.trim();
    if (!visionKey && !ocrSpaceKey) {
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

    const strips = body.stripsBase64?.filter((s) => s && s.length > 32) ?? [];
    let ocrDetail: string | undefined;

    if (visionKey) {
      const google = await runGoogleVisionPrimary(visionKey, imageBase64, strips);
      if (google.text) {
        return json({ text: google.text, rawText: google.text, provider: "google" });
      }
      ocrDetail = google.detail;
      if (ocrDetail) console.warn("Google Vision failed:", ocrDetail);
    }

    if (ocrSpaceKey) {
      const ocrSpaceText = await runOcrSpaceCombined(ocrSpaceKey, imageBase64, strips);
      if (ocrSpaceText) {
        return json({ text: ocrSpaceText, rawText: ocrSpaceText, provider: "ocrspace" });
      }
    }

    return json({ text: "", rawText: "", error: "no_text_detected", detail: ocrDetail ?? "ocr_miss" });
  } catch (e) {
    return json({ text: "", error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

/** Strips first (one Vision batch), then full frame, then OCR.space. */
async function runGoogleVisionPrimary(
  apiKey: string,
  imageBase64: string,
  stripsBase64: string[]
): Promise<{ text: string | null; detail?: string }> {
  if (stripsBase64.length >= 3) {
    const stripResult = await runGoogleVisionBatch(apiKey, stripsBase64.slice(0, 3));
    if (stripResult.detail && !stripResult.text) return { text: null, detail: stripResult.detail };
    const stripText = stripResult.text;
    if (stripText && countUsefulLines(stripText) >= 2) {
      return { text: stripText };
    }
    if (stripText && countUsefulLines(stripText) >= 1) {
      const fullResult = await runGoogleVisionBatch(apiKey, [imageBase64]);
      if (fullResult.detail && !fullResult.text) return { text: stripText, detail: fullResult.detail };
      if (fullResult.text) return { text: mergeOcrTexts([stripText, fullResult.text]) };
      return { text: stripText };
    }
  }

  const fullResult = await runGoogleVisionBatch(apiKey, [imageBase64]);
  return { text: fullResult.text, detail: fullResult.detail };
}

function countUsefulLines(text: string): number {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 2).length;
}

async function runGoogleVisionBatch(
  apiKey: string,
  imagesBase64: string[]
): Promise<{ text: string | null; detail?: string }> {
  if (!imagesBase64.length) return { text: null };

  const visionRes = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: imagesBase64.map((content) => ({
          image: { content },
          features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
          imageContext: { languageHints: ["en"] },
        })),
      }),
    }
  );

  if (!visionRes.ok) {
    const errBody = await visionRes.text();
    console.warn("Google Vision HTTP", visionRes.status, errBody.slice(0, 320));
    const detail =
      visionRes.status === 403 || /billing|PERMISSION_DENIED/i.test(errBody) ? "google_billing" : undefined;
    return { text: null, detail };
  }

  const vision = (await visionRes.json()) as VisionResponse;
  const chunks: string[] = [];

  for (const block of vision.responses ?? []) {
    if (block?.error?.message) {
      console.warn("Google Vision block error:", block.error.message);
      continue;
    }
    const text = block?.fullTextAnnotation?.text?.trim();
    if (text) chunks.push(text);
  }

  if (!chunks.length) return { text: null };
  return { text: mergeOcrTexts(chunks) };
}

async function runOcrSpaceCombined(
  apiKey: string,
  imageBase64: string,
  stripsBase64: string[]
): Promise<string | null> {
  if (stripsBase64.length >= 3) {
    const stripTexts = await Promise.all(
      stripsBase64.slice(0, 3).map((strip) => runOcrSpaceEngine(apiKey, strip, "2"))
    );
    const ordered = stripTexts.map((t) => t?.trim() ?? "");
    const filled = ordered.filter(Boolean);
    if (filled.length >= 2) {
      return filled.join("\n");
    }
    if (filled.length === 1 && imageBase64.length <= 1_350_000) {
      const full = await runOcrSpaceEngine(apiKey, imageBase64, "2");
      if (full) return mergeOcrTexts([filled[0]!, full]);
      return filled[0]!;
    }
    if (filled.length === 1) return filled[0]!;
  }

  if (imageBase64.length > 1_350_000) return null;
  return runOcrSpaceEngine(apiKey, imageBase64, "2");
}

function mergeOcrTexts(chunks: string[]): string {
  const lines = new Set<string>();
  for (const chunk of chunks) {
    for (const line of chunk.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.length >= 2) lines.add(trimmed);
    }
  }
  return [...lines].join("\n");
}

async function runOcrSpaceEngine(
  apiKey: string,
  imageBase64: string,
  engine: string
): Promise<string | null> {
  if (imageBase64.length > 1_350_000) return null;

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
    console.warn("OCR.space engine", engine, payload.ErrorMessage ?? payload.OCRExitCode);
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
