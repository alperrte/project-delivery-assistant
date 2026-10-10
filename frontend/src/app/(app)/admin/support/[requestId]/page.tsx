import { AdminSupportDetailPage } from "@/features/admin/components/support-detail-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("adminSupportRequest");

export default async function AdminSupportRequestRoute({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  return <AdminSupportDetailPage requestId={requestId} />;
}
