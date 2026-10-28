"use client";

import { AnimatePresence, motion } from "motion/react";
import { TaskFormBody } from "@/features/tasks/components/task-form-page";
import { emptyTaskForm } from "@/features/tasks/schemas";
import { useReducedMotionPreference } from "@/lib/preferences/motion";
import { DEMO_USER } from "./demo-data";
import { DemoRoot } from "./demo-root";
import styles from "../landing.module.css";

/** The real task form in its two creation modes; switching crossfades the whole form. */
export function TaskDemo({ mode }: { mode: "SIMPLE" | "ADVANCED" }) {
  const reduce = useReducedMotionPreference();
  return <DemoRoot>{data => <div className={styles.taskDemo}>
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={mode} initial={{ opacity: 0, y: reduce ? 0 : 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : -10 }} transition={{ duration: reduce ? 0 : .22, ease: "easeOut" }}>
        <TaskFormBody slug={data.project.slug} project={data.project} projectId={data.project.id} isManager userId={DEMO_USER.id} initialSprintId="" initialParent={null}
          presentationValues={{ ...emptyTaskForm, creationMode: mode, title: data.task.title, description: data.task.description ?? "", assigneeIds: mode === "ADVANCED" ? [DEMO_USER.id, data.members[1].userId] : [] }} />
      </motion.div>
    </AnimatePresence>
  </div>}</DemoRoot>;
}
