"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, UserMinus } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { errorKey } from "@/lib/api/error-message";
import { membersApi } from "@/features/projects/members-api";
import { squadsApi } from "../api";
import type { Squad } from "../types";

export function SquadMembersDialog({
  trigger,
  projectId,
  squad,
  isManager,
}: {
  trigger: ReactNode;
  projectId: string;
  squad: Squad;
  isManager: boolean;
}) {
  const t = useTranslations("squads.members");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const queryClient = useQueryClient();

  const { data: members, isLoading } = useQuery({
    queryKey: ["projects", projectId, "squads", squad.id, "members"],
    queryFn: () => squadsApi.members(projectId, squad.id, 0, 100),
    enabled: open,
  });

  const { data: results } = useQuery({
    queryKey: ["projects", projectId, "members", "search", query],
    queryFn: () => membersApi.search(projectId, query),
    enabled: open && query.length >= 2,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["projects", projectId, "squads", squad.id, "members"] });

  const addMember = useMutation({
    mutationFn: (userId: string) => squadsApi.addMember(projectId, squad.id, userId),
    onSuccess: () => {
      invalidate();
      setQuery("");
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => squadsApi.removeMember(projectId, squad.id, userId),
    onSuccess: invalidate,
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const memberIds = new Set(members?.content.map((m) => m.userId));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { name: squad.name })}</DialogTitle>
        </DialogHeader>

        {isManager && !squad.general && (
          <div className="space-y-1.5">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPlaceholder")} />
            {results && results.filter((r) => !memberIds.has(r.userId)).length > 0 && (
              <div className="rounded-md border">
                {results
                  .filter((r) => !memberIds.has(r.userId))
                  .map((result) => (
                    <button
                      key={result.userId}
                      type="button"
                      onClick={() => addMember.mutate(result.userId)}
                      className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      {result.nickname}
                      <Plus size={14} />
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {isLoading && <Skeleton className="h-24 w-full" />}
        {members && members.content.length === 0 && <EmptyState title={t("emptyTitle")} />}
        {members && members.content.length > 0 && (
          <div className="space-y-1">
            {members.content.map((member) => (
              <div key={member.userId} className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm">
                {member.nickname ?? member.userId}
                {isManager && !squad.general && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("remove")}
                    onClick={() => removeMember.mutate(member.userId)}
                  >
                    <UserMinus size={14} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
