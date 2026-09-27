"use client";

import { useTranslations } from "next-intl";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

type PaginationBarProps = {
  page: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
};

export function PaginationBar({ page, totalPages, totalElements, onPageChange }: PaginationBarProps) {
  const t = useTranslations("common.pagination");
  if (totalElements === 0) return null;

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
