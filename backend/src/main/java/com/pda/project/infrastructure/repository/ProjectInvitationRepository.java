package com.pda.project.infrastructure.repository;

import com.pda.project.domain.entity.ProjectInvitation;
import com.pda.project.domain.enums.InvitationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectInvitationRepository extends JpaRepository<ProjectInvitation, UUID> {

    Optional<ProjectInvitation> findByProjectIdAndInvitedUserIdAndStatus(UUID projectId, UUID invitedUserId,
                                                                         InvitationStatus status);

    Optional<ProjectInvitation> findByProjectIdAndEmailAndStatus(UUID projectId, String email,
                                                                 InvitationStatus status);

    Page<ProjectInvitation> findByProjectIdAndStatus(UUID projectId, InvitationStatus status, Pageable pageable);

    Optional<ProjectInvitation> findByTokenHash(String tokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from ProjectInvitation i where i.tokenHash = :tokenHash")
    Optional<ProjectInvitation> lockByTokenHash(String tokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from ProjectInvitation i where i.id = :id")
    Optional<ProjectInvitation> lockById(UUID id);

    Page<ProjectInvitation> findByInvitedUserId(UUID invitedUserId, Pageable pageable);

    Page<ProjectInvitation> findByProjectId(UUID projectId, Pageable pageable);

    @Query("select i.invitedUserId from ProjectInvitation i where i.projectId = :projectId "
            + "and i.status = com.pda.project.domain.enums.InvitationStatus.PENDING and i.invitedUserId in :userIds")
    List<UUID> findPendingInviteeIds(UUID projectId, Collection<UUID> userIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from ProjectInvitation i where i.projectId = :projectId and i.teamId = :teamId "
            + "and i.status = com.pda.project.domain.enums.InvitationStatus.PENDING")
    List<ProjectInvitation> lockPendingForTeam(UUID projectId, UUID teamId);
}
