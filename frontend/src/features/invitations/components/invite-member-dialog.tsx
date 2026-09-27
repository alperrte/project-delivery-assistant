"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorKey } from "@/lib/api/error-message";
import { membersApi } from "@/features/projects/members-api";
import { PROJECT_ROLES, type ProjectRole, type UserSearchResult } from "@/features/projects/types";
import { invitationsApi } from "../api";

export function InviteMemberDialog({ trigger, projectId }: { trigger: ReactNode; projectId: string }) {
  const t = useTranslations("invitations");
  const tr = useTranslations("roles");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [roles, setRoles] = useState<Set<ProjectRole>>(new Set());
  const queryClient = useQueryClient();

  const { data: results } = useQuery({
    queryKey: ["projects", projectId, "members", "search", query],
    queryFn: () => membersApi.search(projectId, query),
    enabled: query.length >= 2 && !selectedUser,
  });

  const mutation = useMutation({
    mutationFn: () => invitationsApi.create(projectId, { userId: selectedUser!.userId, roles: Array.from(roles) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "invitations"] });
      toast.success(t("sent"));
      reset();
      setOpen(false);
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  function reset() {
    setQuery("");
    setSelectedUser(null);
    setRoles(new Set());
  }

  function toggleRole(role: ProjectRole) {
    setRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("inviteTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>{t("searchLabel")}</Label>
          {selectedUser ? (
            <div className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm">
              {selectedUser.nickname}
              <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
                {t("change")}
              </Button>
            </div>
          ) : (
            <>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPlaceholder")} />
              {results && results.length > 0 && (
                <div className="rounded-md border">
                  {results.map((result) => (
                    <button
                      key={result.userId}
                      type="button"
                      onClick={() => setSelectedUser(result)}
                      className="block w-full px-2.5 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      {result.nickname}
                    </button>
                  ))}
                </div>
              )}
              {results && results.length === 0 && query.length >= 2 && (
                <p className="text-sm text-muted-foreground">{t("noResults")}</p>
              )}
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>{t("rolesLabel")}</Label>
          <div className="grid grid-cols-2 gap-2">
            {PROJECT_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                <input type="checkbox" checked={roles.has(role)} onChange={() => toggleRole(role)} className="size-3.5" />
                {tr(role)}
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!selectedUser || roles.size === 0 || mutation.isPending}>
            {mutation.isPending && <CircleNotch size={16} className="animate-spin" />}
            {t("send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
