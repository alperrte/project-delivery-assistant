"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Moon, Sun } from "@phosphor-icons/react";

type Scheme = "light" | "dark";
type Run = { id: number; from: Scheme; to: Scheme };

// Timeline (ms): the overlay appears, the old body starts to set, and the new
// theme opens as a circle from the centre while the new body rises.
const SWAP_AT = 300;
const CLEAR_AT = 1400;

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
 * theme) inside a view transition revealed as a growing circle. Returns false
 * when a run is already playing, so the caller can apply the theme directly.
 */
export function playThemeTransition(from: Scheme, to: Scheme, swap: () => void) {
  if (current) return false;
  current = { id: ++seq, from, to };
  emit();

  window.setTimeout(() => {
    const html = document.documentElement;
    html.classList.add("theme-reveal");
    const transition = document.startViewTransition(swap);
    transition.finished.finally(() => html.classList.remove("theme-reveal"));
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
    className: "text-amber-300 drop-shadow-[0_0_28px_rgb(251_191_36/0.85)]",
    halo: "rgb(251 191 36 / 0.45)",
  },
  dark: {
    Icon: Moon,
    className: "text-sky-100 drop-shadow-[0_0_28px_rgb(47_208_245/0.9)]",
    halo: "rgb(47 208 245 / 0.4)",
  },
} as const;

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The overlay itself, mounted once in Providers: the current theme's body
 * sets below a soft horizon while the next one rises in its place. Purely
 * decorative; the toggles announce the change themselves.
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.15 }}
          transition={{ duration: 0.35, ease: EASE }}
          style={{ viewTransitionName: "theme-orb" }}
          className="pointer-events-none fixed left-1/2 top-1/2 z-200 -ml-32 -mt-32 size-64"
        >
          {/* Halos as gradients, not blur: the view-transition capture would cut a blur off square. */}
          <Halo color={BODIES[run.from].halo} leaving />
          <Halo color={BODIES[run.to].halo} />
          <div className="absolute inset-0 grid place-items-center [mask-image:linear-gradient(to_bottom,#000_72%,transparent_94%)]">
            <Body scheme={run.from} leaving />
            <Body scheme={run.to} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Halo({ color, leaving }: { color: string; leaving?: boolean }) {
  return (
    <motion.span
      className="absolute inset-0"
      style={{ background: `radial-gradient(closest-side, ${color}, transparent)` }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={leaving ? { opacity: [0, 1, 0], scale: [0.6, 1, 0.8] } : { opacity: [0, 0, 1], scale: [0.6, 0.6, 1] }}
      transition={{ duration: 0.9, times: leaving ? [0, 0.3, 1] : [0, 0.35, 1], ease: EASE }}
    />
  );
}

function Body({ scheme, leaving }: { scheme: Scheme; leaving?: boolean }) {
  const { Icon, className } = BODIES[scheme];
  const turn = scheme === "light" ? 90 : -40;
  return (
    <motion.span
      className={`col-start-1 row-start-1 ${className}`}
      initial={leaving ? { opacity: 0, scale: 0.6, y: 0, rotate: 0 } : { opacity: 0, y: 90, rotate: turn }}
      animate={
        leaving
          ? { opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, 0.9], y: [0, 0, 0, 90], rotate: [0, 0, 0, -turn] }
          : { opacity: [0, 0, 1], y: [90, 90, 0], rotate: [turn, turn, 0] }
      }
      transition={
        leaving
          ? { duration: 0.85, times: [0, 0.25, 0.4, 1], ease: EASE }
          : { duration: 1, times: [0, 0.35, 1], ease: EASE }
      }
    >
      <Icon size={112} weight="fill" />
    </motion.span>
  );
}
