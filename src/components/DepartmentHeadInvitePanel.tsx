import { useState } from "react";
import { Link } from "react-router-dom";
import { useActiveProduction, useApp } from "@/context/AppStore";
import { useCloudAuth } from "@/context/CloudAuthProvider";
import { useActiveProductionPermissions } from "@/hooks/useActiveProductionPermissions";
import { fabricFloCreateInvite, isNormalizedFabricFloBackend } from "@/lib/cloudRepository";
import { openInviteShare, parseInviteContact } from "@/lib/inviteShare";

export function DepartmentHeadInvitePanel() {
  const production = useActiveProduction();
  const { addInviteRecipient, removeInviteRecipient } = useApp();
  const { user, configured } = useCloudAuth();
  const { canManageInvites, cloudSignedIn } = useActiveProductionPermissions();
  const normalized = isNormalizedFabricFloBackend();
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [contactInput, setContactInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!production) return null;
  const prod = production;

  const recipients = prod.inviteRecipients ?? [];
  const cloudReady = configured && normalized && Boolean(user);

  async function onCreateInvite() {
    if (!canManageInvites) {
      setMsg("Only department heads can create invite codes.");
      return;
    }
    if (!cloudReady) {
      setMsg("Sign in on Home with Fabric Flo account to create Invite Codes.");
      return;
    }
    setBusy(true);
    setMsg(null);
    setInviteToken(null);
    try {
      const res = await fabricFloCreateInvite(prod.id, "crew");
      setInviteToken(res.token);
      setMsg(`Code created — expires ${new Date(res.expiresAt).toLocaleString()}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not create invite code.");
    } finally {
      setBusy(false);
    }
  }

  function onAddRecipient() {
    const kind = parseInviteContact(contactInput);
    if (!kind) {
      setMsg("Enter a valid email or phone number.");
      return;
    }
    addInviteRecipient(prod.id, contactInput, kind);
    setContactInput("");
    setMsg(null);
  }

  function onSendInvite(contact: string, kind: "email" | "phone") {
    if (!inviteToken) {
      setMsg("Create an Invite Code first.");
      return;
    }
    openInviteShare(contact, kind, prod.name, inviteToken);
  }

  function copyToken() {
    if (!inviteToken) return;
    void navigator.clipboard.writeText(inviteToken).then(() => setMsg("Invite code copied."));
  }

  if (cloudSignedIn && !canManageInvites) {
    return (
      <section className="card stack" id="department-head-invites">
        <h2>Invite crew</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          You are on this show as crew. Department heads create Invite Codes and share them with you from their
          account.
        </p>
      </section>
    );
  }

  return (
    <section className="card stack" id="department-head-invites">
      <h2>Invite crew</h2>
      <p className="muted" style={{ marginBottom: 0 }}>
        Create an Invite Code, then send it to crew by email or text. They enter the code on Home under{" "}
        <strong>Crew invites</strong>.
      </p>

      {!cloudReady ? (
        <p className="muted" style={{ marginBottom: 0, fontSize: "0.88rem" }}>
          {!user ? (
            <>
              <Link to="/app">Sign in on Home</Link> with your department head or Fabric Flo account to create codes.
            </>
          ) : (
            <>Cloud invites are not available on this device yet.</>
          )}
        </p>
      ) : null}

      <button
        type="button"
        className="btn btn-secondary btn-block"
        disabled={busy || !cloudReady}
        onClick={() => void onCreateInvite()}
      >
        {busy ? "Creating…" : "Create Invite Code"}
      </button>

      {inviteToken ? (
        <div className="stack">
          <p className="muted" style={{ marginBottom: 0, wordBreak: "break-all" }}>
            <strong>Invite Code:</strong> {inviteToken}
          </p>
          <button type="button" className="btn btn-ghost btn-block" onClick={copyToken}>
            Copy code
          </button>
        </div>
      ) : null}

      <div className="field" style={{ marginTop: "0.5rem" }}>
        <label htmlFor="invite-recipient">Email or phone number</label>
        <p className="muted" style={{ margin: "0.35rem 0 0.5rem", fontSize: "0.82rem" }}>
          Add contacts below, then tap Send to open your mail or messages app with the Invite Code.
        </p>
        <div className="row" style={{ width: "100%", alignItems: "stretch" }}>
          <input
            id="invite-recipient"
            className="input"
            type="text"
            autoComplete="off"
            placeholder="crew@studio.com or 555-123-4567"
            value={contactInput}
            onChange={(e) => setContactInput(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!contactInput.trim()}
            onClick={onAddRecipient}
          >
            Add
          </button>
        </div>
      </div>

      {recipients.length > 0 ? (
        <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {recipients.map((r) => (
            <li
              key={r.id}
              className="row"
              style={{
                width: "100%",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ flex: 1, minWidth: 0, wordBreak: "break-all" }}>
                {r.contact}
                <span className="muted" style={{ fontSize: "0.8rem", marginLeft: "0.35rem" }}>
                  ({r.kind === "email" ? "email" : "text"})
                </span>
              </span>
              <div className="row" style={{ flexShrink: 0, gap: "0.35rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "0.35rem 0.65rem", fontSize: "0.82rem" }}
                  disabled={!inviteToken}
                  onClick={() => onSendInvite(r.contact, r.kind)}
                >
                  Send
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: "0.35rem 0.65rem", fontSize: "0.82rem", color: "var(--danger)" }}
                  onClick={() => removeInviteRecipient(prod.id, r.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ marginBottom: 0, fontSize: "0.88rem" }}>
          No contacts yet — add emails or phone numbers to share your Invite Code.
        </p>
      )}

      {msg ? <p className="muted" style={{ marginBottom: 0, fontSize: "0.88rem" }}>{msg}</p> : null}
    </section>
  );
}
