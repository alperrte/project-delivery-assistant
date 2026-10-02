import { notFound } from "next/navigation";
import { CrashTest } from "@/features/errors/crash-test";

export const metadata = { robots: { index: false, follow: false } };

export default function ErrorTestPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CrashTest />;
}
