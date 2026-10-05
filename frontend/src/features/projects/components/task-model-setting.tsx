"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import { SettingsSection } from "@/components/common/settings-section";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/hooks/use-session";
import { errorKey } from "@/lib/api/error-message";
import { projectsApi } from "../api";
import type { Project, TaskManagementMode } from "../types";

export function TaskModelSetting({ project, initial = false }: { project: Project; initial?: boolean }) {
  const t = useTranslations("taskModels");
  const te = useTranslations("errors");
  const { data: user } = useSession();
  const owner = user?.id === project.createdBy;
  const [choice, setChoice] = useState<TaskManagementMode>(project.taskManagementMode ?? "BOTH");
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: () => projectsApi.setTaskManagementMode(project.id, choice),
    onSuccess: async (updated) => {
      queryClient.setQueryData(["projects", "by-slug", project.slug], updated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]);
      toast.success(t("saved"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  return (
    <SettingsSection title={t(initial ? "setupTitle" : "settingTitle")} description={t("settingDescription")}>
      <fieldset disabled={!owner || save.isPending || !!project.archivedAt} className="@container min-w-0 space-y-4">
        <legend className="sr-only">{t("settingTitle")}</legend>
        <div className="grid gap-3 @2xl:grid-cols-3">
          {(["SIMPLE", "ADVANCED", "BOTH"] as const).map((mode) => (
            <label key={mode} className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
              <input type="radio" name="task-management-mode" value={mode} checked={(owner ? choice : project.taskManagementMode) === mode} onChange={() => setChoice(mode)} className="mt-1 size-4 shrink-0 accent-primary" />
              <span className="min-w-0 space-y-1 break-words">
                <span className="block text-sm font-medium">{t(`policy.${mode}`)}</span>
                <span className="block text-xs leading-5 text-muted-foreground">{t(`policyDescription.${mode}`)}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{t("preserve")}</p>
        {owner && <Button type="button" onClick={() => save.mutate()} disabled={save.isPending || choice === project.taskManagementMode}>
          {save.isPending && <CircleNotch className="animate-spin" aria-hidden="true" />}
          {t(initial ? "start" : "save")}
        </Button>}
      </fieldset>
      <p role="status" className="mt-3 text-sm text-muted-foreground">{t(owner ? "changeLater" : initial ? "waitOwner" : "ownerOnly")}</p>
    </SettingsSection>
  );
}
