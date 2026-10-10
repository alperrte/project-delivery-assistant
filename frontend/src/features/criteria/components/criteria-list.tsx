"use client";

import { useState } from "react";
import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, PencilSimple, Trash, CaretUp, CaretDown, MagnifyingGlass } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { criteriaApi } from "../api";

export function CriteriaList({ slug, projectId, isManager }: { slug: string; projectId: string; isManager: boolean }) {
  const t = useTranslations("criteria");
  const te = useTranslations("errors");
  const tw = useTranslations("workspace");
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "completed" | "remaining">("all");
  const [search, setSearch] = useState("");

  const { data: criteria, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["projects", projectId, "criteria"],
    queryFn: () => criteriaApi.list(projectId),
  });

  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["projects", projectId, "criteria"] }),
    queryClient.invalidateQueries({ queryKey: ["projects", projectId, "home"] }),
  ]);

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
  if (isError) return (
    <div className="flex flex-wrap items-center gap-3">
      <p role="alert" className="text-sm text-destructive">{te(errorKey(error))}</p>
      <Button variant="outline" size="sm" onClick={() => void refetch()}>{tw("retry")}</Button>
    </div>
  );
  if (!criteria) return null;

  const completed = criteria.filter((c) => c.completed).length;
  const total = criteria.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const visibleCriteria = criteria.filter((criterion) =>
    (filter === "all" || (filter === "completed" ? criterion.completed : !criterion.completed)) &&
    criterion.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          isManager && (
            <Link href={`/projects/${slug}/criteria/new`} className={buttonVariants()}>
              <Plus data-icon="inline-start" size={16} aria-hidden="true" />
              {t("create")}
            </Link>
          )
        }
      />

      {total > 0 && (
        <div className="mb-5 space-y-3 rounded-xl border bg-card p-5 shadow-sm sm:p-6">
          <Progress value={percent}>
            <div className="flex w-full items-baseline justify-between text-sm">
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
        <>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("filters.label")}>
            {(["all", "completed", "remaining"] as const).map((value) => (
              <Button key={value} type="button" variant={filter === value ? "default" : "outline"} size="sm" onClick={() => setFilter(value)} aria-pressed={filter === value}>
                {t(`filters.${value}`)} <span className="opacity-70">{value === "all" ? total : value === "completed" ? completed : total - completed}</span>
              </Button>
            ))}
          </div>
          <div className="relative w-full sm:ml-auto sm:w-56">
            <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input aria-label={t("search")} placeholder={t("search")} value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
          </div>
        </div>
        {visibleCriteria.length === 0 ? <EmptyState title={t("noResults")} /> : <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {visibleCriteria.map((criterion) => {
            const index = criteria.findIndex((item) => item.id === criterion.id);
            return (
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
                    disabled={filter !== "all" || !!search || index === 0 || reorder.isPending}
                    onClick={() => move(index, -1)}
                  >
                    <CaretUp size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("moveDown")}
                    disabled={filter !== "all" || !!search || index === criteria.length - 1 || reorder.isPending}
                    onClick={() => move(index, 1)}
                  >
                    <CaretDown size={14} />
                  </Button>
                  <Link
                    href={`/projects/${slug}/criteria/${criterion.id}/edit`}
                    aria-label={`${t("form.editTitle")}: ${criterion.title}`}
                    className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                  >
                    <PencilSimple size={14} aria-hidden="true" />
                  </Link>
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
          ); })}
        </ul>}
        </>
      )}
    </div>
  );
}
