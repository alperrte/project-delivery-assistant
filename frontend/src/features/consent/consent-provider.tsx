"use client";

import type { ReactNode } from "react";
import { ConsentDialog } from "./consent-dialog";
import { CookieBanner } from "./cookie-banner";

/** Mounted once for every route (public, auth and workspace): the banner and the preferences dialog. */
export function ConsentProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <CookieBanner />
      <ConsentDialog />
    </>
  );
}
