"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, PencilSimple, Archive, Users, Stack, CalendarBlank } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { EntityCard, EntityCardFooter, EntityCardLink, EntityCardSection, EntityGrid } from "@/components/common/entity-card";
import { PaginationBar } from "@/components/common/pagination-bar";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { squadsApi } from "../api";
import { SquadFormDialog } from "./squad-form-dialog";

export function SquadList({ projectId, projectSlug, isManager }: { projectId: string; projectSlug: string; isManager: boolean }) {
  const t = useTranslations("squads");
  const te = useTranslations("errors");
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["projects", projectId, "squads", page],
    queryFn: () => squadsApi.list(projectId, page),
  });

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          isManager && (
            <SquadFormDialog
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

      {isLoading && (
        <EntityGrid>
          {[0, 1, 2].map((key) => <li key={key}><Skeleton className="h-72 w-full rounded-xl" /></li>)}
        </EntityGrid>
      )}
      {isError && <p className="text-sm text-destructive">{te(errorKey(error))}</p>}
      {data && data.content.length === 0 && <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />}

      {data && data.content.length > 0 && (
        <>
          <EntityGrid>
            {data.content.map((squad) => (
              <li key={squad.id} className="flex">
                <EntityCard
                  mark={<Stack size={24} weight="duotone" />}
                  title={squad.name}
                  description={squad.description || t("noDescription")}
                >
                  <EntityCardSection label={t("card.members")}>
                    <p className="flex items-center gap-2 text-sm text-foreground">
                      <Users size={16} className="text-muted-foreground" aria-hidden="true" />
                      {t("membersPage.memberCount", { count: squad.memberCount })}
                    </p>
                  </EntityCardSection>
                  <EntityCardSection label={t("card.lastUpdate")}>
                    <p className="flex items-center gap-2 text-sm text-foreground">
                      <CalendarBlank size={16} className="text-muted-foreground" aria-hidden="true" />
                      <time dateTime={squad.updatedAt}>{date.format(new Date(squad.updatedAt))}</time>
                    </p>
                  </EntityCardSection>
                  <EntityCardFooter>
                    <EntityCardLink
                      href={`/projects/${projectSlug}/teams/${squad.id}/members`}
                      label={t("manageMembers")}
                      ariaLabel={t("members.title", { name: squad.name })}
                    />
                    {isManager && !squad.general && (
                      <>
                        <SquadFormDialog
                          projectId={projectId}
                          squad={squad}
                          trigger={
                            <Button variant="outline" size="icon" className="relative z-10" aria-label={t("form.editTitle")} title={t("edit")}>
                              <PencilSimple size={16} />
                            </Button>
                          }
                        />
                        <ConfirmDialog
                          trigger={
                            <Button variant="outline" size="icon" className="relative z-10" aria-label={t("archive")} title={t("archive")}>
                              <Archive size={16} />
                            </Button>
                          }
                          title={t("archiveConfirmTitle")}
                          confirmLabel={t("archive")}
                          cancelLabel={t("cancel")}
                          destructive
                          onConfirm={async () => {
                            try {
                              await squadsApi.archive(projectId, squad.id);
                              await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "squads"] });
                            } catch (err) {
                              toast.error(te(errorKey(err)));
                              throw err;
                            }
                          }}
                        />
                      </>
                    )}
                  </EntityCardFooter>
                </EntityCard>
              </li>
            ))}
          </EntityGrid>
          <PaginationBar page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
