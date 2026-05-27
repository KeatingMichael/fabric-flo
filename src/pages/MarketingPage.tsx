import { Link } from "react-router-dom";
import logo from "@/assets/fabric-flo-logo-widget.jpg";

const FEATURES = [
  {
    title: "Scan on set",
    body: "Dynamic QR codes and handwritten rental labels — both flow into the same log and inventory.",
  },
  {
    title: "Fabrics & bags together",
    body: "One row is a fabric and its matching bag, tracked by the same QR or rental-house sticker.",
  },
  {
    title: "Studios & trucks",
    body: "Log where pieces land: stages, locations, and transport.",
  },
  {
    title: "Rental lists & logs",
    body: "Download or upload CSV and PDF for your rental house and department.",
  },
  {
    title: "Crew & department heads",
    body: "Invite Codes so the whole show shares one production in the cloud.",
  },
  {
    title: "Works in the browser",
    body: "Use Fabric Flo in Safari or Chrome on set — same app wraps for iOS and Android stores.",
  },
] as const;

export function MarketingPage() {
  return (
    <div className="marketing-page">
      <section className="marketing-hero card stack">
        <img className="marketing-hero__logo" src={logo} alt="Fabric Flo" width={120} height={120} />
        <h1 className="marketing-hero__title">Fabric Flo</h1>
        <p className="marketing-hero__tagline">Film fabric &amp; bag tracking for productions</p>
        <p className="muted" style={{ marginBottom: 0, maxWidth: "36rem" }}>
          Track rental inventory on set with dynamic QR codes, handwritten labels, places, and a shared scan log —
          built for department heads and crew.
        </p>
        <div className="marketing-hero__actions row" style={{ width: "100%", maxWidth: "24rem" }}>
          <Link to="/app" className="btn btn-primary" style={{ flex: 1 }}>
            Open app
          </Link>
          <a href="#features" className="btn btn-secondary" style={{ flex: 1 }}>
            Features
          </a>
        </div>
      </section>

      <section id="features" className="marketing-features">
        <h2>Everything in one place</h2>
        <div className="marketing-features__grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="card stack marketing-feature-card">
              <h3 style={{ marginTop: 0 }}>{f.title}</h3>
              <p className="muted" style={{ marginBottom: 0 }}>
                {f.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="card stack marketing-cta">
        <h2 style={{ marginTop: 0 }}>Ready for your next show?</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Create a production, add your Fabric Flow fabric list, scan pieces, and export lists for your rental house.
        </p>
        <Link to="/app" className="btn btn-primary btn-block">
          Get started — open Fabric Flo
        </Link>
      </section>
    </div>
  );
}
