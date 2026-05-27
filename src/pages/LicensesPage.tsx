import { Link } from "react-router-dom";
import { LegalFooter } from "@/components/LegalFooter";

/** Key open-source dependencies (App Store / Play often ask for attribution). */
const LICENSES: { name: string; license: string; url: string }[] = [
  { name: "React", license: "MIT", url: "https://github.com/facebook/react" },
  { name: "Vite", license: "MIT", url: "https://github.com/vitejs/vite" },
  { name: "React Router", license: "MIT", url: "https://github.com/remix-run/react-router" },
  { name: "@supabase/supabase-js", license: "MIT", url: "https://github.com/supabase/supabase-js" },
  { name: "html5-qrcode", license: "Apache-2.0", url: "https://github.com/mebjas/html5-qrcode" },
  { name: "qrcode", license: "MIT", url: "https://github.com/soldair/node-qrcode" },
  { name: "uuid", license: "MIT", url: "https://github.com/uuidjs/uuid" },
  { name: "@capacitor/core", license: "MIT", url: "https://github.com/ionic-team/capacitor" },
  { name: "vite-plugin-pwa", license: "MIT", url: "https://github.com/vite-pwa/vite-plugin-pwa" },
];

export function LicensesPage() {
  return (
    <div className="page stack legal-page">
      <h1>Open source licenses</h1>
      <p className="muted">
        Fabric Flo is built with open-source software. Below are the main libraries we ship in the app.
      </p>
      <section className="card stack">
        <ul className="legal-list" style={{ marginBottom: 0 }}>
          {LICENSES.map((lib) => (
            <li key={lib.name}>
              <a href={lib.url} target="_blank" rel="noopener noreferrer">
                {lib.name}
              </a>{" "}
              — {lib.license}
            </li>
          ))}
        </ul>
      </section>
      <p>
        <Link to="/help">Help</Link>
      </p>
      <LegalFooter />
    </div>
  );
}
