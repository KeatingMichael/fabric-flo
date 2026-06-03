import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { useScrollContainer } from "@/context/ScrollContainerContext";
import { resetScrollAfterPaint } from "@/lib/scrollReset";

/** Scroll the app main pane to top before paint on every navigation. */
export function ScrollToTop() {
  const { pathname, hash, key } = useLocation();
  const { mainRef } = useScrollContainer();

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    const onPopState = () => resetScrollAfterPaint(mainRef.current);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [mainRef]);

  useLayoutEffect(() => {
    const root = mainRef.current;
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        resetScrollAfterPaint(root);
        target.scrollIntoView({ block: "start", behavior: "auto" });
        return;
      }
    }
    resetScrollAfterPaint(root);
  }, [pathname, hash, key, mainRef]);

  return null;
}
