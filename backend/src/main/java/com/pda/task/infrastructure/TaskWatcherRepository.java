package com.pda.task.infrastructure;

import com.pda.task.domain.TaskWatcher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface TaskWatcherRepository extends JpaRepository<TaskWatcher, TaskWatcher.Key> {
    List<TaskWatcher> findByTaskId(UUID taskId);
    boolean existsByTaskIdAndUserId(UUID taskId, UUID userId);

    @Query("select w from TaskWatcher w where w.taskId in :taskIds and w.userId = :userId")
    List<TaskWatcher> findByTaskIdsAndUser(@Param("taskIds") Collection<UUID> taskIds, @Param("userId") UUID userId);

    /** Idempotent: a repeated watch is a no-op. Returns 1 when the watcher was added. */
    @Modifying
    @Query(value = "insert into task_watchers (task_id, user_id, created_at) values (:taskId, :userId, now()) "
            + "on conflict do nothing", nativeQuery = true)
    int watch(@Param("taskId") UUID taskId, @Param("userId") UUID userId);

    @Modifying
    @Query(value = "insert into task_watchers (task_id,user_id,created_at,manual_watch) values (:taskId,:userId,now(),true) "
            + "on conflict (task_id,user_id) do update set manual_watch = true", nativeQuery = true)
    int watchManually(@Param("taskId") UUID taskId, @Param("userId") UUID userId);

    @Modifying
    @Query("delete from TaskWatcher w where w.taskId = :taskId and w.userId = :userId")
    int unwatch(@Param("taskId") UUID taskId, @Param("userId") UUID userId);

    @Modifying
    @Query("delete from TaskWatcher w where w.userId = :userId and w.taskId in "
            + "(select t.id from Task t where t.projectId = :projectId)")
    int deleteByProjectAndUser(@Param("projectId") UUID projectId, @Param("userId") UUID userId);
}
