import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { localizeHref } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";

/** Compatibility route: see the meeting detail redirect. */
export default async function Page({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  redirect(localizeHref(`/meetings/${encodeURIComponent(meetingId)}/edit`, await getLocale() as Locale));
}
