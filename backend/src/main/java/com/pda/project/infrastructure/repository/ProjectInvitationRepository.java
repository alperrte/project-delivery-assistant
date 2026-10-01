package com.pda.project.infrastructure.repository;

import com.pda.project.domain.entity.ProjectInvitation;
import com.pda.project.domain.enums.InvitationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

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
}
