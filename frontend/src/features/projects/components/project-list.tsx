"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { EntityGrid } from "@/components/common/entity-card";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { projectsApi } from "../api";
import { ProjectCreateDialog } from "./project-create-dialog";
import { ProjectCard } from "./project-card";

export function ProjectList() {
  const t = useTranslations("projects");
  const te = useTranslations("errors");
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["projects", page],
    queryFn: () => projectsApi.list(page),
  });

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <ProjectCreateDialog
            trigger={
              <Button>
                <Plus data-icon="inline-start" size={16} />
                {t("create")}
              </Button>
            }
          />
        }
      />

      {isLoading && (
        <EntityGrid>
          {[0, 1, 2].map((key) => <li key={key}><Skeleton className="h-[26rem] w-full rounded-xl" /></li>)}
        </EntityGrid>
      )}

      {isError && <p className="text-sm text-destructive">{te(errorKey(error))}</p>}

      {data && data.content.length === 0 && (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
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
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
