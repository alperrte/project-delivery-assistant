"use client";

import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { remindersApi } from "../api";
import { shortTime } from "../dates";
import { ReminderTypeIcon } from "../type-config";
import type { Reminder } from "../types";

/**
 * Reminders of one day. With `actions` it also offers edit/delete on the reminders the caller may change; that is
 * only a convenience, the backend decides who may actually edit or delete.
 */
export function ReminderList({
  reminders,
  projectId,
  currentUserId,
  isManager,
  actions = false,
}: {
  reminders: Reminder[];
  projectId: string;
  currentUserId?: string;
  isManager: boolean;
  actions?: boolean;
}) {
  const t = useTranslations("reminders");
  const te = useTranslations("errors");
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (reminderId: string) => remindersApi.remove(projectId, reminderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects", projectId, "reminders"] });
      toast.success(t("toasts.deleted"));
    },
    onError: (error) => toast.error(te(errorKey(error))),
  });

  return (
    <ul className="space-y-1">
      {reminders.map((reminder) => {
        const time = shortTime(reminder.time);
        const canChange = actions && (reminder.scope === "PROJECT" ? isManager : reminder.creator.userId === currentUserId);
        return (
          <li key={reminder.id} className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/50">
            <span
              className={cn(
                "mt-0.5 grid size-8 shrink-0 place-items-center rounded-md",
                reminder.scope === "PROJECT" ? "bg-primary/15 text-primary" : "bg-muted text-foreground",
              )}
            >
              <ReminderTypeIcon type={reminder.type} size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{reminder.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{t(`types.${reminder.type}`)}</span>
                {time && <time>{time}</time>}
                <Badge variant={reminder.scope === "PROJECT" ? "default" : "outline"}>{t(`scope.${reminder.scope}`)}</Badge>
              </p>
              {reminder.description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{reminder.description}</p>}
              {reminder.scope === "PROJECT" && reminder.creator.nickname && (
                <p className="mt-1 text-[11px] text-muted-foreground">{t("createdBy", { name: reminder.creator.nickname })}</p>
              )}
            </div>
            {canChange && (
              <div className="flex shrink-0 gap-0.5">
                <Link
                  href={`/calendar/reminders/${reminder.id}/edit`}
                  aria-label={t("actions.editNamed", { title: reminder.title })}
                  title={t("actions.edit")}
                  className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                >
                  <PencilSimple size={15} aria-hidden="true" />
                </Link>
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      aria-label={t("actions.deleteNamed", { title: reminder.title })}
                      title={t("actions.delete")}
                      className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                    >
                      <Trash size={15} aria-hidden="true" />
                    </button>
                  }
                  title={t("actions.deleteTitle")}
                  description={t("actions.deleteDescription", { title: reminder.title })}
                  confirmLabel={t("actions.delete")}
                  cancelLabel={t("actions.cancel")}
                  destructive
                  onConfirm={() => remove.mutateAsync(reminder.id)}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
