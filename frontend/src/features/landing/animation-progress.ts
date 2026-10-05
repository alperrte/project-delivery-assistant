type Scene = "product" | "source";

// Keep progress for this page load, including client-side navigation back to the landing page.
// A full reload starts a fresh module; nothing is persisted in browser storage.
const progress: Record<Scene, number> = { product: 0, source: 0 };
const released = new Set<Scene>();

export function advanceAnimationProgress(scene: Scene, value: number) {
  progress[scene] = Math.max(progress[scene], value);
  return progress[scene];
}

/** Release the long sticky scroll range on the first return after finishing a scene. */
export function releaseCompletedAnimation(scene: Scene, element: HTMLElement, release: () => void) {
  let previousScroll = window.scrollY;
  const finish = () => {
    window.removeEventListener("scroll", onScroll);
    const anchor = element.nextElementSibling;
    const aboveViewport = element.getBoundingClientRect().top < 0;
    const before = anchor?.getBoundingClientRect().top;
    released.add(scene);
    element.dataset.completed = "true";
    release();
    // Keep the content below the shrinking section at the same viewport position.
    if (aboveViewport && anchor && before !== undefined) {
      window.scrollBy({ top: anchor.getBoundingClientRect().top - before, behavior: "instant" });
    }
  };
  function onScroll() {
    const currentScroll = window.scrollY;
    const upwards = currentScroll < previousScroll;
    previousScroll = currentScroll;
    if (upwards && progress[scene] >= 1) finish();
  }
  if (released.has(scene)) finish();
  else window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}
