import { createContext, useCallback, useContext, useRef, type ReactNode, type RefObject } from "react";

type ScrollMainContextValue = {
  mainRef: RefObject<HTMLElement>;
  scrollMainToTop: () => void;
};

const ScrollMainContext = createContext<ScrollMainContextValue | null>(null);

/** Scroll the app main pane to top (single scroll container — stable on iPhone). */
export function ScrollMainProvider({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLElement>(null);

  const scrollMainToTop = useCallback(() => {
    const el = mainRef.current;
    if (el) {
      el.scrollTop = 0;
      return;
    }
    window.scrollTo(0, 0);
  }, []);

  return (
    <ScrollMainContext.Provider value={{ mainRef, scrollMainToTop }}>
      {children}
    </ScrollMainContext.Provider>
  );
}

export function useScrollMain(): ScrollMainContextValue {
  const ctx = useContext(ScrollMainContext);
  if (!ctx) throw new Error("useScrollMain must be used inside ScrollMainProvider");
  return ctx;
}
