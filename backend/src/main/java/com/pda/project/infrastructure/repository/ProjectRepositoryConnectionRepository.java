package com.pda.project.infrastructure.repository;

import com.pda.project.domain.entity.ProjectRepositoryConnection;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectRepositoryConnectionRepository extends JpaRepository<ProjectRepositoryConnection, UUID> {

    Optional<ProjectRepositoryConnection> findByProjectId(UUID projectId);

    void deleteByProjectId(UUID projectId);

    /**
     * Least recently scanned connections of non-archived projects first (never scanned ones lead). Connections whose
     * commit notifications are switched off are never scanned: nothing would be announced and GitHub is spared.
     */
    @Query("select c from ProjectRepositoryConnection c where c.notifyCommits = true and not exists (select 1 "
            + "from Project p where p.id = c.projectId and p.archivedAt is not null) "
            + "order by c.lastScannedAt asc nulls first")
    List<ProjectRepositoryConnection> findScanCandidates(Pageable pageable);

    /**
     * Claims a tip change: only the caller that moves the marker from {@code oldSha} to {@code newSha} gets 1 and may
     * announce it, so several instances or a repeated scan never notify twice.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update ProjectRepositoryConnection c set c.notifiedHeadSha = :newSha, c.lastScannedAt = :now "
            + "where c.id = :id and c.notifiedHeadSha = :oldSha")
    int claimHead(@Param("id") UUID id, @Param("oldSha") String oldSha, @Param("newSha") String newSha,
                  @Param("now") Instant now);

    /** Writes the very first baseline (nothing to announce); only succeeds while no baseline exists. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update ProjectRepositoryConnection c set c.notifiedHeadSha = :newSha, c.lastScannedAt = :now "
            + "where c.id = :id and c.notifiedHeadSha is null")
    int claimBaseline(@Param("id") UUID id, @Param("newSha") String newSha, @Param("now") Instant now);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update ProjectRepositoryConnection c set c.lastScannedAt = :now where c.id = :id")
    int markScanned(@Param("id") UUID id, @Param("now") Instant now);
}
