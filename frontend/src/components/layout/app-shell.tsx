"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { SignOut } from "@phosphor-icons/react";
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
  { href: "/projects", key: "projects" },
  { href: "/organizations", key: "organizations" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("app");
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

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
        <div className="mx-auto flex max-w-[1720px] flex-wrap items-center gap-x-7 gap-y-2 px-5 py-2 sm:h-17 sm:flex-nowrap sm:px-8 sm:py-0 xl:px-12">
          <Link href="/projects" className="flex shrink-0 items-center gap-2.5" aria-label="PDA">
            <Logo variant="emblem" size={32} />
            <span className="hidden font-heading text-lg font-semibold tracking-tight text-foreground sm:inline">PDA</span>
          </Link>

          <nav className="order-last flex w-full items-center gap-1 sm:order-none sm:w-auto">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  pathname.startsWith(link.href) && "bg-primary/10 text-primary",
                )}
              >
                {t(`nav.${link.key}`)}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
            <LocaleSwitcher />
            <ThemeSwitcher />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="sm" className="max-w-28 min-w-0 gap-1.5 sm:max-w-40">
                    <span className="truncate">{user?.nickname}</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled className="opacity-100">
                  {user?.email}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  <SignOut data-icon="inline-start" size={16} />
                  {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1720px] px-5 py-8 sm:px-8 sm:py-10 xl:px-12">{children}</main>
    </div>
  );
}
