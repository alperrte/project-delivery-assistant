package com.pda.meeting.internal;

/** SMTP boundary is intentionally separate from the durable ledger and meeting transactions. */
public interface MeetingReminderMail {
    boolean available();
    void send(MeetingReminderStore.Envelope reminder);
}
