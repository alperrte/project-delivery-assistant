"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { profilePhotoSrc } from "@/features/account/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLabels } from "@/features/labels/hooks";
import { cn } from "@/lib/utils";
import { useProjectMembers, useProjectTeams, useTaskList, useTeamMembers } from "../hooks";
import { MIN_SEARCH } from "../filters";
import type { PersonRef, TaskRef } from "../types";
import { LabelChip } from "./task-badges";

const ALL_MEMBERS = "__all";

export function FormSection({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4 border-t pt-6 first:border-t-0 first:pt-0">
      <div className="space-y-1">
        <h2 id={id} className="font-heading text-base font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export type SegmentOption = { value: string; label: string; adornment?: ReactNode };

/** A radio group drawn as one row of buttons. Native radios underneath, so arrow keys and focus come for free. */
export function Segment({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((option) => (
        <label key={option.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span className="inline-flex h-8 min-w-9 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted peer-checked:border-foreground/40 peer-checked:bg-secondary peer-checked:text-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 motion-reduce:transition-none">
            {option.adornment}
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}

function PersonChip({ person, removeLabel, onRemove }: { person: PersonRef; removeLabel: string; onRemove: () => void }) {
  return (
    <li className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-card pr-1 pl-1">
      <Avatar name={person.nickname ?? "?"} src={profilePhotoSrc(person.userId, person.profilePhotoVersion)} className="size-5 bg-muted text-[9px] text-foreground" />
      <span className="max-w-32 truncate text-xs font-medium text-foreground">{person.nickname ?? "?"}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <X size={11} weight="bold" aria-hidden="true" />
      </button>
    </li>
  );
}

type AssigneePickerProps = {
  projectId: string;
  userId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  max: number;
  /** People already assigned when editing: they stay visible even if they left the project. */
  known?: PersonRef[];
};

/** Pick the team first to narrow the list, then tick people. Selection is shared across teams. */
export function AssigneePicker({ projectId, userId, value, onChange, max, known = [] }: AssigneePickerProps) {
  const t = useTranslations("tasks.form.assignees");
  const [teamId, setTeamId] = useState(ALL_MEMBERS);
  const [query, setQuery] = useState("");
  const teams = useProjectTeams(projectId);
  const everyone = useProjectMembers(projectId);
  const teamMembers = useTeamMembers(projectId, teamId === ALL_MEMBERS ? "" : teamId);

  const source = teamId === ALL_MEMBERS ? everyone : teamMembers;
  const people: PersonRef[] = (source.data ?? []).map((member) => ({ userId: member.userId, nickname: member.nickname }));
  const needle = query.trim().toLowerCase();
  const visible = needle ? people.filter((person) => (person.nickname ?? "").toLowerCase().includes(needle)) : people;

  const names = new Map<string, PersonRef>();
  for (const person of [...known, ...(everyone.data ?? []).map((member) => ({ userId: member.userId, nickname: member.nickname }))]) {
    names.set(person.userId, person);
  }
  const selected = value.map((id) => names.get(id) ?? { userId: id, nickname: null });
  const atLimit = value.length >= max;

  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...value, id] : value.filter((item) => item !== id));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={teamId} onValueChange={(next) => setTeamId(next ?? ALL_MEMBERS)}>
          <SelectTrigger className="h-8 w-auto min-w-44" aria-label={t("team")}>
            <SelectValue>{(current: string) => (current === ALL_MEMBERS ? t("allMembers") : (teams.data?.find((team) => team.id === current)?.name ?? t("allMembers")))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_MEMBERS}>{t("allMembers")}</SelectItem>
            {teams.data?.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative min-w-40 flex-1">
          <MagnifyingGlass size={14} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("search")}
            autoComplete="off"
            className="h-8 pl-8"
          />
        </div>
        {!value.includes(userId) && !atLimit && (
          <Button type="button" variant="ghost" size="lg" onClick={() => toggle(userId, true)}>
            {t("assignMe")}
          </Button>
        )}
      </div>

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("selectedList")}>
          {selected.map((person) => (
            <PersonChip
              key={person.userId}
              person={person}
              removeLabel={t("remove", { name: person.nickname ?? "?" })}
              onRemove={() => toggle(person.userId, false)}
            />
          ))}
        </ul>
      )}

      <div className="max-h-56 overflow-y-auto rounded-lg border bg-card" role="group" aria-label={t("list")}>
        {source.isPending ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">{t("loading")}</p>
        ) : visible.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">{t("none")}</p>
        ) : (
          <ul className="divide-y">
            {visible.map((person) => {
              const checked = value.includes(person.userId);
              const inputId = `${projectId}-${teamId}-${person.userId}`;
              return (
                <li key={person.userId}>
                  <label htmlFor={inputId} className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/60", !checked && atLimit && "cursor-not-allowed opacity-50")}>
                    <Checkbox
                      id={inputId}
                      checked={checked}
                      disabled={!checked && atLimit}
                      onCheckedChange={(next) => toggle(person.userId, next === true)}
                    />
                    <Avatar name={person.nickname ?? "?"} src={profilePhotoSrc(person.userId, person.profilePhotoVersion)} className="size-6 bg-muted text-[10px] text-foreground" />
                    <span className="min-w-0 flex-1 truncate text-foreground">{person.nickname ?? "?"}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {atLimit ? t("limit", { max }) : t("selected", { count: value.length, max })}
      </p>
    </div>
  );
}

export function LabelPicker({ projectId, slug, value, onChange, max }: { projectId: string; slug: string; value: string[]; onChange: (ids: string[]) => void; max: number }) {
  const t = useTranslations("tasks.form.labels");
  const labels = useLabels(projectId);
  const atLimit = value.length >= max;

  if (labels.isPending) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  if (!labels.data || labels.data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("empty")}{" "}
        <Link href={`/projects/${slug}/labels`} className="font-medium text-foreground underline underline-offset-4">
          {t("manage")}
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-1.5" aria-label={t("list")}>
        {labels.data.map((label) => {
          const active = value.includes(label.id);
          return (
            <li key={label.id}>
              <button
                type="button"
                aria-pressed={active}
                disabled={!active && atLimit}
                onClick={() => onChange(active ? value.filter((id) => id !== label.id) : [...value, label.id])}
                className={cn(
                  "rounded-md outline-none transition-opacity focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none",
                  active ? "ring-2 ring-foreground/60" : "opacity-70 hover:opacity-100",
                )}
              >
                <LabelChip label={label} className="h-6 text-xs" />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {atLimit ? t("limit", { max }) : t("selected", { count: value.length, max })}
      </p>
    </div>
  );
}

type ParentPickerProps = {
  projectId: string;
  value: TaskRef | null;
  onChange: (task: TaskRef | null) => void;
  /** The task being edited can never be its own parent. */
  excludeId?: string;
  /** Tasks that are already related; the relation picker hides them. */
  excludeIds?: string[];
  disabled?: boolean;
  /** Parents must be top-level (one level of subtasks); relations may point at any task. */
  topLevelOnly?: boolean;
  placeholder?: string;
  searchLabel?: string;
};

/** Search a task in the project and pick it. Defaults to parent picking: only top-level tasks are offered. */
export function ParentPicker({ projectId, value, onChange, excludeId, excludeIds = [], disabled, topLevelOnly = true, placeholder, searchLabel }: ParentPickerProps) {
  const t = useTranslations("tasks.form.parent");
  const [query, setQuery] = useState("");
  const [committed, setCommitted] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = useId();

  const search = committed.trim().length >= MIN_SEARCH ? committed.trim() : undefined;
  const results = useTaskList(projectId, { creationMode: "ADVANCED", topLevel: topLevelOnly, q: search, sort: "updatedAt", direction: "desc", size: 8 });
  const options = (results.data?.content ?? []).filter((task) => task.id !== excludeId && !excludeIds.includes(task.id));

  function handleChange(next: string) {
    setQuery(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCommitted(next), 300);
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{value.key}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{value.title}</span>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(null)} disabled={disabled} aria-label={t("clear")}>
          <X size={14} aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <MagnifyingGlass size={14} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          disabled={disabled}
          onChange={(event) => handleChange(event.target.value)}
          placeholder={placeholder ?? t("placeholder")}
          aria-label={searchLabel ?? t("search")}
          aria-controls={listId}
          autoComplete="off"
          className="pl-8"
        />
      </div>
      {!disabled && (
        <div id={listId} className="max-h-48 overflow-y-auto rounded-lg border bg-card">
          {results.isPending ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">{t("loading")}</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">{t("noResults")}</p>
          ) : (
            <ul className="divide-y">
              {options.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => onChange({ id: task.id, key: task.taskKey, title: task.title })}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none hover:bg-muted/60 focus-visible:bg-muted"
                  >
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">{task.taskKey}</span>
                    <span className="min-w-0 flex-1 truncate text-foreground">{task.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {query.trim().length > 0 && query.trim().length < MIN_SEARCH && <p className="text-xs text-muted-foreground">{t("minChars", { min: MIN_SEARCH })}</p>}
    </div>
  );
}
