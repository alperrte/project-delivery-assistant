package com.pda.meeting.internal;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;

public interface MeetingHiddenRepository extends JpaRepository<MeetingHidden,MeetingHidden.Key> {
    @Query("select h.meetingId from MeetingHidden h where h.userId=:user and h.meetingId in :ids")
    Set<UUID> hiddenAmong(@Param("user") UUID user,@Param("ids") Collection<UUID> ids);
    @Query("select count(h) from MeetingHidden h where h.userId=:user and h.meetingId in (select m.id from Meeting m where m.projectId=:project)")
    long countInProject(@Param("user") UUID user,@Param("project") UUID project);
    /** Hides every finished or cancelled meeting of the project for this user only; already hidden ones are left alone. */
    @Modifying @Query(value="insert into meeting_user_hidden(meeting_id,user_id,hidden_at) select m.id,:user,:now from meetings m where m.project_id=:project and m.status in ('ENDED','CANCELLED') on conflict do nothing",nativeQuery=true)
    int hideHistory(@Param("project") UUID project,@Param("user") UUID user,@Param("now") java.time.Instant now);
    @Modifying @Query(value="delete from meeting_user_hidden where user_id=:user and meeting_id in (select id from meetings where project_id=:project)",nativeQuery=true)
    int restoreHistory(@Param("project") UUID project,@Param("user") UUID user);
}
