"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, PencilSimple, Archive, Users } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.name")}</TableHead>
                <TableHead className="text-right">{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.content.map((squad) => (
                <TableRow key={squad.id}>
                  <TableCell className="font-medium">{squad.name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
