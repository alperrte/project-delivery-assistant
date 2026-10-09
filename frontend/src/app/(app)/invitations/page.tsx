import { MyInvitationsPage } from "@/features/invitations/components/my-invitations-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("invitations");

export default function InvitationsRoute() {
  return <MyInvitationsPage />;
}
