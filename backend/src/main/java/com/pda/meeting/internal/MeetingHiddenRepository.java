package com.pda.meeting.internal;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;

public interface MeetingHiddenRepository extends JpaRepository<MeetingHidden,MeetingHidden.Key> {
    @Query("select h.meetingId from MeetingHidden h where h.userId=:user and h.meetingId in :ids")
    Set<UUID> hiddenAmong(@Param("user") UUID user,@Param("ids") Collection<UUID> ids);
    @Query("select count(h) from MeetingHidden h where h.userId=:user and h.meetingId in (select m.id from Meeting m where m.organizerId=:user or :user member of m.attendeeIds)")
    long countFor(@Param("user") UUID user);
    /** Hides every finished or cancelled meeting this user organizes or attends, for this user only; already hidden ones are left alone. */
    @Modifying @Query(value="insert into meeting_user_hidden(meeting_id,user_id,hidden_at) select m.id,:user,:now from meetings m where m.status in ('ENDED','CANCELLED') and (m.organizer_id=:user or exists(select 1 from meeting_attendees a where a.meeting_id=m.id and a.user_id=:user)) on conflict do nothing",nativeQuery=true)
    int hideHistory(@Param("user") UUID user,@Param("now") java.time.Instant now);
    @Modifying @Query(value="delete from meeting_user_hidden where user_id=:user",nativeQuery=true)
    int restoreHistory(@Param("user") UUID user);
}
