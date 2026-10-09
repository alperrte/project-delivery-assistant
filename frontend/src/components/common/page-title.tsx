"use client";

import { createContext, useContext, type ReactNode } from "react";

type Level = "h1" | "h2";

const HeadingLevel = createContext<Level>("h1");

/** A page shows one `h1`. A picture of a screen inside another page (the landing demo) is not a page, so its title drops to `h2`. */
export function HeadingLevelProvider({ level, children }: { level: Level; children: ReactNode }) {
  return <HeadingLevel.Provider value={level}>{children}</HeadingLevel.Provider>;
}

export function PageTitle({ className, children }: { className?: string; children: ReactNode }) {
  return useContext(HeadingLevel) === "h2"
    ? <h2 className={className}>{children}</h2>
    : <h1 className={className}>{children}</h1>;
}
