"use client";

import { useTranslations } from "next-intl";
import { useSprints } from "@/features/sprints/hooks";
import { useTaskFormat } from "../../format";
import { useProjectMembers, useProjectTeams } from "../../hooks";
import type { TaskEvent } from "../../types";

/**
 * The sentence an activity event reads as, without the actor (the row shows the name in front of it).
 * The backend stores raw values (enum names, ids, ISO dates); ids are resolved through the project's members,
 * teams and sprints, and anything that can no longer be resolved falls back to a neutral word.
 */
export function useEventText(projectId: string) {
  const t = useTranslations("tasks.detail.activity.events");
  const tc = useTranslations("tasks.common");
  const trel = useTranslations("tasks.detail.relations.types");
  const format = useTaskFormat();
  const members = useProjectMembers(projectId);
  const teams = useProjectTeams(projectId);
  const sprints = useSprints(projectId);

  const person = (id: string | null) => (members.data ?? []).find((member) => member.userId === id)?.nickname ?? t("someone");
  const team = (id: string | null) => (teams.data ?? []).find((item) => item.id === id)?.name ?? t("aTeam");
  const sprint = (id: string | null) => (id ? ((sprints.data ?? []).find((item) => item.id === id)?.name ?? t("aSprint")) : t("backlog"));
  const none = t("none");

  function fieldValue(field: string | null, value: string | null): string {
    if (value === null || value === "") return none;
    switch (field) {
      case "priority":
        return tc(`priority.${value}`);
      case "startDate":
        return format.day(value);
      case "deadlineAt":
        return format.dateTime(value);
      case "estimatePoints":
        return tc("points", { count: Number(value) });
      case "timeEstimateMinutes":
        return format.duration(Number(value));
      default:
        return value;
    }
  }

  const relationType = (field: string | null) =>
    field === "BLOCKS" || field === "RELATES" || field === "DUPLICATES" ? trel(field) : (field ?? "");

  return (event: TaskEvent): string => {
    const { field, oldValue, newValue } = event;
    switch (event.type) {
      case "CREATED":
        return t("created");
      case "STATUS_CHANGED":
        return t("statusChanged", { from: oldValue ? tc(`status.${oldValue}`) : none, to: newValue ? tc(`status.${newValue}`) : none });
      case "FIELD_CHANGED":
        if (field === "description") return t("descriptionChanged");
        return t("fieldChanged", {
          field: field ? t(`fields.${field}`) : t("fields.unknown"),
          from: fieldValue(field, oldValue),
          to: fieldValue(field, newValue),
        });
      case "BLOCKED":
        return newValue ? t("blockedReason", { reason: newValue }) : t("blocked");
      case "UNBLOCKED":
        return t("unblocked");
      case "ASSIGNED":
        return t("assigned", { name: person(newValue ?? oldValue) });
      case "UNASSIGNED":
        return t("unassigned", { name: person(oldValue ?? newValue) });
      case "POOL_OPENED":
        return newValue ? t("poolOpenedTeam", { team: team(newValue) }) : t("poolOpened");
      case "POOL_CLOSED":
        return t("poolClosed");
      case "CLAIMED":
        return t("claimed");
      case "RELEASED":
        return t("released");
      case "LABELS_CHANGED":
        return t("labelsChanged", { from: oldValue || none, to: newValue || none });
      case "SPRINT_CHANGED":
        return t("sprintChanged", { from: sprint(oldValue), to: sprint(newValue) });
      case "PARENT_CHANGED":
        return t("parentChanged");
      case "SUBTASK_ADDED":
        return t("subtaskAdded", { key: newValue ?? "" });
      case "CHECKLIST_ITEM_ADDED":
        return t("checklistAdded", { text: newValue ?? "" });
      case "CHECKLIST_ITEM_DONE":
        return t("checklistDone", { text: newValue ?? "" });
      case "CHECKLIST_ITEM_REOPENED":
        return t("checklistReopened", { text: newValue ?? "" });
      case "RELATION_ADDED":
        return t("relationAdded", { type: relationType(field), key: newValue ?? "" });
      case "RELATION_REMOVED":
        return t("relationRemoved", { type: relationType(field), key: oldValue ?? "" });
      case "ATTACHMENT_ADDED":
        return t("attachmentAdded", { name: newValue ?? "" });
      case "ATTACHMENT_REMOVED":
        return t("attachmentRemoved", { name: oldValue ?? "" });
      case "WORKLOG_ADDED":
        return t("worklogAdded", { duration: format.duration(Number(newValue) || 0) });
      case "ARCHIVED":
        return t("archived");
      default:
        return t("unknown");
    }
  };
}
