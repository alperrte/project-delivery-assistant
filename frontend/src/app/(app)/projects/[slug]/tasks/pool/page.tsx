import { PoolPage } from "@/features/tasks/components/pool-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("pool");

export default async function PoolRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PoolPage slug={slug} />;
}
