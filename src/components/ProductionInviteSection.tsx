import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppStore";
import { useCloudAuth } from "@/context/CloudAuthProvider";
import {
  fabricFloAcceptInvite,
  fabricFloFetchAppData,
  isNormalizedFabricFloBackend,
} from "@/lib/cloudRepository";
import {
  clearPendingInviteJoin,
  readPendingInviteJoin,
  setPendingInviteJoin,
} from "@/lib/pendingInviteJoin";
import { hapticSuccess } from "@/lib/haptics";
import { ProductionNameField } from "@/components/ProductionNameField";

type Props = {
  productionName: string;
  onProductionNameChange: (value: string) => void;
  onEnsureProduction?: () => Promise<string | null>;
  accountEmail?: string;
};

export function ProductionInviteSection({
  productionName,
  onProductionNameChange,
  onEnsureProduction,
  accountEmail = "",
}: Props) {
  const navigate = useNavigate();
  const { replaceEntireAppData, setActiveProductionId } = useApp();
  const { user, configured } = useCloudAuth();
  const [crewEmail, setCrewEmail] = useState(accountEmail);
  const [joinCode, setJoinCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const normalized = isNormalizedFabricFloBackend();

  useEffect(() => {
    if (accountEmail.trim()) setCrewEmail(accountEmail);
  }, [accountEmail]);

  async function finishJoin() {
    const pending = readPendingInviteJoin();
    const token = (pending?.token ?? joinCode).trim();
    if (!token) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fabricFloAcceptInvite(token);
      clearPendingInviteJoin();
      setJoinCode("");
      const cloud = await fabricFloFetchAppData();
      replaceEntireAppData(cloud);
      const joined = cloud.productions.find((p) => p.id === res.productionId);
      if (joined) setActiveProductionId(joined.id);
      else if (cloud.productions[0]) setActiveProductionId(cloud.productions[0].id);
      hapticSuccess();
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not join this production.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!user || !configured || !normalized) return;
    const pending = readPendingInviteJoin();
    if (!pending?.token) return;
    void finishJoin();
  }, [user?.id, configured, normalized]);

  function onCrewContinue(e: FormEvent) {
    e.preventDefault();
    const em = crewEmail.trim();
    const code = joinCode.trim();
    if (!em || !code) return;

    if (!configured || !normalized) {
      if (onEnsureProduction && productionName.trim()) {
        void onEnsureProduction().then((id) => {
          if (id) {
            setMsg("Sign in under Fabric Flo account above first.");
          } else {
            setMsg("Enter your production name under Fabric Flo account first.");
          }
        });
      } else {
        setMsg("Invite Codes need cloud sign-in. Use Fabric Flo account above first.");
      }
      document.getElementById("cloud-account")?.scrollIntoView({ behavior: "auto", block: "start" });
      return;
    }

    setPendingInviteJoin({ email: em, token: code });

    if (user) {
      void finishJoin();
      return;
    }

    setMsg("Sign in under Fabric Flo account above with this email, then tap Continue here again.");
    document.getElementById("cloud-account")?.scrollIntoView({ behavior: "auto", block: "start" });
  }

  if (user) {
    return (
      <section className="card stack" id="crew-invites">
        <h2 style={{ marginTop: 0 }}>Crew invites</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          You are signed in. To invite crew, use <strong>Invite crew</strong> on your dashboard.
        </p>
      </section>
    );
  }

  return (
    <section className="card stack" id="crew-invites">
      <h2 style={{ marginTop: 0 }}>Crew invites</h2>
      <p className="muted" style={{ marginBottom: 0 }}>
        Have an Invite Code from your department head? Enter it below. You will sign in above if you have not yet.
      </p>
      <form className="stack" onSubmit={onCrewContinue}>
        <ProductionNameField
          id="crew-prod-name"
          value={productionName}
          onChange={onProductionNameChange}
          optional
        />
        <div className="field">
          <label htmlFor="crew-email">Your email</label>
          <input
            id="crew-email"
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@studio.com"
            value={crewEmail}
            onChange={(e) => setCrewEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="accept-token">Invite Code from department head</label>
          <input
            id="accept-token"
            className="input"
            autoComplete="off"
            placeholder="Paste invite code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={busy || !crewEmail.trim() || !joinCode.trim()}
        >
          Continue with Invite Code
        </button>
      </form>
      {msg ? <p className="muted" style={{ marginBottom: 0, fontSize: "0.88rem" }}>{msg}</p> : null}
    </section>
  );
}
