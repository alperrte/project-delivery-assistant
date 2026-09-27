"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

/**
 * A template remounts on every navigation, so the card enters afresh. The
 * direction follows the journey: heading to /register slides in from the
 * right, returning to /login from the left. Logo and story stay put.
 */
export default function AuthTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const from = pathname.startsWith("/register") ? 28 : -28;

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
