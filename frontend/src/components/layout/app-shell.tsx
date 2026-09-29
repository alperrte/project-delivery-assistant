"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Buildings, CaretDown, SignOut, SquaresFour, House, List, GearSix, CalendarBlank, CheckCircle, Bell } from "@phosphor-icons/react";
import { ProjectSearch } from "./project-search";
import { ProjectSidebarNav } from "./project-sidebar-nav";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Logo } from "@/components/common/logo";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { authApi } from "@/features/auth/api";
import { sessionQueryKey, useSession } from "@/features/auth/hooks/use-session";

const NAV_LINKS = [
  { href: "/dashboard", key: "home", icon: House },
  { href: "/projects", key: "projects", icon: SquaresFour },
  { href: "/organizations", key: "organizations", icon: Buildings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("app");
  const tw = useTranslations("workspace");
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: user, isLoading, isError } = useSession();

  useEffect(() => {
    if (isError) router.replace("/login");
  }, [isError, router]);

  async function handleLogout() {
    try {
      await authApi.logout();
    } finally {
      queryClient.removeQueries({ queryKey: sessionQueryKey });
      router.replace("/login");
    }
  }

  if (isLoading || isError) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  const navigation = <>
    <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="flex h-16 shrink-0 items-center gap-2.5 px-6" aria-label="PDA">
      <Logo variant="emblem" size={26} /><span className="text-lg font-bold tracking-tight">PDA</span>
    </Link>
    <nav aria-label={tw("navigation")} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3">
      {NAV_LINKS.map(link => {
        const Icon = link.icon;
        const active = pathname === link.href;
        return <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", active && "bg-accent font-semibold text-foreground")}><Icon size={19} weight={active ? "fill" : "regular"} aria-hidden="true" />{t(`nav.${link.key}`)}</Link>;
      })}
      <ProjectSidebarNav onNavigate={() => setMenuOpen(false)} />
      <div className="my-3 border-t" />
      {[[CheckCircle, "tasks"], [Bell, "notifications"]].map(([Icon, key]) => {
        const NavIcon = Icon as typeof CheckCircle;
        return <div key={key as string} className="flex items-center gap-3 px-3 py-2.5 text-[13px] text-muted-foreground"><NavIcon size={19} aria-hidden="true" /><span>{tw(key as "tasks" | "notifications")}</span><span className="ml-auto rounded border px-1.5 py-0.5 text-[10px]">{tw("soon")}</span></div>;
      })}
      <Link href="/dashboard#calendar" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground"><CalendarBlank size={19} aria-hidden="true" />{tw("calendar")}</Link>
    </nav>
    <div className="space-y-3 p-3">
      <Link href="/account" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground"><GearSix size={19} aria-hidden="true" />{tw("settings")}</Link>
      <Link href="/organizations" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg border bg-card p-3 hover:bg-muted"><span className="grid size-8 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">P</span><span className="min-w-0"><span className="block text-xs font-semibold">PDA</span><span className="block truncate text-[11px] text-muted-foreground">{tw("workspace")}</span></span><CaretDown className="ml-auto" size={14} aria-hidden="true" /></Link>
    </div>
  </>;

  return (
    <div className="app-shell flex min-h-[100dvh] bg-background">
      <a href="#main-content" className="sr-only z-50 rounded bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">{tw("skip")}</a>
      <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 flex-col border-r bg-surface-2 lg:flex">{navigation}</aside>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="top-0 left-0 h-[100dvh] max-h-[100dvh] w-72 max-w-[85vw] translate-x-0 translate-y-0 gap-0 rounded-none p-0 sm:max-w-72">
          <DialogTitle className="sr-only">{tw("navigation")}</DialogTitle>
          <div className="flex min-h-0 flex-col overflow-y-auto">{navigation}</div>
        </DialogContent>
      </Dialog>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label={tw("navigation")} onClick={() => setMenuOpen(true)}><List size={20} /></Button>
          <ProjectSearch />
          <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
            <LocaleSwitcher triggerClassName="max-sm:px-1" />
            <ThemeSwitcher />
            <div className="mx-1 h-5 border-l" />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="max-w-40 min-w-0 gap-2 px-1 sm:px-2"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{user?.nickname?.slice(0, 2).toUpperCase()}</span><span className="hidden truncate sm:block">{user?.nickname}</span><CaretDown size={13} aria-hidden="true" /><span className="sr-only">{tw("account")}</span></Button>} />
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled className="opacity-100">{user?.email}</DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/account" />}>{tw("settings")}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}><SignOut data-icon="inline-start" size={16} />{t("nav.logout")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className={cn("w-full min-w-0 flex-1", pathname === "/dashboard" ? "" : "mx-auto max-w-[1560px] px-4 py-6 sm:px-8 sm:py-8")}>{children}</main>
      </div>
    </div>
  );
}
