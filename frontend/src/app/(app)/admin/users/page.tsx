import { AdminUsersPage } from "@/features/admin/components/users-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("adminUsers");

export default function AdminUsersRoute() {
  return <AdminUsersPage />;
}
