import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { useScrollMain } from "@/context/ScrollMainContext";

/** Reset the main scroll pane once when the route changes. */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const { scrollMainToTop } = useScrollMain();

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useLayoutEffect(() => {
    scrollMainToTop();
  }, [pathname, scrollMainToTop]);

  return null;
}
