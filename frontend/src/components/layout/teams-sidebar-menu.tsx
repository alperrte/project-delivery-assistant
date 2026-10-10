"use client";
import { useId, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CaretDown, UsersThree, EnvelopeSimple } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import Link from "./workspace-link";
import { navItemClass } from "./nav-item";
import { PendingInvitationBadge } from "@/features/invitations/components/pending-invitation-badge";
import { InvitationResponseBadge } from "@/features/invitations/components/invitation-response-badge";

/** The caller keys this disclosure by actor/project/logical route, never by ordinary table filters. */
export function TeamsSidebarMenu({ projectPath, active, isInvitationRoute, isManager, count, responseCount, collapsed, onNavigate }: {
  projectPath: string; active: boolean; isInvitationRoute: boolean; isManager: boolean; count?: number; responseCount?: number;
  collapsed?: boolean; onNavigate: () => void;
}) {
  const t = useTranslations("projects.detail");
  const ti = useTranslations("invitations");
  // Pending invitations and unread answers are two separate numbers; both are spoken, neither is derived from the other.
  const description = [
    count !== undefined && count > 0 ? ti("pendingCount", { count }) : undefined,
    responseCount !== undefined && responseCount > 0 ? ti("responseCount", { count: responseCount }) : undefined,
  ].filter(Boolean).join(", ") || undefined;
  const pendingShown = count !== undefined && count > 0;
  const [expanded, setExpanded] = useState(active);
  const [open, setOpen] = useState(false);
  const id = useId();
  const countId = useId();
  const navigating = useRef(false);
  const children = <div id={id} className="space-y-0.5">
    <Link href={`${projectPath}?section=teams`} onClick={() => { navigating.current = true; setOpen(false); onNavigate(); }}
      aria-current={active && !isInvitationRoute ? "page" : undefined}
      className={navItemClass(active && !isInvitationRoute, "flex min-h-11 items-center gap-2 rounded-md px-3 text-[13px] hover:bg-muted")}>
      <UsersThree size={17} aria-hidden="true" /><span>{t("tabs.allTeams")}</span>
    </Link>
    {isManager && <Link aria-label={t("tabs.invitations")} aria-description={description} href={`${projectPath}?section=invitations`} onClick={() => { navigating.current = true; setOpen(false); onNavigate(); }}
      aria-current={isInvitationRoute ? "page" : undefined}
      className={navItemClass(isInvitationRoute, "flex min-h-11 items-center gap-2 rounded-md px-3 text-[13px] hover:bg-muted")}>
      <EnvelopeSimple size={17} aria-hidden="true" /><span>{t("tabs.invitations")}</span><PendingInvitationBadge count={count} /><InvitationResponseBadge count={responseCount} afterPending={pendingShown} />
    </Link>}
  </div>;
  if (collapsed) return <Popover.Root modal={false} open={open} onOpenChange={value => { navigating.current = false; setOpen(value); }}>
    <Popover.Trigger className={navItemClass(active, "flex min-h-11 w-full items-center justify-center rounded-md hover:bg-muted")}
      aria-label={t("tabs.teams")} aria-describedby={description ? countId : undefined} title={t("tabs.teams")}>
      {description && <span id={countId} className="sr-only">{description}</span>}
      <span className="relative"><UsersThree size={17} aria-hidden="true" /><PendingInvitationBadge compact count={count} /><InvitationResponseBadge compact count={responseCount} /></span>
    </Popover.Trigger>
    <Popover.Portal><Popover.Positioner side="right" align="start" sideOffset={8} className="z-50">
      <Popover.Popup finalFocus={() => !navigating.current} aria-label={t("tabs.teams")} aria-description={description}
        className="w-60 max-w-[calc(100vw-1.5rem)] rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg outline-none">
        {children}
      </Popover.Popup>
    </Popover.Positioner></Popover.Portal>
  </Popover.Root>;
  return <div>
    <button type="button" aria-label={t("tabs.teams")} aria-describedby={description ? countId : undefined} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}
      className={navItemClass(active, "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-[13px] hover:bg-muted")}>
      {description && <span id={countId} className="sr-only">{description}</span>}
      <UsersThree size={17} aria-hidden="true" /><span>{t("tabs.teams")}</span>
      <PendingInvitationBadge count={count} /><InvitationResponseBadge count={responseCount} afterPending={pendingShown} /><CaretDown size={14} aria-hidden="true" className={expanded ? "ml-auto rotate-180" : "ml-auto"} />
    </button>
    {expanded && <div className="ml-5 border-l border-border pl-1">{children}</div>}
  </div>;
}
