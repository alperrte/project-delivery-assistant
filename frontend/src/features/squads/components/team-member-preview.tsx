"use client";

import { useLocale, useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { profilePhotoSrc } from "@/features/account/api";
import { memberDisplayName, memberInitials } from "../initials";
import type { TeamMemberPreview as PreviewPerson } from "../types";

/** `compact` is the table variant: overlapping avatars on one line, names stay in the title and accessible label. */
export function TeamMemberPreview({ people, total, compact = false }: { people: PreviewPerson[]; total: number; compact?: boolean }) {
  const locale = useLocale();
  const t = useTranslations("squads.card");
  const shown = people.slice(0, 5), extra = Math.max(total - shown.length, 0);
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
  return <ul className="flex max-w-full flex-wrap items-start gap-2" aria-label={t("members")}>
    {shown.map(person => {
      const name = memberDisplayName(person);
      return <li key={person.userId} className="flex w-10 flex-col items-center gap-1" title={name} aria-label={name} data-member-preview={person.userId}>
        <Avatar name={name} src={profilePhotoSrc(person.userId, person.profilePhotoVersion)} className="size-8 bg-muted text-foreground" />
        <span className="text-xs font-medium text-muted-foreground" aria-hidden="true">{memberInitials(person, locale)}</span>
      </li>;
    })}
    {extra > 0 && <li className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-medium text-muted-foreground" aria-label={t("additionalMembers", { count: extra })}>+{extra}</li>}
  </ul>;
}
