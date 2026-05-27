import { Link } from "react-router-dom";
import { LegalFooter } from "@/components/LegalFooter";
import { privacyPolicyUrl, SUPPORT_EMAIL } from "@/lib/legalConfig";

const UPDATED = "May 18, 2026";

export function TermsPage() {
  return (
    <div className="page stack legal-page">
      <h1>Terms of Service</h1>
      <p className="muted">Last updated: {UPDATED}</p>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Agreement</h2>
        <p style={{ marginBottom: 0 }}>
          By using Fabric Flo you agree to these Terms and our{" "}
          <Link to="/privacy">Privacy Policy</Link>. If you do not agree, do not use the app.
        </p>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>The service</h2>
        <p style={{ marginBottom: 0 }}>
          Fabric Flo helps film and event productions track fabrics and bags using QR codes, locations, and scan
          logs. Features may change; we strive for reliability but do not guarantee uninterrupted service on set.
        </p>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Your responsibilities</h2>
        <ul className="legal-list">
          <li>You are responsible for accuracy of inventory and scan data you enter.</li>
          <li>You must have authority to process personal data about crew you invite (e.g. email addresses).</li>
          <li>Keep invite tokens and crew packs confidential; anyone with a file may import your list.</li>
          <li>Do not use the app for unlawful purposes or to harass others.</li>
          <li>Maintain your own backups of critical production records (export CSV/JSON).</li>
        </ul>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Accounts and cloud</h2>
        <p style={{ marginBottom: 0 }}>
          Optional cloud sign-in stores data with Supabase under your project operator’s configuration. You are
          responsible for safeguarding credentials. We may suspend access for abuse or security risk.
        </p>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Disclaimer</h2>
        <p style={{ marginBottom: 0 }}>
          THE APP IS PROVIDED “AS IS” WITHOUT WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR
          NON-INFRINGEMENT. WE ARE NOT LIABLE FOR LOST, DAMAGED, OR MISPLACED RENTAL INVENTORY — FABRIC FLO IS A
          TRACKING AID, NOT A REPLACEMENT FOR RENTAL HOUSE CONTRACTS OR PHYSICAL COUNTS.
        </p>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Limitation of liability</h2>
        <p style={{ marginBottom: 0 }}>
          To the maximum extent permitted by law, our total liability for any claim arising from the service is
          limited to the amount you paid us in the twelve months before the claim (or USD $100 if you use a free
          tier). We are not liable for indirect, incidental, or consequential damages.
        </p>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Indemnity</h2>
        <p style={{ marginBottom: 0 }}>
          You agree to indemnify us against claims arising from your use of the app, your production data, or
          violation of these Terms.
        </p>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Termination</h2>
        <p style={{ marginBottom: 0 }}>
          You may stop using the app at any time and request account deletion per the Privacy Policy. We may
          discontinue the service with reasonable notice where practicable.
        </p>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Governing law</h2>
        <p style={{ marginBottom: 0 }}>
          These Terms are governed by the laws of the State of California, USA, without regard to conflict-of-law
          rules, unless your local law requires otherwise. Disputes shall be brought in courts located in Los
          Angeles County, California, except where prohibited.
        </p>
      </section>

      <section className="card stack legal-section">
        <h2 style={{ marginTop: 0 }}>Contact</h2>
        <p style={{ marginBottom: 0 }}>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          <br />
          Privacy: <Link to={privacyPolicyUrl()}>Privacy Policy</Link>
        </p>
      </section>

      <p>
        <Link to="/privacy">Privacy Policy</Link> · <Link to="/help">Help</Link>
      </p>
      <LegalFooter />
    </div>
  );
}
