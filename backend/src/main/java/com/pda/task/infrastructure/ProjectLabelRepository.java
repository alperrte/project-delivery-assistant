package com.pda.task.infrastructure;

import com.pda.task.domain.ProjectLabel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectLabelRepository extends JpaRepository<ProjectLabel, UUID> {
    Optional<ProjectLabel> findByIdAndProjectId(UUID id, UUID projectId);

    List<ProjectLabel> findByProjectIdAndArchivedAtIsNullOrderByNameAsc(UUID projectId);

    @Query("select l from ProjectLabel l where l.id in :ids and l.projectId = :projectId and l.archivedAt is null")
    List<ProjectLabel> findActiveByProjectAndIds(@Param("projectId") UUID projectId,
                                                  @Param("ids") Collection<UUID> ids);

    @Query("select count(l) > 0 from ProjectLabel l where l.projectId = :projectId and l.archivedAt is null "
            + "and lower(l.name) = lower(:name) and (:excludeId is null or l.id <> :excludeId)")
    boolean nameTaken(@Param("projectId") UUID projectId, @Param("name") String name,
                      @Param("excludeId") UUID excludeId);
}
