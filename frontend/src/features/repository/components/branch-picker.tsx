"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { GitBranch, LockSimple, MagnifyingGlass } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { RepositoryBranch } from "../types";

/** Searchable list of branches; the default branch is first (the API already orders it that way). */
export function BranchPicker({
  branches,
  selected,
  truncated,
  onSelect,
}: {
  branches: RepositoryBranch[];
  selected: string;
  truncated: boolean;
  onSelect: (branch: string) => void;
}) {
  const t = useTranslations("repository.branches");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? branches.filter((branch) => branch.name.toLowerCase().includes(needle)) : branches;
  }, [branches, query]);

  return (
    <div className="min-w-0 space-y-2">
      <div className="relative">
        <MagnifyingGlass size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
          autoComplete="off"
          className="pl-8"
        />
      </div>

      {visible.length === 0 ? (
        <p className="px-1 py-3 text-sm text-muted-foreground">{t("noMatch")}</p>
      ) : (
        <ul aria-label={t("listLabel")} className="max-h-72 space-y-0.5 overflow-y-auto rounded-lg border bg-card p-1 lg:max-h-[28rem]">
          {visible.map((branch) => {
            const active = branch.name === selected;
            return (
              <li key={branch.name}>
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => onSelect(branch.name)}
                  className={cn(
                    "flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted",
                  )}
                >
                  <GitBranch size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate" title={branch.name}>{branch.name}</span>
                  {branch.isProtected && (
                    <LockSimple size={12} aria-label={t("protected")} className="shrink-0 text-muted-foreground" />
                  )}
                  {branch.isDefault && <Badge variant="secondary" className="h-4 px-1.5 text-[11px]">{t("defaultBadge")}</Badge>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {truncated && <p className="px-1 text-xs text-muted-foreground">{t("truncated", { count: branches.length })}</p>}
    </div>
  );
}
