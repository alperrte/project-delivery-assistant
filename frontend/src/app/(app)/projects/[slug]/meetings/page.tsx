import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { localizeHref } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";

/** Compatibility route: meetings are global, so an old project meetings link opens the user's meetings. */
export default async function Page() {
  redirect(localizeHref("/meetings", await getLocale() as Locale));
}
