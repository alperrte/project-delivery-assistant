import { ReminderFormPage } from "@/features/reminders/components/reminder-form-page";

export default async function EditReminderRoute({ params }: { params: Promise<{ reminderId: string }> }) {
  const { reminderId } = await params;
  return <ReminderFormPage reminderId={reminderId} />;
}
