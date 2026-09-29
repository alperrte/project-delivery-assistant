"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { projectsApi } from "@/features/projects/api";

export function ProjectSearch() {
  const t = useTranslations("workspace");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = useQuery({ queryKey: ["projects", "search"], queryFn: () => projectsApi.list(0, 100), enabled: open });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setOpen(value => !value);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const results = query.data?.content.filter(project => `${project.name} ${project.description ?? ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <>
    <button onClick={() => setOpen(true)} className="flex h-8 w-8 items-center gap-2 rounded-md text-sm text-muted-foreground hover:bg-muted sm:w-72 sm:border sm:bg-background sm:px-3" aria-label={t("search")}>
      <MagnifyingGlass size={17} aria-hidden="true" /><span className="hidden flex-1 text-left text-xs sm:inline">{t("search")}</span><kbd className="hidden rounded border px-1 font-mono text-[10px] sm:inline">Ctrl K</kbd>
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>{t("search")}</DialogTitle>
        <DialogDescription>{t("searchHint")}</DialogDescription>
        <Input name="project-search" autoComplete="off" aria-label={t("search")} placeholder={t("search")} value={search} onChange={event => setSearch(event.target.value)} />
        <div className="max-h-80 space-y-1 overflow-y-auto" aria-live="polite">
          {query.isLoading && <p>{t("loading")}</p>}
          {query.isError && <Button variant="outline" onClick={() => query.refetch()}>{t("retry")}</Button>}
          {results?.length === 0 && <p className="py-4 text-muted-foreground">{t("noResults")}</p>}
          {results?.map(project => <Link key={project.id} href={`/projects/${project.slug}`} onClick={() => setOpen(false)} className="block rounded-md p-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><span className="block truncate font-medium">{project.name}</span><span className="block truncate text-xs text-muted-foreground">{project.description}</span></Link>)}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
