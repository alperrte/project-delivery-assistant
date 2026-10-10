import { AdminUserDetailPage } from "@/features/admin/components/user-detail-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("adminUser");

export default async function AdminUserRoute({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <AdminUserDetailPage userId={userId} />;
}
