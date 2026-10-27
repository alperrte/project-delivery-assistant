import { MeetingDetail } from "@/features/meetings/meeting-detail";
import { pageTitle } from "@/lib/seo/page-title";
export const generateMetadata = () => pageTitle("meetingEdit");
export default async function Page({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  return <MeetingDetail key={meetingId} id={meetingId} edit />;
}
