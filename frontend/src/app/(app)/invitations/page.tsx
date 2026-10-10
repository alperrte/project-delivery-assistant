import { Suspense } from "react";
import { MyInvitationsPage } from "@/features/invitations/components/my-invitations-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("invitations");

export default function InvitationsRoute() {
  // The list keeps its filter and page in the URL, which needs a Suspense boundary during prerender.
  return (
    <Suspense>
      <MyInvitationsPage />
    </Suspense>
  );
}
