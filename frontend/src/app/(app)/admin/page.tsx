import { redirect } from "next/navigation";

/** The administration area opens on its first section. */
export default function AdminIndex() {
  redirect("/admin/users");
}
