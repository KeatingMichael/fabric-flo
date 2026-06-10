import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { RecentLocationChips } from "@/components/RecentLocationChips";
import { ScanCameraPanel } from "@/components/ScanCameraPanel";
import { ScanFlowProgress } from "@/components/ScanFlowProgress";
import { useActiveProduction, useApp } from "@/context/AppStore";
import { hapticSuccess } from "@/lib/haptics";
import {
  joinLabelFields,
  looksLikeWeakFabricLine,
  looksLikeWeakJobLine,
  looksLikeWeakSizeLine,
  polishLabelFields,
} from "@/lib/labelOcr";
import type { LabelScanOutcome } from "@/lib/labelOcrCloud";
import { validateLabelFieldsAgainstInventory } from "@/lib/labelInventoryValidate";
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
type FlowStep = 1 | 2;

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
  const quickLocNameRef = useRef<HTMLInputElement>(null);
  const focusFieldAfterScan = useRef<"job" | "fabric" | "size" | null>(null);

  const [flowStep, setFlowStep] = useState<FlowStep>(1);
  const [mode, setMode] = useState<ScanMode>("label");
  const [cameraOpen, setCameraOpen] = useState(false);
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
  const labelReady = Boolean(labelJob.trim() && labelFabric.trim() && labelSize.trim());

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

  const progressStep = savedFlash ? 3 : flowStep;

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
    const timer = window.setTimeout(() => {
      setSavedFlash(null);
      setFlowStep(1);
    }, 2600);
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

  function onScanStart() {
    setHint("Reading…");
  }

  function onLabelScan(outcome: LabelScanOutcome) {
    const hasFields = Boolean(outcome.fields.job || outcome.fields.fabric || outcome.fields.size);

    if (!hasFields || outcome.status === "no_text") {
      setHint("Type the three lines below — camera is optional.");
      return;
    }

    let fields = outcome.fields;
    let message = outcome.message;

    const polishRaw = joinLabelFields(fields.job, fields.fabric, fields.size);
    fields = polishLabelFields(polishRaw, fields);

    if (production) {
      const validated = validateLabelFieldsAgainstInventory(production, fields);
      fields = validated.fields;
      if (validated.corrected) {
        message = validated.hint ?? outcome.message;
      } else if (validated.hint) {
        message = validated.hint;
      }
    }

    setLabelJob(fields.job);
    setLabelFabric(fields.fabric);
    setLabelSize(fields.size);
    setCameraOpen(false);

    const weakAfter =
      looksLikeWeakJobLine(fields.job) ||
      looksLikeWeakFabricLine(fields.fabric) ||
      looksLikeWeakSizeLine(fields.size);

    if (weakAfter) {
      setHint("Fix any line, then tap Next.");
    } else if (message.includes("inventory") || message.includes("Matched")) {
      setHint(message);
    } else {
      setHint("Looks good — tap Next.");
    }

    if (
      fields.job.trim() &&
      fields.fabric.trim() &&
      fields.size.trim() &&
      !looksLikeWeakJobLine(fields.job) &&
      !looksLikeWeakFabricLine(fields.fabric) &&
      !looksLikeWeakSizeLine(fields.size)
    ) {
      setFlowStep(2);
    } else if (looksLikeWeakJobLine(fields.job)) focusFieldAfterScan.current = "job";
    else if (looksLikeWeakFabricLine(fields.fabric)) focusFieldAfterScan.current = "fabric";
    else if (looksLikeWeakSizeLine(fields.size)) focusFieldAfterScan.current = "size";
    else if (!fields.job) focusFieldAfterScan.current = "job";
  }

  function focusPlacePicker() {
    if (isLocationLocked) return;
    if (!hasPlaces) {
      quickLocNameRef.current?.focus();
      return;
    }
    document.getElementById("scan-log-loc")?.focus();
  }

  function addToLog() {
    if (!production || !scanText) return;

    let placeId = locId;
    let loc = production.locations.find((l) => l.id === placeId);
    if (!loc && quickLocName.trim()) {
      placeId = addLocation(production.id, quickLocKind, quickLocName.trim());
      rememberRecentLocation(production.id, placeId);
      loc = { id: placeId, kind: quickLocKind, name: quickLocName.trim() };
      setLocId(placeId);
      setQuickLocName("");
    }
    if (!loc) {
      setHint("Pick or add a place first.");
      focusPlacePicker();
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
    setHint(null);
    navigate("/scan", {
      replace: true,
      state: { lockedLocationId: loc.id, lockedLocationLabel: loc.name },
    });
  }

  function onQrDecoded(text: string) {
    setManual(text.trim());
    setHint("QR captured — tap Add to Log.");
    setCameraError(null);
    setFlowStep(2);
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
      <div className="page stack scan-page">
        <h1>Log a piece</h1>
        <p className="muted">Open a production first.</p>
        <Link to="/app" className="btn btn-primary btn-block scan-cta scan-cta--ready">
          Sign in
        </Link>
      </div>
    );
  }

  const hasPlaces = production.locations.length > 0;
  const statusLine = cameraError ?? hint;

  if (mode === "qr") {
    return (
      <div className="page stack scan-page">
        <ScanFlowProgress step={progressStep} />
        <header className="scan-page__header">
          <h1>Dynamic QR</h1>
          <p className="scan-page__lead">Center the QR and tap Scan.</p>
        </header>
        <ScanCameraPanel
          mode="qr"
          onQrDecoded={onQrDecoded}
          onScanStart={onScanStart}
          autoCapture={false}
          onCameraError={setCameraError}
        />
        {statusLine ? (
          <p className={`scan-status scan-status--${cameraError ? "warn" : "ok"}`} role="status">
            {statusLine}
          </p>
        ) : null}
        <div className="field">
          <label htmlFor="scan-qr-manual">Or paste QR value</label>
          <textarea
            id="scan-qr-manual"
            className="textarea"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            rows={2}
          />
        </div>
        {renderPlaceSection()}
        <button
          type="button"
          className={`btn btn-block scan-cta${scanText ? " scan-cta--ready" : ""}`}
          disabled={!scanText}
          onClick={addToLog}
        >
          Add to Log
        </button>
        <button
          type="button"
          className="scan-secondary-link"
          onClick={() => {
            setMode("label");
            setManual("");
            setFlowStep(1);
          }}
        >
          ← Rental label instead
        </button>
      </div>
    );
  }

  return (
    <div className="page stack scan-page">
      <ScanFlowProgress step={progressStep} />

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

      {flowStep === 1 ? renderLabelStep() : renderPlaceStep()}

      {flowStep === 1 ? (
        <button type="button" className="scan-secondary-link" onClick={() => setMode("qr")}>
          Dynamic QR instead
        </button>
      ) : null}
    </div>
  );

  function renderLabelStep() {
    return (
      <>
        <header className="scan-page__header">
          <h1>What&apos;s on the sticker?</h1>
          <p className="scan-page__lead">Type the three lines — camera is optional.</p>
        </header>

        <div className="scan-label-fields">
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

        {!cameraOpen ? (
          <button type="button" className="scan-rescan-link" onClick={() => setCameraOpen(true)}>
            Try camera read (optional)
          </button>
        ) : (
          <>
            <ScanCameraPanel
              mode="label"
              onQrDecoded={() => {}}
              onScanStart={onScanStart}
              autoCapture={false}
              onLabelScan={onLabelScan}
              onCameraError={setCameraError}
            />
            <button type="button" className="scan-rescan-link" onClick={() => setCameraOpen(false)}>
              Hide camera — type instead
            </button>
          </>
        )}

        {statusLine ? (
          <p className={`scan-status scan-status--${cameraError ? "warn" : "neutral"}`} role="status">
            {statusLine}
          </p>
        ) : null}

        <button
          type="button"
          className={`btn btn-block scan-cta${labelReady ? " scan-cta--ready" : ""}`}
          disabled={!labelReady}
          onClick={() => {
            setHint(null);
            setFlowStep(2);
          }}
        >
          Next — pick a place
        </button>
      </>
    );
  }

  function renderPlaceStep() {
    return (
      <>
        <header className="scan-page__header">
          <h1>Where is it going?</h1>
          <p className="scan-page__lead scan-sheet__idle">
            {labelJob} · {labelFabric} · {labelSize}
          </p>
        </header>

        {renderPlaceSection()}

        {statusLine ? (
          <p className={`scan-status scan-status--${cameraError ? "warn" : "neutral"}`} role="status">
            {statusLine}
          </p>
        ) : null}

        <button
          type="button"
          className={`btn btn-block scan-cta${scanText && (hasPlaces ? locId : quickLocName.trim()) ? " scan-cta--ready" : ""}`}
          disabled={!scanText}
          onClick={addToLog}
        >
          Add to Log
        </button>

        <button
          type="button"
          className="scan-secondary-link"
          onClick={() => {
            setFlowStep(1);
            setHint(null);
          }}
        >
          ← Edit label lines
        </button>
      </>
    );
  }

  function renderPlaceSection() {
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
          <p className="muted scan-place-setup__note">Add your first place.</p>
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
              ref={quickLocNameRef}
              className="input input--hero"
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
        <div className="field">
          <label htmlFor="scan-log-loc">Place</label>
          <select
            id="scan-log-loc"
            className="select input--hero"
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
}
