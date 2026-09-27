import { useTranslations } from "next-intl";
import { ClockCounterClockwise, LockKey, UsersThree } from "@phosphor-icons/react/dist/ssr";

const PILLARS = [
  { key: "assign", Icon: UsersThree },
  { key: "history", Icon: ClockCounterClockwise },
  { key: "roles", Icon: LockKey },
] as const;

/** Three compact product facts; deliberately not cards. */
export function ValuePillars() {
  const t = useTranslations("story.pillars");
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-3">
      {PILLARS.map(({ key, Icon }) => (
        <li key={key} className="flex items-center gap-2.5 text-sm text-foreground">
          <span className="grid size-8 place-items-center rounded-md border bg-card/70 text-primary">
            <Icon size={16} aria-hidden />
          </span>
          {t(key)}
        </li>
      ))}
    </ul>
  );
}
