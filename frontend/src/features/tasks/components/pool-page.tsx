"use client";

import type { ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { allowsPool } from "@/features/tasks/task-model";
import { errorKey } from "@/lib/api/error-message";
import { TASK_PAGE_SIZE } from "../api";
import { useTaskList } from "../hooks";
import { PoolCard } from "./pool-card";
import { ProjectGate, type ProjectGateContext } from "./project-gate";

function PoolGrid({ children }: { children: ReactNode }) {
  return <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</ul>;
}

function PoolView({ slug, projectId, project }: ProjectGateContext) {
  const t = useTranslations("tasks.pool");
  const te = useTranslations("errors");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = Number.parseInt(searchParams.get("page") ?? "", 10);
  const page = Number.isFinite(requested) && requested > 1 ? requested - 1 : 0;

  const pool = useTaskList(projectId, { pool: true, sort: "priority", direction: "desc", page, size: TASK_PAGE_SIZE });

  function goToPage(next: number) {
    router.push(next > 0 ? `${pathname}?page=${next + 1}` : pathname, { scroll: false });
    window.scrollTo({ top: 0 });
  }

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />

      {pool.isError && (
        <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{te(errorKey(pool.error))}</p>
          <Button variant="outline" size="sm" onClick={() => void pool.refetch()}>
            {t("retry")}
          </Button>
        </div>
      )}

      {pool.isPending && (
        <PoolGrid>
          {[0, 1, 2].map((key) => (
            <li key={key} aria-hidden="true">
              <Skeleton className="h-44 w-full rounded-xl" />
            </li>
          ))}
        </PoolGrid>
      )}

      {pool.data && pool.data.content.length === 0 && <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />}

      {pool.data && pool.data.content.length > 0 && (
        <>
          <p aria-live="polite" className="mb-2 text-xs tabular-nums text-muted-foreground">
            {t("count", { count: pool.data.totalElements })}
          </p>
          <PoolGrid>
            {pool.data.content.map((task) => (
              <PoolCard readOnly={!allowsPool(project.taskManagementMode)} key={task.id} task={task} href={`/projects/${slug}/tasks/${task.id}`} />
            ))}
          </PoolGrid>
          <PaginationBar
            page={Math.min(page, pool.data.totalPages - 1)}
            totalPages={pool.data.totalPages}
            totalElements={pool.data.totalElements}
            pageSize={TASK_PAGE_SIZE}
            onPageChange={goToPage}
          />
        </>
      )}
    </div>
  );
}

export function PoolPage({ slug }: { slug: string }) {
  return <ProjectGate slug={slug}>{(context) => <PoolView {...context} />}</ProjectGate>;
}
