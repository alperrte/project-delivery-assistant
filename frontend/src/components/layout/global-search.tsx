"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { projectsApi } from "@/features/projects/api";
import { organizationsApi } from "@/features/organizations/api";

type ResultItem = { id: string; label: string; sublabel?: string; href: string };
type GroupKey = "pages" | "projects" | "organizations";
type Group = { key: GroupKey; label: string; items: ResultItem[] };

const MAX_PER_GROUP = 5;

function matches(query: string, ...fields: (string | null | undefined)[]) {
  const needle = query.toLocaleLowerCase();
  return fields.some((field) => field?.toLocaleLowerCase().includes(needle));
}

/**
 * Global search anchored in the navbar: no dialog, no separate route. Opens a
 * results panel directly below the input on focus, grouped by Pages /
 * Projects / Organizations. With an empty query it only offers the static
 * pages as quick links; typing brings in matching projects/organizations too.
 * A full ARIA combobox: arrow keys move `aria-activedescendant`, Enter
 * navigates, Escape clears/closes, an outside click closes.
 */
export function GlobalSearch({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const t = useTranslations("workspace");
  const tApp = useTranslations("app");
  const router = useRouter();
  const listboxId = useId();

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mobileOpen, setMobileOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  // The shadcn `Input` wrapper does not forward a ref, so focus is driven
  // through the DOM by scoping a query to the root instead.
  const focusInput = () => rootRef.current?.querySelector("input")?.focus();

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;

  const projectsQuery = useQuery({
    queryKey: ["projects", "global-search"],
    queryFn: () => projectsApi.list(0, 100),
    enabled: hasQuery,
  });
  const organizationsQuery = useQuery({
    queryKey: ["organizations", "global-search"],
    queryFn: () => organizationsApi.list(0, 100),
    enabled: hasQuery,
  });

  const pages = useMemo<ResultItem[]>(
    () => [
      { id: "page-home", label: tApp("nav.home"), href: "/dashboard" },
      { id: "page-projects", label: tApp("nav.projects"), href: "/projects" },
      { id: "page-organizations", label: tApp("nav.organizations"), href: "/organizations" },
      { id: "page-account", label: t("settings"), href: "/account" },
    ],
    [t, tApp],
  );

  const groups = useMemo<Group[]>(() => {
    const pageItems = (hasQuery ? pages.filter((page) => matches(trimmed, page.label)) : pages).slice(0, MAX_PER_GROUP);
    const result: Group[] = [{ key: "pages", label: t("searchGroups.pages"), items: pageItems }];

    if (hasQuery) {
      const projectItems =
        projectsQuery.data?.content
          .filter((project) => matches(trimmed, project.name, project.description))
          .slice(0, MAX_PER_GROUP)
          .map((project) => ({ id: `project-${project.id}`, label: project.name, sublabel: project.description ?? undefined, href: `/projects/${project.slug}` })) ?? [];
      result.push({ key: "projects", label: t("searchGroups.projects"), items: projectItems });

      const organizationItems =
        organizationsQuery.data?.content
          .filter((organization) => matches(trimmed, organization.name, organization.description))
          .slice(0, MAX_PER_GROUP)
          .map((organization) => ({ id: `organization-${organization.id}`, label: organization.name, sublabel: organization.description ?? undefined, href: `/organizations/${organization.id}` })) ?? [];
      result.push({ key: "organizations", label: t("searchGroups.organizations"), items: organizationItems });
    }

    return result.filter((group) => group.items.length > 0);
  }, [hasQuery, pages, trimmed, t, projectsQuery.data, organizationsQuery.data]);

  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const isLoading = hasQuery && (projectsQuery.isLoading || organizationsQuery.isLoading);
  const isError = hasQuery && (projectsQuery.isError || organizationsQuery.isError);
  const isEmpty = hasQuery && !isLoading && !isError && flatItems.length === 0;
  const open = (focused || mobileOpen) && (flatItems.length > 0 || isLoading || isError || isEmpty);

  // activeIndex is reset at every call site that changes `query` (below)
  // rather than in an effect, so it can't trigger a cascading extra render.
  function updateQuery(next: string) {
    setQuery(next);
    setActiveIndex(-1);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMobileOpen(true);
        focusInput();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setFocused(false);
        if (!query) setMobileOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [query]);

  function select(item: ResultItem) {
    router.push(item.href);
    updateQuery("");
    setFocused(false);
    setMobileOpen(false);
    onNavigate?.();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (flatItems.length ? (index + 1) % flatItems.length : -1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (flatItems.length ? (index - 1 + flatItems.length) % flatItems.length : -1));
    } else if (event.key === "Enter") {
      if (activeIndex >= 0 && flatItems[activeIndex]) {
        event.preventDefault();
        select(flatItems[activeIndex]);
      }
    } else if (event.key === "Escape") {
      if (query) updateQuery("");
      else {
        setFocused(false);
        setMobileOpen(false);
        rootRef.current?.querySelector("input")?.blur();
      }
    }
  }

  const activeItem = activeIndex >= 0 ? flatItems[activeIndex] : undefined;

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative min-w-0",
        mobileOpen ? "absolute inset-x-3 top-3 z-50 sm:static sm:inset-auto" : "max-sm:contents",
        className,
      )}
      data-popup-open={open || undefined}
    >
      <div
        className={cn(
          !mobileOpen && "max-sm:hidden",
          mobileOpen && "flex h-14 items-center rounded-xl border border-border/70 bg-background/95 px-3 backdrop-blur-xl sm:h-auto sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none",
        )}
      >
        <MagnifyingGlass size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeItem?.id}
          aria-autocomplete="list"
          aria-label={t("search")}
          autoComplete="off"
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          className="h-9 w-full max-w-sm pr-7 pl-8"
        />
        {query && (
          <button
            type="button"
            aria-label={t("clearSearch")}
            onClick={() => {
              updateQuery("");
              focusInput();
            }}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {mobileOpen ? null : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("search")}
          className="sm:hidden"
          onClick={() => {
            setMobileOpen(true);
            requestAnimationFrame(focusInput);
          }}
        >
          <MagnifyingGlass size={18} aria-hidden="true" />
        </Button>
      )}

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={t("search")}
          className="absolute top-full left-0 z-50 mt-2 max-h-96 w-full min-w-72 overflow-y-auto rounded-lg border bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
        >
          {isLoading && <p className="px-2.5 py-2 text-sm text-muted-foreground">{t("loading")}</p>}
          {isError && (
            <div className="flex items-center justify-between gap-2 px-2.5 py-2">
              <p className="text-sm text-muted-foreground">{t("loadError")}</p>
              <Button variant="outline" size="xs" onClick={() => { projectsQuery.refetch(); organizationsQuery.refetch(); }}>
                {t("retry")}
              </Button>
            </div>
          )}
          {isEmpty && <p className="px-2.5 py-2 text-sm text-muted-foreground">{t("noResults")}</p>}
          {groups.map((group) => (
            <div key={group.key} className="mb-1 last:mb-0">
              <p className="px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{group.label}</p>
              {group.items.map((item) => {
                const index = flatItems.indexOf(item);
                const active = index === activeIndex;
                return (
                  <button
                    key={item.id}
                    id={item.id}
                    role="option"
                    aria-selected={active}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => select(item)}
                    className={cn(
                      "flex w-full min-w-0 flex-col items-start rounded-md px-2.5 py-1.5 text-left text-sm",
                      active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                    )}
                  >
                    <span className="w-full truncate font-medium">{item.label}</span>
                    {item.sublabel && <span className="w-full truncate text-xs text-muted-foreground">{item.sublabel}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
