"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ErrorFrame } from "./error-frame";

/** Mounted only by the development-only test route. The error contains no user data. */
export function CrashTest() {
  const t = useTranslations("errorPages.common");
  const [crashed, setCrashed] = useState(false);
  if (crashed) throw new Error("PDA controlled error screen test");
  return (
    <ErrorFrame>
      <section className="mx-auto max-w-xl py-12">
        <h1 className="text-3xl font-semibold">{t("testTitle")}</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{t("testDescription")}</p>
        <Button className="mt-6 min-h-11" onClick={() => setCrashed(true)}>{t("test")}</Button>
      </section>
    </ErrorFrame>
  );
}
