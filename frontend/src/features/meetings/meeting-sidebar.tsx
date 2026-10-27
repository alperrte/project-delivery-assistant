"use client";
import { useTranslations } from "next-intl";
import { Plus, Video } from "lucide-react";
import Link from "@/components/layout/workspace-link";
import { navItemClass } from "@/components/layout/nav-item";
import { meetingNavActive } from "./meeting-nav";

/**
 * The global "Toplantılar" group of the sidebar (create, my meetings). Meetings belong to the user, so this group is shown on every page, whether
 * or not a project is selected, and between the project groups and the personal links. The same component serves the desktop sidebar,
 * the collapsed rail and the mobile drawer.
 */
export function MeetingSidebar({ pathname, collapsed, onNavigate }: { pathname: string; collapsed?: boolean; onNavigate: () => void }) {
  const t = useTranslations("meetings");
  const active = meetingNavActive(pathname);
  const items = [{ path: "/meetings/new", label: "create", icon: Plus }, { path: "/meetings", label: "myMeetings", icon: Video }] as const;
  const links = items.map(item => {
    const selected = active === item.label;
    return <Link key={item.path} href={item.path} title={collapsed ? t(item.label) : undefined} aria-label={collapsed ? t(item.label) : undefined} aria-current={selected ? "page" : undefined} onClick={onNavigate}
      className={navItemClass(selected, `flex min-h-11 items-center gap-3 rounded-md py-2 text-[13px] hover:bg-muted ${collapsed ? "justify-center" : "px-3"}`)}><item.icon size={17} aria-hidden="true" />{!collapsed && t(item.label)}</Link>;
  });
  if (collapsed) return <div className="mt-3 space-y-0.5 border-t border-border pt-3" role="group" aria-label={t("group")}>{links}</div>;
  return <div className="mt-3 border-t border-border pt-4" role="group" aria-label={t("group")}>
    <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{t("group")}</p>
    <div className="space-y-0.5">{links}</div>
  </div>;
}
