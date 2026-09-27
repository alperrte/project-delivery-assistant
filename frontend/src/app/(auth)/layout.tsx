import type { ReactNode } from "react";
import { AuthShell } from "@/components/layout/auth-shell";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
