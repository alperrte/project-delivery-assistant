import { LabelsPage } from "@/features/labels/components/labels-page";

export default async function LabelsRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LabelsPage slug={slug} />;
}
