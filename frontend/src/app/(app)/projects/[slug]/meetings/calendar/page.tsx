import { MeetingCalendar } from "@/features/meetings/meeting-calendar";
import { pageTitle } from "@/lib/seo/page-title";
export const generateMetadata = () => pageTitle("meetingCalendar");
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <MeetingCalendar slug={slug} />;
}
