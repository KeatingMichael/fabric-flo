import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { FabricFloBrandHeader } from "@/components/FabricFloBrandHeader";
import { LegalFooter } from "@/components/LegalFooter";
import { SyncStatusBanner } from "@/components/SyncStatusBanner";
import { useActiveProduction } from "@/context/AppStore";
import { ScrollContainerProvider, useScrollContainer } from "@/context/ScrollContainerContext";
import { hapticSelection } from "@/lib/haptics";

const nav = [
  { to: "/dashboard", label: "Home", icon: "⌂" },
  { to: "/scan", label: "Scan", icon: "▣" },
  { to: "/inventory", label: "Fabrics", icon: "≡" },
  { to: "/locations", label: "Places", icon: "◎" },
  { to: "/log", label: "Log", icon: "☰" },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  return (
    <ScrollContainerProvider>
      <LayoutShell>{children}</LayoutShell>
    </ScrollContainerProvider>
  );
}

function LayoutShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const production = useActiveProduction();
  const { mainRef } = useScrollContainer();
  const noNavPaths = ["/", "/app", "/help", "/privacy", "/terms", "/launch", "/licenses"];
  const showNav =
    production && !noNavPaths.includes(location.pathname) && location.pathname !== "/assign";
  const showLegalFooter = noNavPaths.includes(location.pathname);

  return (
    <div className="app-shell">
      <FabricFloBrandHeader />
      <SyncStatusBanner />
      <main ref={mainRef} className="app-main">
        {children}
        {showLegalFooter ? <LegalFooter /> : null}
      </main>
      {showNav ? <BottomNav pathname={location.pathname} /> : null}
    </div>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="app-bottom-nav" aria-label="Main">
      <div className="app-bottom-nav__inner">
        {nav.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`app-bottom-nav__link${active ? " app-bottom-nav__link--active" : ""}`}
              onClick={() => hapticSelection()}
            >
              <span className="app-bottom-nav__icon" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
