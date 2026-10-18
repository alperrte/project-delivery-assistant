"use client";
import { useTranslations } from "next-intl";
import { Plus, Video } from "lucide-react";
import Link from "@/components/layout/workspace-link";
import { navItemClass } from "@/components/layout/nav-item";
export function MeetingSidebar({ projectPath, pathname, collapsed, onNavigate }: { projectPath: string; pathname: string; collapsed?: boolean; onNavigate: () => void }) {
  const t = useTranslations("meetings");
  const base = `${projectPath}/meetings`;
  const items = [{ path: `${base}/new`, label: "create", icon: Plus }, { path: base, label: "myMeetings", icon: Video }];
  return <div className={collapsed ? "mt-2 space-y-1 border-t pt-2" : "ml-2 mt-3 space-y-1 border-l pl-2"} role="group" aria-label={t("group")}>
    {!collapsed && <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground">{t("group")}</p>}
    {items.map(item => { const selected = item.path === base ? pathname.startsWith(base) && ![`${base}/new`, `${base}/calendar`].includes(pathname) : pathname === item.path; return <Link key={item.path} href={item.path} title={collapsed ? t(item.label) : undefined} aria-label={collapsed ? t(item.label) : undefined} aria-current={selected ? "page" : undefined} onClick={onNavigate} className={navItemClass(selected, `flex min-h-11 items-center gap-3 rounded-md py-2 text-[13px] hover:bg-muted ${collapsed ? "justify-center" : "px-3"}`)}><item.icon size={17} aria-hidden="true" />{!collapsed && t(item.label)}</Link>; })}
  </div>;
}
