import { AccountPage } from "@/features/account/components/account-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("account");

export default function AccountRoute() {
  return <AccountPage />;
}
