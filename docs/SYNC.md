# Sync and conflicts (normalized backend)

## Model

- Each **production** row has a monotonic `version` (bigint). `fabric_flo_pull` returns a `versions` map keyed by production UUID string.
- The client keeps `productionVersions` (optional on `AppData`) in local storage alongside the bundle.
- On **push**, the client sends `p_expected_versions` with the last known server version for each production it edits. If any value differs from the current row, the RPC raises **version_conflict** (SQLSTATE `P0001`).

## Recommended client flow

1. After a successful **pull**, merge the returned `versions` map into `productionVersions`.
2. Before **push**, build `p_expected_versions` from `productionVersions` for every production id present in the outgoing `productions` array. Omit a production to skip the lock for that row (useful for first push of a newly created production before any version is stored).
3. On **version_conflict**, refresh from the server with `fabric_flo_pull` (or prompt the user), merge or replace local state, update `productionVersions`, and retry the write if appropriate.

## Scan log and idempotency

- For each production included in a push, the server **deletes** existing `scan_events` for that production, then re-inserts from `p_state.scanLog` (full snapshot for in-bundle productions).
- Rows with a non-null `idempotency_key` use `ON CONFLICT DO NOTHING` so flaky networks can retry the same scan without duplicates.

## Offline queue (optional)

The production client does not ship a durable offline queue yet. For flaky networks, callers can:

- attach `idempotencyKey` to scan entries before push, and
- retry push after backoff when the RPC fails.

A future enhancement is IndexedDB-backed queued RPCs with exponential backoff.
