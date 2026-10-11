import { AdminSystemPage } from "@/features/admin/components/system-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("adminSystem");

export default function AdminSystemRoute() {
  return <AdminSystemPage />;
}
