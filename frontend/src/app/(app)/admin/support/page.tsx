import { AdminSupportPage } from "@/features/admin/components/support-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("adminSupport");

export default function AdminSupportRoute() {
  return <AdminSupportPage />;
}
