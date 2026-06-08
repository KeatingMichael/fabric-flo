/** Scroll the document to the top (single pass — no delayed retries that fight touch scrolling). */
export function scrollPageToTop(): void {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}
