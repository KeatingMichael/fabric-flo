/** Public contact and policy URLs (set in production `.env`). */
export const SUPPORT_EMAIL =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() ||
  "support@fabricflo.app";

export const PRIVACY_EMAIL =
  (import.meta.env.VITE_PRIVACY_EMAIL as string | undefined)?.trim() || SUPPORT_EMAIL;

/** Canonical site for App Store / Play privacy policy URL field. */
export const PUBLIC_APP_ORIGIN =
  (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(/\/$/, "") || "";

export function privacyPolicyUrl(): string {
  return PUBLIC_APP_ORIGIN ? `${PUBLIC_APP_ORIGIN}/privacy` : "/privacy";
}

export function termsUrl(): string {
  return PUBLIC_APP_ORIGIN ? `${PUBLIC_APP_ORIGIN}/terms` : "/terms";
}

export function mailtoAccountDeletion(email: string): string {
  const subject = encodeURIComponent("Fabric Flo — delete my account");
  const body = encodeURIComponent(
    `Please delete my Fabric Flo account and associated cloud data.\n\nAccount email: ${email}\n\nI understand this cannot be undone.`
  );
  return `mailto:${PRIVACY_EMAIL}?subject=${subject}&body=${body}`;
}
