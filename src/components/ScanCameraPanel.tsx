import { useEffect, useRef, useState } from "react";
import { playCameraShutter } from "@/lib/cameraFeedback";
import { hapticCameraCapture, hapticSuccess } from "@/lib/haptics";
import { cropVideoFrameToGuide } from "@/lib/labelOcrImage";
import {
  scanLabelFromCapture,
  type LabelScanOutcome,
} from "@/lib/labelOcrCloud";
import type { LabelOcrFields } from "@/lib/labelOcr";
import { captureVideoFrame, decodeQrFromCanvas } from "@/lib/scanQrFromImage";

type ScanMode = "qr" | "label";

type Props = {
  mode: ScanMode;
  onQrDecoded: (text: string) => void;
  onLabelText?: (text: string) => void;
  onLabelFields?: (fields: LabelOcrFields) => void;
  onLabelScan?: (outcome: LabelScanOutcome) => void;
  onError?: (message: string | null) => void;
};

function triggerCaptureFeedback(setFlash: (on: boolean) => void): void {
  hapticCameraCapture();
  playCameraShutter();
  setFlash(true);
  window.setTimeout(() => setFlash(false), 120);
}

export function ScanCameraPanel({
  mode,
  onQrDecoded,
  onLabelText,
  onLabelFields,
  onLabelScan,
  onError,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [readBanner, setReadBanner] = useState<{ message: string; ok: boolean } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    setReady(false);
    setPreview(null);
    setReadBanner(null);
    onError?.(null);

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
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
  }, [mode, onError]);

  async function onScan() {
    const video = videoRef.current;
    if (!video || !ready || busy) return;

    triggerCaptureFeedback(setFlash);
    setBusy(true);
    setPreview(null);
    setReadBanner(null);
    onError?.(null);

    try {
      const canvas = mode === "label" ? cropVideoFrameToGuide(video) : await captureVideoFrame(video);
      const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.88);
      setPreview(jpegDataUrl);

      if (mode === "qr") {
        const text = await decodeQrFromCanvas(canvas);
        if (!text?.trim()) {
          onError?.("No QR code in frame — center the code and tap SCAN again.");
          return;
        }
        hapticSuccess();
        onQrDecoded(text.trim());
        return;
      }

      setReadBanner({ message: "Sending label…", ok: false });
      const outcome = await scanLabelFromCapture(canvas, jpegDataUrl);
      const hasFields = Boolean(outcome.fields.job || outcome.fields.fabric || outcome.fields.size);
      const ok = outcome.status === "success" || outcome.status === "partial";

      setReadBanner({ message: outcome.message, ok: hasFields && ok });

      onLabelFields?.(outcome.fields);
      onLabelText?.([outcome.fields.job, outcome.fields.fabric, outcome.fields.size].filter(Boolean).join(" / "));
      onLabelScan?.(outcome);

      if (hasFields) {
        hapticSuccess();
        onError?.(ok ? null : outcome.message);
      } else {
        onError?.(outcome.message);
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Could not read scan.";
      const message =
        raw.includes("MIME type") || raw.includes("Failed to fetch") || raw.includes("Load failed")
          ? "Could not reach label reading. Pull down to refresh the page, then try SCAN again — or type below."
          : raw || "Could not read scan.";
      setReadBanner({ message, ok: false });
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  const hint =
    mode === "qr"
      ? "Center the dynamic QR in the frame, then tap SCAN."
      : "Fill the frame with the whole white label — any handwriting layout is fine. Good light, then tap SCAN.";

  return (
    <div className="stack scan-camera">
      <div className={`scan-viewfinder${mode === "label" ? " scan-viewfinder--label" : ""}`}>
        <video ref={videoRef} className="scan-viewfinder__video" playsInline muted />
        <div className="scan-viewfinder__guide" aria-hidden>
          <span className="scan-corner scan-corner--tl" />
          <span className="scan-corner scan-corner--tr" />
          <span className="scan-corner scan-corner--bl" />
          <span className="scan-corner scan-corner--br" />
        </div>
        <div className={`scan-viewfinder__flash${flash ? " scan-viewfinder__flash--on" : ""}`} aria-hidden />
        {!ready ? (
          <div className="scan-viewfinder__loading muted">Starting camera…</div>
        ) : null}
        {busy ? (
          <div className="scan-viewfinder__reading muted" role="status">
            Reading label…
          </div>
        ) : null}
        <button
          type="button"
          className="btn btn-primary scan-viewfinder__scan-btn"
          disabled={!ready || busy}
          onPointerDown={(e) => {
            e.preventDefault();
            if (!ready || busy) return;
            void onScan();
          }}
        >
          {busy ? "Reading…" : "SCAN"}
        </button>
      </div>
      <p className="muted scan-camera__hint">{hint}</p>
      {readBanner ? (
        <div
          className={`scan-read-banner${readBanner.ok ? " scan-read-banner--ok" : " scan-read-banner--warn"}`}
          role="status"
        >
          {readBanner.message}
        </div>
      ) : null}
      {preview ? (
        <img
          src={preview}
          alt="Last capture"
          className="scan-camera__preview"
        />
      ) : null}
    </div>
  );
}
