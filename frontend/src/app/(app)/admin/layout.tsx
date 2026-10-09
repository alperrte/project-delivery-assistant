import type { ReactNode } from "react";
import { AdminArea } from "@/features/admin/components/admin-guard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminArea>{children}</AdminArea>;
}
