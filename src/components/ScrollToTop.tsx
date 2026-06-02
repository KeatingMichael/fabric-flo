import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useScrollContainer } from "@/context/ScrollContainerContext";

/** Scroll the app main pane to top on route change (iOS-safe; avoids window scroll restore glitches). */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const { scrollToTop } = useScrollContainer();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        requestAnimationFrame(() => {
          target.scrollIntoView({ block: "start", behavior: "auto" });
        });
        return;
      }
    }

    scrollToTop("auto");
    const t = window.setTimeout(() => scrollToTop("auto"), 0);
    return () => window.clearTimeout(t);
  }, [pathname, hash, scrollToTop]);

  return null;
}
