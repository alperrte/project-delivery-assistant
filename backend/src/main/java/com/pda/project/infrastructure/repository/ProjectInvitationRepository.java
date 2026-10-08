package com.pda.project.infrastructure.repository;

import com.pda.project.domain.entity.ProjectInvitation;
import com.pda.project.domain.enums.InvitationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectInvitationRepository extends JpaRepository<ProjectInvitation, UUID> {
    @Query("select i.projectId from ProjectInvitation i where i.tokenHash = :hash")
    Optional<UUID> projectIdByTokenHash(String hash);

    @Query("select i.projectId from ProjectInvitation i where i.id = :id and i.invitedUserId = :recipient")
    Optional<UUID> projectIdByRecipient(UUID id, UUID recipient);

    Optional<ProjectInvitation> findByProjectIdAndInvitedUserIdAndStatus(UUID projectId, UUID invitedUserId,
                                                                         InvitationStatus status);

    Optional<ProjectInvitation> findByProjectIdAndEmailAndStatus(UUID projectId, String email,
                                                                 InvitationStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from ProjectInvitation i where i.projectId=:projectId and i.invitedUserId=:userId "
            + "and i.status=com.pda.project.domain.enums.InvitationStatus.PENDING")
    Optional<ProjectInvitation> lockPendingUser(UUID projectId, UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from ProjectInvitation i where i.projectId=:projectId and lower(i.email)=:email "
            + "and i.status=com.pda.project.domain.enums.InvitationStatus.PENDING")
    Optional<ProjectInvitation> lockPendingEmail(UUID projectId, String email);

    Page<ProjectInvitation> findByProjectIdAndStatusAndExpiresAtAfter(UUID projectId, InvitationStatus status,
                                                                     Instant now, Pageable pageable);

    @Query("select i from ProjectInvitation i where i.projectId=:projectId and "
            + "(i.status=com.pda.project.domain.enums.InvitationStatus.EXPIRED or "
            + "(i.status=com.pda.project.domain.enums.InvitationStatus.PENDING and i.expiresAt<=:now))")
    Page<ProjectInvitation> findExpiredInProject(UUID projectId, Instant now, Pageable pageable);

    Page<ProjectInvitation> findByProjectIdAndStatus(UUID projectId, InvitationStatus status, Pageable pageable);

    Optional<ProjectInvitation> findByTokenHash(String tokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from ProjectInvitation i where i.tokenHash = :tokenHash")
    Optional<ProjectInvitation> lockByTokenHash(String tokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from ProjectInvitation i where i.id = :id")
    Optional<ProjectInvitation> lockById(UUID id);

    Page<ProjectInvitation> findByInvitedUserId(UUID invitedUserId, Pageable pageable);

    /** The recipient's live pending invitations in active projects; the same predicate serves page totals. */
    @Query("select i from ProjectInvitation i where i.invitedUserId=:invitedUserId and i.status=:status "
            + "and i.expiresAt>:now and exists (select p.id from Project p "
            + "where p.id=i.projectId and p.archivedAt is null)")
    Page<ProjectInvitation> findByInvitedUserIdAndStatusAndExpiresAtAfter(UUID invitedUserId, InvitationStatus status,
                                                                          Instant now, Pageable pageable);

    Page<ProjectInvitation> findByProjectId(UUID projectId, Pageable pageable);

    @Query("select i.invitedUserId from ProjectInvitation i where i.projectId = :projectId "
            + "and i.status = com.pda.project.domain.enums.InvitationStatus.PENDING and i.expiresAt > :now "
            + "and i.invitedUserId in :userIds")
    List<UUID> findPendingInviteeIds(UUID projectId, Collection<UUID> userIds, Instant now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from ProjectInvitation i where i.projectId = :projectId and i.teamId = :teamId "
            + "and i.status = com.pda.project.domain.enums.InvitationStatus.PENDING")
    List<ProjectInvitation> lockPendingForTeam(UUID projectId, UUID teamId);
}
