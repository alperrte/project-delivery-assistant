"use client";

import { useId } from "react";
import { ArrowClockwise, ArrowRight, EnvelopeSimple, FileMagnifyingGlass, LockKey, Plugs, WarningOctagon } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { CONTACT_HREF } from "@/features/public-info/site-info";
import { cn } from "@/lib/utils";
import type { ErrorCode, ErrorCopy } from "./types";

const ICONS = { "404": FileMagnifyingGlass, "403": LockKey, "500": WarningOctagon, "503": Plugs };

/** No provider, router, session or API dependency: also safe in global-error. */
export function ErrorContent({ code, copy, onRetry }: { code: ErrorCode; copy: ErrorCopy; onRetry?: () => void }) {
  const id = useId();
  const text = copy[code];
  const Icon = ICONS[code];
  const retryable = code === "500" || code === "503";
  const actionClass = cn(buttonVariants(), "min-h-11 h-auto whitespace-normal px-5 py-3 text-center");

  return (
    <section data-error-code={code} aria-labelledby={id} className="mx-auto grid w-full max-w-5xl items-center gap-8 py-10 sm:py-16 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
      <div aria-hidden="true" className="relative flex flex-col items-center border-b border-border pb-8 md:border-r md:border-b-0 md:py-10 md:pr-12">
        <Icon size={36} weight="duotone" className="text-primary" />
        <span className="font-mono text-[clamp(6rem,18vw,12rem)] leading-none font-semibold tracking-[-0.08em] text-foreground">{code}</span>
        <div className="mt-5 flex items-center gap-3">
          <span className="h-px w-12 bg-border-strong" />
          <span className="size-2 rounded-full bg-primary" />
          <span className="h-px w-12 border-t border-dashed border-border-strong" />
        </div>
      </div>
      <div className="min-w-0">
        <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground">{copy.common.label} · {code}</p>
        <h1 id={id} className="text-balance text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">{text.title}</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">{text.description}</p>
        <div className="mt-6 border-l-2 border-primary/40 pl-4">
          <h2 className="text-sm font-medium">{copy.common.next}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{text.hint}</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          {retryable ? (
            <button type="button" onClick={onRetry ?? (() => window.location.reload())} className={actionClass}>
              <ArrowClockwise size={18} aria-hidden="true" />{copy.common.retry}
            </button>
          ) : (
            <a href="/dashboard" className={actionClass}>{copy.common.home}<ArrowRight size={18} aria-hidden="true" /></a>
          )}
          <a href={retryable ? "/dashboard" : "/login"} className={cn(buttonVariants({ variant: "outline" }), "min-h-11 h-auto whitespace-normal px-5 py-3 text-center")}>
            {retryable ? copy.common.home : copy.common.login}
          </a>
        </div>
        <a href={CONTACT_HREF} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <EnvelopeSimple size={17} aria-hidden="true" />{copy.common.contact}
        </a>
      </div>
    </section>
  );
}
