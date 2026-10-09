import { SprintDetailPage } from "@/features/sprints/components/sprint-detail-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("sprint");

export default async function SprintDetailRoute({ params }: { params: Promise<{ slug: string; sprintId: string }> }) {
  const { slug, sprintId } = await params;
  return <SprintDetailPage slug={slug} sprintId={sprintId} />;
}
