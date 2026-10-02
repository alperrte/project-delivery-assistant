"use client";

import { useSyncExternalStore } from "react";

/**
 * How much the interface may move, chosen on the Settings page and kept on this device only.
 * - `system`: follow the device's "reduce motion" setting (the default);
 * - `on`: always animate, even when the device asks for less;
 * - `off`: never animate, whatever the device says.
 */
export type MotionPreference = "system" | "on" | "off";

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
  const value = stored(MOTION_KEY);
  return value === "on" || value === "off" ? value : "system";
}

function themeTransitionSnapshot(): boolean {
  return stored(THEME_TRANSITION_KEY) !== "off";
}

export function setMotionPreference(next: MotionPreference) {
  write(MOTION_KEY, next);
}

export function setThemeTransitionPreference(next: boolean) {
  write(THEME_TRANSITION_KEY, next ? "on" : "off");
}

/** The server and the first client render always see the defaults, so hydration never mismatches. */
export function useMotionPreference() {
  const preference = useSyncExternalStore(subscribe, motionSnapshot, () => "system" as const);
  return [preference, (next: MotionPreference) => write(MOTION_KEY, next)] as const;
}

/** Whether the circular reveal plays when the theme changes. Independent of, and weaker than, the motion choice. */
export function useThemeTransitionPreference() {
  const enabled = useSyncExternalStore(subscribe, themeTransitionSnapshot, () => true);
  return [enabled, (next: boolean) => write(THEME_TRANSITION_KEY, next ? "on" : "off")] as const;
}

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToDevice(onChange: () => void) {
  const query = matchMedia(REDUCE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** The device's "reduce motion" setting, kept live (motion's own hook only reads it once and never re-renders). */
export function useDeviceReducesMotion(): boolean {
  return useSyncExternalStore(subscribeToDevice, () => matchMedia(REDUCE_QUERY).matches, () => false);
}

/**
 * True when animation should be skipped: an explicit "off" always wins, an explicit "on" always animates, and
 * "system" follows the device's `prefers-reduced-motion`.
 */
export function useReducedMotionPreference(): boolean {
  const [preference] = useMotionPreference();
  const osReduces = useDeviceReducesMotion();
  if (preference === "off") return true;
  if (preference === "on") return false;
  return osReduces;
}

/** Mirrors the choice onto `<html data-motion>`, which the global stylesheet reads. */
export function applyMotionPreference(preference: MotionPreference) {
  document.documentElement.dataset.motion = preference;
}
