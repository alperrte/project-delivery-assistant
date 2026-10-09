import { AdminAnalyticsPage } from "@/features/admin/components/analytics-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("adminAnalytics");

export default function AdminAnalyticsRoute() {
  return <AdminAnalyticsPage />;
}
