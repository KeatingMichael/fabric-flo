import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAppSnapshot, useApp } from "@/context/AppStore";
import { useCloudAuth } from "@/context/CloudAuthProvider";
import { clearLocalAppData } from "@/lib/clearLocalAppData";
import { deleteAccountAndData } from "@/lib/accountDeletion";
import { isNormalizedFabricFloBackend } from "@/lib/cloudRepository";
import { getSupabase } from "@/lib/supabase";
import { mailtoAccountDeletion, PRIVACY_EMAIL } from "@/lib/legalConfig";
import { pushAppStateToCloud } from "@/lib/offlineSync";
import { useSyncStatus } from "@/context/SyncStatusProvider";
import { ProductionNameField } from "@/components/ProductionNameField";
import { friendlyAuthError } from "@/lib/authMessages";
import { hapticSuccess, hapticWarning } from "@/lib/haptics";

type AccountStep = "email" | "password";
type PasswordMode = "signin" | "signup";

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
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedLegal, setAgreedLegal] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgKind, setMsgKind] = useState<"error" | "success" | "info">("info");
  const [deleting, setDeleting] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  function showMsg(text: string | null, kind: "error" | "success" | "info" = "info") {
    setMsg(text);
    setMsgKind(kind);
    if (text) {
      requestAnimationFrame(() => {
        document.getElementById("cloud-account-feedback")?.scrollIntoView({
          block: "nearest",
          behavior: "auto",
        });
      });
    }
  }

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
      setMsg(isNormalizedFabricFloBackend() ? "Saved online." : "Saved to cloud.");
      sync.markSyncSuccess();
      hapticSuccess();
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
      showMsg("Please agree to the Terms and Privacy Policy.", "error");
      return;
    }
    setAuthBusy(true);
    showMsg(null);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        showMsg(friendlyAuthError(error), "error");
        hapticWarning();
        return;
      }
      if (onEnsureProduction) {
        const id = await onEnsureProduction();
        if (!id) {
          showMsg("Enter your production name to continue.", "error");
          hapticWarning();
          return;
        }
      }
      setPassword("");
      hapticSuccess();
      goHome();
    } finally {
      setAuthBusy(false);
    }
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
      showMsg("Please agree to the Terms and Privacy Policy.", "error");
      return;
    }
    setAuthBusy(true);
    showMsg(null);
    try {
      const { error } = await signUp(email, password);
      if (error) {
        showMsg(friendlyAuthError(error), "error");
        hapticWarning();
        return;
      }
      const session = (await getSupabase()?.auth.getSession())?.data.session;
      if (session) {
        if (onEnsureProduction) {
          const id = await onEnsureProduction();
          if (!id) {
            showMsg("Enter your production name to continue.", "error");
            hapticWarning();
            return;
          }
        }
        setPassword("");
        hapticSuccess();
        goHome();
        return;
      }
      showMsg(
        "Account created. Check your email if asked to confirm, then choose Returning and tap Sign in.",
        "success"
      );
      hapticSuccess();
      setPasswordMode("signin");
    } finally {
      setAuthBusy(false);
    }
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
          Open my show
        </button>
        <details className="account-advanced">
          <summary className="muted" style={{ cursor: "pointer", fontSize: "0.88rem" }}>
            Backup &amp; sign-out
          </summary>
          <div className="stack" style={{ marginTop: "0.65rem", gap: "0.5rem" }}>
            <p className="muted" style={{ marginBottom: 0, fontSize: "0.82rem" }}>
              Your show is saved online. You rarely need the options below.
            </p>
            {sync.lastSyncedAt && !sync.lastError ? (
              <p className="muted" style={{ marginBottom: 0, fontSize: "0.85rem" }}>
                Last saved online: {new Date(sync.lastSyncedAt).toLocaleString()}
              </p>
            ) : null}
            {suppressAutoPush ? (
              <p className="muted" style={{ marginBottom: 0, fontSize: "0.85rem" }}>
                Automatic save is paused on this device.
              </p>
            ) : null}
            <div className="row" style={{ width: "100%" }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => void onPushNow()}>
                Save now
              </button>
              {suppressAutoPush ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setSuppressAutoPush(false)}
                >
                  Turn auto-save on
                </button>
              ) : null}
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
            <p className="muted" style={{ marginBottom: 0, fontSize: "0.78rem" }}>
              Save now — upload this phone&apos;s copy immediately. Sign out — log out here only; your online data stays.
            </p>
            <button type="button" className="btn btn-secondary btn-block" onClick={onDeleteLocalData}>
              Clear this phone only
            </button>
            <p className="muted" style={{ marginBottom: 0, fontSize: "0.78rem" }}>
              Removes Fabric Flo data from this device. Your online account and show are not deleted.
            </p>
            <button
              type="button"
              className="btn btn-danger btn-block"
              disabled={deleting}
              onClick={() => void onDeleteAccount()}
            >
              {deleting ? "Deleting…" : "Delete my account permanently"}
            </button>
            <p className="muted" style={{ marginBottom: 0, fontSize: "0.78rem" }}>
              Removes your account and cloud data. This cannot be undone.
            </p>
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
          Step 1 of 2 — enter your email. On the next screen you will create a password or sign in.
        </p>
        {msg ? <p className="muted" style={{ marginBottom: 0 }}>{msg}</p> : null}
      </section>
    );
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (passwordMode === "signup") {
      await onSignUp();
    } else {
      await onSignIn(e);
    }
  }

  return (
    <section className="card stack" id="cloud-account">
      <h2 style={{ marginTop: 0 }}>Fabric Flo account</h2>
      <p className="muted" style={{ marginBottom: 0 }}>
        Step 2 of 2 — for <strong>{email.trim()}</strong>
        {productionName.trim() ? (
          <>
            {" "}
            · show: <strong>{productionName.trim()}</strong>
          </>
        ) : null}
      </p>
      <form className="stack" onSubmit={(e) => void onPasswordSubmit(e)}>
        <fieldset className="stack" style={{ border: "none", margin: 0, padding: 0, gap: "0.35rem" }}>
          <legend className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.25rem" }}>
            I am…
          </legend>
          <label className="legal-consent">
            <input
              type="radio"
              name="password-mode"
              checked={passwordMode === "signup"}
              onChange={() => {
                setPasswordMode("signup");
                showMsg(null);
              }}
            />
            <span>New — create my Fabric Flo account</span>
          </label>
          <label className="legal-consent">
            <input
              type="radio"
              name="password-mode"
              checked={passwordMode === "signin"}
              onChange={() => {
                setPasswordMode("signin");
                showMsg(null);
              }}
            />
            <span>Returning — I already have a password</span>
          </label>
        </fieldset>
        <div className="field">
          <label htmlFor="cloud-pass">Password</label>
          <input
            id="cloud-pass"
            className="input"
            type="password"
            autoComplete={passwordMode === "signup" ? "new-password" : "current-password"}
            placeholder={passwordMode === "signup" ? "Choose a password" : "Your password"}
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
          disabled={!password || !agreedLegal || authBusy}
        >
          {authBusy
            ? passwordMode === "signup"
              ? "Creating account…"
              : "Signing in…"
            : passwordMode === "signup"
              ? "Create my account"
              : "Sign in"}
        </button>
        {msg ? (
          <p
            id="cloud-account-feedback"
            className={`auth-feedback auth-feedback--${msgKind}`}
            role={msgKind === "error" ? "alert" : "status"}
          >
            {msg}
          </p>
        ) : null}
        {passwordMode === "signin" ? (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => void onForgotPassword()}>
            Forgot password
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => {
            setAccountStep("email");
            setPassword("");
            showMsg(null);
          }}
        >
          Use a different email
        </button>
      </form>
    </section>
  );
}
