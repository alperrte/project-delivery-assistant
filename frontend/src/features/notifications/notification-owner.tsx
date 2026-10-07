"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { sessionQueryKey } from "@/features/auth/hooks/use-session";
import { notificationsApi } from "./api";
import { invalidateTeamDeletion } from "@/features/squads/cache";
import { dismissNotificationToasts, notificationKeys, trackNotificationToast, untrackNotificationToast } from "./query-keys";

type Owner = { userId: string | undefined; open: boolean; setOpen: (open: boolean) => void; current: () => boolean };
const NotificationContext = createContext<Owner | null>(null);
export const useNotificationOwner = () => useContext(NotificationContext);

export function NotificationOwner({ userId, children }: { userId: string | undefined; children: ReactNode }) {
  const client = useQueryClient();
  const t = useTranslations("notifications");
  const live = useRef(false);
  const [open, setOpen] = useState(false);

  function current() {
    return live.current && !!userId && client.getQueryData<{ id: string }>(sessionQueryKey)?.id === userId;
  }

  useEffect(() => {
    if (!userId) return;
    live.current = true;
    let cancelled = false, busy = false, displaying = false;
    let controller: AbortController | undefined;
    const owns = () => !cancelled && client.getQueryData<{ id: string }>(sessionQueryKey)?.id === userId;

    async function tick() {
      if (!owns() || busy || displaying || document.visibilityState !== "visible" || !navigator.onLine) return;
      busy = true;
      controller = new AbortController();
      try {
        const notification = await notificationsApi.claim(controller.signal);
        if (!owns() || !notification?.teamDeletion || notification.type !== "SQUAD_DELETED") return;
        if (notification.projectId) void invalidateTeamDeletion(client, notification.projectId);
        displaying = true;
        const id = `team-deletion:${userId}:${notification.id}`;
        const dismissed = () => { displaying = false; untrackNotificationToast(userId!, id); };
        trackNotificationToast(userId!, id);
        toast.info(t("teamDeleted"), {
          id,
          description: t("teamDeletedBody", {
            project: notification.teamDeletion.projectName,
            team: notification.teamDeletion.teamName,
            actor: notification.teamDeletion.actorNickname ?? t("projectManager"),
          }),
          duration: Infinity,
          closeButton: true,
          action: { label: t("openCenter"), onClick: () => { if (owns()) setOpen(true); dismissed(); } },
          onDismiss: dismissed,
          onAutoClose: dismissed,
        });
        void client.invalidateQueries({ queryKey: notificationKeys.actor(userId) });
      } catch {
        // No automatic mutation retry: a committed grant may have lost its response; history is durable.
      } finally { busy = false; }
    }
    void tick();
    const interval = window.setInterval(() => void tick(), 30_000);
    const wake = () => { void tick(); };
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      cancelled = true; live.current = false; controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
      dismissNotificationToasts(userId);
      void client.cancelQueries({ queryKey: notificationKeys.actor(userId) });
      client.removeQueries({ queryKey: notificationKeys.actor(userId) });
    };
  }, [client, userId, t]);

  return <NotificationContext value={{ userId, open, setOpen, current }}>{children}</NotificationContext>;
}
