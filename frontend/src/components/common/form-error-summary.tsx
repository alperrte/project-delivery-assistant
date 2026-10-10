"use client";

import { WarningCircle } from "@phosphor-icons/react";

export type FormErrorSection = {
  id: string;
  label: string;
  /** Scroll the first invalid field of the section into view and focus it. */
  focus: () => void;
};

const FOCUSABLE = 'input:not([type="hidden"]), textarea, select, button, [role="radio"], [tabindex]:not([tabindex="-1"])';

function scrollBehavior(): ScrollBehavior {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/**
 * Scrolls to and focuses the first invalid control inside the `<section>` that owns the heading `headingId`.
 * An invalid control is the first `[aria-invalid="true"]` element; when that is a group (e.g. a radio group), its
 * first focusable child. Falls back to the section's first focusable element.
 */
export function focusFormSection(headingId: string) {
  const section = document.getElementById(headingId)?.closest("section");
  if (!section) return;
  const invalid = section.querySelector<HTMLElement>('[aria-invalid="true"]');
  const target = invalid?.querySelector<HTMLElement>(FOCUSABLE) ?? invalid ?? section.querySelector<HTMLElement>(FOCUSABLE);
  if (!target) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "center", behavior: scrollBehavior() });
}

/**
 * Accessible validation summary for full-page forms. Lists the sections that still contain errors; each entry moves focus
 * to that section's first invalid field. The panel never takes focus itself: after a failed submit the form moves focus to
 * the first invalid field (team standard), and the panel is announced through `role="alert"`. Callers remount it per
 * failed submit (`key={submitCount}`) so screen readers announce it again on every attempt. Render it near the submit
 * area and point the submit button's `aria-describedby` at `id` while it is visible.
 */
export function FormErrorSummary({
  id,
  title,
  description,
  sectionsLabel,
  sections,
}: {
  id: string;
  title: string;
  description?: string;
  sectionsLabel: string;
  sections: FormErrorSection[];
}) {
  if (sections.length === 0) return null;

  return (
    <div
      id={id}
      role="alert"
      aria-labelledby={`${id}-title`}
      className="mt-8 scroll-mb-24 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
    >
      <div className="flex items-start gap-3">
        <WarningCircle size={20} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p id={`${id}-title`} className="font-medium text-foreground">
            {title}
          </p>
          {description && <p className="mt-0.5 text-muted-foreground">{description}</p>}
          <p className="mt-2 text-muted-foreground">{sectionsLabel}</p>
          <ul className="flex flex-wrap gap-x-4">
            {sections.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={section.focus}
                  className="inline-flex min-h-11 items-center rounded-md font-medium text-destructive underline underline-offset-4 outline-none hover:text-destructive/80 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
