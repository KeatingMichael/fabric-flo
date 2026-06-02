import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { Html5Qrcode } from "html5-qrcode";
import { LabelCameraCapture } from "@/components/LabelCameraCapture";
import { isNativeApp } from "@/lib/native";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { readScanNavState } from "@/lib/scanNavigation";
import type { ScanMethod } from "@/types";

type ScanMode = "qr" | "label";

export function ScanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const scanNav = readScanNavState(location.state);
  const lockedLocationId = scanNav.lockedLocationId;
  const lockedLocationLabel = scanNav.lockedLocationLabel;

  const [mode, setMode] = useState<ScanMode>("qr");
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [labelDraft, setLabelDraft] = useState("");
  const handledRef = useRef(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  function goFabrics(raw: string, scanMethod: ScanMethod) {
    const t = raw.trim();
    if (!t) return;
    hapticLight();
    navigate("/inventory", {
      state: {
        raw: t,
        scanMethod,
        lockedLocationId,
        lockedLocationLabel,
      },
    });
  }

  function clearLockedLocation() {
    navigate("/scan", { replace: true, state: {} });
  }

  useEffect(() => {
    if (mode !== "qr") {
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        void s
          .stop()
          .then(() => s.clear())
          .catch(() => {});
      }
      return;
    }

    handledRef.current = false;
    const boxId = "qr-region";
    let cancelled = false;

    const onOk = (text: string, scanner: Html5Qrcode) => {
      if (handledRef.current) return;
      handledRef.current = true;
      hapticSuccess();
      void scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {})
        .finally(() => {
          goFabrics(text, "qr");
        });
    };

    const start = async () => {
      setError(null);
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(boxId, { verbose: false });
        if (cancelled) {
          scanner.clear();
          return;
        }
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 280, height: 280 } },
          (text) => onOk(text, scanner),
          () => {}
        );
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Camera could not start.";
          setError(msg);
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        void s
          .stop()
          .then(() => s.clear())
          .catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goFabrics closes over locked location from router state
  }, [mode, navigate, lockedLocationId, lockedLocationLabel]);

  return (
    <div className="page stack">
      <h1>Scan</h1>
      <p>
        Use <strong>Dynamic QR code</strong> or <strong>Handwritten label</strong> with rental-house numbers on
        gear today. Both can flow into the same log and inventory.
        {isNativeApp() ? " Camera access is not recorded." : null}
      </p>

      {lockedLocationLabel ? (
        <div className="card locked-location-banner" style={{ borderColor: "rgba(56, 189, 248, 0.35)" }}>
          <div className="row" style={{ justifyContent: "space-between", width: "100%", alignItems: "flex-start" }}>
            <div>
              <div className="muted" style={{ fontSize: "0.82rem" }}>
                Same place for every scan
              </div>
              <strong>{lockedLocationLabel}</strong>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ minHeight: 40, padding: "0.35rem 0.65rem", fontSize: "0.82rem" }}
              onClick={clearLockedLocation}
            >
              Change
            </button>
          </div>
        </div>
      ) : null}

      <div className="row" style={{ width: "100%" }}>
        <button
          type="button"
          className={`btn ${mode === "qr" ? "btn-primary" : "btn-secondary"}`}
          style={{ flex: 1 }}
          onClick={() => setMode("qr")}
        >
          Dynamic QR
        </button>
        <button
          type="button"
          className={`btn ${mode === "label" ? "btn-primary" : "btn-secondary"}`}
          style={{ flex: 1 }}
          onClick={() => setMode("label")}
        >
          Handwritten label
        </button>
      </div>

      {mode === "qr" ? (
        <>
          <div
            id="qr-region"
            style={{
              width: "100%",
              minHeight: 280,
              borderRadius: "var(--radius)",
              overflow: "hidden",
              border: "1px solid var(--border)",
              background: "#020617",
            }}
          />
          {error ? (
            <div className="card" style={{ borderColor: "rgba(251,191,36,0.35)" }}>
              <strong style={{ color: "var(--warning)" }}>Camera</strong>
              <p style={{ marginBottom: 0 }}>{error}</p>
            </div>
          ) : null}
        </>
      ) : (
        <LabelCameraCapture
          onText={(text) => setLabelDraft(text)}
          onError={(msg) => setError(msg)}
        />
      )}

      {error && mode === "label" ? (
        <div className="card" style={{ borderColor: "rgba(251,191,36,0.35)" }}>
          <p style={{ marginBottom: 0 }}>{error}</p>
        </div>
      ) : null}

      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>
          {mode === "qr" ? "Paste QR value" : "Label text"}
        </h2>
        <p style={{ marginBottom: 0 }}>
          {mode === "qr"
            ? "If the camera is unavailable, paste the QR JSON or code here."
            : "Correct OCR mistakes, or type what is written on the case."}
        </p>
        <textarea
          className="textarea"
          placeholder={
            mode === "qr"
              ? "Paste dynamic QR JSON…"
              : 'e.g. 1247, A-12, BLUE VEL 12x12…'
          }
          value={mode === "qr" ? manual : labelDraft}
          onChange={(e) =>
            mode === "qr" ? setManual(e.target.value) : setLabelDraft(e.target.value)
          }
        />
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!(mode === "qr" ? manual : labelDraft).trim()}
          onClick={() =>
            goFabrics(mode === "qr" ? manual : labelDraft, mode === "qr" ? "qr" : "label")
          }
        >
          Continue to Fabrics
        </button>
      </section>

      <Link to="/dashboard" className="btn btn-secondary btn-block">
        Cancel
      </Link>
    </div>
  );
}
