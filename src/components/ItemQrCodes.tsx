import { useState } from "react";
import type { InventoryItem } from "@/types";
import { useApp } from "@/context/AppStore";
import {
  fabricFloLabelPayload,
  isDynamicTrackingPayload,
} from "@/lib/qrPayload";
import { openQrPrintSheet } from "@/lib/qrPrint";

const RENTAL_PIECE_LABEL = "Fabric & bag";

type QrRow = {
  id: string;
  label: string;
  payload: string;
  kind: "dynamic" | "manual";
};

function buildTrackingRows(item: InventoryItem): QrRow[] {
  const stable = fabricFloLabelPayload(item);
  const rows: QrRow[] = [];
  const seen = new Set<string>();

  for (let i = item.qrAliases.length - 1; i >= 0; i--) {
    const t = item.qrAliases[i]!.trim();
    if (!t || seen.has(t) || t === stable) continue;
    seen.add(t);
    if (isDynamicTrackingPayload(t)) {
      rows.push({
        id: `dyn-${i}`,
        label: "Dynamic tracking code",
        payload: t,
        kind: "dynamic",
      });
    } else {
      rows.push({
        id: `man-${i}`,
        label: "Other scanned value",
        payload: t,
        kind: "manual",
      });
    }
  }
  return rows;
}

export function ItemQrCodes({
  productionId,
  item,
  pieceLabel,
}: {
  productionId: string;
  item: InventoryItem;
  pieceLabel?: string | null;
}) {
  const { appendQrAlias, generateDynamicQrAlias } = useApp();
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const trackingRows = buildTrackingRows(item);
  const dynamicRows = trackingRows.filter((r) => r.kind === "dynamic");
  const stablePayload = fabricFloLabelPayload(item);

  async function handlePrint(row: QrRow) {
    setBusy(row.id);
    try {
      await openQrPrintSheet({
        title: item.name,
        subtitle: row.label,
        payload: row.payload,
        kindLabel: RENTAL_PIECE_LABEL,
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not open print sheet.");
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerateDynamic() {
    setBusy("generate");
    try {
      const payload = generateDynamicQrAlias(productionId, item.id);
      if (!payload) return;
      await openQrPrintSheet({
        title: item.name,
        subtitle: "New dynamic tracking code — print and stick on the piece",
        payload,
        kindLabel: RENTAL_PIECE_LABEL,
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not generate QR.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="stack item-qr-codes">
      <h3 className="item-qr-codes__heading">Dynamic tracking QR</h3>
      <p className="muted" style={{ marginBottom: 0, fontSize: "0.88rem" }}>
        {pieceLabel ? (
          <>
            <strong>{pieceLabel}</strong> — same name/size as other rows, but this sticker&apos;s{" "}
            <code>dyn</code> token tracks <em>this</em> physical piece only.
          </>
        ) : (
          <>
            Crew scans use <strong>dynamic</strong> codes — each sticker carries a unique token so moves stay
            tied to this piece only (even when many share the same name and size).
          </>
        )}{" "}
        Rotate and reprint when vendors change security; older stickers still match until you retire them.
      </p>

      {dynamicRows.length === 0 ? (
        <p className="item-qr-codes__warn" role="status">
          No dynamic tracking code yet. Generate one below before sticking a label on set.
        </p>
      ) : null}

      <div className="stack" style={{ gap: "0.5rem" }}>
        {trackingRows.map((row) => (
          <div key={row.id} className="item-qr-row card" style={{ padding: "0.65rem 0.75rem" }}>
            <div className="item-qr-row__top">
              <span
                className={`pill ${row.kind === "dynamic" ? "pill-dynamic" : "pill-fabric"}`}
                style={{ fontSize: "0.7rem" }}
              >
                {row.kind === "dynamic" ? "Tracking" : "Other"}
              </span>
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{row.label}</span>
            </div>
            <code className="item-qr-row__payload">{row.payload}</code>
            <div className="row" style={{ width: "100%", marginTop: "0.35rem" }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={busy !== null}
                onClick={() => void handlePrint(row)}
              >
                {busy === row.id ? "Opening…" : "Print / reprint"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => void navigator.clipboard.writeText(row.payload)}
              >
                Copy value
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={busy !== null}
        onClick={() => void handleGenerateDynamic()}
      >
        {busy === "generate"
          ? "Generating…"
          : dynamicRows.length
            ? "Rotate — generate new dynamic QR"
            : "Generate dynamic tracking QR"}
      </button>

      <details className="item-qr-codes__stable">
        <summary>Optional stable backup (not for tracking)</summary>
        <p className="muted" style={{ fontSize: "0.82rem", marginTop: "0.35rem" }}>
          A fixed JSON without a <code>dyn</code> token — use only if you need a non-rotating reference. Scans
          on set should use dynamic stickers above.
        </p>
        <code className="item-qr-row__payload">{stablePayload}</code>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          style={{ marginTop: "0.35rem" }}
          disabled={busy !== null}
          onClick={() =>
            void openQrPrintSheet({
              title: item.name,
              subtitle: "Stable backup (no dyn token)",
              payload: stablePayload,
              kindLabel: RENTAL_PIECE_LABEL,
            }).catch((e) =>
              window.alert(e instanceof Error ? e.message : "Could not open print sheet.")
            )
          }
        >
          Print stable backup
        </button>
      </details>

      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor={`extra-${item.id}`}>Vendor token (optional)</label>
        <div className="row" style={{ width: "100%" }}>
          <input
            id={`extra-${item.id}`}
            className="input"
            placeholder="Paste vendor code if they issued one"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const v = extra.trim();
              if (!v) return;
              appendQrAlias(productionId, item.id, v);
              setExtra("");
            }}
          >
            Add
          </button>
        </div>
      </div>
    </section>
  );
}
