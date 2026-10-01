"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { projectsApi } from "@/features/projects/api";

/** Picks which project's calendar is shown. The choice is the same "selected project" the sidebar uses. */
export function ProjectSwitcher({ slug, onSelect }: { slug: string | undefined; onSelect: (slug: string) => void }) {
  const t = useTranslations("calendarPage");
  const { data } = useQuery({
    queryKey: ["projects", "calendar-switcher"],
    queryFn: () => projectsApi.list(0, 100),
  });
  const projects = data?.content ?? [];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Label htmlFor="calendar-project" className="text-sm text-muted-foreground">{t("project")}</Label>
      <Select value={slug ?? null} onValueChange={(value) => value && onSelect(value)}>
        <SelectTrigger id="calendar-project" className="w-full min-w-56 sm:w-72">
          <SelectValue>
            {(value: string | null) => (value ? (projects.find((project) => project.slug === value)?.name ?? value) : t("selectProject"))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.slug}>{project.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
