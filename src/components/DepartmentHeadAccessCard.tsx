import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCloudAuth } from "@/context/CloudAuthProvider";
import { ProductionNameField } from "@/components/ProductionNameField";

type Props = {
  productionName: string;
  onProductionNameChange: (value: string) => void;
  requireProductionName?: boolean;
  onEnsureProduction?: () => Promise<string | null>;
  accountEmail?: string;
  onEmailCaptured?: (email: string) => void;
};

export function DepartmentHeadAccessCard({
  productionName,
  onProductionNameChange,
  requireProductionName = false,
  onEnsureProduction,
  accountEmail = "",
  onEmailCaptured,
}: Props) {
  const navigate = useNavigate();
  const { configured, user } = useCloudAuth();
  const [email, setEmail] = useState(accountEmail);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (accountEmail.trim()) setEmail(accountEmail);
  }, [accountEmail]);

  async function onContinue(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setMsg("Enter your email.");
      return;
    }
    if (requireProductionName && !productionName.trim()) {
      setMsg("Enter your production name.");
      return;
    }
    setMsg(null);
    onEmailCaptured?.(email.trim());
    if (onEnsureProduction) {
      const id = await onEnsureProduction();
      if (!id) {
        setMsg("Enter your production name to continue.");
        return;
      }
    }
    if (user) {
      navigate("/dashboard");
      return;
    }
    if (configured) {
      setMsg("Sign in under Fabric Flo account above first, then come back here.");
      document.getElementById("cloud-account")?.scrollIntoView({ behavior: "auto", block: "start" });
      return;
    }
    navigate("/dashboard");
  }

  return (
    <section className="card stack" id="department-head-access">
      <h2 style={{ marginTop: 0 }}>Department head access</h2>
      <p className="muted" style={{ marginBottom: 0 }}>
        Same sign-in as above. After you open your show, create Invite Codes on the dashboard and text them to crew.
      </p>
      <form className="stack" onSubmit={(e) => void onContinue(e)}>
        {requireProductionName ? (
          <ProductionNameField
            id="hod-prod-name"
            value={productionName}
            onChange={onProductionNameChange}
          />
        ) : null}
        <div className="field">
          <label htmlFor="hod-email">Your email</label>
          <input
            id="hod-email"
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@studio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={!email.trim() || (requireProductionName && !productionName.trim())}
        >
          Continue
        </button>
      </form>
      <p className="muted" style={{ marginBottom: 0, fontSize: "0.82rem" }}>
        By continuing you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.
      </p>
      {msg ? <p className="muted" style={{ marginBottom: 0, fontSize: "0.88rem" }}>{msg}</p> : null}
    </section>
  );
}
