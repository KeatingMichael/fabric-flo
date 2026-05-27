import { Link } from "react-router-dom";
import { LegalFooter } from "@/components/LegalFooter";

export function HelpPage() {
  return (
    <div className="page stack">
      <h1>How Fabric Flo works</h1>
      <p>
        <Link to="/app">← Back to productions</Link>
      </p>
      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>Phones first</h2>
        <p>
          On location, everyone should use Fabric Flo in <strong>Safari (iPhone)</strong> or{" "}
          <strong>Chrome (Android)</strong> so the camera and taps feel natural. A laptop browser is only for
          your convenience while you build lists or skim the log — it is not a separate &quot;admin
          site.&quot;
        </p>
        <p style={{ marginBottom: 0 }}>
          Optional: add this page to the Home Screen (Share → Add to Home Screen on iPhone; Install app on
          Android) so it opens like a normal app.
        </p>
      </section>
      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>Get your department on the same log</h2>
        <p style={{ marginBottom: 0 }}>
          From <strong>Home</strong>, sign in with email under <strong>Fabric Flo account</strong>, create your
          production, then use <strong>Crew invites</strong> to generate an Invite Code. Crew signs in on their phones,
          accepts the code, and every scan syncs to the same daily log when online.
        </p>
      </section>
      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>1. Create a production</h2>
        <p style={{ marginBottom: 0 }}>
          From the welcome screen, name your show or job. All fabrics, bags, and scans stay under that
          umbrella.
        </p>
      </section>
      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>2. List places &amp; inventory</h2>
        <p style={{ marginBottom: 0 }}>
          After you open a production, use the <strong>Places</strong> tab to add each stage, on-location holding
          area, and transport vehicle. Use the <strong>Fabrics &amp; bags</strong> tab to add rentals with clear
          names. On that tab you can also mark a piece <strong>Lost</strong> or <strong>Damaged</strong> (or back
          to <strong>In use</strong>) without removing it from the list.
        </p>
      </section>
      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>3. Stick dynamic QR codes on cases</h2>
        <p>
          One list row = one physical piece. Orders often repeat the same name and size (e.g. several 12&apos; ×
          12&apos; solids) — add each as its own row (or use <strong>Quantity</strong> with N/A for one piece at a
          time) so every case gets a unique <strong>dynamic tracking QR</strong> with its own <code>dyn</code> token.
        </p>
        <p style={{ marginBottom: 0 }}>
          On <strong>Fabrics &amp; bags</strong>, use <strong>Print / reprint</strong> for any tracking code
          still on set. When a vendor rotates security, tap <strong>Rotate — generate new dynamic QR</strong>.
          Older stickers keep matching until you retire them.
        </p>
      </section>
      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>4. Scan on set</h2>
        <p>
          Open <strong>Scan</strong> and pick <strong>Dynamic QR</strong> or <strong>Handwritten label</strong>.
          Handwritten mode reads rental stickers and Sharpie text (you can fix OCR before saving). Both paths
          log the move and tie back to your rental inventory.
        </p>
        <p>
          On <strong>Fabrics &amp; bags</strong>, search the rental list and add sticker IDs under{" "}
          <strong>Handwritten / sticker IDs</strong>. After a scan, tap <strong>Scan next → [place]</strong> to log
          many pieces to the same truck or stage without re-picking location.
        </p>
        <p style={{ marginBottom: 0 }}>
          Under <strong>Places</strong>, add studios and trucks one at a time — optional shortcuts for Stages or Trucks
          appear only while your list is still small.
        </p>
      </section>
      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>5. Share paperwork</h2>
        <p style={{ marginBottom: 0 }}>
          From the home dashboard you can download CSV files on a phone too (saves to Files / Downloads). Use a
          laptop only if you prefer a big screen for spreadsheets.
        </p>
      </section>
      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>Privacy, cloud &amp; devices</h2>
        <p>
          Each physical piece is tracked by its <strong>dynamic QR</strong>, not just name and size. Inventory and
          scans are stored on your device so you can work offline on set.
        </p>
        <p style={{ marginBottom: 0 }}>
          Sign in syncs your production across phones (encrypted in transit). You can delete data on this device or
          request account deletion from <strong>Home → Fabric Flo account</strong>. Read the{" "}
          <Link to="/privacy">Privacy Policy</Link> and <Link to="/terms">Terms</Link>.
        </p>
      </section>
      <LegalFooter />
    </div>
  );
}
