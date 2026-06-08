import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useScrollMain } from "@/context/ScrollMainContext";
import { isFormFieldFocused } from "@/lib/iosScrollFix";

/** Reset scroll once when the route changes (skip if a form field is focused). */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const { scrollMainToTop } = useScrollMain();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    if (isFormFieldFocused()) return;
    const id = requestAnimationFrame(() => {
      scrollMainToTop();
    });
    return () => cancelAnimationFrame(id);
  }, [pathname, scrollMainToTop]);

  return null;
}
