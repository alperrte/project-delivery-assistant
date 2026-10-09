import { ReminderFormPage } from "@/features/reminders/components/reminder-form-page";
import { isDateKey } from "@/features/reminders/dates";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("reminderNew");

export default async function NewReminderRoute({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  return <ReminderFormPage initialDate={date && isDateKey(date) ? date : undefined} />;
}
