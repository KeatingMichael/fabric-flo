import { createContext, useCallback, useContext, type ReactNode } from "react";

type ScrollMainContextValue = {
  scrollMainToTop: () => void;
};

const ScrollMainContext = createContext<ScrollMainContextValue | null>(null);

/** Scroll the document to the top (native page scroll — stable on iPhone). */
export function ScrollMainProvider({ children }: { children: ReactNode }) {
  const scrollMainToTop = useCallback(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  return (
    <ScrollMainContext.Provider value={{ scrollMainToTop }}>
      {children}
    </ScrollMainContext.Provider>
  );
}

export function useScrollMain(): ScrollMainContextValue {
  const ctx = useContext(ScrollMainContext);
  if (!ctx) throw new Error("useScrollMain must be used inside ScrollMainProvider");
  return ctx;
}
