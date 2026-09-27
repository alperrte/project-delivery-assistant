"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 110, damping: 20 }}
    >
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="mt-1 text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </motion.div>
  );
}
