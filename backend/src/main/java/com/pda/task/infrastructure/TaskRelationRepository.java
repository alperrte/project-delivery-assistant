package com.pda.task.infrastructure;

import com.pda.task.domain.RelationType;
import com.pda.task.domain.TaskRelation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TaskRelationRepository extends JpaRepository<TaskRelation, UUID> {
    @Query("select r from TaskRelation r where r.sourceTaskId = :taskId or r.targetTaskId = :taskId")
    List<TaskRelation> findOfTask(@Param("taskId") UUID taskId);

    @Query("select r from TaskRelation r where r.sourceTaskId in :taskIds or r.targetTaskId in :taskIds")
    List<TaskRelation> findOfTasks(@Param("taskIds") Collection<UUID> taskIds);

    Optional<TaskRelation> findByIdAndProjectId(UUID id, UUID projectId);

    /** Existing row between the two tasks in this direction, or (for the symmetric RELATES) in either one. */
    @Query("select count(r) > 0 from TaskRelation r where r.type = :type and "
            + "((r.sourceTaskId = :a and r.targetTaskId = :b) or (r.sourceTaskId = :b and r.targetTaskId = :a))")
    boolean existsBetween(@Param("a") UUID a, @Param("b") UUID b, @Param("type") RelationType type);

    @Query("select count(r) > 0 from TaskRelation r where r.type = :type "
            + "and r.sourceTaskId = :source and r.targetTaskId = :target")
    boolean existsDirected(@Param("source") UUID source, @Param("target") UUID target,
                           @Param("type") RelationType type);

    @Query("select r from TaskRelation r where r.type = com.pda.task.domain.RelationType.BLOCKS "
            + "and r.targetTaskId in :taskIds")
    List<TaskRelation> findBlockersOf(@Param("taskIds") Collection<UUID> taskIds);
}
