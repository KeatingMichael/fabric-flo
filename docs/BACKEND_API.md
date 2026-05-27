# Fabric Flo backend API (Supabase)

The app can run in two persistence modes:

1. **Legacy blob** — table `user_app_state`: one JSON `state` column per authenticated user (migration `001_user_app_state.sql`). The client reads/writes the full `AppData` object.
2. **Normalized** — Postgres tables plus Row Level Security (`002_productions_normalized_rls.sql`) and **RPCs** (`003_fabric_flo_rpcs.sql`). Enable in the client with `VITE_FABRIC_FLO_BACKEND=normalized`.

## PostgREST surface (normalized mode)

Authenticated users call Supabase RPCs with the anon key and a valid JWT. Direct table writes for sensitive paths are denied by RLS where noted; mutations go through `SECURITY DEFINER` functions.

| RPC | Args | Returns | Purpose |
|-----|------|---------|---------|
| `fabric_flo_create_production` | `p_name text` | `uuid` | Creates a production row and a membership row for the caller as `admin`. |
| `fabric_flo_pull` | _(none)_ | `jsonb` | Bundle: `productions`, `scanLog`, `activeProductionId` (always null), `versions` (map of production id → version bigint). |
| `fabric_flo_push` | `p_state jsonb`, `p_expected_versions jsonb` default `{}` | `jsonb` | `{ ok: true, versions: { ... } }`. Replaces child rows for each production in `p_state.productions` the caller may edit (`admin`, `department_head`, `crew`). Optional optimistic lock: include expected server `version` per production id in `p_expected_versions`; mismatch raises `version_conflict` (SQLSTATE `P0001`). Writes `bundle_push` audit rows. |
| `fabric_flo_create_invite` | `p_production_id`, `p_role`, `p_email`, `p_expires_days` | `jsonb` | `{ inviteId, token, expiresAt, role }` — share `token` once; stored as SHA-256 hash server-side. |
| `fabric_flo_accept_invite` | `p_token text` | `jsonb` | `{ productionId, role }` — adds `production_members` row. |
| `fabric_flo_import_inventory_rows` | `p_production_id`, `p_rows jsonb`, `p_expected_version` | `jsonb` | `{ merged, added, version }` — each row is one physical piece; `merged` = rows with matching `id` updated (`admin` / `department_head` only). Max 500 rows. |

### `p_state` shape (aligned with `AppData`)

- `productions`: array of `{ id, name, createdAt?, departmentHeadPin?, locations[], items[] }`. Optional `settings` jsonb is merged into `productions.settings` on the server. `departmentHeadPin` is copied into `settings.departmentHeadPin` for backward compatibility with the client.
- `locations[]`: `{ id?, kind, name, sort_order? }` (`sort_order` defaults to 0).
- `items[]`: `{ id?, kind, name, qrAliases[], notes?, condition? }`.
- `scanLog[]`: only rows whose `productionId` appears in `productions[]` are applied. Fields: `id?, productionId, itemId, locationId, itemKind, itemName, locationKind, locationLabel, scannedAt?, rawQr`, optional `idempotencyKey` (unique when set).

### REST equivalents (if you add a BFF later)

Map the same contracts to production-scoped routes, for example:

- `POST /v1/productions` → create (same as `fabric_flo_create_production`).
- `GET /v1/me/bundle` → pull.
- `PUT /v1/me/bundle` → push with `If-Match` / body version map.
- `POST /v1/productions/:id/scans` → single scan append (optional decomposition of `fabric_flo_push`).
- `GET /v1/productions/:id/scans` → paginated log.
- `POST /v1/productions/:id/inventory/import` → CSV (server-side validation).

## Tables (reference)

See `002_productions_normalized_rls.sql`: `productions`, `production_members`, `production_invites`, `locations`, `inventory_items`, `item_qr_aliases`, `scan_events`.

## Audit log

`fabric_flo_audit_log` (`004_fabric_flo_audit_log.sql`) stores future security events. Rows are readable by `admin` and `department_head` on that production; clients cannot insert (RPCs or service role only).
