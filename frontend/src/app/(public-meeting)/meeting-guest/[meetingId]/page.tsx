import { MeetingRoom } from "@/features/meetings/meeting-room";
import { pageTitle } from "@/lib/seo/page-title";
export const generateMetadata = () => pageTitle("meetingRoom");
export default async function Page({ params }: { params: Promise<{ meetingId: string }> }) { const { meetingId } = await params; return <main className="min-h-dvh bg-background p-4 sm:p-8"><MeetingRoom key={meetingId} id={meetingId} /></main>; }
