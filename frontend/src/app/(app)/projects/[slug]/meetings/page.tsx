import { MeetingsPage } from "@/features/meetings/meetings-page";
import { pageTitle } from "@/lib/seo/page-title";
export const generateMetadata = () => pageTitle("meetings");
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <MeetingsPage slug={slug} />;
}
