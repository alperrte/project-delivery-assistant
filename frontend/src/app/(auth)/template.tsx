"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

/**
 * A template remounts on every navigation, so the card enters afresh. /login
 * is the one anchor route: leaving it (to register, forgot- or
 * change-password) slides in from the right, returning to it slides in from
 * the left. The scene, logo and corner controls live in the layout and stay put.
 */
export default function AuthTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const from = pathname.startsWith("/login") ? -28 : 28;

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: from, filter: "blur(4px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      transition={{ type: "spring", duration: 0.5, bounce: 0 }}
    >
      {children}
    </motion.div>
  );
}
