// Keep progress for this page load, including client-side navigation back to the landing page.
// A full reload starts a fresh module; nothing is persisted in browser storage.
let progress = 0;

/** Typing progress of the terminal scene (0..1) only ever moves forward, so scrolling back never erases the commands. */
export function advanceAnimationProgress(value: number) {
  progress = Math.max(progress, value);
  return progress;
}
