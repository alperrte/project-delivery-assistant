import { SettingsPage } from "@/features/settings/components/settings-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("settings");

export default function SettingsRoute() {
  return <SettingsPage />;
}
