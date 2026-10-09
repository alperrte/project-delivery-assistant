import { OrganizationDetail } from "@/features/organizations/components/organization-detail";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("organization");

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  return <OrganizationDetail organizationId={organizationId} />;
}
