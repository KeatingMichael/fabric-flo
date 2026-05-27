import { Link } from "react-router-dom";
import { LegalFooter } from "@/components/LegalFooter";
import { PRIVACY_EMAIL, SUPPORT_EMAIL } from "@/lib/legalConfig";

const UPDATED = "May 18, 2026";

export function PrivacyPage() {
  return (
    <div className="page stack legal-page">
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: {UPDATED}</p>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Who we are</h2>
        <p style={{ marginBottom: 0 }}>
          Fabric Flo (“we,” “us”) provides a production tool to track fabrics and bags using QR codes, locations,
          and scan logs. This policy describes how we handle information when you use the Fabric Flo mobile or
          web app.
        </p>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>What we collect</h2>
        <ul className="legal-list">
          <li>
            <strong>Account data (optional):</strong> If you create a cloud account, we store your email address
            and authentication credentials through our auth provider (Supabase). We do not store your password
            in plain text.
          </li>
          <li>
            <strong>Production data:</strong> Production names, inventory items (names, sizes, notes, condition),
            location names, QR alias values, and scan events (what was scanned, where it was assigned, date and
            time, and the raw QR payload).
          </li>
          <li>
            <strong>Device data:</strong> The app stores a copy of your production data on your device
            (localStorage) so you can work on set without a network. We do not use advertising trackers.
          </li>
          <li>
            <strong>Camera:</strong> Used only when you open the scanner to read QR codes on cases. We do not
            record or upload video.
          </li>
        </ul>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>How we use information</h2>
        <ul className="legal-list">
          <li>Operate inventory and scan tracking for your production.</li>
          <li>Sync data between your devices when you sign in to cloud backup.</li>
          <li>Let department heads invite crew to a shared production when team sign-in is turned on for your show.</li>
          <li>Respond to support and legal requests.</li>
        </ul>
        <p style={{ marginBottom: 0 }}>
          We do <strong>not</strong> sell your personal information.
        </p>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Where data is stored</h2>
        <p>
          On-device data stays in your browser or app storage until you clear it or uninstall. Cloud data is
          stored in your Supabase project (or the project operator configured for your deployment) with
          encryption in transit (HTTPS/TLS). Row Level Security limits access so members only see productions they
          belong to.
        </p>
        <p style={{ marginBottom: 0 }}>
          If you use the app without cloud sign-in, production data does not leave your device except when you
          export CSV/JSON files yourself.
        </p>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Sharing</h2>
        <p style={{ marginBottom: 0 }}>
          You control sharing: crew packs (JSON exports), CSV downloads, and invite links/tokens are distributed
          by you through channels you trust. We do not share production data with third parties for marketing.
          Infrastructure providers (e.g. hosting, Supabase) process data only to run the service.
        </p>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Retention</h2>
        <p style={{ marginBottom: 0 }}>
          Cloud data is kept until you or your production admin deletes it or closes the account. Local device
          data remains until you use “Delete data on this device” in Fabric Flo account or clear app storage. Scan
          logs are kept for the life of the production unless removed by an authorized user.
        </p>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Your rights and choices</h2>
        <ul className="legal-list">
          <li>
            <strong>Access / export:</strong> Download inventory and scan CSV from the app dashboard.
          </li>
          <li>
            <strong>Delete on device:</strong> Fabric Flo account → “Delete data on this device.”
          </li>
          <li>
            <strong>Delete cloud account:</strong> Fabric Flo account → “Delete my account &amp; cloud data” (type
            DELETE to confirm), or email {PRIVACY_EMAIL}. We remove your memberships and productions you solely
            administer. When our server delete function is enabled, your sign-in email is removed as well; otherwise
            we complete email removal within 30 days.
          </li>
          <li>
            <strong>EU / UK users:</strong> You may have rights to access, rectify, erase, restrict, or port data,
            and to object. Contact {PRIVACY_EMAIL}.
          </li>
          <li>
            <strong>California residents:</strong> You may request information about categories of data we collect
            and deletion of personal information, subject to exceptions. Contact {PRIVACY_EMAIL}.
          </li>
        </ul>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Children</h2>
        <p style={{ marginBottom: 0 }}>
          Fabric Flo is a workplace tool not directed at children under 13 (or 16 where applicable). We do not
          knowingly collect data from children.
        </p>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Security</h2>
        <p style={{ marginBottom: 0 }}>
          Use HTTPS, strong passwords, and limit who receives crew packs or invite tokens. Department-head PINs
          in the app are a convenience feature, not enterprise access control — rely on cloud roles and invites
          for multi-user access.
        </p>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Changes</h2>
        <p style={{ marginBottom: 0 }}>
          We may update this policy; the “Last updated” date will change. Continued use after changes means you
          accept the revised policy.
        </p>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Contact</h2>
        <p style={{ marginBottom: 0 }}>
          Privacy: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
          <br />
          Support: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </section>

      <p>
        <Link to="/terms">Terms of Service</Link> · <Link to="/help">Help</Link>
      </p>
      <LegalFooter />
    </div>
  );
}
