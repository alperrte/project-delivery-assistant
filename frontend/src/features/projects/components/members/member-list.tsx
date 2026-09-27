"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PencilSimple, UserMinus } from "@phosphor-icons/react";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorKey } from "@/lib/api/error-message";
import { membersApi } from "../../members-api";
import { EditRolesDialog } from "./edit-roles-dialog";

export function MemberList({ projectId, isManager }: { projectId: string; isManager: boolean }) {
  const t = useTranslations("members");
  const tr = useTranslations("roles");
  const te = useTranslations("errors");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["projects", projectId, "members", page],
    queryFn: () => membersApi.list(projectId, page),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (isError) return <p className="text-sm text-destructive">{te(errorKey(error))}</p>;
  if (!data) return null;

  if (data.content.length === 0) return <EmptyState title={t("emptyTitle")} />;

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.member")}</TableHead>
            <TableHead>{t("columns.roles")}</TableHead>
            {isManager && <TableHead className="text-right">{t("columns.actions")}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.content.map((member) => (
            <TableRow key={member.userId}>
              <TableCell className="font-medium">{member.nickname ?? member.userId}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {member.roles.map((role) => (
                    <Badge key={role} variant={role === "PROJECT_MANAGER" ? "default" : "secondary"}>
                      {tr(role)}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              {isManager && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <EditRolesDialog
                      projectId={projectId}
                      member={member}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={t("editRolesTitle")}>
                          <PencilSimple size={16} />
                        </Button>
                      }
                    />
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={t("remove")}>
                          <UserMinus size={16} />
                        </Button>
                      }
                      title={t("removeConfirmTitle")}
                      description={t("removeConfirmDescription")}
                      confirmLabel={t("remove")}
                      cancelLabel={t("cancel")}
                      destructive
                      onConfirm={async () => {
                        try {
                          await membersApi.remove(projectId, member.userId);
                          await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "members"] });
                        } catch (err) {
                          toast.error(te(errorKey(err)));
                          throw err;
                        }
                      }}
                    />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PaginationBar page={data.page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} />
    </div>
  );
}
