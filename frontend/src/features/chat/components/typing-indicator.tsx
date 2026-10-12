"use client";

import { useTranslations } from "next-intl";
import type { TypingPerson } from "../types";
import { typingLabelParts } from "../typing";

/**
 * "Alper yazıyor…" line between the history and the composer. The row keeps its height whether or not somebody is
 * typing, so the indicator appearing and disappearing never moves the messages or the input.
 */
export function TypingIndicator({ people }: { people: TypingPerson[] }) {
  const t = useTranslations("chat");
  const { names, others } = typingLabelParts(people);
  const label =
    people.length === 0
      ? ""
      : others > 0
        ? t("typing.many", { first: names[0], second: names[1], count: others })
        : names.length === 2
          ? t("typing.two", { first: names[0], second: names[1] })
          : t("typing.one", { name: names[0] });
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="chat-typing"
      className="flex h-5 shrink-0 items-center gap-1.5 px-4 text-xs text-muted-foreground sm:px-6"
    >
      {people.length > 0 && (
        <>
          <span aria-hidden="true" className="flex items-center gap-0.5 motion-reduce:hidden">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="size-1 animate-pulse rounded-full bg-muted-foreground"
                style={{ animationDelay: `${dot * 200}ms` }}
              />
            ))}
          </span>
          <span className="min-w-0 truncate" data-testid="chat-typing-label">{label}</span>
        </>
      )}
    </div>
  );
}
