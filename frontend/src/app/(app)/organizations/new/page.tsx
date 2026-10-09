import { OrganizationFormPage } from "@/features/organizations/components/organization-form-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("organizationNew");

export default function NewOrganizationPage() {
  return <OrganizationFormPage />;
}
