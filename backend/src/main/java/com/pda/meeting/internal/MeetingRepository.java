package com.pda.meeting.internal;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;

public interface MeetingRepository extends JpaRepository<Meeting,UUID>, JpaSpecificationExecutor<Meeting> {
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select m from Meeting m where m.id=:id")
    Optional<Meeting> lock(@Param("id") UUID id);
    Optional<Meeting> findByRoomName(String roomName);
    @Query("select m.id from Meeting m where m.roomName=:room") Optional<UUID> idByRoom(@Param("room") String roomName);
    List<Meeting> findByProjectId(UUID projectId);
    @Query("select m.id from Meeting m where m.projectId=:project") List<UUID> idsByProject(@Param("project") UUID projectId);
    @Query(value="select id from meetings where (status='SCHEDULED' and starts_at<=:now) or status='OPEN' or (cleanup_pending=true and (cleanup_retry_at is null or cleanup_retry_at<=:now)) order by starts_at,id",nativeQuery=true)
    List<UUID> work(@Param("now") Instant now, Pageable page);
}
