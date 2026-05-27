/** Run OCR on an image source (canvas, image element, or data URL). */
export async function recognizeLabelFromImage(
  source: HTMLCanvasElement | HTMLImageElement | string
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: () => {},
  });
  try {
    const {
      data: { text },
    } = await worker.recognize(source);
    return text.replace(/\s+/g, " ").trim();
  } finally {
    await worker.terminate();
  }
}
