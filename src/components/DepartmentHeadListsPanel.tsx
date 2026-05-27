import { useRef, useState } from "react";
import { useActiveProduction, useApp } from "@/context/AppStore";
import { useCloudAuth } from "@/context/CloudAuthProvider";
import { useActiveProductionPermissions } from "@/hooks/useActiveProductionPermissions";
import {
  fabricFloFetchAppData,
  fabricFloImportInventoryRows,
  isNormalizedFabricFloBackend,
} from "@/lib/cloudRepository";
import { parseInventoryCsvForImport } from "@/lib/inventoryImport";
import { parseScanLogCsvForImport } from "@/lib/scanLogImport";
import { isPdfFile, readUploadFileAsCsvText } from "@/lib/pdfTableImport";
import {
  downloadTextFile,
  exportInventoryCsv,
  exportScanLogCsv,
} from "@/lib/storage";

export function DepartmentHeadListsPanel() {
  const production = useActiveProduction();
  const {
    scanLog,
    productionVersions,
    mergeInventoryImportRows,
    importScanLogRows,
    replaceEntireAppData,
    setRentalHouseName,
  } = useApp();
  const { session } = useCloudAuth();
  const { canUploadLists, cloudSignedIn } = useActiveProductionPermissions();
  const rentalInputRef = useRef<HTMLInputElement>(null);
  const logInputRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!production) return null;
  const prod = production;
  const safeName = prod.name.replace(/[^\w\d-]+/g, "_").slice(0, 48);
  const cloudReady = isNormalizedFabricFloBackend() && Boolean(session);

  function pause(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  /** One tap: CSV + PDF (browsers may ask to allow multiple downloads). */
  async function downloadRentalList() {
    const csv = exportInventoryCsv(prod, scanLog);
    downloadTextFile(`${safeName}_rental_list.csv`, csv, "text/csv;charset=utf-8");
    await pause(350);
    const { downloadInventoryPdf } = await import("@/lib/listPdfExport");
    downloadInventoryPdf(prod, scanLog, `${safeName}_rental_list.pdf`);
  }

  async function downloadLog() {
    const csv = exportScanLogCsv(prod, scanLog);
    downloadTextFile(`${safeName}_log.csv`, csv, "text/csv;charset=utf-8");
    await pause(350);
    const { downloadScanLogPdf } = await import("@/lib/listPdfExport");
    downloadScanLogPdf(prod, scanLog, `${safeName}_log.pdf`);
  }

  async function onUploadRentalList(file: File) {
    if (!canUploadLists) {
      window.alert("Only department heads can upload rental lists. You can download them instead.");
      return;
    }
    setMsg(null);
    let text: string;
    try {
      text = await readUploadFileAsCsvText(file, "inventory");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not read that PDF.");
      return;
    }
    const rows = parseInventoryCsvForImport(text);
    if (!rows.length) {
      window.alert(
        "No rows could be read. Use a Fabric Flo rental list CSV or PDF with Kind and Name columns (or name in the first column)."
      );
      return;
    }
    try {
      if (cloudReady) {
        const expected = productionVersions?.[prod.id];
        const { merged, added, version } = await fabricFloImportInventoryRows(prod.id, rows, expected);
        const cloud = await fabricFloFetchAppData();
        replaceEntireAppData({
          ...cloud,
          activeProductionId: cloud.activeProductionId ?? prod.id,
          productionVersions: {
            ...(cloud.productionVersions ?? {}),
            [prod.id]: version,
          },
        });
        setMsg(
          `Rental list updated on server: ${added} new piece(s), ${merged} updated.${isPdfFile(file) ? " (from PDF)" : ""}`
        );
      } else {
        const { merged, added } = mergeInventoryImportRows(prod.id, rows);
        setMsg(`Rental list updated: ${added} new piece(s), ${merged} updated.${isPdfFile(file) ? " (from PDF)" : ""}`);
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Rental list upload failed.");
    }
  }

  async function onUploadLog(file: File) {
    if (!canUploadLists) {
      window.alert("Only department heads can upload logs. You can download them instead.");
      return;
    }
    setMsg(null);
    let text: string;
    try {
      text = await readUploadFileAsCsvText(file, "log");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not read that PDF.");
      return;
    }
    const rows = parseScanLogCsvForImport(text);
    if (!rows.length) {
      window.alert(
        "No log rows could be read. Use a Fabric Flo log CSV or PDF with item kind, item name, and location columns."
      );
      return;
    }
    const { imported, skipped } = importScanLogRows(prod.id, rows);
    if (imported === 0) {
      window.alert(
        skipped > 0
          ? "No log rows imported. Each row needs a matching item in your rental list (same name and kind)."
          : "No log rows found in that file."
      );
      return;
    }
    setMsg(
      `Log updated: ${imported} scan(s) added${skipped > 0 ? `, ${skipped} skipped (no matching item in rental list)` : ""}.${isPdfFile(file) ? " (from PDF)" : ""}`
    );
  }

  return (
    <section className="card stack" id="department-head-lists">
      <h2>Rental lists &amp; logs</h2>
      {canUploadLists ? (
        <div className="field" style={{ marginTop: "0.35rem" }}>
          <label htmlFor="rental-house">Rental house (optional)</label>
          <input
            id="rental-house"
            className="input"
            placeholder="e.g. Best Films Service, WFW, MBS, Sunbelt"
            defaultValue={prod.rentalHouseName ?? ""}
            onBlur={(e) => {
              const v = e.target.value;
              if (v !== (prod.rentalHouseName ?? "")) setRentalHouseName(prod.id, v);
            }}
          />
        </div>
      ) : null}
      <p className="muted" style={{ marginBottom: 0 }}>
        {canUploadLists ? (
          <>
            <strong>Download</strong> gives CSV and PDF; <strong>Upload</strong> accepts either format.
          </>
        ) : (
          <>
            <strong>Download</strong> gives CSV and PDF for this show. Uploading is for department heads only.
          </>
        )}
      </p>

      <div className="stack" style={{ gap: "0.75rem", marginTop: "0.35rem" }}>
        <div>
          <h3 style={{ margin: "0 0 0.35rem", fontSize: "0.95rem" }}>Rental list</h3>
          <div className="row" style={{ width: "100%" }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => void downloadRentalList()}
            >
              Download
            </button>
            {canUploadLists ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => rentalInputRef.current?.click()}
                >
                  Upload
                </button>
                <input
                  ref={rentalInputRef}
                  type="file"
                  accept=".csv,.pdf,text/csv,application/pdf"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void onUploadRentalList(f);
                  }}
                />
              </>
            ) : null}
          </div>
        </div>

        <div>
          <h3 style={{ margin: "0 0 0.35rem", fontSize: "0.95rem" }}>Log</h3>
          <div className="row" style={{ width: "100%" }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => void downloadLog()}
            >
              Download
            </button>
            {canUploadLists ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => logInputRef.current?.click()}
                >
                  Upload
                </button>
                <input
                  ref={logInputRef}
                  type="file"
                  accept=".csv,.pdf,text/csv,application/pdf"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void onUploadLog(f);
                  }}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>

      {cloudSignedIn && !canUploadLists ? (
        <p className="muted" style={{ marginBottom: 0, fontSize: "0.82rem" }}>
          You joined this show as crew. Scan fabrics and download lists here; ask your department head to upload
          rental inventory.
        </p>
      ) : null}

      {msg ? <p className="muted" style={{ marginBottom: 0, fontSize: "0.88rem" }}>{msg}</p> : null}
    </section>
  );
}
