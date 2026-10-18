package com.pda.meeting.internal;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;
public interface MeetingRoomCleanupRepository extends JpaRepository<MeetingRoomCleanup,String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select c from MeetingRoomCleanup c where c.roomName=:name") Optional<MeetingRoomCleanup> lock(@Param("name") String name);
    List<MeetingRoomCleanup> findByRetryAtLessThanEqual(Instant now,Pageable page);
}
