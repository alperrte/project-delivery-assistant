import { SprintsPage } from "@/features/sprints/components/sprints-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("sprints");

export default async function SprintsRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SprintsPage slug={slug} />;
}
