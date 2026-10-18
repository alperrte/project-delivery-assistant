package com.pda.meeting.internal;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface MeetingParticipantRepository extends JpaRepository<MeetingParticipant,UUID> {
    Optional<MeetingParticipant> findByMeetingIdAndIdentity(UUID meetingId,String identity);
    Optional<MeetingParticipant> findBySessionHash(String hash);
    List<MeetingParticipant> findByMeetingId(UUID meetingId);
    List<MeetingParticipant> findByInviteId(UUID inviteId);
}
