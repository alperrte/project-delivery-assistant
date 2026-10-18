import { MeetingForm } from "@/features/meetings/meeting-form";
import { pageTitle } from "@/lib/seo/page-title";
export const generateMetadata = () => pageTitle("meetingNew");
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <MeetingForm key={slug} slug={slug} />;
}
