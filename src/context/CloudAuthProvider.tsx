import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getAppSnapshot, useApp } from "@/context/AppStore";
import {
  fabricFloPull,
  fetchMyProductionRoles,
  fetchUserAppState,
  isNormalizedFabricFloBackend,
  isVersionConflictError,
  upsertUserAppState,
} from "@/lib/cloudRepository";
import { pushAppStateToCloud } from "@/lib/offlineSync";
import { normalizeAppData } from "@/lib/normalizeAppData";
import { useSyncStatus } from "@/context/SyncStatusProvider";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { PUBLIC_APP_ORIGIN } from "@/lib/legalConfig";

type CloudAuthValue = {
  ready: boolean;
  configured: boolean;
  session: Session | null;
  user: User | null;
  suppressAutoPush: boolean;
  setSuppressAutoPush: (v: boolean) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const CloudAuthContext = createContext<CloudAuthValue | null>(null);

export function useCloudAuth(): CloudAuthValue {
  const ctx = useContext(CloudAuthContext);
  if (!ctx) throw new Error("useCloudAuth must be used inside CloudAuthProvider");
  return ctx;
}

export function CloudAuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [ready, setReady] = useState(!configured);
  const [session, setSession] = useState<Session | null>(null);
  const [suppressAutoPush, setSuppressAutoPush] = useState(false);

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setReady(true);
      return;
    }
    void sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, [configured]);

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return { error: "Cloud is not configured." };
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (!error && data.session) setSession(data.session);
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return { error: "Cloud is not configured." };
    const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
    if (!error && data.session) setSession(data.session);
    return { error: error?.message ?? null };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const sb = getSupabase();
    if (!sb) return { error: "Cloud is not configured." };
    const redirectTo = PUBLIC_APP_ORIGIN
      ? `${PUBLIC_APP_ORIGIN}/`
      : `${window.location.origin}/`;
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith("ffboot_")) sessionStorage.removeItem(k);
    }
    setSuppressAutoPush(false);
    if (sb) await sb.auth.signOut();
    setSession(null);
  }, []);

  const value = useMemo<CloudAuthValue>(
    () => ({
      ready,
      configured,
      session,
      user: session?.user ?? null,
      suppressAutoPush,
      setSuppressAutoPush,
      signIn,
      signUp,
      resetPassword,
      signOut,
    }),
    [ready, configured, session, suppressAutoPush, signIn, signUp, resetPassword, signOut]
  );

  return <CloudAuthContext.Provider value={value}>{children}</CloudAuthContext.Provider>;
}

/** First-time cloud merge after sign-in (same browser session token skips repeat prompts). */
export function CloudSessionBootstrap() {
  const { session, setSuppressAutoPush, configured, ready } = useCloudAuth();
  const { replaceEntireAppData } = useApp();
  const replaceRef = useRef(replaceEntireAppData);
  replaceRef.current = replaceEntireAppData;

  useEffect(() => {
    if (!configured || !ready) return;
    const sb = getSupabase();
    if (!sb || !session?.user || !session.access_token) return;

    const uid = session.user.id;
    const key = `ffboot_${uid}`;
    if (sessionStorage.getItem(key) === "done") return;

    let cancelled = false;
    void (async () => {
      try {
        const snap = getAppSnapshot();
        const hasLocal = snap.productions.length > 0 || snap.scanLog.length > 0;

        if (isNormalizedFabricFloBackend()) {
          const pulledRaw = await fabricFloPull();
          if (cancelled) return;
          const cloud = normalizeAppData(pulledRaw);
          const hasCloud = cloud.productions.length > 0 || cloud.scanLog.length > 0;

          if (hasCloud) {
            if (!hasLocal) {
              replaceRef.current(cloud);
              setSuppressAutoPush(false);
            } else {
              const ok = window.confirm(
                "This phone already has show data, and your account also has a copy online.\n\nOK — use the online copy (replaces what's on this phone).\nCancel — keep this phone's copy (automatic online save pauses until you turn it back on)."
              );
              if (cancelled) return;
              if (ok) {
                replaceRef.current(cloud);
                setSuppressAutoPush(false);
              } else {
                setSuppressAutoPush(true);
              }
            }
          } else if (hasLocal) {
            window.alert(
              "Normalized cloud mode is on, but this account has no server productions yet. Data on this device was not uploaded (local-only IDs are not valid on the server). Create a new production from Home while signed in, or import a crew pack so the app can register a production on the server first."
            );
          }
          return;
        }

        const cloud = await fetchUserAppState(uid);
        if (cancelled) return;
        const hasCloud = cloud && (cloud.productions.length > 0 || cloud.scanLog.length > 0);

        if (hasCloud) {
          if (!hasLocal) {
            replaceRef.current(cloud!);
            setSuppressAutoPush(false);
          } else {
            const ok = window.confirm(
              "This phone already has show data, and your account also has a backup online.\n\nOK — use the online backup (replaces what's on this phone).\nCancel — keep this phone's copy (automatic online save pauses until you turn it back on)."
            );
            if (cancelled) return;
            if (ok) {
              replaceRef.current(cloud!);
              setSuppressAutoPush(false);
            } else {
              setSuppressAutoPush(true);
            }
          }
        } else if (hasLocal) {
          await upsertUserAppState(uid, snap);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          window.alert(
            e instanceof Error ? e.message : "Could not sync with the cloud. Check your Supabase table and RLS."
          );
        }
      } finally {
        if (!cancelled) {
          sessionStorage.setItem(key, "done");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, ready, session?.user?.id, setSuppressAutoPush]);

  return null;
}

/** Keeps `productionRoles` in app state current for signed-in cloud users. */
export function ProductionRolesSync() {
  const { session, configured, ready } = useCloudAuth();
  const { productions, setProductionRoles } = useApp();

  useEffect(() => {
    if (!configured || !ready || !session?.user || !isNormalizedFabricFloBackend()) return;
    let cancelled = false;
    void fetchMyProductionRoles()
      .then((roles) => {
        if (!cancelled) setProductionRoles(roles);
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, [configured, ready, session?.user?.id, productions.length, setProductionRoles]);

  return null;
}

async function runCloudPush(
  userId: string,
  app: ReturnType<typeof useApp>,
  sync: ReturnType<typeof useSyncStatus>
) {
  sync.markSyncStart();
  try {
    const { productionVersions } = await pushAppStateToCloud(userId, {
      productions: app.productions,
      scanLog: app.scanLog,
      activeProductionId: app.activeProductionId,
      productionVersions: app.productionVersions,
    });
    if (productionVersions && Object.keys(productionVersions).length > 0) {
      app.mergeProductionVersions(productionVersions);
    }
    sync.markSyncSuccess();
  } catch (e) {
    if (isNormalizedFabricFloBackend() && isVersionConflictError(e)) {
      sync.markSyncError("Production was updated on the server.", { versionConflict: true });
    } else if (!navigator.onLine) {
      sync.markSyncError("Offline — changes saved on this device.");
    } else {
      sync.markSyncError(e instanceof Error ? e.message : "Cloud sync failed.");
      console.error(e);
    }
  }
}

/** Debounced push of local state to Supabase while signed in. */
export function CloudSyncBridge() {
  const { session, suppressAutoPush, configured, ready } = useCloudAuth();
  const app = useApp();
  const sync = useSyncStatus();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const online = sync.online;

  useEffect(() => {
    if (!configured || !ready || !session?.user || suppressAutoPush || !online) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void runCloudPush(session.user.id, app, sync);
    }, 900);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [
    configured,
    ready,
    session?.user?.id,
    suppressAutoPush,
    online,
    app.productions,
    app.scanLog,
    app.activeProductionId,
    app.productionVersions,
    app.mergeProductionVersions,
    sync.markSyncStart,
    sync.markSyncSuccess,
    sync.markSyncError,
  ]);

  return null;
}

/** Push to cloud immediately when the device comes back online. */
export function CloudOnlineFlush() {
  const { session, suppressAutoPush, configured, ready } = useCloudAuth();
  const app = useApp();
  const sync = useSyncStatus();

  useEffect(() => {
    if (!configured || !ready || !session?.user || suppressAutoPush) return;

    const onOnline = () => {
      if (!navigator.onLine) return;
      void runCloudPush(session.user.id, app, sync);
    };

    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [
    configured,
    ready,
    session?.user?.id,
    suppressAutoPush,
    app.productions,
    app.scanLog,
    app.activeProductionId,
    app.productionVersions,
    app.mergeProductionVersions,
    sync.markSyncStart,
    sync.markSyncSuccess,
    sync.markSyncError,
  ]);

  return null;
}
