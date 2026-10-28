"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { LazyDemo } from "../demo/lazy-demo";
import { FeatureSection } from "./feature-section";
import { ModeToggle } from "./mode-toggle";
import styles from "../landing.module.css";

// Each demo is its own chunk: it loads when its box nears the viewport, never with the page.
const MeetingDemo = dynamic(() => import("../demo/meeting-demo").then(m => m.MeetingDemo), { ssr: false });
const ChatDemo = dynamic(() => import("../demo/chat-demo").then(m => m.ChatDemo), { ssr: false });
const TaskDemo = dynamic(() => import("../demo/task-demo").then(m => m.TaskDemo), { ssr: false });
const RepositoryDemo = dynamic(() => import("../demo/repository-demo").then(m => m.RepositoryDemo), { ssr: false });
const OrganizationDemo = dynamic(() => import("../demo/organization-demo").then(m => m.OrganizationDemo), { ssr: false });

export function MeetingFeature() {
  const t = useTranslations("landing");
  return <FeatureSection id="meetings" number="01" side="left" title={t("meetingTitle")} body={t("meetingBody")}
    demo={<LazyDemo description={t("meetingSr")} className={styles.meetingFrame}><MeetingDemo /></LazyDemo>} />;
}

export function ChatFeature() {
  const t = useTranslations("landing");
  return <FeatureSection id="chat" number="02" side="right" title={t("chatTitle")} body={t("chatBody")}
    demo={<LazyDemo description={t("chatSr")} className={styles.chatFrame}><ChatDemo /></LazyDemo>} />;
}

export function TaskFeature() {
  const t = useTranslations("landing");
  const [mode, setMode] = useState<"SIMPLE" | "ADVANCED">("SIMPLE");
  return <FeatureSection id="tasks" number="03" side="left" title={t("taskTitle")} body={t("taskBody")}
    demo={<LazyDemo description={t("taskSr")} className={styles.taskFrame}><TaskDemo mode={mode} /></LazyDemo>}>
    <ModeToggle label={t("taskModeLabel")} value={mode} onChange={setMode} options={[{ value: "SIMPLE", label: t("taskModeSimple") }, { value: "ADVANCED", label: t("taskModeAdvanced") }]} />
    <p className={styles.quiet}>{t("taskQuiet")}</p>
  </FeatureSection>;
}

export function RepositoryFeature() {
  const t = useTranslations("landing");
  const [mode, setMode] = useState<"BASIC" | "ADVANCED">("BASIC");
  return <FeatureSection id="repository" number="04" layout="stack" title={t("repoTitle")} body={t("repoBody")}
    demo={<LazyDemo description={t("repoSr")} className={styles.repoFrame}><RepositoryDemo mode={mode} /></LazyDemo>}>
    <ModeToggle label={t("repoModeLabel")} value={mode} onChange={setMode} options={[{ value: "BASIC", label: t("repoModeBasic") }, { value: "ADVANCED", label: t("repoModeAdvanced") }]} />
  </FeatureSection>;
}

export function OrganizationFeature() {
  const t = useTranslations("landing");
  return <FeatureSection id="organizations" number="05" side="right" title={t("orgTitle")} body={t("orgBody")}
    demo={<LazyDemo description={t("orgSr")} className={styles.orgFrame}><OrganizationDemo /></LazyDemo>} />;
}
