import { parseRawTextToLabelFields, type LabelOcrFields } from "@/lib/labelOcr";
import { getSupabase } from "@/lib/supabase";

type LabelOcrResponse = {
  text?: string;
  error?: string;
};

/** Cloud handwriting OCR (Google Vision via Supabase Edge Function). Returns null when unavailable. */
export async function recognizeLabelFieldsCloud(jpegDataUrl: string): Promise<LabelOcrFields | null> {
  const sb = getSupabase();
  if (!sb || !navigator.onLine) return null;

  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) return null;

  const base64 = jpegDataUrl.replace(/^data:image\/\w+;base64,/, "");
  if (!base64) return null;

  try {
    const { data, error } = await sb.functions.invoke<LabelOcrResponse>("label-ocr", {
      body: { imageBase64: base64 },
    });

    if (error) return null;
    if (!data?.text || data.error === "vision_not_configured") return null;

    return parseRawTextToLabelFields(data.text);
  } catch {
    return null;
  }
}
