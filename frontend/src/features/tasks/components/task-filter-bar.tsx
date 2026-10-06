"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CaretDown, MagnifyingGlass, Rows, SortAscending, X } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useLabels } from "@/features/labels/hooks";
import { useSprints } from "@/features/sprints/hooks";
import { cn } from "@/lib/utils";
import { activeFilterCount, defaultDirection, GROUPINGS, MIN_SEARCH, SORT_FIELDS, type Grouping, type TaskFilters } from "../filters";
import { useProjectMembers } from "../hooks";
import { TASK_STATUSES, type TaskPriority, type TaskSortField, type TaskStatus } from "../types";
import { labelDotClass, PRIORITY_DESC } from "../workflow";
import { PriorityIndicator, StatusDot } from "./task-badges";

const TRIGGER = buttonVariants({ variant: "outline", size: "sm", className: "max-md:h-9" });

export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function FilterButton({ label, count, children, width = "min-w-48" }: { label: string; count?: number; children: ReactNode; width?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(TRIGGER, count ? "border-primary/40 bg-primary/5" : "")}>
        {label}
        {!!count && (
          <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
            {count}
          </span>
        )}
        <CaretDown size={11} weight="bold" aria-hidden="true" className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn("w-auto", width)}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Types freely, and only commits to the URL once typing pauses, so the list is not refetched per keystroke. */
function SearchBox({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const t = useTranslations("tasks.filters");
  const [draft, setDraft] = useState(value);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function change(next: string) {
    setDraft(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onCommit(next), 300);
  }

  const short = draft.trim().length > 0 && draft.trim().length < MIN_SEARCH;

  return (
    <div className="relative w-full sm:w-64">
      <MagnifyingGlass size={15} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={draft}
        onChange={(event) => change(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          window.clearTimeout(timer.current);
          onCommit(draft);
        }}
        maxLength={100}
        placeholder={t("searchPlaceholder")}
        aria-label={t("search")}
        aria-describedby={short ? "task-search-hint" : undefined}
        className="h-8 pl-8 max-md:h-9"
      />
      {short && (
        <p id="task-search-hint" className="absolute top-full left-0 z-10 mt-1 text-xs text-muted-foreground">
          {t("searchShort", { min: MIN_SEARCH })}
        </p>
      )}
    </div>
  );
}

type Props = {
  projectId: string;
  advanced?: boolean;
  filters: TaskFilters;
  onChange: (patch: Partial<TaskFilters>) => void;
  onReset: () => void;
  /** The board shows one sprint and fixed columns, so it hides status, sprint, sort and grouping. */
  hide?: ("status" | "sprint" | "sort" | "group")[];
};

export function TaskFilterBar({ projectId, filters, onChange, onReset, hide = [], advanced = true }: Props) {
  const t = useTranslations("tasks.filters");
  const tc = useTranslations("tasks.common");
  const tm = useTranslations("taskModels");
  const members = useProjectMembers(projectId);
  const labels = useLabels(projectId, advanced);
  const sprints = useSprints(projectId, undefined, advanced);
  const [resetKey, setResetKey] = useState(0);
  const count = activeFilterCount(filters);

  const memberName = (id: string) => members.data?.find((member) => member.userId === id)?.nickname ?? "?";
  const assigneeCount = filters.assignee ? 1 : 0;

  return (
    <div role="search" aria-label={t("label")} className="mb-4 flex flex-wrap items-center gap-2">
      <SearchBox key={resetKey} value={filters.q} onCommit={(q) => onChange({ q })} />

      <FilterButton label={tm("type")} count={filters.creationMode ? 1 : 0}>
        <DropdownMenuRadioGroup value={filters.creationMode || "any"} onValueChange={(value) => onChange({ creationMode: value === "any" ? "" : value as "SIMPLE" | "ADVANCED" })}>
          <DropdownMenuRadioItem value="any">{tm("all")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="SIMPLE">{tm("mode.SIMPLE")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="ADVANCED">{tm("mode.ADVANCED")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </FilterButton>

      {!hide.includes("status") && (
        <FilterButton label={t("status")} count={filters.status.length}>
          {TASK_STATUSES.map((status: TaskStatus) => (
            <DropdownMenuCheckboxItem
              key={status}
              checked={filters.status.includes(status)}
              onCheckedChange={() => onChange({ status: toggle(filters.status, status) })}
            >
              <StatusDot status={status} />
              {tc(`status.${status}`)}
            </DropdownMenuCheckboxItem>
          ))}
        </FilterButton>
      )}

      <FilterButton label={t("priority")} count={filters.priority.length}>
        {PRIORITY_DESC.map((priority: TaskPriority) => (
          <DropdownMenuCheckboxItem
            key={priority}
            checked={filters.priority.includes(priority)}
            onCheckedChange={() => onChange({ priority: toggle(filters.priority, priority) })}
          >
            <PriorityIndicator priority={priority} />
            {tc(`priority.${priority}`)}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterButton>

      <FilterButton label={filters.assignee && filters.assignee !== "me" && filters.assignee !== "none" ? memberName(filters.assignee) : t("assignee")} count={assigneeCount}>
        <DropdownMenuRadioGroup value={filters.assignee || "any"} onValueChange={(value) => onChange({ assignee: value === "any" ? "" : String(value) })}>
          <DropdownMenuRadioItem value="any">{t("anyone")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="me">{t("me")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="none">{tc("unassigned")}</DropdownMenuRadioItem>
          {!!members.data?.length && <DropdownMenuSeparator />}
          {members.data?.map((member) => (
            <DropdownMenuRadioItem key={member.userId} value={member.userId}>
              {member.nickname ?? "?"}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </FilterButton>

      {advanced && !!labels.data?.length && (
        <FilterButton label={t("labels")} count={filters.label.length}>
          {labels.data.map((label) => (
            <DropdownMenuCheckboxItem
              key={label.id}
              checked={filters.label.includes(label.id)}
              onCheckedChange={() => onChange({ label: toggle(filters.label, label.id) })}
            >
              <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", labelDotClass(label.color))} />
              <span className="truncate">{label.name}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </FilterButton>
      )}

      {advanced && !hide.includes("sprint") && (
        <FilterButton label={t("sprint")} count={filters.sprint ? 1 : 0}>
          <DropdownMenuRadioGroup value={filters.sprint || "any"} onValueChange={(value) => onChange({ sprint: value === "any" ? "" : String(value) })}>
            <DropdownMenuRadioItem value="any">{t("anySprint")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="backlog">{t("backlog")}</DropdownMenuRadioItem>
            {!!sprints.data?.length && <DropdownMenuSeparator />}
            {sprints.data?.map((sprint) => (
              <DropdownMenuRadioItem key={sprint.id} value={sprint.id}>
                {sprint.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </FilterButton>
      )}

      <button
        type="button"
        aria-pressed={filters.overdue}
        onClick={() => onChange({ overdue: !filters.overdue })}
        className={cn(TRIGGER, filters.overdue && "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15")}
      >
        {t("overdue")}
      </button>
      <button
        type="button"
        aria-pressed={filters.blocked}
        onClick={() => onChange({ blocked: !filters.blocked })}
        className={cn(TRIGGER, filters.blocked && "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15")}
      >
        {t("blocked")}
      </button>

      {count > 0 && (
        <button
          type="button"
          onClick={() => {
            setResetKey((key) => key + 1);
            onReset();
          }}
          className={buttonVariants({ variant: "ghost", size: "sm", className: "text-muted-foreground max-md:h-9" })}
        >
          <X size={13} aria-hidden="true" />
          {t("clear")}
        </button>
      )}

      <div className="ml-auto flex items-center gap-2">
        {!hide.includes("sort") && (
          <FilterButton label={t("sortBy", { field: t(`sort.${filters.sort}`) })} width="min-w-52">
            <DropdownMenuRadioGroup
              value={filters.sort}
              onValueChange={(value) => onChange({ sort: value as TaskSortField, dir: defaultDirection(value as TaskSortField) })}
            >
              <DropdownMenuLabel>{t("sortLabel")}</DropdownMenuLabel>
              {SORT_FIELDS.map((field) => (
                <DropdownMenuRadioItem key={field} value={field}>
                  {t(`sort.${field}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={filters.dir} onValueChange={(value) => onChange({ dir: value as "asc" | "desc" })}>
              <DropdownMenuRadioItem value="asc">
                <SortAscending size={14} aria-hidden="true" />
                {t("direction.asc")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="desc">
                <SortAscending size={14} aria-hidden="true" className="-scale-y-100" />
                {t("direction.desc")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </FilterButton>
        )}

        {!hide.includes("group") && (
          <FilterButton label={t("groupBy", { group: t(`group.${filters.group}`) })} width="min-w-44">
            <DropdownMenuRadioGroup value={filters.group} onValueChange={(value) => onChange({ group: value as Grouping })}>
              <DropdownMenuLabel>
                <Rows size={12} aria-hidden="true" className="mr-1 inline" />
                {t("groupLabel")}
              </DropdownMenuLabel>
              {GROUPINGS.filter((group) => advanced || group !== "sprint").map((group) => (
                <DropdownMenuRadioItem key={group} value={group}>
                  {t(`group.${group}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </FilterButton>
        )}
      </div>
    </div>
  );
}
