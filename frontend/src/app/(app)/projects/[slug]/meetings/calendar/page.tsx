import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { localizeHref } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";

/** Compatibility route: the personal calendar is the single calendar surface. */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(localizeHref(`/calendar?project=${encodeURIComponent(slug)}`, await getLocale() as Locale));
}
