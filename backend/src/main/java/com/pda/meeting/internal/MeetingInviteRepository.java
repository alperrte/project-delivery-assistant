package com.pda.meeting.internal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface MeetingInviteRepository extends JpaRepository<MeetingInvite,UUID> {
    org.springframework.data.domain.Page<MeetingInvite> findByMeetingId(UUID meetingId,org.springframework.data.domain.Pageable pageable);
    Optional<MeetingInvite> findByTokenHash(String hash);
    interface InviteScope { UUID getId(); UUID getMeetingId(); }
    @Query("select i.id as id,i.meetingId as meetingId from MeetingInvite i where i.tokenHash=:hash")
    Optional<InviteScope> scopeByTokenHash(@Param("hash") String hash);
}
