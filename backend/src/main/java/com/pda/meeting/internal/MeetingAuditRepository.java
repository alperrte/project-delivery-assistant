package com.pda.meeting.internal;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface MeetingAuditRepository extends JpaRepository<MeetingAudit,UUID> {}
