import { MeetingDetail } from "@/features/meetings/meeting-detail";
import { pageTitle } from "@/lib/seo/page-title";
export const generateMetadata = () => pageTitle("meetingEdit");
export default async function Page({ params }: { params: Promise<{ slug: string; meetingId: string }> }) {
  const { slug, meetingId } = await params;
  return <MeetingDetail key={meetingId} slug={slug} id={meetingId} edit />;
}
