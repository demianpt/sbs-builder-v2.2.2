/**
 * Waiting for the preview to stop rebuilding.
 *
 * The preview is rebuilt on a debounce, and one action can queue more than one
 * rebuild — applying a flow renders, saves and re-renders. Waiting for the frame
 * to *contain* something is not enough: the document that satisfied the wait can
 * be replaced a moment later, which destroys any execution context a spec is
 * holding inside it. That shows up as "Execution context was destroyed" or
 * "Resulting promise was garbage collected", neither of which is what the spec
 * was testing.
 *
 * So: watch the frame's load events and return once none has arrived for a
 * while. Anything that measures *inside* the preview — a transition sampled
 * frame by frame, a scroll position, a computed style — should call this first.
 */
export async function previewSettled(page, { quietFor = 600, timeout = 20_000 } = {}) {
  await page.evaluate(() => {
    const frame = document.getElementById('sitePreview');
    if (!frame) return;
    if (window.__sbsPreviewLoads === undefined) {
      window.__sbsPreviewLoads = 0;
      frame.addEventListener('load', () => { window.__sbsPreviewLoads += 1; });
    }
  });
  const started = Date.now();
  let last = -1;
  while (Date.now() - started < timeout) {
    const count = await page.evaluate(() => window.__sbsPreviewLoads ?? 0);
    if (count === last) return;
    last = count;
    await page.waitForTimeout(quietFor);
  }
  throw new Error('the preview never stopped rebuilding');
}
