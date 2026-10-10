import { CriterionFormPage } from "@/features/criteria/components/criterion-form-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("criterionEdit");

export default async function EditCriterionRoute({ params }: { params: Promise<{ slug: string; criterionId: string }> }) {
  const { slug, criterionId } = await params;
  return <CriterionFormPage slug={slug} criterionId={criterionId} />;
}
