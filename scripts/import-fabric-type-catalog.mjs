/**
 * Reads fabric types from FABRIC LIST/FABRIC FLOW - FABRIC LIST.xlsx (column A, top to bottom).
 * Falls back to the PDF if the spreadsheet is missing. Preserves exact spelling and case.
 * Writes src/data/fabricTypeCatalog.ts — run: npm run fabric-catalog:import
 */
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const listDir = join(root, "FABRIC LIST");
const xlsxPath = join(listDir, "FABRIC FLOW - FABRIC LIST.xlsx");
const pdfPath = join(listDir, "FABRIC FLOW - FABRIC LIST.pdf");
const outPath = join(root, "src", "data", "fabricTypeCatalog.ts");

function shouldSkipLine(text) {
  const t = text.trim();
  if (!t) return true;
  if (t === "TYPE") return true;
  if (t === "FABRIC FLOW - FABRIC LIST") return true;
  return false;
}

function readNamesFromXlsx() {
  if (!existsSync(xlsxPath)) return null;
  const wb = XLSX.readFile(xlsxPath);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: "",
    raw: false,
  });
  const names = [];
  const seenExact = new Set();
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const cell = row[0];
    const t = String(cell ?? "");
    if (shouldSkipLine(t)) continue;
    if (seenExact.has(t)) continue;
    seenExact.add(t);
    names.push(t);
  }
  return names;
}

async function readNamesFromPdf() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { readFile } = await import("node:fs/promises");
  const data = new Uint8Array(await readFile(pdfPath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const names = [];
  const seenExact = new Set();

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items
      .map((item) => ({
        str: "str" in item ? item.str : "",
        y: "transform" in item && item.transform ? item.transform[5] : 0,
        x: "transform" in item && item.transform ? item.transform[4] : 0,
      }))
      .filter((t) => t.str.trim());

    items.sort((a, b) => b.y - a.y || a.x - b.x);

    const lineTol = 4;
    let lastY = null;
    let line = "";

    for (const item of items) {
      if (lastY !== null && Math.abs(item.y - lastY) > lineTol) {
        const t = line.trim();
        if (!shouldSkipLine(t) && !seenExact.has(t)) {
          seenExact.add(t);
          names.push(t);
        }
        line = item.str;
      } else {
        line = line ? `${line} ${item.str}` : item.str;
      }
      lastY = item.y;
    }
    const t = line.trim();
    if (!shouldSkipLine(t) && !seenExact.has(t)) {
      seenExact.add(t);
      names.push(t);
    }
  }

  return names;
}

let names = readNamesFromXlsx();
let sourceLabel = "FABRIC LIST/FABRIC FLOW - FABRIC LIST.xlsx (column A, top to bottom)";

if (!names?.length && existsSync(pdfPath)) {
  names = await readNamesFromPdf();
  sourceLabel = "FABRIC LIST/FABRIC FLOW - FABRIC LIST.pdf (top to bottom)";
}

if (!names?.length) {
  console.error("No fabric types found. Add names to the xlsx (column A) or PDF in FABRIC LIST/.");
  process.exit(1);
}

const lines = names.map((n) => `  ${JSON.stringify(n)},`).join("\n");

const source = `// Auto-generated from ${sourceLabel}
// Exact spelling and case preserved. Regenerate: npm run fabric-catalog:import
//
// ${names.length} fabric types.

export const FABRIC_TYPE_CATALOG: readonly string[] = [
${lines}
] as const;
`;

writeFileSync(outPath, source, "utf8");
console.log(`Wrote ${names.length} fabric types to ${outPath}`);
