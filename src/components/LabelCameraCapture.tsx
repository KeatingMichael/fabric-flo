import { useEffect, useRef, useState } from "react";
import { recognizeLabelFromImage } from "@/lib/labelOcr";

type Props = {
  onText: (text: string) => void;
  onError?: (message: string) => void;
};

export function LabelCameraCapture({ onText, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setReady(true);
        }
      } catch (e) {
        onError?.(e instanceof Error ? e.message : "Camera could not start.");
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onError]);

  async function captureAndRead() {
    const video = videoRef.current;
    if (!video || !ready) return;
    setBusy(true);
    setPreview(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not capture frame.");
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      setPreview(dataUrl);
      const text = await recognizeLabelFromImage(canvas);
      if (!text) {
        onError?.("No text detected — try brighter light, closer framing, or type the label below.");
        return;
      }
      onText(text);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Could not read label.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack label-capture">
      <div
        className="label-capture__frame"
        style={{
          position: "relative",
          width: "100%",
          minHeight: 220,
          borderRadius: "var(--radius)",
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "#020617",
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: "100%", display: "block", objectFit: "cover", minHeight: 220 }}
        />
        {!ready ? (
          <div
            className="muted"
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "rgba(2,6,23,0.7)",
            }}
          >
            Starting camera…
          </div>
        ) : null}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        Frame the handwritten sticker or rental-house number. Tap read, then fix any mistakes before
        continuing.
      </p>
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!ready || busy}
        onClick={() => void captureAndRead()}
      >
        {busy ? "Reading label…" : "Read handwritten label"}
      </button>
      {preview ? (
        <img
          src={preview}
          alt="Last captured label"
          style={{ width: "100%", maxHeight: 120, objectFit: "contain", borderRadius: "var(--radius-sm)" }}
        />
      ) : null}
    </div>
  );
}
