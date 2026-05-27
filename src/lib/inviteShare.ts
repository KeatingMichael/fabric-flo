export type InviteRecipientKind = "email" | "phone";

export function parseInviteContact(raw: string): InviteRecipientKind | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.includes("@")) return "email";
  const digits = t.replace(/\D/g, "");
  if (digits.length >= 7) return "phone";
  return null;
}

export function openInviteShare(
  contact: string,
  kind: InviteRecipientKind,
  productionName: string,
  inviteCode: string
): void {
  const body = `You're invited to join "${productionName}" on Fabric Flo.\n\nInvite Code: ${inviteCode}\n\nOpen the app, go to Crew invites, enter your email and this code.`;
  if (kind === "email") {
    const subject = encodeURIComponent(`Fabric Flo invite — ${productionName}`);
    const mailBody = encodeURIComponent(body);
    window.location.href = `mailto:${encodeURIComponent(contact.trim())}?subject=${subject}&body=${mailBody}`;
    return;
  }
  const phone = contact.replace(/\D/g, "");
  window.location.href = `sms:${phone}?body=${encodeURIComponent(body)}`;
}
