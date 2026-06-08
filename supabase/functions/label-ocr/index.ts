/**
 * Handwriting OCR for rental labels (Supabase Edge Function).
 *
 * Deploy: supabase functions deploy label-ocr
 *
 * Set ONE of these secrets (OCR.space is easiest — no credit card):
 *   supabase secrets set OCR_SPACE_API_KEY=your_key
 *   supabase secrets set GOOGLE_VISION_API_KEY=your_key
 *
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
    error?: { message?: string };
  }>;
};

type OcrSpaceResponse = {
  OCRExitCode?: number;
  ErrorMessage?: string;
  ParsedResults?: Array<{ ParsedText?: string }>;
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
      return json({ error: "vision_not_configured" }, 501);
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

    const body = (await req.json()) as { imageBase64?: string };
    const imageBase64 = body.imageBase64?.trim();
    if (!imageBase64 || imageBase64.length < 32) {
      return json({ error: "missing_image" }, 400);
    }
    if (imageBase64.length > 8_000_000) {
      return json({ error: "image_too_large" }, 413);
    }

    if (visionKey) {
      const googleText = await runGoogleVision(visionKey, imageBase64);
      if (googleText) return json({ text: googleText, provider: "google" });
    }

    if (ocrSpaceKey) {
      const ocrSpaceText = await runOcrSpaceCombined(ocrSpaceKey, imageBase64);
      if (ocrSpaceText) return json({ text: ocrSpaceText, provider: "ocrspace" });
    }

    return json({ error: "no_text_detected" }, 422);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

async function runGoogleVision(apiKey: string, imageBase64: string): Promise<string | null> {
  const visionRes = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBase64 },
            features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
            imageContext: { languageHints: ["en"] },
          },
        ],
      }),
    }
  );

  if (!visionRes.ok) return null;

  const vision = (await visionRes.json()) as VisionResponse;
  const block = vision.responses?.[0];
  if (block?.error?.message) return null;

  const text = block?.fullTextAnnotation?.text?.trim() ?? "";
  return text || null;
}

async function runOcrSpaceCombined(apiKey: string, imageBase64: string): Promise<string | null> {
  if (imageBase64.length > 1_350_000) return null;

  const chunks: string[] = [];
  for (const engine of ["2", "1"] as const) {
    const text = await runOcrSpaceEngine(apiKey, imageBase64, engine);
    if (text) chunks.push(text);
  }
  if (!chunks.length) return null;
  return mergeOcrTexts(chunks);
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
  const form = new URLSearchParams();
  form.set("apikey", apiKey);
  form.set("base64Image", `data:image/jpeg;base64,${imageBase64}`);
  form.set("language", "eng");
  form.set("OCREngine", engine);
  form.set("isOverlayRequired", "false");
  form.set("detectOrientation", "true");
  form.set("scale", "true");

  const res = await fetch("https://api.ocr.space/parse", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (!res.ok) return null;

  const payload = (await res.json()) as OcrSpaceResponse;
  if (payload.OCRExitCode !== 1) return null;

  const text = payload.ParsedResults?.[0]?.ParsedText?.trim() ?? "";
  return text || null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
