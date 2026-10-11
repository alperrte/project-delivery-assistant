"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { profilePhotoSrc } from "@/features/account/api";
import { PROJECT_ROLES, type ProjectRole } from "@/features/projects/types";
import { memberDisplayName } from "../initials";
import type { TeamMemberPreview as PreviewPerson } from "../types";

const PREVIEW_LIMIT = 5;

/** The server already sends roles in enum order; sorting again keeps locally built previews consistent. */
function orderedRoles(person: PreviewPerson): ProjectRole[] {
  return [...(person.roles ?? [])].sort((a, b) => PROJECT_ROLES.indexOf(a) - PROJECT_ROLES.indexOf(b));
}

/**
 * `compact` is the table variant: overlapping avatars on one line, names stay in the title and accessible label.
 * The default (card) variant shows each member as a small column: photo, display name, primary project role (+N).
 */
export function TeamMemberPreview({ people, total, compact = false }: { people: PreviewPerson[]; total: number; compact?: boolean }) {
  const t = useTranslations("squads.card");
  const shown = people.slice(0, PREVIEW_LIMIT), extra = Math.max(total - shown.length, 0);
  if (compact) {
    return <ul className="flex items-center -space-x-2" aria-label={t("members")}>
      {shown.map(person => {
        const name = memberDisplayName(person);
        return <li key={person.userId} className="flex" title={name} aria-label={name} data-member-preview={person.userId}>
          <Avatar name={name} src={profilePhotoSrc(person.userId, person.profilePhotoVersion)} className="size-8 bg-muted text-foreground" />
        </li>;
      })}
      {extra > 0 && <li className="relative grid size-8 place-items-center rounded-full bg-secondary text-xs font-medium text-muted-foreground ring-2 ring-card" aria-label={t("additionalMembers", { count: extra })}>+{extra}</li>}
    </ul>;
  }
  return <ul className="grid w-full grid-cols-[repeat(auto-fill,minmax(5.5rem,7rem))] items-start gap-x-3 gap-y-3" aria-label={t("members")}>
    {shown.map(person => <MemberColumn key={person.userId} person={person} />)}
    {extra > 0 && <li className="flex flex-col items-center" aria-label={t("additionalMembers", { count: extra })} data-member-preview-extra>
      <span className="grid size-10 place-items-center rounded-full bg-secondary text-xs font-medium text-muted-foreground">+{extra}</span>
    </li>}
  </ul>;
}

function MemberColumn({ person }: { person: PreviewPerson }) {
  const tRoles = useTranslations("roles");
  const name = memberDisplayName(person);
  const roles = orderedRoles(person);
  const labels = roles.map(role => tRoles(role));
  // Name first, then every role, so the screen reader hears who the person is and what they do on the project.
  const accessibleName = labels.length ? [name, ...labels].join(", ") : name;
  return <li className="flex min-w-0 flex-col items-center" aria-label={accessibleName} data-member-preview={person.userId}>
    <Tooltip>
      <TooltipTrigger render={<div className="relative z-10 flex w-full min-w-0 flex-col items-center gap-1 rounded-md" />}>
        <Avatar name={name} title={false} src={profilePhotoSrc(person.userId, person.profilePhotoVersion)} className="size-10 bg-muted text-sm text-foreground" />
        <span className="block w-full text-center text-xs font-medium leading-4 text-foreground [overflow-wrap:anywhere]" data-member-name aria-hidden="true">{name}</span>
        {labels.length > 0 && <span className="flex w-full min-w-0 flex-wrap items-center justify-center gap-x-1 gap-y-0.5" data-member-role aria-hidden="true">
          <span className="min-w-0 text-center text-xs leading-4 text-muted-foreground [overflow-wrap:anywhere]" data-member-primary-role>{labels[0]}</span>
          {labels.length > 1 && <span className="shrink-0 rounded-full bg-secondary px-1.5 text-[0.6875rem] font-medium leading-4 text-muted-foreground" data-member-more-roles>+{labels.length - 1}</span>}
        </span>}
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start gap-0.5 break-words">
        <span className="font-medium">{name}</span>
        {labels.map((label, index) => <span key={roles[index]}>{label}</span>)}
      </TooltipContent>
    </Tooltip>
  </li>;
}
