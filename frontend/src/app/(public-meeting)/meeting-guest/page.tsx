import { GuestMeetingPage } from "@/features/meetings/guest-meeting-page";
import { pageTitle } from "@/lib/seo/page-title";
export const generateMetadata = () => pageTitle("meetingRoom");
export default function Page() { return <GuestMeetingPage />; }
