import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppStoreProvider } from "@/context/AppStore";
import {
  CloudAuthProvider,
  CloudSessionBootstrap,
  CloudOnlineFlush,
  CloudSyncBridge,
  ProductionRolesSync,
} from "@/context/CloudAuthProvider";
import { SyncStatusProvider } from "@/context/SyncStatusProvider";
import App from "@/App";
import { initNativeShell } from "@/lib/initNativeShell";
import "@/styles/global.css";

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

void initNativeShell();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppStoreProvider>
      <SyncStatusProvider>
        <CloudAuthProvider>
          <CloudSessionBootstrap />
          <ProductionRolesSync />
          <CloudSyncBridge />
          <CloudOnlineFlush />
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </CloudAuthProvider>
      </SyncStatusProvider>
    </AppStoreProvider>
  </StrictMode>
);
