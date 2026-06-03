import { createContext, useCallback, useContext, useRef, type ReactNode, type RefObject } from "react";
import { resetScrollPosition } from "@/lib/scrollReset";

type ScrollContainerContextValue = {
  mainRef: RefObject<HTMLElement>;
  scrollToTop: (behavior?: ScrollBehavior) => void;
};

const ScrollContainerContext = createContext<ScrollContainerContextValue | null>(null);

export function ScrollContainerProvider({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLElement>(null);

  const scrollToTop = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = mainRef.current;
    if (behavior === "auto") {
      resetScrollPosition(el);
      return;
    }
    if (el) {
      el.scrollTo({ top: 0, left: 0, behavior });
    }
    window.scrollTo({ top: 0, left: 0, behavior });
  }, []);

  return (
    <ScrollContainerContext.Provider value={{ mainRef, scrollToTop }}>
      {children}
    </ScrollContainerContext.Provider>
  );
}

export function useScrollContainer(): ScrollContainerContextValue {
  const ctx = useContext(ScrollContainerContext);
  if (!ctx) {
    throw new Error("useScrollContainer must be used inside ScrollContainerProvider");
  }
  return ctx;
}
