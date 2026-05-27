#!/usr/bin/env node
/**
 * Builds docs/Fabric_Flo_Legal_Checklist.pdf from LEGAL_CHECKLIST_FOR_OPERATORS.md
 * Uses md-to-pdf (devDependency). Run: npm run legal:pdf
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mdPath = join(root, "docs", "LEGAL_CHECKLIST_FOR_OPERATORS.md");
const outPath = join(root, "docs", "Fabric_Flo_Legal_Checklist.pdf");

const css = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #111; max-width: 7.5in; margin: 0 auto; padding: 0.5in; }
  h1 { font-size: 20pt; border-bottom: 2px solid #0f172a; padding-bottom: 0.2em; }
  h2 { font-size: 14pt; margin-top: 1.2em; color: #0f172a; }
  table { border-collapse: collapse; width: 100%; margin: 0.6em 0; font-size: 10pt; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; }
  code { font-size: 9pt; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; }
  ul { padding-left: 1.2em; }
  li { margin: 0.25em 0; }
  hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
  strong { color: #0f172a; }
`;

async function main() {
  const { mdToPdf } = await import("md-to-pdf");
  const md = readFileSync(mdPath, "utf8");
  const pdf = await mdToPdf(
    { content: md },
    {
      dest: outPath,
      pdf_options: {
        format: "Letter",
        margin: { top: "0.75in", bottom: "0.75in", left: "0.75in", right: "0.75in" },
        printBackground: true,
      },
      css,
    }
  );
  if (!pdf?.filename) {
    throw new Error("PDF generation failed");
  }
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
