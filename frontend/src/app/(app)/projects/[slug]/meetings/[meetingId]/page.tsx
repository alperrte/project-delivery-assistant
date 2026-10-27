import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { localizeHref } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";

/** Compatibility route: an old project meeting link opens the same meeting at its global address. Access is decided by the server for that meeting alone. */
export default async function Page({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  redirect(localizeHref(`/meetings/${encodeURIComponent(meetingId)}`, await getLocale() as Locale));
}
