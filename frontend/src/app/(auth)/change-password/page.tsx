import { ChangePasswordForm } from "@/features/auth/components/change-password-form";

// The subtitle depends on the session's mustChangePassword flag, which is only
// known client-side, so the form owns its own AuthCard instead of the page.
export default function ChangePasswordPage() {
  return <ChangePasswordForm />;
}
