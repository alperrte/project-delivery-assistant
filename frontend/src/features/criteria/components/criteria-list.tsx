"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, PencilSimple, Trash, CaretUp, CaretDown } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { criteriaApi } from "../api";
import { CriterionFormDialog } from "./criterion-form-dialog";

export function CriteriaList({ projectId, isManager }: { projectId: string; isManager: boolean }) {
  const t = useTranslations("criteria");
  const te = useTranslations("errors");
  const queryClient = useQueryClient();

  const { data: criteria, isLoading, isError, error } = useQuery({
    queryKey: ["projects", projectId, "criteria"],
    queryFn: () => criteriaApi.list(projectId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "criteria"] });

  const toggle = useMutation({
    mutationFn: (vars: { id: string; completed: boolean }) =>
      vars.completed ? criteriaApi.uncomplete(projectId, vars.id) : criteriaApi.complete(projectId, vars.id),
    onSuccess: invalidate,
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const remove = useMutation({
    mutationFn: (id: string) => criteriaApi.remove(projectId, id),
    onSuccess: invalidate,
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) => criteriaApi.reorder(projectId, orderedIds),
    onSuccess: invalidate,
    onError: (err) => toast.error(te(errorKey(err))),
  });

  function move(index: number, direction: -1 | 1) {
    if (!criteria) return;
    const target = index + direction;
    if (target < 0 || target >= criteria.length) return;
    const ids = criteria.map((c) => c.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  }

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (isError) return <p className="text-sm text-destructive">{te(errorKey(error))}</p>;
  if (!criteria) return null;

  const completed = criteria.filter((c) => c.completed).length;
  const total = criteria.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div>
      <PageHeader
        title={t("title")}
        action={
          isManager && (
            <CriterionFormDialog
              projectId={projectId}
              trigger={
                <Button>
                  <Plus data-icon="inline-start" size={16} />
                  {t("create")}
                </Button>
              }
            />
          )
        }
      />

      {total > 0 && (
        <div className="mb-6 space-y-3 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <Progress value={percent}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-foreground">{t("progressLabel")}</span>
              <span className="tabular-nums text-muted-foreground">
                {t("progressCount", { completed, total })}
              </span>
            </div>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
        </div>
      )}

      {total === 0 && <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />}

      {total > 0 && (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
          {criteria.map((criterion, index) => (
            <li key={criterion.id} className="flex flex-wrap items-start gap-3 p-4 transition-colors hover:bg-muted/25 sm:p-5">
              <label className="flex min-w-0 flex-1 items-start gap-3 has-disabled:cursor-not-allowed">
                <Checkbox
                  checked={criterion.completed}
                  disabled={!isManager || toggle.isPending}
                  onCheckedChange={() => toggle.mutate({ id: criterion.id, completed: criterion.completed })}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className={criterion.completed ? "text-sm text-muted-foreground line-through" : "text-sm text-foreground"}>
                    {criterion.title}
                  </p>
                  {criterion.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{criterion.description}</p>
                  )}
                </div>
              </label>
              {isManager && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("moveUp")}
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(index, -1)}
                  >
                    <CaretUp size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("moveDown")}
                    disabled={index === criteria.length - 1 || reorder.isPending}
                    onClick={() => move(index, 1)}
                  >
                    <CaretDown size={14} />
                  </Button>
                  <CriterionFormDialog
                    projectId={projectId}
                    criterion={criterion}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={t("form.editTitle")}>
                        <PencilSimple size={14} />
                      </Button>
                    }
                  />
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={t("delete")}>
                        <Trash size={14} />
                      </Button>
                    }
                    title={t("deleteConfirmTitle")}
                    confirmLabel={t("delete")}
                    cancelLabel={t("cancel")}
                    destructive
                    onConfirm={() => remove.mutateAsync(criterion.id)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
