import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { FabricFloBrandHeader } from "@/components/FabricFloBrandHeader";
import { LegalFooter } from "@/components/LegalFooter";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";
import { useActiveProduction } from "@/context/AppStore";
import { hapticSelection } from "@/lib/haptics";

const nav = [
  { to: "/dashboard", label: "Home", icon: "⌂" },
  { to: "/scan", label: "Scan", icon: "▣" },
  { to: "/inventory", label: "Fabrics", icon: "≡" },
  { to: "/locations", label: "Places", icon: "◎" },
  { to: "/log", label: "Log", icon: "☰" },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const production = useActiveProduction();
  const noNavPaths = ["/", "/app", "/help", "/privacy", "/terms", "/launch", "/licenses"];
  const showNav =
    production && !noNavPaths.includes(location.pathname) && location.pathname !== "/assign";
  const showLegalFooter = noNavPaths.includes(location.pathname);

  return (
    <div className="app-shell">
      <FabricFloBrandHeader />
      <SyncStatusBanner />
      <main style={{ flex: 1 }}>{children}</main>
      {showLegalFooter ? <LegalFooter /> : null}
      {showNav ? <BottomNav pathname={location.pathname} /> : null}
    </div>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Main"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: "calc(0.5rem + var(--safe-bottom))",
        paddingTop: "0.35rem",
        background: "rgba(11,18,32,0.96)",
        borderTop: "1px solid var(--border)",
        backdropFilter: "blur(12px)",
        zIndex: 30,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          alignItems: "stretch",
          maxWidth: 560,
          margin: "0 auto",
        }}
      >
        {nav.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => hapticSelection()}
              style={{
                flex: 1,
                textAlign: "center",
                textDecoration: "none",
                color: active ? "var(--accent)" : "var(--muted)",
                fontSize: "0.72rem",
                fontWeight: 600,
                padding: "0.35rem 0.2rem",
              }}
            >
              <div style={{ fontSize: "1.25rem", lineHeight: 1.1 }}>{item.icon}</div>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
