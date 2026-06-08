/**
 * Handwriting OCR via Google Cloud Vision (DOCUMENT_TEXT_DETECTION).
 *
 * Deploy: supabase functions deploy label-ocr
 * Secret: supabase secrets set GOOGLE_VISION_API_KEY=your_key
 *
 * Requires Authorization: Bearer <user JWT> (same as other app functions).
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
    if (!visionKey) {
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

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`,
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

    if (!visionRes.ok) {
      const detail = await visionRes.text();
      return json({ error: "vision_request_failed", detail: detail.slice(0, 240) }, 502);
    }

    const vision = (await visionRes.json()) as VisionResponse;
    const block = vision.responses?.[0];
    if (block?.error?.message) {
      return json({ error: "vision_error", detail: block.error.message }, 502);
    }

    const text = block?.fullTextAnnotation?.text?.trim() ?? "";
    if (!text) {
      return json({ error: "no_text_detected" }, 422);
    }

    return json({ text });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
