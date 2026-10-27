import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { localizeHref } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";

/** Compatibility route: creating a meeting no longer involves a project. */
export default async function Page() {
  redirect(localizeHref("/meetings/new", await getLocale() as Locale));
}
