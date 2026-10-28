"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { RepositoryBranches } from "@/features/repository/components/repository-branches";
import { RepositoryOverview } from "@/features/repository/components/repository-overview";
import { useReducedMotionPreference } from "@/lib/preferences/motion";
import { GitBranch } from "lucide-react";
import { DemoRoot } from "./demo-root";
import styles from "../landing.module.css";

const noop = () => {};

/** Basic follows the default branch only; advanced adds the branch explorer. A commit notification slides in on top. */
export function RepositoryDemo({ mode }: { mode: "BASIC" | "ADVANCED" }) {
  const t = useTranslations("landing");
  const reduce = useReducedMotionPreference();
  return <DemoRoot>{data => <div className={styles.repoDemo}>
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={mode} initial={{ opacity: 0, y: reduce ? 0 : 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : -10 }} transition={{ duration: reduce ? 0 : .22, ease: "easeOut" }}>
        {mode === "BASIC"
          ? <RepositoryOverview projectId={data.project.id} connection={{ ...data.connection, trackingMode: "BASIC" }} />
          : <RepositoryBranches projectId={data.project.id} connection={data.connection} branchParam={data.compare.branch} commitPage={1} onSelectBranch={noop} onCommitPageChange={noop} />}
      </motion.div>
    </AnimatePresence>
    <motion.div className={styles.toast} initial={{ opacity: 0, x: reduce ? 0 : 48 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduce ? 0 : 1.1, duration: reduce ? 0 : .5, ease: [.22, 1, .36, 1] }}>
      <span aria-hidden="true" className={styles.toastIcon}><GitBranch size={16} /></span>
      <span><strong>{t("toastTitle")}</strong><br />{data.featureCommits[0].message}</span>
    </motion.div>
  </div>}</DemoRoot>;
}
