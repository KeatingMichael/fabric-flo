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
        "Replace everything on this phone with the latest copy from the cloud? Unsaved changes on this phone may be lost."
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
    message = "You’re offline. Scans save on this phone and upload when you’re back online.";
  } else if (suppressAutoPush) {
    message = "Automatic save is paused on this phone. Open Fabric Flo account to save manually.";
  } else if (showConflict) {
    message = "This show was updated on another phone. Get the latest copy, or save this phone’s version again.";
  } else if (showSyncing) {
    message = "Saving to the cloud…";
  } else if (showError) {
    message = sync.lastError ?? "Could not save online.";
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
                Get latest copy
              </button>
            ) : null}
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => void onRetryPush()}>
              Save again
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
