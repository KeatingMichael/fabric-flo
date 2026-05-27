#!/usr/bin/env node
/** Quick repo checks before deploy. Run: npm run verify:release */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;

function ok(msg) {
  console.log(`✓ ${msg}`);
}
function fail(msg) {
  console.error(`✗ ${msg}`);
  failed++;
}

const migDir = join(root, "supabase", "migrations");
if (existsSync(migDir)) {
  const files = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
  if (files.length >= 9) ok(`${files.length} SQL migrations present`);
  else fail(`Expected 9+ migrations, found ${files.length}`);
} else {
  fail("supabase/migrations missing");
}

for (const f of ["vercel.json", "netlify.toml", "capacitor.config.ts"]) {
  if (existsSync(join(root, f))) ok(f);
  else fail(`Missing ${f}`);
}

const pdf = join(root, "docs", "Fabric_Flo_Legal_Checklist.pdf");
if (existsSync(pdf)) ok("Legal PDF (run npm run legal:pdf to refresh)");
else fail("Missing docs/Fabric_Flo_Legal_Checklist.pdf — run npm run legal:pdf");

if (existsSync(join(root, "ios"))) ok("ios/ Capacitor project");
else fail("Missing ios/ — run npm run cap:add");

if (existsSync(join(root, "android"))) ok("android/ Capacitor project");
else fail("Missing android/ — run npm run cap:add");

const envEx = readFileSync(join(root, ".env.example"), "utf8");
/** Keys required for multi-user crew invites + shared scan log (see Home page flow). */
for (const key of [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_FABRIC_FLO_BACKEND=normalized",
  "VITE_PUBLIC_APP_URL",
  "VITE_PRIVACY_EMAIL",
]) {
  if (envEx.includes(key)) ok(`.env.example documents ${key.split("=")[0]}`);
  else fail(`.env.example missing ${key}`);
}

process.exit(failed ? 1 : 0);
