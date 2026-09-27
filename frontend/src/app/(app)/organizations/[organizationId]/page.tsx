import { OrganizationDetail } from "@/features/organizations/components/organization-detail";

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <OrganizationDetail organizationId={organizationId} />;
}
