"use client";

import { useEffect, useState, type ReactNode } from "react";

// Set after the first auth page has mounted in this tab. Only ever written in an
// effect, so the server (and the hydrating first render) always see `false`.
let hasEntered = false;

/**
 * A template remounts on every navigation, so each page's content enters
 * afresh. The first page of a visit plays the staggered entrance (headline,
 * then card; see `[data-entrance="initial"]` in globals.css) together with the
 * shell's own; moving between login, register and forgot-password afterwards
 * is a soft fade, lift and unblur. Both are CSS, so they start with the server
 * HTML and need no JavaScript. The scene, logo and corner controls live in the
 * layout and stay put.
 */
export default function AuthTemplate({ children }: { children: ReactNode }) {
  const [initial] = useState(() => !hasEntered);
  useEffect(() => {
    hasEntered = true;
  }, []);

  return <div data-entrance={initial ? "initial" : "soft"}>{children}</div>;
}
