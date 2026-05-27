import QRCode from "qrcode";

export async function qrCodeDataUrl(text: string, sizePx = 280): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: sizePx,
    errorCorrectionLevel: "M",
  });
}

export type QrPrintOptions = {
  title: string;
  subtitle?: string;
  payload: string;
  kindLabel?: string;
};

/** Opens a print-friendly window with a scannable QR and the encoded value. */
export async function openQrPrintSheet(opts: QrPrintOptions): Promise<void> {
  const dataUrl = await qrCodeDataUrl(opts.payload, 320);
  const w = window.open("", "_blank", "noopener,noreferrer,width=480,height=640");
  if (!w) {
    window.alert("Allow pop-ups for this site to open the print sheet.");
    return;
  }

  const safeTitle = escapeHtml(opts.title);
  const safeSub = opts.subtitle ? escapeHtml(opts.subtitle) : "";
  const safeKind = opts.kindLabel ? escapeHtml(opts.kindLabel) : "";
  const safePayload = escapeHtml(opts.payload);

  w.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle} — QR label</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, sans-serif;
      margin: 0;
      padding: 1.25rem;
      text-align: center;
      color: #111;
    }
    h1 { font-size: 1.15rem; margin: 0 0 0.25rem; }
    .sub { color: #444; font-size: 0.9rem; margin-bottom: 1rem; }
    .kind { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: #666; }
    img { width: min(320px, 90vw); height: auto; }
    code {
      display: block;
      margin: 1rem auto 0;
      font-size: 0.65rem;
      word-break: break-all;
      max-width: 360px;
      text-align: left;
      background: #f4f4f5;
      padding: 0.5rem;
      border-radius: 6px;
    }
    @media print {
      body { padding: 0.5rem; }
      button { display: none; }
    }
  </style>
</head>
<body>
  ${safeKind ? `<div class="kind">${safeKind}</div>` : ""}
  <h1>${safeTitle}</h1>
  ${safeSub ? `<p class="sub">${safeSub}</p>` : ""}
  <img src="${dataUrl}" alt="QR code" />
  <code>${safePayload}</code>
  <p style="margin-top:1rem"><button type="button" onclick="window.print()">Print</button></p>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 300); });</script>
</body>
</html>`);
  w.document.close();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
