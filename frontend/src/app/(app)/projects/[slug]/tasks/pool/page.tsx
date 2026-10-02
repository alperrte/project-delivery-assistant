import { PoolPage } from "@/features/tasks/components/pool-page";

export default async function PoolRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PoolPage slug={slug} />;
}
