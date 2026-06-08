import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { scrollPageToTop } from "@/lib/scrollToTop";

/** Reset document scroll once before paint when the route changes. */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useLayoutEffect(() => {
    scrollPageToTop();
  }, [pathname]);

  return null;
}
