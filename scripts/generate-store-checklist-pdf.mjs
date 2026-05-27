#!/usr/bin/env node
/**
 * Builds docs/Fabric_Flo_App_Store_Release_Checklist.pdf
 * Run: npm run store:pdf
 */
import { accessSync, constants, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mdPath = join(root, "docs", "APP_STORE_RELEASE_CHECKLIST.md");
const outPath = join(root, "docs", "Fabric_Flo_App_Store_Release_Checklist.pdf");

const css = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #111; max-width: 7.5in; margin: 0 auto; padding: 0.5in; }
  h1 { font-size: 20pt; border-bottom: 2px solid #0f172a; padding-bottom: 0.2em; }
  h2 { font-size: 14pt; margin-top: 1.2em; color: #0f172a; page-break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 0.6em 0; font-size: 10pt; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; }
  code, pre { font-size: 9pt; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; }
  pre { padding: 8px; white-space: pre-wrap; }
  ul { padding-left: 1.2em; }
  li { margin: 0.2em 0; }
  hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
  strong { color: #0f172a; }
  input[type="checkbox"] { margin-right: 0.35em; }
`;

function chromeExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.platform === "darwin") {
    const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    try {
      accessSync(mac, constants.X_OK);
      return mac;
    } catch {
      /* use puppeteer default */
    }
  }
  return undefined;
}

async function main() {
  const chrome = chromeExecutable();
  const launchOptions = chrome ? { executablePath: chrome } : {};
  const { mdToPdf } = await import("md-to-pdf");
  const md = readFileSync(mdPath, "utf8");
  const pdf = await mdToPdf(
    { content: md },
    {
      dest: outPath,
      launch_options: launchOptions,
      pdf_options: {
        format: "Letter",
        margin: { top: "0.75in", bottom: "0.75in", left: "0.75in", right: "0.75in" },
        printBackground: true,
      },
      css,
    }
  );
  if (!pdf?.filename) throw new Error("PDF generation failed");
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
