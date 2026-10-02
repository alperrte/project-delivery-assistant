import { Avatar } from "@/components/ui/avatar";
import { profilePhotoSrc } from "@/features/account/api";

const MAX_AVATARS = 5;

/** Overlapping avatars (newest first) with a "+N" tail for the people who do not fit. Decorative: pair it with a text count. */
export function AvatarStack({ people, total }: { people: { userId: string; nickname: string | null; profilePhotoVersion?: number | null }[]; total: number }) {
  const shown = people.slice(0, MAX_AVATARS);
  const extra = Math.max(total - shown.length, 0);
  return (
    <div className="flex -space-x-2" aria-hidden="true">
      {shown.map((person) => (
        <Avatar key={person.userId} name={person.nickname ?? "?"} src={profilePhotoSrc(person.userId, person.profilePhotoVersion)} className="bg-muted text-foreground" />
      ))}
      {extra > 0 && (
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-muted-foreground ring-2 ring-card">
          +{extra}
        </span>
      )}
    </div>
  );
}
