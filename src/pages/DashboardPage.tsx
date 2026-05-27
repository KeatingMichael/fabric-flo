import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DepartmentHeadInvitePanel } from "@/components/DepartmentHeadInvitePanel";
import { DepartmentHeadListsPanel } from "@/components/DepartmentHeadListsPanel";
import { ProductionList } from "@/components/ProductionList";
import { SetupChecklistCard } from "@/components/SetupChecklistCard";
import { useActiveProduction, useApp } from "@/context/AppStore";

export function DashboardPage() {
  const production = useActiveProduction();
  const { productions, activeProductionId, setActiveProductionId, scanLog, deleteProduction } = useApp();
  const navigate = useNavigate();
  const scanCount = useMemo(
    () =>
      production ? scanLog.filter((e) => e.productionId === production.id).length : 0,
    [scanLog, production]
  );
  if (!production) return null;

  return (
    <div className="page stack">
      <h1>Today on set</h1>
      <p style={{ marginBottom: 0 }}>
        Tap <strong>Start Scanning</strong>, point at a dynamic QR or handwritten rental label, then pick where the
        piece is going. Everything lands in the log and rental inventory.
      </p>

      <Link to="/scan" className="btn btn-primary btn-block" style={{ fontSize: "1.1rem", padding: "1rem" }}>
        Start Scanning
      </Link>
      <p className="muted" style={{ marginTop: "-0.35rem", marginBottom: 0, fontSize: "0.82rem", textAlign: "center" }}>
        Dynamic QR · handwritten label · paste code by hand
      </p>

      {production.locations.length === 0 ? (
        <>
          <Link
            to="/locations"
            className="btn btn-primary btn-block"
            style={{ fontSize: "1.1rem", padding: "1rem" }}
          >
            Add studios &amp; trucks
          </Link>
          <p
            className="muted"
            style={{ marginTop: "-0.35rem", marginBottom: 0, fontSize: "0.82rem", textAlign: "center" }}
          >
            Scans need a place to land.
          </p>
        </>
      ) : null}

      <SetupChecklistCard production={production} scanCount={scanCount} />

      <DepartmentHeadListsPanel />

      <DepartmentHeadInvitePanel />

      <section className="card stack">
        <h2>Productions</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Shows you have worked on in Fabric Flo. Tap a row to switch; <strong>Current</strong> is the production
          you are tracking right now.
        </p>
        <ProductionList
          productions={productions}
          activeProductionId={activeProductionId}
          onSelect={setActiveProductionId}
          onRemove={(id) => {
            const wasCurrent = id === activeProductionId;
            deleteProduction(id);
            if (wasCurrent) navigate("/app", { replace: true });
          }}
        />
      </section>
    </div>
  );
}
