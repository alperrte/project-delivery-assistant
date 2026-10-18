package com.pda.meeting.internal;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name="meeting_webhook_events")
public class MeetingWebhookEvent {
    @Id @Column(length=128) public String id;
    @Column(nullable=false) public Instant receivedAt;
}
