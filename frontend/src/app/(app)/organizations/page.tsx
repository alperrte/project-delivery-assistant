import { OrganizationList } from "@/features/organizations/components/organization-list";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("organizations");

export default function OrganizationsPage() {
  return <OrganizationList />;
}
