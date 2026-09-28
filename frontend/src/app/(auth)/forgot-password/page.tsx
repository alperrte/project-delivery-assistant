import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

// The card's title/subtitle change with the step (email -> code), so the
// form owns its own AuthCard client-side instead of the page pre-rendering it.
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
