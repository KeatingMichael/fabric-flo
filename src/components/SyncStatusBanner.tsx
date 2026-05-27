import { useCloudAuth } from "@/context/CloudAuthProvider";
import { getAppSnapshot, useApp } from "@/context/AppStore";
import { useSyncStatus } from "@/context/SyncStatusProvider";
import {
  fabricFloPull,
  fetchUserAppState,
  isNormalizedFabricFloBackend,
  isVersionConflictError,
} from "@/lib/cloudRepository";
import { pushAppStateToCloud } from "@/lib/offlineSync";
import { normalizeAppData } from "@/lib/normalizeAppData";

export function SyncStatusBanner() {
  const { session, configured, suppressAutoPush } = useCloudAuth();
  const sync = useSyncStatus();
  const app = useApp();

  if (!configured || !session?.user) return null;

  const showOffline = !sync.online;
  const showConflict = sync.versionConflict;
  const showError = sync.lastError && !showConflict;
  const showSyncing = sync.syncing;

  if (!showOffline && !showConflict && !showError && !showSyncing && !suppressAutoPush) {
    return null;
  }

  async function onPullLatest() {
    if (
      !window.confirm(
        "Replace everything on this device with the latest copy from the server? Unsynced changes on this device may be lost."
      )
    ) {
      return;
    }
    sync.markSyncStart();
    try {
      if (isNormalizedFabricFloBackend()) {
        const raw = await fabricFloPull();
        app.replaceEntireAppData(normalizeAppData(raw));
      } else {
        const cloud = await fetchUserAppState(session!.user.id);
        if (cloud) app.replaceEntireAppData(cloud);
      }
      sync.markSyncSuccess();
      sync.clearVersionConflict();
    } catch (e) {
      sync.markSyncError(e instanceof Error ? e.message : "Could not pull from server.");
    }
  }

  async function onRetryPush() {
    sync.markSyncStart();
    try {
      const { productionVersions } = await pushAppStateToCloud(session!.user.id, getAppSnapshot());
      if (productionVersions && Object.keys(productionVersions).length > 0) {
        app.mergeProductionVersions(productionVersions);
      }
      sync.markSyncSuccess();
    } catch (e) {
      sync.markSyncError(e instanceof Error ? e.message : "Sync failed", {
        versionConflict: isVersionConflictError(e),
      });
    }
  }

  let message = "";
  if (showOffline) {
    message = "Offline — scans and edits are saved on this device and will sync when you’re back online.";
  } else if (suppressAutoPush) {
    message = "Automatic sync is paused. Open Fabric Flo account to push manually or resume backup.";
  } else if (showConflict) {
    message = "Someone else updated this production on the server. Pull the latest copy or retry after reviewing.";
  } else if (showSyncing) {
    message = "Syncing with cloud…";
  } else if (showError) {
    message = sync.lastError ?? "Sync issue";
  }

  return (
    <div
      className={`sync-banner${showOffline ? " sync-banner--offline" : ""}${showConflict ? " sync-banner--warn" : ""}`}
      role="status"
    >
      <p style={{ margin: 0, fontSize: "0.88rem" }}>{message}</p>
      <div className="row" style={{ width: "100%", marginTop: "0.4rem", gap: "0.35rem" }}>
        {showConflict || showError ? (
          <>
            {isNormalizedFabricFloBackend() ? (
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => void onPullLatest()}>
                Pull latest
              </button>
            ) : null}
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => void onRetryPush()}>
              Retry sync
            </button>
          </>
        ) : null}
        {showError || showConflict ? (
          <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={sync.clearError}>
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
