package com.pda.task.sprint.infrastructure;

import com.pda.task.sprint.domain.Sprint;
import com.pda.task.sprint.domain.SprintStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SprintRepository extends JpaRepository<Sprint, UUID> {
    Optional<Sprint> findByIdAndProjectIdAndArchivedAtIsNull(UUID id, UUID projectId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Sprint s where s.id = :id and s.projectId = :projectId and s.archivedAt is null")
    Optional<Sprint> lockScoped(@Param("projectId") UUID projectId, @Param("id") UUID id);

    List<Sprint> findByProjectIdAndArchivedAtIsNullOrderBySequenceDesc(UUID projectId);
    List<Sprint> findByProjectIdAndStatusAndArchivedAtIsNullOrderBySequenceDesc(UUID projectId, SprintStatus status);
    List<Sprint> findByProjectIdInAndStatusAndArchivedAtIsNull(Collection<UUID> projectIds, SprintStatus status);
    boolean existsByProjectIdAndStatusAndArchivedAtIsNull(UUID projectId, SprintStatus status);

    @Query("select s from Sprint s where s.id in :ids")
    List<Sprint> findAllByIds(@Param("ids") Collection<UUID> ids);

    @Query("select coalesce(max(s.sequence), 0) from Sprint s where s.projectId = :projectId")
    int maxSequence(@Param("projectId") UUID projectId);
}
