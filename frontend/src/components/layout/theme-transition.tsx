"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Moon, Sun } from "@phosphor-icons/react";

type Scheme = "light" | "dark";
type Run = { id: number; from: Scheme; to: Scheme };

// Timeline (ms): the circle starts almost at once; a small sun/moon crosses over
// in the centre and is gone by the time the circle has finished. The circle opens
// from the centre for the light theme and closes in on it for the dark theme.
const SWAP_AT = 60;
const CLEAR_AT = 600;

let current: Run | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Plays the sun/moon overlay and, part-way in, runs `swap` (which applies the
 * theme) inside a view transition: a circle growing from the centre when going
 * to the light theme, one closing in on the centre when going to the dark
 * theme. Returns false when a run is already playing, so the caller can apply
 * the theme directly.
 */
export function playThemeTransition(from: Scheme, to: Scheme, swap: () => void) {
  if (current) return false;
  current = { id: ++seq, from, to };
  emit();

  window.setTimeout(() => {
    const html = document.documentElement;
    const motion = to === "dark" ? "theme-close-in" : "theme-reveal";
    html.classList.add(motion);
    const transition = document.startViewTransition(swap);
    transition.finished.finally(() => html.classList.remove(motion));
  }, SWAP_AT);

  window.setTimeout(() => {
    current = null;
    emit();
  }, CLEAR_AT);
  return true;
}

const BODIES = {
  light: {
    Icon: Sun,
    className: "text-amber-300 drop-shadow-[0_0_14px_rgb(251_191_36/0.55)]",
    halo: "rgb(251 191 36 / 0.28)",
  },
  dark: {
    Icon: Moon,
    className: "text-sky-100 drop-shadow-[0_0_14px_rgb(47_208_245/0.6)]",
    halo: "rgb(47 208 245 / 0.26)",
  },
} as const;

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The overlay itself, mounted once in Providers: a small sun/moon in the
 * centre of the opening circle. The old body turns away and fades while the
 * new one turns in, then the whole thing fades out; nothing holds still.
 * Purely decorative; the toggles announce the change themselves.
 */
export function ThemeTransitionOverlay() {
  const run = useSyncExternalStore(subscribe, () => current, () => null);
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {run && (
        <motion.div
          key={run.id}
          aria-hidden
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.25, ease: EASE }}
          style={{ viewTransitionName: "theme-orb" }}
          className="pointer-events-none fixed left-1/2 top-1/2 z-200 -ml-16 -mt-16 grid size-32 place-items-center"
        >
          {/* Halo as a gradient, not blur: the view-transition capture would cut a blur off square. */}
          <motion.span
            className="absolute inset-0"
            initial={{ background: `radial-gradient(closest-side, ${BODIES[run.from].halo}, transparent)` }}
            animate={{ background: `radial-gradient(closest-side, ${BODIES[run.to].halo}, transparent)` }}
            transition={{ duration: 0.4, ease: EASE }}
          />
          <Body scheme={run.from} leaving />
          <Body scheme={run.to} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Body({ scheme, leaving }: { scheme: Scheme; leaving?: boolean }) {
  const { Icon, className } = BODIES[scheme];
  const turn = scheme === "light" ? 90 : -40;
  return (
    <motion.span
      className={`col-start-1 row-start-1 ${className}`}
      initial={leaving ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.6, rotate: turn }}
      animate={leaving ? { opacity: 0, scale: 0.6, rotate: -turn } : { opacity: 1, scale: 1, rotate: 0 }}
      transition={leaving ? { duration: 0.3, ease: EASE } : { delay: 0.12, duration: 0.4, ease: EASE }}
    >
      <Icon size={48} weight="fill" />
    </motion.span>
  );
}
