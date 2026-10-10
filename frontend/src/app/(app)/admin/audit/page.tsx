import { AdminAuditPage } from "@/features/admin/components/audit-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("adminAudit");

export default function AdminAuditRoute() {
  return <AdminAuditPage />;
}
