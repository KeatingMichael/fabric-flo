import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { RecentLocationChips } from "@/components/RecentLocationChips";
import { ScanCameraPanel } from "@/components/ScanCameraPanel";
import { useActiveProduction, useApp } from "@/context/AppStore";
import { hapticSuccess } from "@/lib/haptics";
import { joinLabelFields, looksLikeWeakFabricLine, looksLikeWeakJobLine, looksLikeWeakSizeLine } from "@/lib/labelOcr";
import type { LabelScanOutcome } from "@/lib/labelOcrCloud";
import {
  getLastLocationId,
  getRecentLocationIds,
  rememberRecentLocation,
} from "@/lib/recentLocations";
import { readScanNavState } from "@/lib/scanNavigation";
import { resolveScan } from "@/lib/scanResolve";
import type { LocationKind, ScanMethod } from "@/types";
import { LOCATION_KIND_LABEL, LOCATION_KIND_ORDER } from "@/types";

type ScanMode = "qr" | "label";

const RENTAL_FABRIC_HINTS = [
  "SOLID",
  "BLUE FOAM",
  "DIGI GREEN",
  "CHROMA GREEN",
  "DUVET",
  "DUVETYNE",
  "MUSLIN",
  "VELVET",
  "FOAM",
  "BOUNCE",
  "CHROMA",
  "BLACK",
  "WHITE",
  "GRID",
  "SILK",
  "SATIN",
  "SCRIM",
  "NET",
];

export function ScanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const production = useActiveProduction();
  const { logScan, linkUnknownScan, rememberHandwrittenMark, addLocation } = useApp();
  const scanNav = readScanNavState(location.state);
  const lockedLocationId = scanNav.lockedLocationId;
  const lockedLocationLabel = scanNav.lockedLocationLabel;
  const jobInputRef = useRef<HTMLInputElement>(null);
  const fabricInputRef = useRef<HTMLInputElement>(null);
  const sizeInputRef = useRef<HTMLInputElement>(null);
  const focusFieldAfterScan = useRef<"job" | "fabric" | "size" | null>(null);

  const [mode, setMode] = useState<ScanMode>("label");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [labelJob, setLabelJob] = useState("");
  const [labelFabric, setLabelFabric] = useState("");
  const [labelSize, setLabelSize] = useState("");
  const [locId, setLocId] = useState("");
  const [quickLocKind, setQuickLocKind] = useState<LocationKind>("filming_location");
  const [quickLocName, setQuickLocName] = useState("");
  const [locationUnlocked, setLocationUnlocked] = useState(false);
  const [savedFlash, setSavedFlash] = useState<{ itemName: string; locationLabel: string } | null>(
    null
  );

  const labelDraft = joinLabelFields(labelJob, labelFabric, labelSize);
  const scanText = (mode === "qr" ? manual : labelDraft).trim();

  const isLocationLocked = Boolean(
    lockedLocationId &&
      lockedLocationLabel &&
      !locationUnlocked &&
      production?.locations.some((l) => l.id === lockedLocationId)
  );

  const recentLocIds = useMemo(
    () => (production ? getRecentLocationIds(production.id) : []),
    [production?.id]
  );

  useEffect(() => {
    if (!production || production.locations.length === 0) return;
    if (isLocationLocked && lockedLocationId) {
      setLocId(lockedLocationId);
      return;
    }
    setLocId((current) => {
      if (current && production.locations.some((l) => l.id === current)) return current;
      const last = getLastLocationId(production.id);
      if (last && production.locations.some((l) => l.id === last)) return last;
      return production.locations[0]!.id;
    });
  }, [production, production?.locations, isLocationLocked, lockedLocationId]);

  useEffect(() => {
    if (!savedFlash) return;
    const timer = window.setTimeout(() => setSavedFlash(null), 2600);
    return () => window.clearTimeout(timer);
  }, [savedFlash]);

  function saveQuickPlace() {
    if (!production || !quickLocName.trim()) return;
    const id = addLocation(production.id, quickLocKind, quickLocName.trim());
    rememberRecentLocation(production.id, id);
    setLocId(id);
    setQuickLocName("");
    setCameraError(null);
  }

  function groupedLocs(kind: LocationKind) {
    return production?.locations.filter((l) => l.kind === kind) ?? [];
  }

  function scanMethodForAdd(): ScanMethod {
    return mode === "qr" ? "qr" : "label";
  }

  function unknownItemName(raw: string): string {
    const fabric = labelFabric.trim();
    const size = labelSize.trim();
    if (fabric && size) return `${fabric} · ${size}`;
    if (fabric) return fabric;
    if (labelJob.trim()) return labelJob.trim();
    return raw;
  }

  function clearLabelFields() {
    setLabelJob("");
    setLabelFabric("");
    setLabelSize("");
    setHint(null);
  }

  function onLabelScan(outcome: LabelScanOutcome) {
    setLabelJob(outcome.fields.job);
    setLabelFabric(outcome.fields.fabric);
    setLabelSize(outcome.fields.size);
    setHint(outcome.message);

    if (looksLikeWeakJobLine(outcome.fields.job)) focusFieldAfterScan.current = "job";
    else if (looksLikeWeakFabricLine(outcome.fields.fabric)) focusFieldAfterScan.current = "fabric";
    else if (looksLikeWeakSizeLine(outcome.fields.size)) focusFieldAfterScan.current = "size";
    else if (!outcome.fields.job) focusFieldAfterScan.current = "job";
  }

  function addToLog() {
    if (!production || !scanText) return;
    const loc = production.locations.find((l) => l.id === locId);
    if (!loc) {
      setHint("Pick a place first.");
      return;
    }

    rememberRecentLocation(production.id, loc.id);

    const resolved = resolveScan(production, scanText, scanMethodForAdd());
    const scanMethod = resolved.method;
    const itemName = resolved.item ? resolved.item.name : unknownItemName(scanText);

    if (resolved.item) {
      if (scanMethod === "label" || scanMethod === "manual") {
        rememberHandwrittenMark(production.id, resolved.item.id, scanText);
      }
      logScan({
        productionId: production.id,
        itemId: resolved.item.id,
        itemKind: resolved.item.kind,
        itemName: resolved.item.name,
        locationId: loc.id,
        locationKind: loc.kind,
        locationLabel: loc.name,
        rawQr: scanText,
        scanMethod,
      });
    } else {
      linkUnknownScan(production.id, scanText, "fabric", unknownItemName(scanText), loc.id);
    }

    setSavedFlash({ itemName, locationLabel: loc.name });
    hapticSuccess();
    setManual("");
    clearLabelFields();
    setLocationUnlocked(false);
    navigate("/scan", {
      replace: true,
      state: { lockedLocationId: loc.id, lockedLocationLabel: loc.name },
    });
  }

  function onQrDecoded(text: string) {
    setManual(text.trim());
    setHint("QR captured.");
    setCameraError(null);
  }

  useEffect(() => {
    if (mode !== "label" || !focusFieldAfterScan.current) return;
    const target = focusFieldAfterScan.current;
    focusFieldAfterScan.current = null;
    const input =
      target === "job"
        ? jobInputRef.current
        : target === "fabric"
          ? fabricInputRef.current
          : sizeInputRef.current;
    input?.focus();
    input?.select();
  }, [labelJob, labelFabric, labelSize, mode]);

  if (!production) {
    return (
      <div className="page stack">
        <h1>Log a piece</h1>
        <p>Open a production first.</p>
        <Link to="/app" className="btn btn-primary btn-block">
          Sign in
        </Link>
      </div>
    );
  }

  const hasPlaces = production.locations.length > 0;
  const canAddToLog = Boolean(scanText && locId && hasPlaces);
  const statusLine = cameraError ?? hint;

  return (
    <div className="page stack scan-page">
      <header className="scan-page__header">
        <h1>Scan</h1>
        <p className="scan-page__lead">
          {mode === "label"
            ? "Fill the frame with the white sticker, tap Scan — job, fabric, and size fill in below."
            : "Center the dynamic QR and tap Scan."}
        </p>
      </header>

      {savedFlash ? (
        <div className="scan-celebrate" role="status">
          <span className="scan-celebrate__icon" aria-hidden>
            ✓
          </span>
          <div>
            <strong>Logged!</strong>
            <div className="scan-celebrate__detail muted">
              {savedFlash.itemName} → {savedFlash.locationLabel}
            </div>
          </div>
        </div>
      ) : null}

      <div className="scan-mode-tabs" role="tablist" aria-label="Scan type">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "label" ? "true" : "false"}
          className={`scan-mode-tabs__btn${mode === "label" ? " scan-mode-tabs__btn--active" : ""}`}
          onClick={() => {
            setCameraError(null);
            setHint(null);
            setMode("label");
          }}
        >
          Rental label
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "qr" ? "true" : "false"}
          className={`scan-mode-tabs__btn${mode === "qr" ? " scan-mode-tabs__btn--active" : ""}`}
          onClick={() => {
            setCameraError(null);
            setHint(null);
            setMode("qr");
          }}
        >
          Dynamic QR
        </button>
      </div>

      <ScanCameraPanel
        mode={mode}
        onQrDecoded={onQrDecoded}
        onLabelFields={(fields) => {
          setLabelJob(fields.job);
          setLabelFabric(fields.fabric);
          setLabelSize(fields.size);
        }}
        onLabelScan={onLabelScan}
        onCameraError={setCameraError}
      />

      {statusLine ? (
        <p className={`scan-status scan-status--${cameraError ? "warn" : "ok"}`} role="status">
          {statusLine}
        </p>
      ) : null}

      <section className="card stack scan-sheet">
        {renderPlacePicker()}

        {mode === "label" ? renderLabelFields() : renderQrField()}

        <button
          type="button"
          className={`btn btn-block scan-cta${canAddToLog ? " scan-cta--ready" : ""}`}
          disabled={!canAddToLog}
          onClick={addToLog}
        >
          Add to Log
        </button>

        {scanText ? (
          <button
            type="button"
            className="scan-secondary-link"
            onClick={() =>
              goFabrics(mode === "qr" ? manual : labelDraft, mode === "qr" ? "qr" : "label")
            }
          >
            Match in Fabrics instead
          </button>
        ) : null}
      </section>

      <Link to="/dashboard" className="scan-cancel muted">
        Cancel
      </Link>
    </div>
  );

  function goFabrics(raw: string, scanMethod: ScanMethod) {
    const t = raw.trim();
    if (!t) return;
    navigate("/inventory", {
      state: {
        raw: t,
        scanMethod,
        lockedLocationId,
        lockedLocationLabel,
      },
    });
  }

  function renderPlacePicker() {
    if (isLocationLocked) {
      return (
        <div className="scan-place-locked">
          <span className="muted">Place</span>
          <strong>{lockedLocationLabel}</strong>
          <button type="button" className="scan-place-locked__change" onClick={() => setLocationUnlocked(true)}>
            Change
          </button>
        </div>
      );
    }
    if (!hasPlaces) {
      return (
        <div className="stack scan-place-setup">
          <p className="muted scan-place-setup__note">Add a place first.</p>
          <div className="row scan-place-setup__row">
            <select
              id="scan-quick-loc-kind"
              className="select"
              aria-label="Place type"
              value={quickLocKind}
              onChange={(e) => setQuickLocKind(e.target.value as LocationKind)}
            >
              {LOCATION_KIND_ORDER.map((kind) => (
                <option key={kind} value={kind}>
                  {LOCATION_KIND_LABEL[kind]}
                </option>
              ))}
            </select>
            <input
              id="scan-quick-loc-name"
              className="input"
              placeholder="Place name"
              value={quickLocName}
              onChange={(e) => setQuickLocName(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={!quickLocName.trim()}
              onClick={saveQuickPlace}
            >
              Add
            </button>
          </div>
        </div>
      );
    }
    return (
      <>
        <RecentLocationChips
          locations={production!.locations}
          recentIds={recentLocIds}
          selectedId={locId}
          onPick={setLocId}
        />
        <div className="field scan-field--compact">
          <label htmlFor="scan-log-loc">Place</label>
          <select
            id="scan-log-loc"
            className="select"
            value={locId}
            onChange={(e) => setLocId(e.target.value)}
          >
            <option value="">Choose…</option>
            {LOCATION_KIND_ORDER.map((kind) => {
              const group = groupedLocs(kind);
              if (!group.length) return null;
              return (
                <optgroup key={kind} label={LOCATION_KIND_LABEL[kind]}>
                  {group.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
      </>
    );
  }

  function renderLabelFields() {
    return (
      <div className="scan-label-fields">
        <p className="scan-field-hint muted">Filled by Scan — tap to fix</p>
        <div className="field">
          <label htmlFor="label-job">Job #</label>
          <input
            ref={jobInputRef}
            id="label-job"
            className="input input--hero"
            placeholder="111023"
            value={labelJob}
            onChange={(e) => setLabelJob(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="label-fabric">Fabric</label>
          <input
            id="label-fabric"
            ref={fabricInputRef}
            className="input input--hero"
            placeholder="SOLID"
            value={labelFabric}
            onChange={(e) => setLabelFabric(e.target.value)}
            list="label-fabric-hints"
            autoComplete="off"
            autoCapitalize="characters"
          />
          <datalist id="label-fabric-hints">
            {RENTAL_FABRIC_HINTS.map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="label-size">Size</label>
          <input
            id="label-size"
            ref={sizeInputRef}
            className="input input--hero"
            placeholder={"12' x 12'"}
            value={labelSize}
            onChange={(e) => setLabelSize(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>
    );
  }

  function renderQrField() {
    return (
      <div className="field scan-field--compact">
        <label htmlFor="scan-qr-manual">QR value</label>
        <textarea
          id="scan-qr-manual"
          className="textarea"
          placeholder="Paste if the camera did not read it"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          rows={3}
        />
      </div>
    );
  }
}
