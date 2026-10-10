"use client";

import { WifiSlash } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useOnlineStatus } from "@/hooks/use-online-status";

/** Tells the person the connection is gone while they work; queries refetch on reconnect, so nothing has to be pressed. */
export function OfflineNotice() {
  const t = useTranslations("workspace");
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <p className="pointer-events-auto flex max-w-md items-center gap-2 rounded-lg border border-border bg-popover px-4 py-2.5 text-sm text-popover-foreground shadow-lg">
        <WifiSlash size={18} className="shrink-0 text-destructive" aria-hidden="true" />
        {t("offline")}
      </p>
    </div>
  );
}
