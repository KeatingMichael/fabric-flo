import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SyncStatusState = {
  online: boolean;
  syncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  versionConflict: boolean;
};

type SyncStatusApi = SyncStatusState & {
  markSyncStart: () => void;
  markSyncSuccess: () => void;
  markSyncError: (message: string, opts?: { versionConflict?: boolean }) => void;
  clearError: () => void;
  clearVersionConflict: () => void;
};

const SyncStatusContext = createContext<SyncStatusApi | null>(null);

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [versionConflict, setVersionConflict] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const markSyncStart = useCallback(() => {
    setSyncing(true);
    setLastError(null);
  }, []);

  const markSyncSuccess = useCallback(() => {
    setSyncing(false);
    setLastSyncedAt(new Date().toISOString());
    setLastError(null);
    setVersionConflict(false);
  }, []);

  const markSyncError = useCallback((message: string, opts?: { versionConflict?: boolean }) => {
    setSyncing(false);
    setLastError(message);
    if (opts?.versionConflict) setVersionConflict(true);
  }, []);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  const clearVersionConflict = useCallback(() => {
    setVersionConflict(false);
    setLastError(null);
  }, []);

  const value = useMemo<SyncStatusApi>(
    () => ({
      online,
      syncing,
      lastSyncedAt,
      lastError,
      versionConflict,
      markSyncStart,
      markSyncSuccess,
      markSyncError,
      clearError,
      clearVersionConflict,
    }),
    [
      online,
      syncing,
      lastSyncedAt,
      lastError,
      versionConflict,
      markSyncStart,
      markSyncSuccess,
      markSyncError,
      clearError,
      clearVersionConflict,
    ]
  );

  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

export function useSyncStatus(): SyncStatusApi {
  const ctx = useContext(SyncStatusContext);
  if (!ctx) throw new Error("useSyncStatus must be used inside SyncStatusProvider");
  return ctx;
}
