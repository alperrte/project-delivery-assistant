"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

type CursorPaginationProps = {
  /** One based, like the `?page=` the API takes. */
  page: number;
  /** Whether a page after this one exists. Ignored (treated as unknown) while `loading`. */
  hasNext: boolean;
  /** The page is being fetched: the controls keep their place and focus but do nothing until it arrives. */
  loading?: boolean;
  /** The last page the source serves (GitHub history is cut at page 10); reaching it shows `limitNote`. */
  maxPage?: number;
  /** Explains why the history ends at `maxPage`. */
  limitNote?: string;
  /** A change of the list behind the pages (branch, author, project) forgets how far the user had been. */
  scopeKey?: string;
  onPageChange: (page: number) => void;
};

const touchTarget = "h-11 min-w-11 sm:h-7 sm:min-w-8 aria-disabled:pointer-events-none aria-disabled:opacity-50";

/**
 * Previous / numbered pages / Next for a list whose total is unknown (GitHub gives none). Numbers run from 1 up to
 * the furthest page known to exist: the highest one reached so far, or the current page plus one while a next page
 * exists. Same visual language as `PaginationBar`, which needs totals.
 */
export function CursorPagination({ page, hasNext, loading = false, maxPage, limitNote, scopeKey = "", onPageChange }: CursorPaginationProps) {
  const t = useTranslations("common.pagination");
  const next = !loading && hasNext && (maxPage === undefined || page < maxPage);
  const known = Math.max(page, next ? page + 1 : 0);

  // Furthest page seen within this scope. Derived while rendering (no effect) so the numbers never lag a frame.
  const [seen, setSeen] = useState({ scopeKey, furthest: known });
  const furthest = seen.scopeKey === scopeKey ? Math.max(seen.furthest, known) : known;
  if (seen.scopeKey !== scopeKey || seen.furthest !== furthest) setSeen({ scopeKey, furthest });

  const go = (target: number) => {
    if (!loading && target >= 1 && target !== page) onPageChange(target);
  };
  const atLimit = maxPage !== undefined && page >= maxPage;

  return (
    <nav aria-label={t("navLabel")} className="flex flex-col items-center gap-2 pt-4">
      <div className="flex flex-wrap items-center justify-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={touchTarget}
          aria-disabled={loading || page <= 1 || undefined}
          onClick={() => go(page - 1)}
        >
          <CaretLeft data-icon="inline-start" size={14} aria-hidden="true" />
          <span className="hidden sm:inline">{t("previous")}</span>
          <span className="sr-only sm:hidden">{t("previous")}</span>
        </Button>
        <ol className="hidden items-center gap-1 sm:flex">
          {Array.from({ length: furthest }, (_, index) => index + 1).map((number) => (
            <li key={number}>
              <Button
                type="button"
                variant={number === page ? "default" : "ghost"}
                size="sm"
                aria-label={t("pageNumber", { page: number })}
                aria-current={number === page ? "page" : undefined}
                aria-disabled={loading && number !== page ? true : undefined}
                className={`${touchTarget} tabular-nums`}
                onClick={() => go(number)}
              >
                {number}
              </Button>
            </li>
          ))}
        </ol>
        <span className="px-2 text-sm text-muted-foreground tabular-nums sm:hidden">{t("pageNumber", { page })}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={touchTarget}
          aria-disabled={!next || undefined}
          onClick={() => next && go(page + 1)}
        >
          <span className="hidden sm:inline">{t("next")}</span>
          <span className="sr-only sm:hidden">{t("next")}</span>
          <CaretRight data-icon="inline-end" size={14} aria-hidden="true" />
        </Button>
      </div>
      {atLimit && limitNote && <p className="text-center text-xs text-muted-foreground">{limitNote}</p>}
    </nav>
  );
}
