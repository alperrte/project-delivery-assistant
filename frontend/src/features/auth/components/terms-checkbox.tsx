"use client";

import { useId, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Check } from "@phosphor-icons/react";
import { PageLink } from "./registration-notice";

/**
 * The "I accept the Terms of Use" box on the account-creation forms. Only the Terms are accepted here; the KVKK
 * and privacy texts stay a plain notice (RegistrationNotice), because they inform and are not a consent.
 */
export function TermsCheckbox({ error, ...props }: Omit<ComponentProps<"input">, "type" | "id"> & { error?: string }) {
  const t = useTranslations("register");
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2.5 text-sm">
        <span className="group relative mt-px grid size-[1.125rem] shrink-0 place-items-center">
          <input
            {...props}
            id={id}
            type="checkbox"
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            className="peer size-full cursor-pointer appearance-none rounded-[5px] border border-(--auth-field-border) bg-(--auth-field) transition-colors checked:border-(--auth-link) checked:bg-(--auth-link) hover:border-(--auth-link) aria-invalid:border-destructive focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-(--glow)/35"
          />
          <Check
            aria-hidden
            size={12}
            weight="bold"
            className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100 dark:text-[#04121a]"
          />
        </span>
        <label htmlFor={id} className="cursor-pointer select-none leading-5">
          {t.rich("termsAgree", { terms: (chunks) => <PageLink href="/terms">{chunks}</PageLink> })}
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
