/** Hide fixed tab bar while the keyboard is open (iPhone Safari). */
export function initIosScrollFix(): () => void {
  const root = document.documentElement;
  let blurTimer: ReturnType<typeof setTimeout> | null = null;

  const setKeyboardOpen = (open: boolean) => {
    root.classList.toggle("ios-keyboard-open", open);
  };

  const isField = (el: EventTarget | null): el is HTMLElement =>
    el instanceof HTMLElement && el.matches("input, textarea, select");

  const onFocusIn = (e: FocusEvent) => {
    if (!isField(e.target)) return;
    if (blurTimer) {
      clearTimeout(blurTimer);
      blurTimer = null;
    }
    setKeyboardOpen(true);
  };

  const onFocusOut = () => {
    blurTimer = setTimeout(() => {
      if (!isField(document.activeElement)) setKeyboardOpen(false);
    }, 120);
  };

  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);

  return () => {
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
    if (blurTimer) clearTimeout(blurTimer);
    setKeyboardOpen(false);
  };
}

export function isFormFieldFocused(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLElement && el.matches("input, textarea, select");
}
