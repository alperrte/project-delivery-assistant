package com.pda.project.application.service;

import com.pda.project.domain.entity.Project;
import com.pda.project.domain.entity.ProjectInvitation;
import com.pda.project.domain.entity.ProjectMembership;
import com.pda.project.domain.enums.InvitationStatus;
import com.pda.project.domain.enums.MembershipStatus;
import com.pda.user.ProjectPermission;
import com.pda.user.ProjectRole;
import com.pda.user.RolePolicy;
import com.pda.project.infrastructure.repository.ProjectInvitationRepository;
import com.pda.project.infrastructure.repository.ProjectMembershipRepository;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.user.UserAccounts;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Invitation create/resend/cancel/reject (HMZ-PROJ-14), accept-into-membership (HMZ-PROJ-15) and best-effort
 * mail notification on create/resend (HMZ-PROJ-16) use-cases. {@link #accept} mirrors
 * {@link ProjectMembershipService#addMember}'s reactivate-or-create membership logic.
 */
@Service
public class ProjectInvitationService {

    private static final Logger log = LoggerFactory.getLogger(ProjectInvitationService.class);

    static final Duration INVITATION_TTL = Duration.ofDays(7);

    private static final SecureRandom TOKEN_RANDOM = new SecureRandom();

    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;
    private final ProjectInvitationRepository invitations;
    private final UserAccounts users;
    private final ObjectProvider<ProjectInvitationMailPort> mailProvider;
    private final Clock clock;
    private final String frontendUrl;

    public ProjectInvitationService(ProjectRepository projects, ProjectMembershipRepository memberships,
                                    ProjectInvitationRepository invitations, UserAccounts users,
                                    ObjectProvider<ProjectInvitationMailPort> mailProvider, Clock clock,
                                    @Value("${FRONTEND_URL}") String frontendUrl) {
        this.projects = projects;
        this.memberships = memberships;
        this.invitations = invitations;
        this.users = users;
        this.mailProvider = mailProvider;
        this.clock = clock;
        this.frontendUrl = frontendUrl;
    }

    /** The raw token is returned exactly once, to be delivered out-of-band (mail, in HMZ-PROJ-16); never persisted. */
    public record CreatedInvitation(ProjectInvitation invitation, String rawToken) {}

    @Transactional
    public CreatedInvitation inviteRegisteredUser(UUID actorId, UUID projectId, UUID targetUserId,
                                                  Set<ProjectRole> roles) {
        Project project = requireManager(actorId, projectId);
        Objects.requireNonNull(targetUserId, "targetUserId is required");
        UserAccounts.AuthenticatedUser target = users.findActiveById(targetUserId)
                .orElseThrow(() -> new NoSuchElementException("Active user not found"));
        if (memberships.findByProjectIdAndUserIdAndStatus(projectId, targetUserId, MembershipStatus.ACTIVE)
                .isPresent()) {
            throw new InvitationConflictException("User is already a project member");
        }
        if (invitations.findByProjectIdAndInvitedUserIdAndStatus(projectId, targetUserId, InvitationStatus.PENDING)
                .isPresent()) {
            throw new InvitationConflictException("An invitation is already pending for this user");
        }
        String rawToken = generateToken();
        ProjectInvitation invitation = ProjectInvitation.forRegisteredUser(projectId, targetUserId, actorId,
                roles, rawToken, clock.instant().plus(INVITATION_TTL));
        ProjectInvitation saved = invitations.saveAndFlush(invitation);
        sendInvitationMailSafely(target.email(), project.getName(), projectId, saved.getId(), rawToken);
        return new CreatedInvitation(saved, rawToken);
    }

    @Transactional
    public CreatedInvitation inviteByEmail(UUID actorId, UUID projectId, String email, Set<ProjectRole> roles) {
        Project project = requireManager(actorId, projectId);
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("email is required");
        }
        String normalized = email.strip();
        if (invitations.findByProjectIdAndEmailAndStatus(projectId, normalized, InvitationStatus.PENDING)
                .isPresent()) {
            throw new InvitationConflictException("An invitation is already pending for this email");
        }
        String rawToken = generateToken();
        ProjectInvitation invitation = ProjectInvitation.forEmail(projectId, normalized, actorId, roles,
                rawToken, clock.instant().plus(INVITATION_TTL));
        ProjectInvitation saved = invitations.saveAndFlush(invitation);
        sendInvitationMailSafely(normalized, project.getName(), projectId, saved.getId(), rawToken);
        return new CreatedInvitation(saved, rawToken);
    }

    @Transactional(readOnly = true)
    public Page<InvitationSummary> listPending(UUID actorId, UUID projectId, Pageable pageable) {
        requireManager(actorId, projectId);
        return invitations.findByProjectIdAndStatus(projectId, InvitationStatus.PENDING, pageable)
                .map(InvitationSummary::from);
    }

    /** Cancels the existing pending invitation and issues a fresh one to the same target with the same roles. */
    @Transactional
    public CreatedInvitation resend(UUID actorId, UUID projectId, UUID invitationId) {
        Project project = requireManager(actorId, projectId);
        ProjectInvitation current = pendingInvitationIn(projectId, invitationId);
        current.cancel(clock.instant());
        invitations.saveAndFlush(current);

        String rawToken = generateToken();
        boolean registeredTarget = current.getInvitedUserId() != null;
        ProjectInvitation next = registeredTarget
                ? ProjectInvitation.forRegisteredUser(projectId, current.getInvitedUserId(), actorId,
                        current.getInitialRoles(), rawToken, clock.instant().plus(INVITATION_TTL))
                : ProjectInvitation.forEmail(projectId, current.getEmail(), actorId,
                        current.getInitialRoles(), rawToken, clock.instant().plus(INVITATION_TTL));
        ProjectInvitation saved = invitations.saveAndFlush(next);

        String recipientEmail = registeredTarget
                ? users.findActiveById(current.getInvitedUserId()).map(UserAccounts.AuthenticatedUser::email)
                        .orElse(null)
                : current.getEmail();
        if (recipientEmail != null) {
            sendInvitationMailSafely(recipientEmail, project.getName(), projectId, saved.getId(), rawToken);
        }
        return new CreatedInvitation(saved, rawToken);
    }

    @Transactional
    public void cancel(UUID actorId, UUID projectId, UUID invitationId) {
        requireManager(actorId, projectId);
        ProjectInvitation invitation = pendingInvitationIn(projectId, invitationId);
        invitation.cancel(clock.instant());
        invitations.saveAndFlush(invitation);
    }

    /** The invitee declines. Anyone holding a valid token may act, except a registered-user target must match. */
    @Transactional
    public void reject(UUID actorId, UUID projectId, UUID invitationId, String rawToken) {
        ProjectInvitation invitation = requireMatchingPendingInvitation(projectId, invitationId, rawToken);
        if (invitation.getInvitedUserId() != null && !invitation.getInvitedUserId().equals(actorId)) {
            throw new AccessDeniedException("This invitation is not addressed to you");
        }
        invitation.reject(clock.instant());
        invitations.saveAndFlush(invitation);
    }

    /**
     * The invitee accepts (HMZ-PROJ-15): the invitation is marked ACCEPTED and an ACTIVE {@link ProjectMembership}
     * is created (or reactivated, mirroring {@link ProjectMembershipService#addMember}) in the same transaction.
     */
    @Transactional
    public MemberSummary accept(UUID actorId, UUID projectId, UUID invitationId, String rawToken) {
        ProjectInvitation invitation = requireMatchingPendingInvitation(projectId, invitationId, rawToken);
        if (invitation.getInvitedUserId() != null && !invitation.getInvitedUserId().equals(actorId)) {
            throw new AccessDeniedException("This invitation is not addressed to you");
        }
        if (users.findActiveById(actorId).isEmpty()) {
            throw new NoSuchElementException("Active user not found");
        }
        ProjectMembership membership = memberships.findByProjectIdAndUserId(projectId, actorId)
                .map(existing -> {
                    if (existing.getStatus() == MembershipStatus.ACTIVE) {
                        throw new InvitationConflictException("User is already a project member");
                    }
                    existing.reactivate(invitation.getInitialRoles());
                    return existing;
                })
                .orElseGet(() -> ProjectMembership.active(projectId, actorId, invitation.getInitialRoles()));
        ProjectMembership saved = memberships.saveAndFlush(membership);
        invitation.accept(clock.instant());
        invitations.saveAndFlush(invitation);
        return MemberSummary.from(saved);
    }

    private ProjectInvitation requireMatchingPendingInvitation(UUID projectId, UUID invitationId, String rawToken) {
        Objects.requireNonNull(projectId, "projectId is required");
        Objects.requireNonNull(invitationId, "invitationId is required");
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("token is required");
        }
        ProjectInvitation invitation = invitations.findByTokenHash(ProjectInvitation.hashToken(rawToken))
                .filter(candidate -> candidate.matchesToken(rawToken))
                .filter(candidate -> candidate.getProjectId().equals(projectId)
                        && candidate.getId().equals(invitationId))
                .orElseThrow(() -> new NoSuchElementException("Invitation not found"));
        if (!invitation.isPending(clock.instant())) {
            throw new IllegalStateException("Invitation is not pending");
        }
        return invitation;
    }

    private ProjectInvitation pendingInvitationIn(UUID projectId, UUID invitationId) {
        Objects.requireNonNull(invitationId, "invitationId is required");
        ProjectInvitation invitation = invitations.findById(invitationId)
                .filter(candidate -> candidate.getProjectId().equals(projectId))
                .orElseThrow(() -> new NoSuchElementException("Invitation not found"));
        if (!invitation.isPending(clock.instant())) {
            throw new IllegalStateException("Invitation is not pending");
        }
        return invitation;
    }

    private Project requireManager(UUID actorId, UUID projectId) {
        Objects.requireNonNull(actorId, "actorId is required");
        Objects.requireNonNull(projectId, "projectId is required");
        Project project = projects.findByIdAndArchivedAtIsNull(projectId)
                .orElseThrow(() -> new NoSuchElementException("Project not found"));
        ProjectMembership membership = memberships.findByProjectIdAndUserIdAndStatus(projectId, actorId,
                        MembershipStatus.ACTIVE)
                .orElseThrow(() -> new AccessDeniedException("Project access denied"));
        if (!RolePolicy.allows(membership.getRoles(), ProjectPermission.MEMBER_MANAGE)) {
            throw new AccessDeniedException("Project management denied");
        }
        return project;
    }

    /**
     * Best-effort: resolved lazily via {@link ObjectProvider} (not a plain constructor dependency) so that this
     * service's own instantiation never forces {@code SmtpProjectInvitationMailAdapter}'s constructor to run — that
     * constructor fails fast on an incomplete SMTP_* config, which must never happen merely because some other,
     * unrelated flow enabled MAIL_ENABLED. Any failure here (missing config, transport error) is swallowed: mail
     * being disabled or broken must never break the invitation flow itself.
     */
    private void sendInvitationMailSafely(String recipientEmail, String projectName, UUID projectId,
                                          UUID invitationId, String rawToken) {
        try {
            ProjectInvitationMailPort mail = mailProvider.getIfAvailable();
            if (mail != null && mail.available()) {
                String link = frontendUrl + "/invitations/" + invitationId + "?projectId=" + projectId
                        + "&token=" + rawToken;
                mail.sendInvitation(recipientEmail, projectName, link);
            }
        } catch (RuntimeException exception) {
            log.warn("Project invitation mail dispatch failed; the invitation itself was still created.", exception);
        }
    }

    private static String generateToken() {
        byte[] bytes = new byte[32];
        TOKEN_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
