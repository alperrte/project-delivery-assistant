"use client";

import { ArrowLeft } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useWorkspaceHistory } from "@/components/layout/use-workspace-history";
import { useSearchParams } from "next/navigation";
import { matchPath } from "@/i18n/routing";
import { authenticatedRoute } from "@/components/layout/authenticated-route";

export function WorkspaceHelpBack() {
  const t = useTranslations("workspace.history");
  const history = useWorkspaceHistory();
  const router = useRouter();
  const pathname = usePathname();
  const returnTo = useSearchParams().get("returnTo");
  const targetPath = returnTo ? returnTo.split(/[?#]/)[0] : "";
  const safeReturn = returnTo?.startsWith("/") && !returnTo.startsWith("//") && !returnTo.includes("\\")
    && matchPath(targetPath)?.internalPath !== pathname
    && authenticatedRoute(targetPath);
  return <Button variant="ghost" className="mb-5 min-h-11" onClick={() => {
    if (!history.back()) router.replace(safeReturn ? returnTo! : "/dashboard");
  }}><ArrowLeft size={18} aria-hidden="true" />{t("back")}</Button>;
}
