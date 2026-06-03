import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { FabricFloBrandHeader } from "@/components/FabricFloBrandHeader";
import { LegalFooter } from "@/components/LegalFooter";
import { ScrollLink } from "@/components/ScrollLink";
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
  const { mainRef, scrollToTop } = useScrollContainer();
  const noNavPaths = ["/", "/app", "/help", "/privacy", "/terms", "/launch", "/licenses"];
  const showNav =
    production && !noNavPaths.includes(location.pathname) && location.pathname !== "/assign";
  const showLegalFooter = noNavPaths.includes(location.pathname);

  return (
    <div className="app-shell">
      <FabricFloBrandHeader />
      <SyncStatusBanner />
      <main ref={mainRef} className="app-main">
        <div className="route-outlet" key={location.pathname}>
          {children}
        </div>
        {showLegalFooter ? <LegalFooter /> : null}
      </main>
      {showNav ? <BottomNav pathname={location.pathname} onNavigate={scrollToTop} /> : null}
    </div>
  );
}

function BottomNav({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return (
    <nav className="app-bottom-nav" aria-label="Main">
      <div className="app-bottom-nav__inner">
        {nav.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <ScrollLink
              key={item.to}
              to={item.to}
              className={`app-bottom-nav__link${active ? " app-bottom-nav__link--active" : ""}`}
              onClick={() => {
                onNavigate();
                hapticSelection();
              }}
            >
              <span className="app-bottom-nav__icon" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </ScrollLink>
          );
        })}
      </div>
    </nav>
  );
}
