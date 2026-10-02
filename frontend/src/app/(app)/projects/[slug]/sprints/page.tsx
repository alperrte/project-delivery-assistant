import { SprintsPage } from "@/features/sprints/components/sprints-page";

export default async function SprintsRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SprintsPage slug={slug} />;
}
