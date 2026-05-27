import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAppSnapshot, useApp } from "@/context/AppStore";
import { useCloudAuth } from "@/context/CloudAuthProvider";
import { clearLocalAppData } from "@/lib/clearLocalAppData";
import { deleteAccountAndData } from "@/lib/accountDeletion";
import { isNormalizedFabricFloBackend } from "@/lib/cloudRepository";
import { mailtoAccountDeletion, PRIVACY_EMAIL } from "@/lib/legalConfig";
import { pushAppStateToCloud } from "@/lib/offlineSync";
import { useSyncStatus } from "@/context/SyncStatusProvider";
import { ProductionNameField } from "@/components/ProductionNameField";

type AccountStep = "email" | "password";

type Props = {
  productionName: string;
  onProductionNameChange: (value: string) => void;
  requireProductionName?: boolean;
  onEnsureProduction?: () => Promise<string | null>;
  onEmailCaptured?: (email: string) => void;
};

export function CloudAccountCard({
  productionName,
  onProductionNameChange,
  requireProductionName = false,
  onEnsureProduction,
  onEmailCaptured,
}: Props) {
  const navigate = useNavigate();
  const {
    configured,
    ready,
    user,
    suppressAutoPush,
    setSuppressAutoPush,
    signIn,
    signUp,
    resetPassword,
    signOut,
  } = useCloudAuth();
  const { mergeProductionVersions, replaceEntireAppData } = useApp();
  const sync = useSyncStatus();
  const [accountStep, setAccountStep] = useState<AccountStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedLegal, setAgreedLegal] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) setAccountStep("email");
  }, [user?.id]);

  async function onPushNow() {
    if (!user) return;
    setMsg(null);
    sync.markSyncStart();
    try {
      const { productionVersions } = await pushAppStateToCloud(user.id, getAppSnapshot());
      if (productionVersions && Object.keys(productionVersions).length > 0) {
        mergeProductionVersions(productionVersions);
      }
      setMsg(isNormalizedFabricFloBackend() ? "Saved to server." : "Saved to cloud.");
      sync.markSyncSuccess();
    } catch (e) {
      const text = e instanceof Error ? e.message : "Sync failed";
      setMsg(text);
      sync.markSyncError(text);
    }
  }

  async function onDeleteAccount() {
    const typed = window.prompt(
      `This permanently deletes your cloud productions (where you are the only admin), removes you from shared productions, and clears this device.\n\nType DELETE to confirm:`
    );
    if (typed?.trim().toUpperCase() !== "DELETE") return;
    setDeleting(true);
    setMsg(null);
    try {
      const result = await deleteAccountAndData();
      clearLocalAppData();
      replaceEntireAppData({
        productions: [],
        scanLog: [],
        activeProductionId: null,
        productionVersions: {},
      });
      await signOut();
      setMsg(
        `Account removed (${result.deletedProductions} production(s), ${result.removedMemberships} membership(s)). If you can still sign in, email ${PRIVACY_EMAIL}.`
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not delete account data.");
    } finally {
      setDeleting(false);
    }
  }

  function onDeleteLocalData() {
    if (
      !window.confirm(
        "Delete all Fabric Flo data stored on THIS device? Cloud backup (if any) is not removed. This cannot be undone."
      )
    ) {
      return;
    }
    clearLocalAppData();
    replaceEntireAppData({
      productions: [],
      scanLog: [],
      activeProductionId: null,
      productionVersions: {},
    });
    setMsg("Local data cleared.");
  }

  function goHome() {
    navigate("/dashboard");
  }

  async function onLocalContinue(e: FormEvent) {
    e.preventDefault();
    if (requireProductionName && !productionName.trim()) {
      setMsg("Enter your production name.");
      return;
    }
    setMsg(null);
    if (email.trim()) onEmailCaptured?.(email.trim());
    if (onEnsureProduction) {
      const id = await onEnsureProduction();
      if (!id) {
        setMsg("Enter your production name to continue.");
        return;
      }
    }
    goHome();
  }

  function onEmailContinue(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    if (requireProductionName && !productionName.trim()) {
      setMsg("Enter your production name.");
      return;
    }
    setMsg(null);
    onEmailCaptured?.(email.trim());
    setAccountStep("password");
  }

  async function onSignIn(e: FormEvent) {
    e.preventDefault();
    if (!agreedLegal) {
      setMsg("Please agree to the Terms and Privacy Policy.");
      return;
    }
    setMsg(null);
    const { error } = await signIn(email, password);
    if (error) {
      setMsg(error);
      return;
    }
    if (onEnsureProduction) {
      const id = await onEnsureProduction();
      if (!id) {
        setMsg("Enter your production name to continue.");
        return;
      }
    }
    setPassword("");
    goHome();
  }

  async function onSignedInContinue() {
    if (requireProductionName && !productionName.trim()) {
      setMsg("Enter your production name.");
      return;
    }
    setMsg(null);
    if (onEnsureProduction) {
      const id = await onEnsureProduction();
      if (!id) {
        setMsg("Enter your production name to continue.");
        return;
      }
    }
    goHome();
  }

  async function onSignUp() {
    if (!agreedLegal) {
      setMsg("Please agree to the Terms and Privacy Policy.");
      return;
    }
    setMsg(null);
    const { error } = await signUp(email, password);
    setMsg(
      error ??
        "Check your email to confirm your account, then return here and tap Continue to sign in."
    );
  }

  async function onForgotPassword() {
    if (!email.trim()) return;
    setMsg(null);
    const { error } = await resetPassword(email);
    setMsg(error ?? "Check your email for a password reset link.");
  }

  if (!configured) {
    return (
      <section className="card stack" id="cloud-account">
        <h2 style={{ marginTop: 0 }}>Fabric Flo account</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Cloud sign-in is not set up on this device yet. Enter your show below and tap Continue — your data stays
          on this phone until the released app is connected to Fabric Flo servers. Read our{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
        <form className="stack" onSubmit={(e) => void onLocalContinue(e)}>
          {requireProductionName ? (
            <ProductionNameField
              id="cloud-prod-name-offline"
              value={productionName}
              onChange={onProductionNameChange}
            />
          ) : null}
          <div className="field">
            <label htmlFor="cloud-email">Email (optional)</label>
            <input
              id="cloud-email"
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
            disabled={requireProductionName && !productionName.trim()}
          >
            Continue
          </button>
        </form>
        {import.meta.env.DEV ? (
          <p className="muted" style={{ marginBottom: 0, fontSize: "0.82rem" }}>
            Developers: copy <code>.env.example</code> to <code>.env</code> and add Supabase keys to test sign-in.
          </p>
        ) : null}
        {msg ? <p className="muted" style={{ marginBottom: 0, fontSize: "0.88rem" }}>{msg}</p> : null}
      </section>
    );
  }

  if (!ready) {
    return (
      <section className="card stack" id="cloud-account">
        <h2 style={{ marginTop: 0 }}>Fabric Flo account</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Checking session…
        </p>
      </section>
    );
  }

  if (user) {
    return (
      <section className="card stack" id="cloud-account">
        <h2 style={{ marginTop: 0 }}>Fabric Flo account</h2>
        <p style={{ marginBottom: 0 }}>
          Signed in as <strong>{user.email}</strong>.
        </p>
        {requireProductionName ? (
          <ProductionNameField
            id="cloud-prod-name-signed-in"
            value={productionName}
            onChange={onProductionNameChange}
          />
        ) : null}
        <button type="button" className="btn btn-primary btn-block" onClick={() => void onSignedInContinue()}>
          Continue
        </button>
        <details className="account-advanced">
          <summary className="muted" style={{ cursor: "pointer", fontSize: "0.88rem" }}>
            Account options
          </summary>
          <div className="stack" style={{ marginTop: "0.65rem", gap: "0.5rem" }}>
            {sync.lastSyncedAt && !sync.lastError ? (
              <p className="muted" style={{ marginBottom: 0, fontSize: "0.85rem" }}>
                Last synced: {new Date(sync.lastSyncedAt).toLocaleString()}
              </p>
            ) : null}
            {suppressAutoPush ? (
              <p className="muted" style={{ marginBottom: 0, fontSize: "0.85rem" }}>
                Automatic sync is paused. You can still push manually.
              </p>
            ) : null}
            <div className="row" style={{ width: "100%" }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => void onPushNow()}>
                Push now
              </button>
              {suppressAutoPush ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setSuppressAutoPush(false)}
                >
                  Resume sync
                </button>
              ) : null}
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
            <button type="button" className="btn btn-secondary btn-block" onClick={onDeleteLocalData}>
              Delete data on this device
            </button>
            <button
              type="button"
              className="btn btn-danger btn-block"
              disabled={deleting}
              onClick={() => void onDeleteAccount()}
            >
              {deleting ? "Deleting…" : "Delete my account & cloud data"}
            </button>
            <a
              className="btn btn-ghost btn-block"
              style={{ textAlign: "center", textDecoration: "none", fontSize: "0.88rem" }}
              href={mailtoAccountDeletion(user.email ?? "")}
            >
              Or email {PRIVACY_EMAIL}
            </a>
          </div>
        </details>
        {msg ? <p className="muted" style={{ marginBottom: 0 }}>{msg}</p> : null}
      </section>
    );
  }

  if (accountStep === "email") {
    return (
      <section className="card stack" id="cloud-account">
        <h2 style={{ marginTop: 0 }}>Fabric Flo account</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Sign in with email so your department shares <strong>one production</strong> and{" "}
          <strong>one daily log</strong> across every phone.
        </p>
        <form className="stack" onSubmit={onEmailContinue}>
          {requireProductionName ? (
            <ProductionNameField
              id="cloud-prod-name"
              value={productionName}
              onChange={onProductionNameChange}
            />
          ) : null}
          <div className="field">
            <label htmlFor="cloud-email">Email</label>
            <input
              id="cloud-email"
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
          New here? You will create a password on the next screen. By continuing you agree to our{" "}
          <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.
        </p>
        {msg ? <p className="muted" style={{ marginBottom: 0 }}>{msg}</p> : null}
      </section>
    );
  }

  return (
    <section className="card stack" id="cloud-account">
      <h2 style={{ marginTop: 0 }}>Fabric Flo account</h2>
      <p className="muted" style={{ marginBottom: 0 }}>
        Welcome back, <strong>{email.trim()}</strong>
        {productionName.trim() ? (
          <>
            {" "}
            · <strong>{productionName.trim()}</strong>
          </>
        ) : null}
      </p>
      <form className="stack" onSubmit={onSignIn}>
        <div className="field">
          <label htmlFor="cloud-pass">Password</label>
          <input
            id="cloud-pass"
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <label className="legal-consent">
          <input
            type="checkbox"
            checked={agreedLegal}
            onChange={(e) => setAgreedLegal(e.target.checked)}
          />
          <span>
            I agree to the <Link to="/terms">Terms of Service</Link> and{" "}
            <Link to="/privacy">Privacy Policy</Link>.
          </span>
        </label>
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={!password || !agreedLegal}
        >
          Continue
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => void onForgotPassword()}>
          Forgot password
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => {
            setAccountStep("email");
            setPassword("");
            setMsg(null);
          }}
        >
          Use a different email
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          disabled={!password || !agreedLegal}
          onClick={() => void onSignUp()}
        >
          Create new account
        </button>
      </form>
      {msg ? <p className="muted" style={{ marginBottom: 0 }}>{msg}</p> : null}
    </section>
  );
}
