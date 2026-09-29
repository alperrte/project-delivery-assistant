"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, PencilSimple, Archive, Users, Stack } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { squadsApi } from "../api";
import { SquadFormDialog } from "./squad-form-dialog";
import { SquadMembersDialog } from "./squad-members-dialog";

export function SquadList({ projectId, isManager }: { projectId: string; isManager: boolean }) {
  const t = useTranslations("squads");
  const te = useTranslations("errors");
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

      {isLoading && <Skeleton className="h-32 w-full" />}
      {isError && <p className="text-sm text-destructive">{te(errorKey(error))}</p>}
      {data && data.content.length === 0 && <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />}

      {data && data.content.length > 0 && (
        <>
          <ul className="grid gap-3 xl:grid-cols-2">
              {data.content.map((squad) => (
                <li key={squad.id} className="workspace-panel min-w-0 p-5">
                  <div className="flex items-start gap-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><Stack size={25} weight="duotone" aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold text-foreground">{squad.name}</h2>
                      <p className="mt-1 line-clamp-2 min-h-9 text-sm leading-5 text-muted-foreground">{squad.description || t("noDescription")}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-1.5 border-t pt-4">
                      <SquadMembersDialog
                        projectId={projectId}
                        squad={squad}
                        isManager={isManager}
                        trigger={
                          <Button variant="outline" size="sm" aria-label={t("members.title", { name: squad.name })}>
                            <Users size={16} />
                            {t("manageMembers")}
                          </Button>
                        }
                      />
                      {isManager && (
                        <>
                          <SquadFormDialog
                            projectId={projectId}
                            squad={squad}
                            trigger={
                              <Button variant="ghost" size="sm" aria-label={t("form.editTitle")}>
                                <PencilSimple size={16} />
                                {t("edit")}
                              </Button>
                            }
                          />
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="sm" aria-label={t("archive")}>
                                <Archive size={16} />
                                {t("archive")}
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
                  </div>
                </li>
              ))}
          </ul>
          <PaginationBar page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
