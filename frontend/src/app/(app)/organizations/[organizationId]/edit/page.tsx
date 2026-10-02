import { OrganizationFormPage } from "@/features/organizations/components/organization-form-page";

export default async function EditOrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <OrganizationFormPage organizationId={organizationId} />;
}
