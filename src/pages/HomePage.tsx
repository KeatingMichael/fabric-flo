import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloudAccountCard } from "@/components/CloudAccountCard";
import { DepartmentHeadAccessCard } from "@/components/DepartmentHeadAccessCard";
import { ProductionList } from "@/components/ProductionList";
import { ProductionInviteSection } from "@/components/ProductionInviteSection";
import { useCloudAuth } from "@/context/CloudAuthProvider";
import { useApp } from "@/context/AppStore";
import { ensureProductionByName } from "@/lib/ensureProduction";

export function HomePage() {
  const { productions, activeProductionId, setActiveProductionId, addProduction, deleteProduction } =
    useApp();
  const { session } = useCloudAuth();
  const [productionName, setProductionName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const navigate = useNavigate();

  const needsProductionName = productions.length === 0;

  const ensureProduction = useCallback(async (): Promise<string | null> => {
    try {
      return await ensureProductionByName({
        name: productionName,
        productions,
        activeProductionId,
        session,
        addProduction,
        setActiveProductionId,
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not save production.");
      return null;
    }
  }, [productionName, productions, activeProductionId, session, addProduction, setActiveProductionId]);

  return (
    <div className="page stack">
      <header className="welcome-header">
        <h1>Welcome</h1>
        <p className="welcome-header__tagline">
          An easy solution to keep tabs on fabrics with legs!
        </p>
      </header>
      <p>
        Fabric Flo is built to track all fabrics used on your production. Start by uploading your inventory or
        rental list. From there, you can scan labels, choose your location, studio, or transport vehicle. Every
        scan is time-stamped and saved to your daily logs.
      </p>

      <CloudAccountCard
        productionName={productionName}
        onProductionNameChange={setProductionName}
        requireProductionName={needsProductionName}
        onEnsureProduction={ensureProduction}
        onEmailCaptured={setAccountEmail}
      />

      <DepartmentHeadAccessCard
        productionName={productionName}
        onProductionNameChange={setProductionName}
        requireProductionName={needsProductionName}
        onEnsureProduction={ensureProduction}
        accountEmail={accountEmail}
        onEmailCaptured={setAccountEmail}
      />

      <ProductionInviteSection
        productionName={productionName}
        onProductionNameChange={setProductionName}
        onEnsureProduction={ensureProduction}
        accountEmail={accountEmail}
      />

      {productions.length > 0 ? (
        <section className="stack">
          <h2 className="muted" style={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.08em" }}>
            Your productions
          </h2>
          <ProductionList
            productions={productions}
            activeProductionId={activeProductionId}
            onSelect={(id) => {
              setActiveProductionId(id);
              navigate("/dashboard");
            }}
            onRemove={deleteProduction}
          />
        </section>
      ) : null}
    </div>
  );
}
