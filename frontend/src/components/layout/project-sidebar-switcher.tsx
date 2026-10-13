"use client";

import { useEffect, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { projectLogoSource, projectsApi } from "@/features/projects/api";
import { membersApi } from "@/features/projects/members-api";
import { ProjectMark } from "@/features/projects/components/project-mark";
import { switchProjectHref } from "@/features/projects/switch-project-href";
import { sessionQueryKey, useSession } from "@/features/auth/hooks/use-session";
import { useOptionalChat } from "@/features/chat/chat-provider";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { Project } from "@/features/projects/types";

const foldName = (value: string) => value.normalize("NFC").replace(/[Iİı]/g, "i").toLowerCase();

/** Uses the workspace's existing selected project; no separate selection store. */
export function ProjectSidebarSwitcher({ project, collapsed, onNavigate, select }: {
  project?: Project; collapsed?: boolean; onNavigate: () => void; select: (slug: string) => void;
}) {
  const t = useTranslations("projects.switcher"), td = useTranslations("projects.detail"), te = useTranslations("errors");
  const { data: actor } = useSession();
  const router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const chat = useOptionalChat(), client = useQueryClient();
  const [open, setOpen] = useState(false), [search, setSearch] = useState("");
  const [pending, setPending] = useState<string>(), [failure, setFailure] = useState<string>();
  const input = useRef<HTMLInputElement>(null), popup = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false), navigating = useRef(false);
  useEffect(() => () => request.current?.abort(), []);
  const list = useQuery({
    queryKey: ["projects", "sidebar-switcher", actor?.id],
    queryFn: ({ signal }) => projectsApi.allVisible(signal),
    enabled: open && !!actor?.id,
    staleTime: 0,
    gcTime: 0,
  });
  const choices = (list.isSuccess ? list.data : []).filter(item => foldName(item.name).includes(foldName(search.trim())));
  function changeOpen(value: boolean) {
    request.current?.abort(); busy.current = false;
    setOpen(value); setSearch(""); setFailure(undefined); setPending(undefined);
    if (value) navigating.current = false;
  }
  async function choose(candidate: Project) {
    if (!actor || busy.current) return;
    if (candidate.slug === project?.slug) { changeOpen(false); onNavigate(); return; }
    const abort = new AbortController(); request.current?.abort(); request.current = abort;
    const actorId = actor.id;
    busy.current = true; setPending(candidate.id); setFailure(undefined);
    try {
      // Always revalidate with the server; a row may have lost membership since the list was read.
      const next = await projectsApi.bySlug(candidate.slug, abort.signal);
      let manager = false, repository = false;
      const section = params.get("section");
      if (section === "invitations" || pathname.endsWith("/labels")) {
        const member = await membersApi.detail(next.id, actorId, abort.signal);
        manager = member.roles.includes("PROJECT_MANAGER");
      }
      if (section === "repository") repository = (await projectsApi.home(next.id, abort.signal)).repository.connected;
      if (abort.signal.aborted || client.getQueryData<{ id: string }>(sessionQueryKey)?.id !== actorId) return;
      const href = switchProjectHref(pathname, section, next, { manager, repository });
      client.setQueryData(["projects", "selected", actorId, next.slug], next);
      select(next.slug);
      if (href) { navigating.current = true; chat?.navigatePage(); router.push(href); }
      changeOpen(false); onNavigate();
    } catch (error) {
      if (!abort.signal.aborted && client.getQueryData<{ id: string }>(sessionQueryKey)?.id === actorId) {
        setFailure(te(errorKey(error)));
        void client.invalidateQueries({ queryKey: ["projects", "sidebar-switcher", actorId] });
      }
    } finally {
      if (request.current === abort) { busy.current = false; if (!abort.signal.aborted) setPending(undefined); }
    }
  }
  function navigateList(event: React.KeyboardEvent) {
    if (event.nativeEvent.isComposing || pending) return;
    const rows = [...(popup.current?.querySelectorAll<HTMLButtonElement>("[data-project-choice]:not(:disabled)") ?? [])];
    const current = rows.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | undefined;
    if (event.key === "ArrowDown") next = (current + 1) % rows.length;
    if (event.key === "ArrowUp") next = current <= 0 ? rows.length - 1 : current - 1;
    if (event.key === "Home" && current >= 0) next = 0;
    if (event.key === "End" && current >= 0) next = rows.length - 1;
    if (next !== undefined && rows.length) { event.preventDefault(); rows[next].focus(); }
    if (event.key === "Enter" && event.target === input.current && choices[0]) { event.preventDefault(); void choose(choices[0]); }
  }
  return <Popover.Root modal={false} open={open} onOpenChange={changeOpen}>
    <Popover.Trigger data-testid="project-switcher-trigger" aria-label={t("open")} title={t("open")}
      className={cn("cursor-pointer rounded-md outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50", collapsed ? "mb-1 flex min-h-11 w-full items-center justify-center" : "min-h-9 shrink-0 px-1.5 text-[11px] font-medium text-muted-foreground")}>
      {collapsed ? <span data-logo-frame aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground"><ProjectMark name={project?.name ?? "P"} shape={project?.logoShape} src={project ? projectLogoSource(project) : null} /></span> : td("changeProject")}
    </Popover.Trigger>
    <Popover.Portal><Popover.Positioner side={collapsed ? "right" : "bottom"} align="start" sideOffset={8} collisionPadding={12} className="z-50">
      <Popover.Popup ref={popup} data-testid="project-switcher-popup" initialFocus={input} finalFocus={() => !navigating.current}
        onKeyDown={navigateList} className="flex max-h-[min(32rem,var(--available-height))] w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg outline-none">
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2"><Popover.Title className="min-w-0 flex-1 text-sm font-semibold">{t("title")}</Popover.Title><Popover.Close render={<Button variant="ghost" size="icon-sm" aria-label={t("close")} />}><X size={16} aria-hidden="true" /></Popover.Close></div>
        <div className="relative m-3 shrink-0"><MagnifyingGlass size={16} aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3 text-muted-foreground" /><Input ref={input} name="sidebarProjectSearch" autoComplete="off" aria-label={t("search")} placeholder={t("placeholder")} value={search} disabled={!!pending} onChange={event => setSearch(event.target.value)} data-testid="project-switcher-search" className="h-11 pl-9" /></div>
        {failure && <p role="alert" className="shrink-0 px-4 pb-3 text-sm text-destructive">{t("switchFailed")} {failure}</p>}
        {pending && <p role="status" className="shrink-0 px-4 pb-3 text-xs text-muted-foreground">{t("switching")}</p>}
        <div data-workspace-scroll="" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2" aria-busy={list.isFetching || !!pending}>
          {list.isPending ? <div aria-label={t("loading")} className="space-y-2 p-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : list.isError ? <div role="alert" className="space-y-3 p-3 text-sm"><p>{t("loadFailed")}</p><Button variant="outline" onClick={() => void list.refetch()}>{t("retry")}</Button></div> : !choices.length ? <p role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">{search.trim() ? t("noResults") : t("empty")}</p> :
            <ul className="space-y-1">{choices.map(item => <li key={item.id}><button type="button" data-project-choice={item.id} data-testid="project-switcher-option" aria-current={project?.id === item.id ? "true" : undefined} disabled={!!pending} onClick={() => void choose(item)}
              className={cn("flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 [content-visibility:auto] [contain-intrinsic-size:auto_3rem]", project?.id === item.id && "bg-primary/10")}>
              <span data-logo-frame aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"><ProjectMark name={item.name} shape={item.logoShape} src={projectLogoSource(item)} /></span>
              <span className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">{item.name}</span>{project?.id === item.id && <Check size={18} aria-label={t("active")} className="shrink-0 text-primary" />}
            </button></li>)}</ul>}
        </div>
      </Popover.Popup>
    </Popover.Positioner></Popover.Portal>
  </Popover.Root>;
}
