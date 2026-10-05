package com.pda.task.infrastructure;

import com.pda.task.domain.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TaskRepository extends JpaRepository<Task, UUID>, JpaSpecificationExecutor<Task> {
    Optional<Task> findByIdAndProjectId(UUID id, UUID projectId);

    /** Persisted advanced data (including archived children) must never disappear through a model downgrade. */
    @Query(value = "select (exists(select 1 from tasks where parent_task_id=:taskId) "
            + "or exists(select 1 from task_labels where task_id=:taskId) "
            + "or exists(select 1 from task_checklist_items where task_id=:taskId) "
            + "or exists(select 1 from task_relations where source_task_id=:taskId or target_task_id=:taskId) "
            + "or exists(select 1 from task_attachments where task_id=:taskId and deleted_at is null) "
            + "or exists(select 1 from task_worklogs where task_id=:taskId and deleted_at is null) "
            + "or exists(select 1 from task_watchers where task_id=:taskId and manual_watch))", nativeQuery = true)
    boolean hasAdvancedData(@Param("taskId") UUID taskId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Task t where t.id = :taskId and t.projectId = :projectId")
    Optional<Task> lockScoped(@Param("projectId") UUID projectId, @Param("taskId") UUID taskId);

    List<Task> findByParentTaskIdAndArchivedAtIsNull(UUID parentTaskId);

    @Query("select t from Task t where t.id in :ids and t.projectId = :projectId and t.archivedAt is null")
    List<Task> findActiveByProjectAndIds(@Param("projectId") UUID projectId, @Param("ids") Collection<UUID> ids);

    @Query("select t from Task t where t.id in :ids")
    List<Task> findAllByIds(@Param("ids") Collection<UUID> ids);

    /** {@code [parentId, total, done]} per parent for the supplied parents, archived subtasks excluded. */
    @Query("select t.parentTaskId, count(t), sum(case when t.status = com.pda.task.domain.TaskStatus.DONE "
            + "then 1 else 0 end) from Task t where t.parentTaskId in :parentIds and t.archivedAt is null "
            + "group by t.parentTaskId")
    List<Object[]> subtaskCounts(@Param("parentIds") Collection<UUID> parentIds);

    @Query("select count(t) from Task t where t.sprintId = :sprintId and t.archivedAt is null")
    long countActiveInSprint(@Param("sprintId") UUID sprintId);

    @Query("select t from Task t where t.sprintId = :sprintId and t.archivedAt is null")
    List<Task> findActiveBySprint(@Param("sprintId") UUID sprintId);

    /** Open tasks whose deadline falls inside the reminder window and that were not reminded yet. */
    @Query("select t from Task t where t.archivedAt is null and t.status <> com.pda.task.domain.TaskStatus.DONE "
            + "and t.deadlineAt is not null and t.deadlineAt > :now and t.deadlineAt <= :until "
            + "and t.deadlineRemindedAt is null")
    List<Task> findDueSoon(@Param("now") Instant now, @Param("until") Instant until);

    @Query("select t from Task t where t.archivedAt is null and t.status <> com.pda.task.domain.TaskStatus.DONE "
            + "and t.deadlineAt is not null and t.deadlineAt <= :now and t.deadlineOverdueNotifiedAt is null")
    List<Task> findNewlyOverdue(@Param("now") Instant now);

    /** Conditional claim of the reminder marker: 1 when this caller won, 0 when another instance did. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Task t set t.deadlineRemindedAt = :now where t.id = :id and t.deadlineRemindedAt is null "
            + "and t.deadlineAt = :deadlineAt")
    int claimReminder(@Param("id") UUID id, @Param("deadlineAt") Instant deadlineAt, @Param("now") Instant now);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Task t set t.deadlineOverdueNotifiedAt = :now, "
            + "t.deadlineRemindedAt = coalesce(t.deadlineRemindedAt, :now) "
            + "where t.id = :id and t.deadlineOverdueNotifiedAt is null and t.deadlineAt = :deadlineAt")
    int claimOverdue(@Param("id") UUID id, @Param("deadlineAt") Instant deadlineAt, @Param("now") Instant now);
}
