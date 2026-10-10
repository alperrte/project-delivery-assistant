import { CriterionFormPage } from "@/features/criteria/components/criterion-form-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("criterionNew");

export default async function NewCriterionRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CriterionFormPage slug={slug} />;
}
