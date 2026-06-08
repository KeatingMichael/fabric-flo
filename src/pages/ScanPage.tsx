import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ScanCameraPanel } from "@/components/ScanCameraPanel";
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

  function onQrDecoded(text: string) {
    hapticSuccess();
    goFabrics(text, "qr");
  }

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
          onClick={() => {
            setError(null);
            setMode("qr");
          }}
        >
          Dynamic QR
        </button>
        <button
          type="button"
          className={`btn ${mode === "label" ? "btn-primary" : "btn-secondary"}`}
          style={{ flex: 1 }}
          onClick={() => {
            setError(null);
            setMode("label");
          }}
        >
          Handwritten label
        </button>
      </div>

      <ScanCameraPanel
        mode={mode}
        onQrDecoded={onQrDecoded}
        onLabelText={(text) => {
          setError(null);
          setLabelDraft(text);
        }}
        onError={setError}
      />

      {error ? (
        <div className="card" style={{ borderColor: "rgba(251,191,36,0.35)" }}>
          <strong style={{ color: "var(--warning)" }}>{mode === "qr" ? "Scan" : "Label"}</strong>
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
