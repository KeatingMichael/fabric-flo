import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getHandwrittenMarks } from "@/lib/labelText";
import { SCAN_METHOD_LABEL } from "@/lib/scanResolve";
import {
  downloadBlob,
  formatLocalDateTime,
  lastScanForItem,
} from "@/lib/storage";
import {
  effectiveItemCondition,
  type Production,
  type ScanLogEntry,
} from "@/types";

function savePdf(doc: jsPDF, filename: string) {
  downloadBlob(filename, doc.output("blob"));
}

function drawTitle(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 14);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, 14, 20);
  }
}

export function downloadInventoryPdf(
  production: Production,
  log: ScanLogEntry[],
  filename: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const prodLog = log.filter((e) => e.productionId === production.id);
  const subtitle = [
    production.name,
    production.rentalHouseName ? `Rental house: ${production.rentalHouseName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  drawTitle(doc, "Rental list", subtitle);

  const body = production.items.map((item) => {
    const last = lastScanForItem(prodLog, production.id, item.id);
    return [
      item.kind,
      item.name,
      item.size ?? "",
      effectiveItemCondition(item),
      item.qrAliases.join(" | "),
      getHandwrittenMarks(item).join(" | "),
      last ? `${last.locationLabel} (${last.locationKind})` : "",
      last ? formatLocalDateTime(last.scannedAt) : "",
      item.notes ?? "",
    ];
  });

  autoTable(doc, {
    startY: subtitle ? 24 : 18,
    head: [
      [
        "Kind",
        "Name",
        "Size",
        "Status",
        "QR aliases",
        "Sticker IDs",
        "Last location",
        "Last scan",
        "Notes",
      ],
    ],
    body,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [47, 91, 140], fontSize: 7 },
    margin: { left: 10, right: 10 },
  });

  savePdf(doc, filename);
}

export function downloadScanLogPdf(
  production: Production,
  log: ScanLogEntry[],
  filename: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const filtered = log
    .filter((e) => e.productionId === production.id)
    .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());

  const subtitle = [
    production.name,
    production.rentalHouseName ? `Rental house: ${production.rentalHouseName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  drawTitle(doc, "Scan log", subtitle);

  const body = filtered.map((e) => {
    const item = production.items.find((i) => i.id === e.itemId);
    return [
      formatLocalDateTime(e.scannedAt),
      e.itemKind,
      e.itemName,
      item?.size ?? "",
      item ? getHandwrittenMarks(item).join(" | ") : "",
      item ? item.qrAliases.join(" | ") : "",
      e.locationLabel,
      e.locationKind,
      e.scanMethod ? SCAN_METHOD_LABEL[e.scanMethod] : "Dynamic QR",
    ];
  });

  autoTable(doc, {
    startY: subtitle ? 24 : 18,
    head: [
      [
        "Date & time",
        "Kind",
        "Name",
        "Size",
        "Sticker IDs",
        "QR aliases",
        "Location",
        "Location type",
        "Scan method",
      ],
    ],
    body,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [47, 91, 140], fontSize: 7 },
    margin: { left: 10, right: 10 },
  });

  savePdf(doc, filename);
}
