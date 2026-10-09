import { CalendarPage } from "@/features/calendar/calendar-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("calendar");

export default function CalendarRoute() {
  return <CalendarPage />;
}
