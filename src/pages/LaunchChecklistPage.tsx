import { Link } from "react-router-dom";
import { useCloudAuth } from "@/context/CloudAuthProvider";
import { LegalFooter } from "@/components/LegalFooter";
import { envReadinessScore, getEnvReadinessChecks } from "@/lib/envCheck";
import { isNativeApp } from "@/lib/native";
import { privacyPolicyUrl, termsUrl } from "@/lib/legalConfig";
import { isNormalizedFabricFloBackend } from "@/lib/cloudRepository";

const IN_CURSOR = [
  "Web app build (npm run build) and PWA assets",
  "Capacitor ios/ and android/ projects (npm run cap:sync:full)",
  "Privacy, Terms, Help, Licenses, and Launch pages in the app",
  "Account deletion flow + SQL migration 008 (file in repo)",
  "Legal checklist PDF (npm run legal:pdf)",
  "CSV export, offline scans, dynamic QR per piece",
  "CI workflow on GitHub push",
] as const;

const OUTSIDE_CURSOR = [
  "Create Apple Developer + Google Play developer accounts",
  "Install full Xcode + CocoaPods; sign app; upload to TestFlight / Play",
  "Deploy on Netlify (see docs/NETLIFY_DEPLOY.md) and set Site environment variables",
  "Run Supabase migrations 001–008 in your project SQL editor",
  "Optional: supabase functions deploy delete-account",
  "Smoke-test coordinator flow: two browsers, sign in, invite code, accept, scan — same log on both when online",
  "Attorney review of Privacy Policy and Terms",
  "Form LLC / business entity, insurance, trademark search",
  "App Store Connect + Play Console questionnaires and screenshots",
] as const;

export function LaunchChecklistPage() {
  const { configured, user } = useCloudAuth();
  const checks = getEnvReadinessChecks();
  const { passed, total } = envReadinessScore();

  return (
    <div className="page stack legal-page">
      <h1>Rollout guide</h1>
      <p className="muted">
        What’s done in the Fabric Flo repo vs what you still do in browsers and on your Mac. Not legal advice —
        see <strong>docs/Fabric_Flo_Legal_Checklist.pdf</strong> (run <code>npm run legal:pdf</code>).
      </p>

      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>This build</h2>
        <ul className="legal-list" style={{ marginBottom: 0 }}>
          <li>
            <strong>Environment:</strong> {passed}/{total} production checks passing
          </li>
          <li>
            <strong>Cloud:</strong>{" "}
            {configured
              ? user
                ? `Signed in as ${user.email}`
                : "Configured, not signed in"
              : "Local-only (no .env)"}
          </li>
          <li>
            <strong>Backend mode:</strong>{" "}
            {isNormalizedFabricFloBackend() ? "Normalized (multi-user)" : "Legacy blob or local"}
          </li>
          <li>
            <strong>Native shell:</strong> {isNativeApp() ? "Capacitor app" : "Browser / PWA"}
          </li>
        </ul>
      </section>

      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>Production .env checks</h2>
        <ul className="launch-checks">
          {checks.map((c) => (
            <li key={c.id} className={c.ok ? "launch-checks__ok" : "launch-checks__todo"}>
              <span>{c.ok ? "✓" : "○"}</span>
              <div>
                <strong>{c.label}</strong>
                {!c.ok ? (
                  <div className="muted" style={{ fontSize: "0.82rem" }}>
                    {c.hint}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>Done through Cursor (this repo)</h2>
        <ul className="legal-list">
          {IN_CURSOR.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>You do outside Cursor</h2>
        <ul className="legal-list">
          {OUTSIDE_CURSOR.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="muted" style={{ marginBottom: 0, fontSize: "0.85rem" }}>
          Netlify deploy: <code>docs/NETLIFY_DEPLOY.md</code>. Also <code>docs/STORE_RELEASE.md</code> and{" "}
          <code>docs/WHAT_YOU_CAN_DO_IN_CURSOR.md</code>.
        </p>
      </section>

      <p>
        <Link to="/help">Help</Link> ·{" "}
        <a href={privacyPolicyUrl()} target="_blank" rel="noopener noreferrer">
          Privacy
        </a>{" "}
        ·{" "}
        <a href={termsUrl()} target="_blank" rel="noopener noreferrer">
          Terms
        </a>{" "}
        · <Link to="/licenses">Open source licenses</Link>
      </p>
      <LegalFooter />
    </div>
  );
}
