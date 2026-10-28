import { Suspense } from "react";
import { MeetingsPage } from "@/features/meetings/meetings-page";
import { pageTitle } from "@/lib/seo/page-title";
export const generateMetadata = () => pageTitle("meetings");
/** My meetings: global, shows what the signed-in user organizes or attends whatever project is selected (or none). */
export default function Page() {
  return <Suspense><MeetingsPage /></Suspense>;
}
