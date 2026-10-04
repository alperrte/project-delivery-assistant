"use client";

import Link from "@/i18n/navigation";
import { usePathname, useRouter, useSearchParams } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { EntityGrid } from "@/components/common/entity-card";
import { PaginationBar } from "@/components/common/pagination-bar";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { PROJECT_PAGE_SIZE, projectsApi } from "../api";
import { ProjectCard } from "./project-card";

/** `?page=` is one based in the URL and zero based in the API; anything unusable falls back to the first page. */
function pageFromParam(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 1 ? parsed - 1 : 0;
}

function ProjectCardSkeleton() {
  return (
    <div className="w-full rounded-xl border bg-card p-2" aria-hidden="true">
      <Skeleton className="h-36 w-full rounded-lg" />
      <div className="space-y-4 px-2 pt-4 pb-2">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}

export function ProjectList() {
  const t = useTranslations("projects");
  const te = useTranslations("errors");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = pageFromParam(searchParams.get("page"));

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["projects", page],
    queryFn: () => projectsApi.list(page),
  });

  function goToPage(next: number) {
    router.push(next > 0 ? `${pathname}?page=${next + 1}` : pathname);
    window.scrollTo({ top: 0 });
  }

  const createLink = (
    <Link href="/projects/new" className={buttonVariants()}>
      <Plus data-icon="inline-start" size={16} aria-hidden="true" />
      {t("create")}
    </Link>
  );

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} action={createLink} />

      {isLoading && (
        <EntityGrid>
          {Array.from({ length: 6 }, (_, key) => <li key={key} className="flex"><ProjectCardSkeleton /></li>)}
        </EntityGrid>
      )}

      {isError && <p className="text-sm text-destructive">{te(errorKey(error))}</p>}

      {data && data.content.length === 0 && (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Link href="/projects/new" className={buttonVariants()}>
              <Plus data-icon="inline-start" size={16} aria-hidden="true" />
              {t("emptyAction")}
            </Link>
          }
        />
      )}

      {data && data.content.length > 0 && (
        <>
          <EntityGrid>
            {data.content.map((project) => <li key={project.id} className="flex"><ProjectCard project={project} /></li>)}
          </EntityGrid>
          <PaginationBar
            page={data.page}
            totalPages={data.totalPages}
            totalElements={data.totalElements}
            pageSize={PROJECT_PAGE_SIZE}
            onPageChange={goToPage}
          />
        </>
      )}
    </div>
  );
}
