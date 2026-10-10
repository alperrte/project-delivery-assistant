import type { ReactNode } from "react";
import { AuthShell } from "@/components/layout/auth-shell";

/** The administrator sign-in sits on the same scene as the other sign-in screens (logo, theme and language controls, footer). */
export default function AdminEntryLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
