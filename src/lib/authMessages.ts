/** Plain-English messages for Supabase Auth errors shown in the UI. */
export function friendlyAuthError(message: string | null | undefined): string | null {
  if (!message) return null;
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "That email or password did not match. New here? Choose “New — create my account”. Returning? Tap Forgot password below.";
  }
  if (lower.includes("email not confirmed")) {
    return "Check your email for a confirmation link, then tap Sign in.";
  }
  if (lower.includes("user already registered")) {
    return "That email already has an account. Choose “I already have a password” and tap Sign in.";
  }
  return message;
}
