import { Dashboard } from "@/features/dashboard/dashboard";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("dashboard");

export default function DashboardPage() {
  return <Dashboard />;
}
