import { LabelsPage } from "@/features/labels/components/labels-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("labels");

export default async function LabelsRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LabelsPage slug={slug} />;
}
