"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/hooks/use-session";
import { useSelectedProject } from "@/features/projects/hooks/use-selected-project";
import { useCurrentMember } from "@/features/projects/hooks/use-current-member";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { meetingsApi } from "./api";
import type { Meeting } from "./types";

export const meetingKeys = (actor: string | undefined, project: string | undefined) => ["accounts", actor, "meetings", project] as const;
export function useMeetingProject(slug: string) {
  const selected = useSelectedProject(slug);
  const { data: user } = useSession();
  const member = useCurrentMember(selected.project?.id ?? "");
  return { ...selected, user, isManager: member.isManager, keys: meetingKeys(user?.id, selected.project?.id) };
}
export function useMeeting(slug: string, id: string) {
  const context = useMeetingProject(slug);
  const query = useQuery({
    queryKey: [...context.keys, id], enabled: !!context.project,
    queryFn: ({ signal }) => meetingsApi.detail(context.project!.id, id, signal),
    refetchInterval: 10_000, retry: false,
  });
  return { ...context, query };
}
export function meetingErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return "error";
  if (error.code === "MEETING_DUPLICATE_TAB") return "duplicateTab";
  if (error.code === "MEETING_INVITE_INVALID") return "invalidInvite";
  if (error.status === 403) return error.code === "MEETING_PARTICIPANT_REVOKED" ? "removed" : "forbidden";
  if (error.status === 401) return "sessionExpired";
  if (error.status === 404) return "notFound";
  if (error.status === 429) return "rateLimit";
  if (error.code === "MEETING_RECONNECT_PENDING") return "rotationPending";
  if (error.status === 503) return "unavailable";
  if (error.status === 409) return "closed";
  if (error.status === 400) return "invalid";
  return "error";
}
export function MeetingError({ error, retry }: { error: unknown; retry?: () => void }) {
  const t = useTranslations("meetings");
  return <div role="alert" className="workspace-panel space-y-3 p-5 text-sm"><p className="text-destructive">{t(meetingErrorKey(error))}</p>{retry && <Button variant="outline" onClick={retry}>{t("retry")}</Button>}</div>;
}
export function MeetingStatus({ meeting }: { meeting: Meeting }) {
  const t = useTranslations("meetings");
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${meeting.status === "OPEN" ? "bg-live/15 text-success" : "bg-muted text-muted-foreground"}`}>
    {meeting.status === "OPEN" && <span className="size-1.5 rounded-full bg-current" />}{t(`status.${meeting.status}`)}
  </span>;
}
export function localDateTime(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
