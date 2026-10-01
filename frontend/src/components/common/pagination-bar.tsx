"use client";

import { useTranslations } from "next-intl";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PaginationBarProps = {
  /** Zero based, like the API. */
  page: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
  /** Passing the page size switches to numbered pages with a "from-to" summary. */
  pageSize?: number;
};

/** First, last, current and its neighbours; gaps collapse to `null` (rendered as an ellipsis). */
function pageWindow(page: number, totalPages: number): (number | null)[] {
  const keep = new Set([0, totalPages - 1, page - 1, page, page + 1]);
  const pages = [...keep].filter((p) => p >= 0 && p < totalPages).sort((a, b) => a - b);
  const result: (number | null)[] = [];
  pages.forEach((p, index) => {
    if (index > 0 && p - pages[index - 1] > 1) result.push(null);
    result.push(p);
  });
  return result;
}

export function PaginationBar({ page, totalPages, totalElements, onPageChange, pageSize }: PaginationBarProps) {
  const t = useTranslations("common.pagination");
  if (totalElements === 0) return null;

  if (pageSize) {
    const from = page * pageSize + 1;
    const to = Math.min((page + 1) * pageSize, totalElements);
    return (
      <nav aria-label={t("navLabel")} className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <p className="text-sm text-muted-foreground">
          {t("total", { count: totalElements })}
          <span className="hidden sm:inline">
            {" · "}
            {t("showing", { from, to })}
          </span>
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => onPageChange(page - 1)}>
            <CaretLeft data-icon="inline-start" size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{t("previous")}</span>
            <span className="sr-only sm:hidden">{t("previous")}</span>
          </Button>
          <ol className="hidden items-center gap-1 sm:flex">
            {pageWindow(page, totalPages).map((p, index) =>
              p === null ? (
                <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-sm text-muted-foreground">
                  …
                </li>
              ) : (
                <li key={p}>
                  <Button
                    variant={p === page ? "default" : "ghost"}
                    size="sm"
                    aria-label={t("pageNumber", { page: p + 1 })}
                    aria-current={p === page ? "page" : undefined}
                    className={cn("min-w-8 tabular-nums")}
                    onClick={() => p !== page && onPageChange(p)}
                  >
                    {p + 1}
                  </Button>
                </li>
              ),
            )}
          </ol>
          <span className="px-2 text-sm text-muted-foreground tabular-nums sm:hidden">
            {t("pageOf", { page: page + 1, totalPages: Math.max(totalPages, 1) })}
          </span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => onPageChange(page + 1)}>
            <span className="hidden sm:inline">{t("next")}</span>
            <span className="sr-only sm:hidden">{t("next")}</span>
            <CaretRight data-icon="inline-end" size={14} aria-hidden="true" />
          </Button>
        </div>
      </nav>
    );
  }

  return (
    <div className="flex items-center justify-between pt-3">
      <p className="text-sm text-muted-foreground">{t("total", { count: totalElements })}</p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
        >
          <CaretLeft data-icon="inline-start" size={14} />
          {t("previous")}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t("pageOf", { page: page + 1, totalPages: Math.max(totalPages, 1) })}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page + 1 >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t("next")}
          <CaretRight data-icon="inline-end" size={14} />
        </Button>
      </div>
    </div>
  );
}
