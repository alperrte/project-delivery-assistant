package com.pda.meeting.internal;
import org.springframework.data.jpa.repository.JpaRepository;
public interface MeetingWebhookRepository extends JpaRepository<MeetingWebhookEvent,String> {}
