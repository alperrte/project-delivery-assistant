"use client";

import { useTranslations } from "next-intl";
import { SquaresFour, Table as TableIcon } from "@phosphor-icons/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseTaskView, type TaskView } from "../use-task-view";

/** The card/table switch, drawn like the one on the Teams page. */
export function TaskViewToggle({ view, onChange }: { view: TaskView; onChange: (view: TaskView) => void }) {
  const t = useTranslations("tasks.view");
  return (
    <Tabs value={view} onValueChange={(next) => { const chosen = parseTaskView(next as string); if (chosen) onChange(chosen); }}>
      <TabsList aria-label={t("label")} className="group-data-horizontal/tabs:h-9">
        <TabsTrigger value="grid" className="px-2.5">
          <SquaresFour size={16} aria-hidden="true" />
          {t("grid")}
        </TabsTrigger>
        <TabsTrigger value="table" className="px-2.5">
          <TableIcon size={16} aria-hidden="true" />
          {t("table")}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
