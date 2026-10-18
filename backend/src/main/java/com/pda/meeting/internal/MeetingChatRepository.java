package com.pda.meeting.internal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.*;
import java.util.UUID;
public interface MeetingChatRepository extends JpaRepository<MeetingChatMessage,UUID> {
    Page<MeetingChatMessage> findByMeetingId(UUID meetingId,Pageable pageable);
    void deleteByMeetingId(UUID meetingId);
}
