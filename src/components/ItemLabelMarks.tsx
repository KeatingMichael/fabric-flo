import { useState } from "react";
import type { InventoryItem } from "@/types";
import { useApp } from "@/context/AppStore";
import { getHandwrittenMarks, normalizeLabelText } from "@/lib/labelText";

export function ItemLabelMarks({
  productionId,
  item,
}: {
  productionId: string;
  item: InventoryItem;
}) {
  const { appendQrAlias } = useApp();
  const [mark, setMark] = useState("");
  const marks = getHandwrittenMarks(item);

  function addMark() {
    const t = mark.trim();
    if (!t) return;
    appendQrAlias(productionId, item.id, t);
    setMark("");
  }

  return (
    <section className="stack item-label-marks">
      <h3 className="item-qr-codes__heading">Handwritten / sticker IDs</h3>
      <p className="muted" style={{ marginBottom: 0, fontSize: "0.88rem" }}>
        Rental-house numbers, Sharpie text, or gear tags crews scan today — stored on this row and matched
        on the <strong>Handwritten label</strong> scanner. Dynamic QR remains the long-term tracking standard.
      </p>
      {marks.length > 0 ? (
        <ul className="item-label-marks__list">
          {marks.map((m) => (
            <li key={normalizeLabelText(m)}>
              <code className="item-qr-row__payload">{m}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
          No sticker IDs yet — add what is written on the case, or scan once and we will remember it.
        </p>
      )}
      <div className="row" style={{ width: "100%" }}>
        <input
          className="input"
          placeholder='e.g. 1247, A-12, "BLUE VEL 12x12"'
          value={mark}
          onChange={(e) => setMark(e.target.value)}
        />
        <button type="button" className="btn btn-secondary" onClick={addMark} disabled={!mark.trim()}>
          Add ID
        </button>
      </div>
    </section>
  );
}
