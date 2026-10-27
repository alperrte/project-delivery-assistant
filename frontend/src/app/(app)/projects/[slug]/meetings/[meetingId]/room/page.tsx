import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { localizeHref } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";

/** Compatibility route: an old project room link opens the same room at its global address (a full navigation, so the media policy applies to the new document). */
export default async function Page({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  redirect(localizeHref(`/meetings/${encodeURIComponent(meetingId)}/room`, await getLocale() as Locale));
}
