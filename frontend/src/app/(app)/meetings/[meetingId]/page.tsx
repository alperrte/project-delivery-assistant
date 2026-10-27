import { MeetingDetail } from "@/features/meetings/meeting-detail";
import { pageTitle } from "@/lib/seo/page-title";
export const generateMetadata = () => pageTitle("meetingDetail");
export default async function Page({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  return <MeetingDetail key={meetingId} id={meetingId} />;
}
