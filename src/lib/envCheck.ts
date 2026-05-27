import { isNormalizedFabricFloBackend } from "@/lib/cloudRepository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { PUBLIC_APP_ORIGIN } from "@/lib/legalConfig";

export type EnvCheckItem = {
  id: string;
  label: string;
  ok: boolean;
  hint: string;
};

/** In-app / dev checklist for production readiness (no secrets exposed). */
export function getEnvReadinessChecks(): EnvCheckItem[] {
  const checks: EnvCheckItem[] = [
    {
      id: "supabase",
      label: "Supabase URL and anon key configured",
      ok: isSupabaseConfigured(),
      hint: "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env",
    },
    {
      id: "normalized",
      label: "Normalized multi-user backend enabled",
      ok: isNormalizedFabricFloBackend(),
      hint: "Set VITE_FABRIC_FLO_BACKEND=normalized in production .env",
    },
    {
      id: "public_url",
      label: "Public HTTPS URL for store privacy link",
      ok: Boolean(PUBLIC_APP_ORIGIN?.startsWith("https://")),
      hint: "Set VITE_PUBLIC_APP_URL=https://your-domain.com after deploy",
    },
    {
      id: "support_email",
      label: "Support email for store listing",
      ok: Boolean(import.meta.env.VITE_SUPPORT_EMAIL?.trim()),
      hint: "Set VITE_SUPPORT_EMAIL in production .env",
    },
    {
      id: "privacy_email",
      label: "Privacy / deletion contact",
      ok: Boolean(import.meta.env.VITE_PRIVACY_EMAIL?.trim()),
      hint: "Set VITE_PRIVACY_EMAIL in production .env",
    },
  ];
  return checks;
}

export function envReadinessScore(): { passed: number; total: number } {
  const checks = getEnvReadinessChecks();
  const passed = checks.filter((c) => c.ok).length;
  return { passed, total: checks.length };
}
