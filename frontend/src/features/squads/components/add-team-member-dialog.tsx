"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleNotch, Plus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { membersApi } from "@/features/projects/members-api";
import { squadsApi } from "../api";

async function teamMemberIds(projectId: string, teamId: string) {
  const ids = new Set<string>();
  const first = await squadsApi.members(projectId, teamId, 0, 100);
  first.content.forEach((member) => ids.add(member.userId));
  for (let page = 1; page < first.totalPages; page++) {
    const next = await squadsApi.members(projectId, teamId, page, 100);
    next.content.forEach((member) => ids.add(member.userId));
  }
  return ids;
}

export function AddTeamMemberDialog({ projectId, teamId }: { projectId: string; teamId: string }) {
  const t = useTranslations("squads.membersPage");
  const te = useTranslations("errors");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const projectMembers = useQuery({
    queryKey: ["projects", projectId, "members", "team-candidates", page],
    queryFn: () => membersApi.list(projectId, page),
    enabled: open,
  });
  const existingMembers = useQuery({
    queryKey: ["projects", projectId, "squads", teamId, "member-ids"],
    queryFn: () => teamMemberIds(projectId, teamId),
    enabled: open,
  });
  const addMember = useMutation({
    mutationFn: (userId: string) => squadsApi.addMember(projectId, teamId, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "squads"] });
      toast.success(t("added"));
      setOpen(false);
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setPage(0); }}>
      <DialogTrigger render={<Button><Plus data-icon="inline-start" size={16} />{t("add")}</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <p className="text-sm text-muted-foreground">{t("addDescription")}</p>
        </DialogHeader>
        {(projectMembers.isLoading || existingMembers.isLoading) && <Skeleton className="h-32 w-full" />}
        {(projectMembers.isError || existingMembers.isError) && (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">{te(errorKey(projectMembers.error ?? existingMembers.error))}</p>
            <Button variant="outline" size="sm" onClick={() => { void projectMembers.refetch(); void existingMembers.refetch(); }}>{t("retry")}</Button>
          </div>
        )}
        {projectMembers.data && existingMembers.data && (
          <>
            {projectMembers.data.content.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noCandidates")}</p>
            ) : (
              <ul className="max-h-72 divide-y overflow-y-auto rounded-xl border">
                {projectMembers.data.content.map((member) => {
                  const alreadyAdded = existingMembers.data.has(member.userId);
                  return (
                    <li key={member.userId} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="min-w-0 truncate text-sm font-medium">{member.nickname ?? member.userId}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={alreadyAdded || addMember.isPending}
                        onClick={() => addMember.mutate(member.userId)}
                        aria-label={t("addPerson", { name: member.nickname ?? member.userId })}
                      >
                        {addMember.isPending && addMember.variables === member.userId && <CircleNotch size={14} className="animate-spin" />}
                        {alreadyAdded ? t("alreadyAdded") : t("add")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            <PaginationBar
              page={projectMembers.data.page}
              totalPages={projectMembers.data.totalPages}
              totalElements={projectMembers.data.totalElements}
              onPageChange={setPage}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
