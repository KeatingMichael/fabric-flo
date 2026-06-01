#!/usr/bin/env node
/**
 * Builds printable PDFs of the transfer + submission guides:
 *   docs/TRANSFER_TO_WINDOWS.md       -> docs/Fabric_Flo_Transfer_To_Windows.pdf
 *   docs/FINISH_AND_SUBMIT_CHECKLIST.md -> docs/Fabric_Flo_Finish_And_Submit_Checklist.pdf
 *
 * Run: npm run guides:pdf
 * Works on macOS and Windows (uses local Chrome/Edge if available, else Puppeteer's).
 */
import { accessSync, constants, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const guides = [
  {
    md: join(root, "docs", "TRANSFER_TO_WINDOWS.md"),
    out: join(root, "docs", "Fabric_Flo_Transfer_To_Windows.pdf"),
  },
  {
    md: join(root, "docs", "FINISH_AND_SUBMIT_CHECKLIST.md"),
    out: join(root, "docs", "Fabric_Flo_Finish_And_Submit_Checklist.pdf"),
  },
  {
    md: join(root, "docs", "CODEMAGIC_SETUP.md"),
    out: join(root, "docs", "Fabric_Flo_Codemagic_Setup.pdf"),
  },
];

const css = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #111; max-width: 7.5in; margin: 0 auto; padding: 0.5in; }
  h1 { font-size: 20pt; border-bottom: 2px solid #0f172a; padding-bottom: 0.2em; }
  h2 { font-size: 14pt; margin-top: 1.2em; color: #0f172a; page-break-after: avoid; }
  h3 { font-size: 12pt; color: #0f172a; page-break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 0.6em 0; font-size: 10pt; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; }
  code, pre { font-size: 9pt; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; }
  pre { padding: 8px; white-space: pre-wrap; }
  ul, ol { padding-left: 1.2em; }
  li { margin: 0.2em 0; }
  hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
  strong { color: #0f172a; }
  blockquote { border-left: 3px solid #cbd5e1; margin: 0.6em 0; padding: 0.2em 0.9em; color: #334155; background: #f8fafc; }
  input[type="checkbox"] { margin-right: 0.35em; }
  a { color: #1d4ed8; }
`;

function chromeExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const candidates =
    process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ]
      : process.platform === "win32"
        ? [
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
            "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
          ]
        : ["/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"];
  for (const path of candidates) {
    try {
      accessSync(path, constants.X_OK);
      return path;
    } catch {
      /* try next */
    }
  }
  return undefined; // fall back to Puppeteer's bundled Chromium
}

async function main() {
  const chrome = chromeExecutable();
  const launchOptions = chrome ? { executablePath: chrome } : {};
  const { mdToPdf } = await import("md-to-pdf");

  for (const guide of guides) {
    const md = readFileSync(guide.md, "utf8");
    const pdf = await mdToPdf(
      { content: md },
      {
        dest: guide.out,
        launch_options: launchOptions,
        pdf_options: {
          format: "Letter",
          margin: { top: "0.75in", bottom: "0.75in", left: "0.75in", right: "0.75in" },
          printBackground: true,
        },
        css,
      }
    );
    if (!pdf?.filename) throw new Error(`PDF generation failed for ${guide.md}`);
    console.log(`Wrote ${guide.out}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
