/** Hard reset scroll on the app pane and document (iOS needs direct scrollTop assignment). */
export function resetScrollPosition(scrollRoot?: HTMLElement | null): void {
  if (scrollRoot) {
    scrollRoot.scrollTop = 0;
    scrollRoot.scrollLeft = 0;
  }
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/** Reset immediately and again after paint — catches mobile Safari restoring mid-page scroll. */
export function resetScrollAfterPaint(scrollRoot?: HTMLElement | null): void {
  resetScrollPosition(scrollRoot);
  requestAnimationFrame(() => {
    resetScrollPosition(scrollRoot);
    requestAnimationFrame(() => resetScrollPosition(scrollRoot));
  });
  window.setTimeout(() => resetScrollPosition(scrollRoot), 50);
}
