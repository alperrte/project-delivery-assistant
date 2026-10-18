import { ProjectMeetingRoom } from "@/features/meetings/meeting-room";
import { pageTitle } from "@/lib/seo/page-title";
export const generateMetadata = () => pageTitle("meetingRoom");
export default async function Page({ params }: { params: Promise<{ slug: string; meetingId: string }> }) {
  const { slug, meetingId } = await params;
  return <ProjectMeetingRoom slug={slug} id={meetingId} />;
}
