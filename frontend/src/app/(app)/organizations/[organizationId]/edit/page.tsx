import { OrganizationFormPage } from "@/features/organizations/components/organization-form-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("organizationEdit");

export default async function EditOrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <OrganizationFormPage organizationId={organizationId} />;
}
