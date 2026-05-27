import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCloudAuth } from "@/context/CloudAuthProvider";
import { useApp } from "@/context/AppStore";
import {
  fabricFloCreateProduction,
  fabricFloFetchAppData,
  fabricFloImportInventoryRows,
  isNormalizedFabricFloBackend,
} from "@/lib/cloudRepository";
import { clearHeadSession, readHeadSession, writeHeadSession } from "@/lib/headSession";
import { parseInventoryCsvForImport } from "@/lib/inventoryImport";
import { buildCrewSharePack, parseCrewSharePack, type CrewSharePackV1 } from "@/lib/sharePack";
import { downloadTextFile } from "@/lib/storage";

export function DepartmentHeadSection() {
  const { productions, mergeInventoryImportRows, replaceEntireAppData, productionVersions } =
    useApp();
  const { session } = useCloudAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [headSession, setHeadSession] = useState(() => readHeadSession());
  const [prodId, setProdId] = useState(productions[0]?.id ?? "");
  const [pin, setPin] = useState("");
  const [headName, setHeadName] = useState("");

  useEffect(() => {
    setHeadSession(readHeadSession());
  }, [productions]);

  useEffect(() => {
    if (productions.length && !productions.some((p) => p.id === prodId)) {
      setProdId(productions[0]!.id);
    }
  }, [productions, prodId]);

  const activeHeadProd = headSession
    ? productions.find((p) => p.id === headSession.productionId)
    : undefined;

  function onSignIn(e: FormEvent) {
    e.preventDefault();
    const p = productions.find((x) => x.id === prodId);
    if (!p) return;
    if (!p.departmentHeadPin) {
      window.alert(
        "No department head PIN is set for this production yet. Open the production on the Dashboard and add one under “Department head access.”"
      );
      return;
    }
    if (pin.trim() !== p.departmentHeadPin) {
      window.alert("That PIN does not match. Try again or ask the coordinator to reset it on the Dashboard.");
      return;
    }
    writeHeadSession(p.id, headName.trim() || undefined);
    setHeadSession(readHeadSession());
    setPin("");
  }

  function onSignOut() {
    clearHeadSession();
    setHeadSession(null);
    setOpen(false);
  }

  async function onUploadCsv(file: File) {
    if (!headSession) return;
    const text = await file.text();
    const rows = parseInventoryCsvForImport(text);
    if (!rows.length) {
      window.alert("No rows could be read. Use a CSV with Kind and Name columns (Fabric Flo export works).");
      return;
    }
    try {
      if (isNormalizedFabricFloBackend() && session) {
        const pid = headSession.productionId;
        const expected = productionVersions?.[pid];
        const { merged, added, version } = await fabricFloImportInventoryRows(
          pid,
          rows,
          expected
        );
        const cloud = await fabricFloFetchAppData();
        replaceEntireAppData({
          ...cloud,
          activeProductionId: cloud.activeProductionId ?? pid,
          productionVersions: {
            ...(cloud.productionVersions ?? {}),
            [pid]: version,
          },
        });
        window.alert(
          `Server inventory updated: ${added} new physical piece(s), ${merged} updated by Item ID.`
        );
      } else {
        const { merged, added } = mergeInventoryImportRows(headSession.productionId, rows);
        window.alert(
          `Inventory updated: ${added} new physical piece(s), ${merged} updated by Item ID. Duplicate name/size rows stay separate.`
        );
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Import failed.");
    }
  }

  function onDownloadSharePack() {
    if (!activeHeadProd) return;
    const safe = activeHeadProd.name.replace(/[^\w\d-]+/g, "_").slice(0, 40);
    const json = buildCrewSharePack(activeHeadProd);
    downloadTextFile(`${safe}_fabricflo_crew.json`, json, "application/json;charset=utf-8");
  }

  if (productions.length === 0) {
    return (
      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>Department head</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Create a production first. Then the coordinator can set a PIN on the Dashboard so heads can sign in
          here to upload lists and export a crew share file.
        </p>
      </section>
    );
  }

  return (
    <section className="card stack">
      <h2 style={{ marginTop: 0 }}>Department head</h2>
      <p className="muted" style={{ marginBottom: 0 }}>
        Optional: sign in to merge CSV inventory into one production and download a JSON pack for your crew to
        import on their phones. PIN is set per production on the Dashboard.
      </p>

      {!open && !headSession ? (
        <button type="button" className="btn btn-secondary btn-block" onClick={() => setOpen(true)}>
          Open department head sign-in
        </button>
      ) : null}

      {open && !headSession ? (
        <form className="stack" onSubmit={onSignIn}>
          <div className="field">
            <label htmlFor="dh-prod">Production</label>
            <select
              id="dh-prod"
              className="select"
              value={prodId}
              onChange={(e) => setProdId(e.target.value)}
            >
              {productions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="dh-name">Your name (optional)</label>
            <input
              id="dh-name"
              className="input"
              placeholder="Shown only on this device after sign-in"
              value={headName}
              onChange={(e) => setHeadName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="field">
            <label htmlFor="dh-pin">Department head PIN</label>
            <input
              id="dh-pin"
              className="input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="From Dashboard → Department head access"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>
          <div className="row" style={{ width: "100%" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={!pin.trim()}>
              Sign in
            </button>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {headSession && activeHeadProd ? (
        <div className="stack">
          <p style={{ marginBottom: 0 }}>
            Signed in for <strong>{activeHeadProd.name}</strong>
            {headSession.label ? (
              <>
                {" "}
                as <strong>{headSession.label}</strong>
              </>
            ) : null}
            . Session lasts about 12 hours on this device.
          </p>
          <div className="row" style={{ width: "100%" }}>
            <label className="btn btn-secondary" style={{ flex: 1, cursor: "pointer", textAlign: "center" }}>
              Upload inventory CSV
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void onUploadCsv(f);
                }}
              />
            </label>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onDownloadSharePack}>
              Download crew pack
            </button>
          </div>
          <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 0 }}>
            Crew pack is a JSON file — send it by text, email, or AirDrop. Crew uses <strong>Import crew pack</strong>{" "}
            below. CSV import adds <strong>one row per line</strong> (many identical name/size lines = many pieces).
            Rows with an <strong>Item ID</strong> update that piece only.
          </p>
          <div className="row" style={{ width: "100%" }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate("/dashboard")}>
              Open dashboard
            </button>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>
      ) : null}

      {headSession && !activeHeadProd ? (
        <p className="muted">
          Your sign-in refers to a production that is no longer on this device.{" "}
          <button type="button" className="btn btn-ghost" onClick={onSignOut}>
            Sign out
          </button>
        </p>
      ) : null}
    </section>
  );
}

export function CrewShareImportSection() {
  const { productions, importCrewSharePackAsNewProduction, importCrewSharePackMerge } = useApp();
  const { session } = useCloudAuth();
  const navigate = useNavigate();
  const [pack, setPack] = useState<CrewSharePackV1 | null>(null);
  const [mergeId, setMergeId] = useState(productions[0]?.id ?? "");

  useEffect(() => {
    if (productions.length && !productions.some((p) => p.id === mergeId)) {
      setMergeId(productions[0]!.id);
    }
  }, [productions, mergeId]);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const text = await f.text();
    const p = parseCrewSharePack(text);
    if (!p) {
      window.alert("This file is not a valid Fabric Flo crew pack (.json from a department head).");
      setPack(null);
      return;
    }
    setPack(p);
  }

  async function onNew() {
    if (!pack) return;
    const title = pack.productionName;
    try {
      if (isNormalizedFabricFloBackend() && session) {
        const id = await fabricFloCreateProduction(pack.productionName.trim());
        importCrewSharePackAsNewProduction(pack, id);
      } else {
        importCrewSharePackAsNewProduction(pack);
      }
      setPack(null);
      window.alert(`Imported “${title}” as a new production.`);
      navigate("/dashboard");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not register this production on the server.");
    }
  }

  function onMerge() {
    if (!pack || !mergeId) return;
    const { merged, added, locationsAdded } = importCrewSharePackMerge(mergeId, pack);
    setPack(null);
    window.alert(
      `Merged into your production: ${added} new piece(s), ${merged} updated by Item ID, ${locationsAdded} new place(s).`
    );
    navigate("/dashboard");
  }

  return (
    <section className="card stack">
      <h2 style={{ marginTop: 0 }}>Crew: import shared list</h2>
      <p className="muted" style={{ marginBottom: 0 }}>
        When your coordinator sends a <strong>.json</strong> crew pack, choose it here. You can add it as a new
        production or merge it into one you already have. Each item in the pack keeps its own row and dynamic
        tracking codes.
      </p>
      <label className="btn btn-secondary btn-block" style={{ cursor: "pointer", textAlign: "center" }}>
        Choose crew pack file (.json)
        <input type="file" accept=".json,application/json" hidden onChange={onPickFile} />
      </label>

      {pack ? (
        <div className="stack">
          <p style={{ marginBottom: 0 }}>
            Loaded <strong>{pack.productionName}</strong> — {pack.items.length} item(s), {pack.locations.length}{" "}
            place(s). Exported {new Date(pack.exportedAt).toLocaleString()}.
          </p>
          {productions.length > 0 ? (
            <div className="field">
              <label htmlFor="crew-merge">Merge into production</label>
              <select
                id="crew-merge"
                className="select"
                value={mergeId}
                onChange={(e) => setMergeId(e.target.value)}
              >
                {productions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="muted" style={{ marginBottom: 0 }}>
              No production exists yet — use <strong>New production</strong> above, or create one and return here
              to merge into it.
            </p>
          )}
          <div className="row" style={{ width: "100%" }}>
            <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={onNew}>
              New production
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={onMerge}
              disabled={!productions.length}
            >
              Merge into selected
            </button>
          </div>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setPack(null)}>
            Cancel
          </button>
        </div>
      ) : null}
    </section>
  );
}
