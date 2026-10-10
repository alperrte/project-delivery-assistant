"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Check, Checks, EnvelopeSimple } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { profilePhotoSrc } from "@/features/account/api";
import { useSession } from "@/features/auth/hooks/use-session";
import { useInvitationResponseNotifications } from "@/features/notifications/hooks/use-invitation-responses";
import { useNotificationRead } from "@/features/notifications/hooks/use-notification-read";
import { useNotificationOwner } from "@/features/notifications/notification-owner";
import type { Notification } from "@/features/notifications/types";
import { useTaskFormat } from "@/features/tasks/format";
import { invitationsApi } from "../api";
import { invitationKeys } from "../query-keys";
import type { Invitation } from "../types";

const personName = (invitation?: Invitation) =>
  invitation?.firstName ? `${invitation.firstName} ${invitation.lastName ?? ""}`.trim() : (invitation?.nickname ?? undefined);

/** Names come from the manager's own invitation list: the notification only carries the responder's id. */
function useResponder(projectId: string, status: "ACCEPTED" | "REJECTED", enabled: boolean) {
  const { data: user } = useSession();
  return useQuery({
    queryKey: [...invitationKeys.project(projectId, user?.id), "responses", status],
    queryFn: ({ signal }) => invitationsApi.list(projectId, 0, 100, status, signal),
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
  });
}

/**
 * Compact list of this project's unread accepted/rejected invitation answers. Opening the page never marks anything
 * read; each row and "mark all" go through the shared notification read hook (per-id PATCH, never read-all), so the
 * sidebar badge, the bell and the lists reconcile together. Hidden while there is nothing unread.
 */
export function InvitationResponseStrip({ projectId }: { projectId: string }) {
  const t = useTranslations("invitations");
  const format = useTaskFormat();
  const owner = useNotificationOwner();
  const list = useInvitationResponseNotifications(projectId, true);
  const rows = list.isSuccess ? list.data.content : [];
  const read = useNotificationRead(owner);
  const sectionRef = useRef<HTMLElement>(null);
  const focusPlan = useRef<string | "page" | null>(null);

  const accepted = useResponder(projectId, "ACCEPTED", rows.some(n => n.type === "PROJECT_INVITATION_ACCEPTED"));
  const rejected = useResponder(projectId, "REJECTED", rows.some(n => n.type === "PROJECT_INVITATION_REJECTED"));
  const invitations = new Map<string, Invitation>();
  for (const page of [accepted.data, rejected.data]) page?.content.forEach(invitation => invitations.set(invitation.id, invitation));

  useEffect(() => {
    const plan = focusPlan.current;
    if (!plan || read.isPending || !read.isSuccess || list.isFetching || !owner?.current()) return;
    focusPlan.current = null;
    const active = document.activeElement;
    if (active !== document.body && !sectionRef.current?.contains(active)) return;
    const next = plan === "page" ? null : sectionRef.current?.querySelector<HTMLElement>(`[data-response-read-id="${CSS.escape(plan)}"]`);
    const target = next ?? sectionRef.current?.querySelector<HTMLElement>("h2") ?? document.querySelector<HTMLElement>("h1");
    if (target && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target?.focus({ preventScroll: true });
  }, [read.isPending, read.isSuccess, read.data, list.isFetching, owner]);

  if (!list.isSuccess || rows.length === 0) return null;
  const total = list.data.totalElements;

  function mark(action: Parameters<typeof read.execute>[0], origin: HTMLElement, next?: string) {
    if (!read.execute(action)) return;
    if (origin.contains(document.activeElement)) focusPlan.current = next ?? "page";
  }
  function entry(n: Notification) {
    const invitation = invitations.get(n.resourceId);
    const name = personName(invitation) ?? t("responses.unknownPerson");
    const isAccepted = n.type === "PROJECT_INVITATION_ACCEPTED";
    const details = [
      n.invitationContext?.projectName ? t("responses.project", { project: n.invitationContext.projectName }) : undefined,
      invitation?.teamName ? t("responses.team", { team: invitation.teamName }) : undefined,
    ].filter(Boolean).join(" · ");
    const index = rows.findIndex(row => row.id === n.id);
    const neighbour = rows[index + 1] ?? rows[index - 1];
    return <li key={n.id} data-invitation-response-id={n.id} data-response-type={n.type}
      className="flex flex-wrap items-center gap-3 rounded-lg border bg-background/60 px-3 py-2">
      <Avatar name={name} src={n.actorUserId ? profilePhotoSrc(n.actorUserId, invitation?.profilePhotoVersion) : null} className="size-8 bg-muted text-foreground ring-0" />
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium">{t(isAccepted ? "responses.accepted" : "responses.rejected", { name })}</p>
        <p className="break-words text-xs text-muted-foreground">
          {details && <>{details} · </>}
          <time dateTime={n.createdAt}>{format.relative(n.createdAt)}</time>
        </p>
      </div>
      <Button variant="ghost" size="sm" className="min-h-11" disabled={read.isPending} data-response-read-id={n.id}
        aria-label={t("responses.markReadNamed", { name })}
        onClick={event => mark({ kind: "read", id: n.id }, event.currentTarget, neighbour?.id)}>
        <Check size={15} aria-hidden="true" />{t("responses.markRead")}
      </Button>
    </li>;
  }

  return <section ref={sectionRef} aria-labelledby="invitation-responses-title" data-invitation-response-strip
    className="workspace-panel mb-4 space-y-3 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 id="invitation-responses-title" className="flex items-center gap-2 text-sm font-semibold outline-none">
          <EnvelopeSimple size={16} aria-hidden="true" />{t("responseCount", { count: total })}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("responses.hint")}</p>
      </div>
      <Button variant="outline" size="sm" className="min-h-11" disabled={read.isPending}
        onClick={event => mark({ kind: "many", ids: rows.map(row => row.id) }, event.currentTarget)}>
        <Checks size={15} aria-hidden="true" />{t("responses.markAllRead")}
      </Button>
    </div>
    {read.isError && <p role="alert" className="text-sm text-destructive">{t("responses.readFailed")}</p>}
    <ul className="max-h-72 space-y-2 overflow-y-auto" aria-label={t("responses.listLabel")}>{rows.map(entry)}</ul>
  </section>;
}
