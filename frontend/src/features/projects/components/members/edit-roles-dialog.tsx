"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { errorKey } from "@/lib/api/error-message";
import { membersApi } from "@/features/projects/members-api";
import { PROJECT_ROLES, type Member, type ProjectRole } from "@/features/projects/types";

export function EditRolesDialog({
  trigger,
  projectId,
  member,
}: {
  trigger: ReactNode;
  projectId: string;
  member: Member;
}) {
  const t = useTranslations("members");
  const tr = useTranslations("roles");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<ProjectRole>>(new Set(member.roles));
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => membersApi.replaceRoles(projectId, member.userId, Array.from(selected)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "members"] });
      toast.success(t("rolesUpdated"));
      setOpen(false);
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  function toggle(role: ProjectRole) {
    setSelected((prev) => {
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
        if (next) setSelected(new Set(member.roles));
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editRolesTitle")}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {PROJECT_ROLES.map((role) => (
            <label key={role} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
              <input type="checkbox" checked={selected.has(role)} onChange={() => toggle(role)} className="size-3.5" />
              {tr(role)}
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || selected.size === 0}>
            {mutation.isPending && <CircleNotch size={16} className="animate-spin" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
