"use client";

import { useSyncExternalStore } from "react";

/**
 * How much the interface may move, chosen on the Settings page and kept on this device only.
 * - `on`: animate unless the device asks for reduced motion;
 * - `off`: never animate, whatever the device says.
 */
export type MotionPreference = "on" | "off";

/** Old "system" choices and missing preferences use the new enabled default. */
export function normalizeMotionPreference(value: unknown): MotionPreference {
  return value === "off" ? "off" : "on";
}

export const MOTION_KEY = "pda:motion";
export const THEME_TRANSITION_KEY = "pda:theme-transition";
const CHANGE_EVENT = "pda:preferences-changed";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing or disabled storage: the choice still applies to this tab through the event below.
    memory.set(key, value);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Fallback so a choice made while storage is unavailable still works until the tab is closed.
const memory = new Map<string, string>();

function stored(key: string): string | null {
  return read(key) ?? memory.get(key) ?? null;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function motionSnapshot(): MotionPreference {
  return normalizeMotionPreference(stored(MOTION_KEY));
}

function themeTransitionSnapshot(): boolean {
  return stored(THEME_TRANSITION_KEY) !== "off";
}

export function setMotionPreference(next: MotionPreference) {
  write(MOTION_KEY, normalizeMotionPreference(next));
}

export function setThemeTransitionPreference(next: boolean) {
  write(THEME_TRANSITION_KEY, next ? "on" : "off");
}

/** The server and the first client render always see the defaults, so hydration never mismatches. */
export function useMotionPreference() {
  const preference = useSyncExternalStore(subscribe, motionSnapshot, () => "on" as const);
  return [preference, setMotionPreference] as const;
}

/** Whether the circular reveal plays when the theme changes. Independent of, and weaker than, the motion choice. */
export function useThemeTransitionPreference() {
  const enabled = useSyncExternalStore(subscribe, themeTransitionSnapshot, () => true);
  return [enabled, (next: boolean) => write(THEME_TRANSITION_KEY, next ? "on" : "off")] as const;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Whether the operating system asks this browser to reduce motion. */
export function useDeviceReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

/** The device accessibility preference and the explicit off choice both stop motion. */
export function useReducedMotionPreference(): boolean {
  const [preference] = useMotionPreference();
  const deviceReducesMotion = useDeviceReducedMotion();
  return preference === "off" || deviceReducesMotion;
}

/** Mirrors the choice onto `<html data-motion>`, which the global stylesheet reads. */
export function applyMotionPreference(preference: MotionPreference) {
  document.documentElement.dataset.motion = preference;
}
