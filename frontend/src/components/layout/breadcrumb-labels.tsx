"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Crumb } from "@/components/common/breadcrumb";

/** Records that are named in the trail but only known to the page that loaded them. */
export type CrumbKind = "team" | "task" | "sprint" | "organization";
type Entry = { label: string; parent?: Crumb };
type Entries = Partial<Record<CrumbKind, Entry>>;
type Setter = (kind: CrumbKind, entry: Entry | undefined) => void;

// Two contexts so a page that only publishes a name does not re-render when the trail changes.
const EntriesContext = createContext<Entries>({});
const SetterContext = createContext<Setter | null>(null);

export function BreadcrumbLabelsProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entries>({});
  const set = useCallback<Setter>((kind, entry) => setEntries(current => {
    const old = current[kind];
    if (old?.label === entry?.label && old?.parent?.href === entry?.parent?.href) return current;
    return { ...current, [kind]: entry };
  }), []);
  return <SetterContext.Provider value={set}><EntriesContext.Provider value={entries}>{children}</EntriesContext.Provider></SetterContext.Provider>;
}

export function useBreadcrumbEntry(kind: CrumbKind): Entry | undefined {
  return useContext(EntriesContext)[kind];
}

/** A page names its record (a team, a task…) in the trail while it is mounted. Outside the app shell it does nothing. */
export function BreadcrumbLabel({ kind, label, parent }: { kind: CrumbKind; label: string; parent?: Crumb }) {
  const set = useContext(SetterContext);
  const parentLabel = typeof parent?.label === "string" ? parent.label : undefined;
  const parentHref = parent?.href;
  const parentTitle = parent?.title;
  useEffect(() => {
    set?.(kind, { label, parent: parentHref ? { label: parentLabel, href: parentHref, title: parentTitle } : undefined });
    return () => set?.(kind, undefined);
  }, [set, kind, label, parentLabel, parentHref, parentTitle]);
  return null;
}
