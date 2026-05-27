import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useActiveProduction } from "@/context/AppStore";
import logoBundled from "@/assets/fabric-flo-logo-widget.jpg";

/** Public copy for dev + PWA; bundled copy for production builds. */
const LOGO_PUBLIC = "/fabric-flo-logo-widget.jpg";

function formatProductionTitle(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function FabricFloBrandHeader() {
  const production = useActiveProduction();
  const { pathname } = useLocation();
  const homeTo = production ? "/dashboard" : pathname === "/" ? "/" : "/app";
  const [logoSrc, setLogoSrc] = useState(logoBundled || LOGO_PUBLIC);

  return (
    <div className="app-brand-header-wrap">
      <header className="app-brand-header">
        <div className="app-brand-header__inner">
          <div className="app-brand-header__brand">
            <Link to={homeTo} className="app-brand-header__logo-link" aria-label="Fabric Flo home">
              <img
                className="app-brand-header__logo"
                src={logoSrc}
                alt="Fabric Flo"
                decoding="async"
                onError={() => {
                  if (logoSrc !== LOGO_PUBLIC) setLogoSrc(LOGO_PUBLIC);
                }}
              />
            </Link>
            {production ? (
              <p className="app-brand-header__production">{formatProductionTitle(production.name)}</p>
            ) : null}
          </div>
          <Link to="/help" className="btn btn-secondary app-brand-header__help">
            Help
          </Link>
        </div>
      </header>
    </div>
  );
}
