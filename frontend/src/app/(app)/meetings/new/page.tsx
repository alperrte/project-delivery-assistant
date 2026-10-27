import { Suspense } from "react";
import { MeetingCreate } from "@/features/meetings/meeting-create";
import { pageTitle } from "@/lib/seo/page-title";
export const generateMetadata = () => pageTitle("meetingNew");
/** Create a meeting: choose a project meeting or an independent one, then the one meeting form. */
export default function Page() {
  return <Suspense><MeetingCreate /></Suspense>;
}
