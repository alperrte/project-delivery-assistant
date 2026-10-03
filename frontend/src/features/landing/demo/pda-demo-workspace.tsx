"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { AppShellView } from "@/components/layout/app-shell";
import { ChatProvider } from "@/features/chat/chat-provider";
import { ProjectCreatePage } from "@/features/projects/components/project-create-page";
import { ProjectDetail } from "@/features/projects/components/project-detail";
import { TeamDetailPage } from "@/features/squads/components/team-detail-page";
import { TaskFormBody } from "@/features/tasks/components/task-form-page";
import { TasksPage } from "@/features/tasks/components/tasks-page";
import { emptyTaskForm } from "@/features/tasks/schemas";
import { TASK_STATUSES } from "@/features/tasks/types";
import { demoData, DEMO_USER, demoPage, type DemoData } from "./demo-data";
import { LandingPdaDemoProvider } from "./landing-pda-demo-provider";

export type DemoStage = "project" | "team" | "task" | "delivery";
export const DELIVERY_STATUSES = TASK_STATUSES.filter(status => status !== "BACKLOG");
const STATIC_PROGRESS = { project: 0.16, team: 0.4, task: 0.61, delivery: 0.96 };
const noop = () => {};
const fraction = (value: number, start: number, duration: number) => Math.max(0, Math.min(1, (value - start) / duration));
const typed = (value: string, amount: number) => value.slice(0, Math.floor(value.length * amount));

function DemoWorkspace({ data, stage, progress }: { data: DemoData; stage: DemoStage; progress: number }) {
  const client = useQueryClient();
  const root = useRef<HTMLDivElement>(null);
  const created = stage === "project" && progress >= 0.18;
  const assigned = stage === "task" && progress >= 0.62;
  const status = stage === "delivery" ? DELIVERY_STATUSES[Math.min(4, Math.max(0, Math.floor((progress - 0.69) / 0.055)))] : "TODO";
  const pathname = stage === "project" ? created ? `/projects/${data.project.slug}` : "/projects/new" : stage === "team" ? `/projects/${data.project.slug}/teams/${data.team.id}` : `/projects/${data.project.slug}/tasks${stage === "task" && !assigned ? "/new" : ""}`;

  useEffect(() => {
    const task = { ...data.task, status };
    client.setQueriesData({ queryKey: ["projects", data.project.id, "tasks", "list"] }, demoPage([task]));
    client.setQueriesData({ queryKey: ["projects", data.project.id, "tasks", "all"] }, [task]);
  }, [client, data, status, assigned]);

  const projectCamera = stage === "project" && !created && progress >= 0.08;
  const taskCamera = stage === "task" && !assigned && progress >= 0.55;
  useEffect(() => {
    const viewport = root.current;
    const main = viewport?.querySelector<HTMLElement>("main");
    if (!viewport || !main) return;
    const position = () => {
      main.scrollTop = 0;
      const target = projectCamera ? viewport.querySelector("#project-tagline") : taskCamera ? viewport.querySelector('[id$="-assignment"]') : null;
      const scale = viewport.getBoundingClientRect().width / viewport.offsetWidth;
      if (target && scale) {
        const offset = Math.max(0, (target.getBoundingClientRect().top - viewport.getBoundingClientRect().top) / scale - 84);
        main.scrollTop = offset;
      }
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [projectCamera, taskCamera]);
  useEffect(() => {
    if (stage !== "team") return;
    root.current?.querySelectorAll<HTMLElement>("tbody tr").forEach((row, index) => {
      const amount = fraction(progress, 0.26 + index * 0.03, 0.04);
      row.style.opacity = String(amount);
      row.style.transform = "translateY(" + (1 - amount) * 12 + "px)";
    });
  }, [stage, progress]);
  useEffect(() => {
    const submit = root.current?.querySelector<HTMLElement>('button[type="submit"]');
    if (!submit) return;
    const start = stage === "project" ? 0.16 : 0.6;
    const press = fraction(progress, start, 0.02);
    submit.style.transform = "scale(" + (1 - Math.sin(press * Math.PI) * 0.02) + ")";
  }, [stage, progress]);

  return <div ref={root} inert data-pda-demo-stage={stage} data-demo-status={status}>
    <ChatProvider>
      <AppShellView contained pathname={pathname} user={DEMO_USER} onLogout={noop} onToggleCollapsed={noop}>
        {stage === "project" && (created ? <ProjectDetail slug={data.project.slug} /> : <ProjectCreatePage presentationValues={{ name: typed(data.project.name, fraction(progress, 0.02, 0.055)), tagline: typed(data.project.tagline ?? "", fraction(progress, 0.08, 0.065)), description: data.project.description ?? "", projectType: "WEB", techStack: ["nextjs", "spring", "postgresql"] }} />)}
        {stage === "team" && <TeamDetailPage slug={data.project.slug} teamId={data.team.id} />}
        {stage === "task" && (assigned ? <TasksPage slug={data.project.slug} /> : <TaskFormBody slug={data.project.slug} project={data.project} projectId={data.project.id} isManager userId={DEMO_USER.id} initialSprintId="" initialParent={null} presentationValues={{ ...emptyTaskForm, title: typed(data.task.title, fraction(progress, 0.47, 0.06)), description: data.task.description ?? "", assigneeIds: progress >= 0.55 ? [DEMO_USER.id] : [] }} />)}
        {stage === "delivery" && <TasksPage slug={data.project.slug} />}
      </AppShellView>
    </ChatProvider>
  </div>;
}

export function PdaDemoWorkspace({ stage, progress }: { stage: DemoStage; progress: number | null }) {
  const t = useTranslations("landing");
  const data = useMemo(() => demoData({ projectName: t("projectName"), projectAbout: t("projectAbout"), teamName: t("teamName"), teamAbout: t("teamAbout"), taskName: t("taskName") }), [t]);
  return <LandingPdaDemoProvider key={data.project.name + data.team.name + data.task.title} data={data}><DemoWorkspace data={data} stage={stage} progress={progress ?? STATIC_PROGRESS[stage]} /></LandingPdaDemoProvider>;
}
