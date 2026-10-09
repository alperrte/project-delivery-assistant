import { ReminderFormPage } from "@/features/reminders/components/reminder-form-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("reminderEdit");

export default async function EditReminderRoute({ params }: { params: Promise<{ reminderId: string }> }) {
  const { reminderId } = await params;
  return <ReminderFormPage reminderId={reminderId} />;
}
