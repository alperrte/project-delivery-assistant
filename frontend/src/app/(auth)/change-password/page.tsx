import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { pageTitle } from "@/lib/seo/page-title";

export async function generateMetadata() {
  // Only reachable signed in (the proxy sends everyone else to login), so it must never be indexed.
  return { ...(await pageTitle("changePassword")), robots: { index: false, follow: false } };
}

// The subtitle depends on the session's mustChangePassword flag, which is only
// known client-side, so the form owns its own AuthCard instead of the page.
export default function ChangePasswordPage() {
  return <ChangePasswordForm />;
}
