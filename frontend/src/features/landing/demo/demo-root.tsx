"use client";

import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { HeadingLevelProvider } from "@/components/common/page-title";
import { demoData, type DemoData, type DemoText } from "./demo-data";
import { LandingPdaDemoProvider } from "./landing-pda-demo-provider";

const KEYS = ["projectName", "projectAbout", "teamName", "teamAbout", "taskName", "demoTask2", "demoTask3", "demoTask4", "demoTask5", "demoTask6", "demoTask7",
  "demoCommit1", "demoCommit2", "demoCommit3", "demoCommit4", "demoCommit5", "demoCommit6", "demoCommit7", "demoMeeting1", "demoMeeting3",
  "demoChat1", "demoChat2", "demoChat3", "demoFile"] as const;

/** Fake, localized data behind a read-only query client: nothing in a demo can reach the API. */
export function DemoRoot({ children }: { children: (data: DemoData) => ReactNode }) {
  const t = useTranslations("landing");
  const data = useMemo(() => demoData(Object.fromEntries(KEYS.map(key => [key, t(key)])) as DemoText), [t]);
  return <LandingPdaDemoProvider data={data}><HeadingLevelProvider level="h2">{children(data)}</HeadingLevelProvider></LandingPdaDemoProvider>;
}
