# Security notes — Fabric Flo

## Secrets

- **Never commit** `.env` or real API keys. Only `.env.example` belongs in git.
- The Supabase **anon** key is shipped to browsers by design; **Row Level Security (RLS)** must stay enabled on `user_app_state` so users can only read/write their own row (see `supabase/migrations/001_user_app_state.sql`).
- With **normalized** mode (`VITE_FABRIC_FLO_BACKEND=normalized`), the anon key must never grant broad table access: rely on RLS on `productions`, `production_members`, child tables, and `SECURITY DEFINER` RPCs for bundle writes. See `supabase/migrations/002_productions_normalized_rls.sql` and `003_fabric_flo_rpcs.sql`.

## Department head PIN

- Stored in production `settings` JSON when using the normalized backend, or in the client model during transition. It is **not** enterprise IAM; real enforcement uses **membership roles** (`admin`, `department_head`, `crew`, `viewer`) on the server.

## Crew JSON packs

- Anyone with a crew pack file can import it. Distribute packs over channels you already trust (encrypted email, studio Slack, etc.).

## Account deletion

- Migration `008_fabric_flo_delete_account.sql` exposes `fabric_flo_delete_my_account` for authenticated users (removes memberships and sole-admin productions).
- Complete removal of `auth.users` requires a **service-role** Edge Function or manual dashboard action — see `supabase/functions/delete-auth-user/README.md`.

## Audit and operations

- `fabric_flo_audit_log` (migration `004`) is reserved for security-relevant events; only admins/heads can read it via RLS. Inserts are intended from trusted server paths (RPCs or service role), not from anonymous clients.
- Run migrations in CI/staging before production; keep TLS and backups on the Supabase project per vendor guidance.

## Dependency updates

- Run `npm audit` periodically and upgrade dependencies for patched CVEs.

## Hosting

- Serve the built app over **HTTPS** so session cookies and Supabase auth tokens are not exposed on insecure networks.
