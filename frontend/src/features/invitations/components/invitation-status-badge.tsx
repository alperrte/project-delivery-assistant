"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { InvitationStatus } from "../types";

export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  const t = useTranslations("invitations");
  return (
    <Badge className={
      status === "ACCEPTED"
        ? "border border-success/25 bg-success/10 text-success"
        : status === "PENDING"
          ? "border border-primary/25 bg-primary/10 text-primary"
          : "border border-border bg-muted text-muted-foreground"
    }>
      {t(`statusValues.${status}`)}
    </Badge>
  );
}
