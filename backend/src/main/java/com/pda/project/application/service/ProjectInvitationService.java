package com.pda.project.application.service;

import com.pda.project.domain.entity.Project;
import com.pda.project.ProjectInvitationEvents;
import com.pda.project.ProjectInvitationOnboarding;
import com.pda.project.ProjectTeamDirectory;
import com.pda.project.domain.entity.ProjectInvitation;
import com.pda.project.domain.entity.ProjectLogo;
import com.pda.project.domain.entity.ProjectMembership;
import com.pda.project.domain.enums.InvitationStatus;
import com.pda.project.domain.enums.MembershipStatus;
import com.pda.project.domain.enums.ProjectStatus;
import com.pda.project.domain.enums.ProjectType;
import com.pda.user.ProjectPermission;
import com.pda.user.ProjectRole;
import com.pda.user.RolePolicy;
import com.pda.project.infrastructure.repository.ProjectInvitationRepository;
import com.pda.project.infrastructure.repository.ProjectLogoRepository;
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
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Invitation create/resend/cancel/reject (HMZ-PROJ-14), accept-into-membership (HMZ-PROJ-15) and best-effort
 * mail notification on create/resend (HMZ-PROJ-16) use-cases. {@link #accept} mirrors
 * {@link ProjectMembershipService#addMember}'s reactivate-or-create membership logic.
 */
@Service
public class ProjectInvitationService implements ProjectInvitationOnboarding {

    private static final Logger log = LoggerFactory.getLogger(ProjectInvitationService.class);

    static final Duration INVITATION_TTL = Duration.ofDays(7);

    private static final SecureRandom TOKEN_RANDOM = new SecureRandom();

    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;
    private final ProjectInvitationRepository invitations;
    private final ProjectLogoRepository logos;
    private final UserAccounts users;
    private final ObjectProvider<ProjectInvitationMailPort> mailProvider;
    private final Clock clock;
    private final String frontendUrl;
    private final ApplicationEventPublisher events;
    private final ProjectTeamDirectory teams;

    public ProjectInvitationService(ProjectRepository projects, ProjectMembershipRepository memberships,
                                    ProjectInvitationRepository invitations, ProjectLogoRepository logos,
                                    UserAccounts users,
                                    ObjectProvider<ProjectInvitationMailPort> mailProvider, Clock clock,
                                    @Value("${FRONTEND_URL}") String frontendUrl,
                                    ApplicationEventPublisher events, ProjectTeamDirectory teams) {
        this.projects = projects;
        this.memberships = memberships;
        this.invitations = invitations;
        this.logos = logos;
        this.users = users;
        this.mailProvider = mailProvider;
        this.clock = clock;
        this.frontendUrl = frontendUrl;
        this.events = events;
        this.teams = teams;
    }

    /** The raw token is returned exactly once, to be delivered out-of-band (mail, in HMZ-PROJ-16); never persisted. */
    public record CreatedInvitation(ProjectInvitation invitation, String rawToken) {}

    /** Every invitation joins a team; the invitee lands in it when the invitation is accepted. */
    @Transactional
    public CreatedInvitation inviteRegisteredUser(UUID actorId, UUID projectId, UUID targetUserId,
                                                  Set<ProjectRole> roles, String message, UUID teamId) {
        Project project = requireManager(actorId, projectId);
        String teamName = requireActiveTeam(projectId, teamId);
        Objects.requireNonNull(targetUserId, "targetUserId is required");
        if (targetUserId.equals(actorId)) throw new IllegalArgumentException("Cannot invite yourself");
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
        if (invitations.findByProjectIdAndEmailAndStatus(projectId, target.email().strip().toLowerCase(java.util.Locale.ROOT),
                InvitationStatus.PENDING).isPresent()) {
            throw new InvitationConflictException("An invitation is already pending for this email");
        }
        String rawToken = generateToken();
        ProjectInvitation invitation = ProjectInvitation.forRegisteredUser(projectId, targetUserId, actorId,
                roles, message, rawToken, clock.instant().plus(INVITATION_TTL)).inTeam(teamId);
        ProjectInvitation saved = invitations.saveAndFlush(invitation);
        events.publishEvent(new ProjectInvitationEvents.Created(saved.getId(), projectId, targetUserId, actorId));
        sendInvitationMailSafely(target.email(), project.getName(), teamName, saved, rawToken, false);
        return new CreatedInvitation(saved, rawToken);
    }

    @Transactional
    public CreatedInvitation inviteByEmail(UUID actorId, UUID projectId, String email, String firstName,
                                           String lastName, Set<ProjectRole> roles, String message, UUID teamId) {
        Project project = requireManager(actorId, projectId);
        String teamName = requireActiveTeam(projectId, teamId);
        if (email == null || email.isBlank()) throw new IllegalArgumentException("email is required");
        String normalizedEmail = email.strip().toLowerCase(java.util.Locale.ROOT);
        if (normalizedEmail.equals(users.findActiveById(actorId).map(UserAccounts.AuthenticatedUser::email)
                .map(value -> value.toLowerCase(java.util.Locale.ROOT)).orElse(null))) {
            throw new IllegalArgumentException("Cannot invite yourself");
        }
        var registered = users.findActiveByEmail(normalizedEmail);
        if (registered.isPresent()) {
            return inviteRegisteredUser(actorId, projectId, registered.get(), roles, message, teamId);
        }
        if (users.emailExists(normalizedEmail)) {
            throw new InvitationConflictException("Account is not available for invitation");
        }
        if (firstName == null || firstName.isBlank() || lastName == null || lastName.isBlank()) {
            throw new IllegalArgumentException("First and last name are required for an external invitation");
        }
        if (invitations.findByProjectIdAndEmailAndStatus(projectId, normalizedEmail, InvitationStatus.PENDING)
                .isPresent()) throw new InvitationConflictException("An invitation is already pending for this email");
        String rawToken = generateToken();
        ProjectInvitation invitation = ProjectInvitation.forEmail(projectId, normalizedEmail, firstName, lastName,
                actorId, roles, message, rawToken, clock.instant().plus(INVITATION_TTL)).inTeam(teamId);
        ProjectInvitation saved = invitations.saveAndFlush(invitation);
        sendInvitationMailSafely(normalizedEmail, project.getName(), teamName, saved, rawToken, true);
        return new CreatedInvitation(saved, rawToken);
    }

    @Transactional(readOnly = true)
    public Page<InvitationSummary> listPending(UUID actorId, UUID projectId, Pageable pageable) {
        requireManager(actorId, projectId);
        return withNicknames(invitations.findByProjectIdAndStatus(projectId, InvitationStatus.PENDING, pageable));
    }

    /** Project invitation history, optionally narrowed to one status. */
    @Transactional(readOnly = true)
    public Page<InvitationSummary> listProject(UUID actorId, UUID projectId, InvitationStatus status,
                                               Pageable pageable) {
        requireManager(actorId, projectId);
        return withNicknames(status == null ? invitations.findByProjectId(projectId, pageable)
                : invitations.findByProjectIdAndStatus(projectId, status, pageable));
    }

    private Page<InvitationSummary> withNicknames(Page<ProjectInvitation> page) {
        Set<UUID> targetIds = page.getContent().stream().map(ProjectInvitation::getInvitedUserId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, UserAccounts.AuthenticatedUser> targetUsers = users.findActiveByIds(targetIds);
        Map<UUID, String> teamNames = teamNames(page.getContent());
        return page.map(invitation -> InvitationSummary.from(invitation,
                nicknameOf(targetUsers, invitation.getInvitedUserId()),
                invitation.getTeamId() == null ? null : teamNames.get(invitation.getTeamId())));
    }

    /** E-mail invitations have no target account yet, and the lookup maps are immutable (null keys throw). */
    private static String nicknameOf(Map<UUID, UserAccounts.AuthenticatedUser> users, UUID userId) {
        UserAccounts.AuthenticatedUser user = userId == null ? null : users.get(userId);
        return user == null ? null : user.nickname();
    }

    private Map<UUID, String> teamNames(List<ProjectInvitation> page) {
        Set<UUID> teamIds = page.stream().map(ProjectInvitation::getTeamId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        return teamIds.isEmpty() ? Map.of() : teams.teamNames(teamIds);
    }

    @Transactional(readOnly = true)
    public Page<MyInvitationSummary> listMine(UUID actorId, Pageable pageable) {
        Page<ProjectInvitation> page = invitations.findByInvitedUserId(actorId, pageable);
        Map<UUID, Project> projectMap = projects.findAllById(page.getContent().stream()
                .map(ProjectInvitation::getProjectId).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(Project::getId, Function.identity()));
        Map<UUID, UserAccounts.AuthenticatedUser> senders = users.findActiveByIds(page.getContent().stream()
                .map(ProjectInvitation::getInvitedBy).collect(Collectors.toSet()));
        Map<UUID, String> teamNames = teamNames(page.getContent());
        return page.map(invitation -> new MyInvitationSummary(
                InvitationSummary.from(invitation, null,
                        invitation.getTeamId() == null ? null : teamNames.get(invitation.getTeamId())),
                projectMap.containsKey(invitation.getProjectId())
                        ? projectMap.get(invitation.getProjectId()).getName() : null,
                senders.containsKey(invitation.getInvitedBy())
                        ? senders.get(invitation.getInvitedBy()).nickname() : null));
    }

    public record MyInvitationSummary(InvitationSummary invitation, String projectName, String invitedByNickname) {}

    /** Card-level fields only. The recipient may inspect an invitation without becoming a project member. */
    public record InvitationProjectPreview(UUID projectId, String slug, String name, String tagline, String description,
                                           String projectGoal, ProjectStatus status, ProjectType projectType,
                                           String techStack, long memberCount, Instant updatedAt,
                                           Long logoVersion) {}

    @Transactional(readOnly = true)
    public InvitationProjectPreview previewMine(UUID actorId, UUID invitationId) {
        Project project = invitedProject(actorId, invitationId);
        Instant logoUpdatedAt = project.getLogoUpdatedAt();
        return new InvitationProjectPreview(project.getId(), project.getSlug(), project.getName(), project.getTagline(),
                project.getDescription(), project.getProjectGoal(), project.getStatus(), project.getProjectType(),
                project.getTechStack(), memberships.countByProjectIdAndStatus(project.getId(), MembershipStatus.ACTIVE),
                project.getUpdatedAt(), logoUpdatedAt == null ? null : logoUpdatedAt.toEpochMilli());
    }

    @Transactional(readOnly = true)
    public ProjectLogoService.StoredLogo previewLogoMine(UUID actorId, UUID invitationId) {
        Project project = invitedProject(actorId, invitationId);
        ProjectLogo logo = logos.findById(project.getId())
                .orElseThrow(() -> new NoSuchElementException("Project logo not found"));
        return new ProjectLogoService.StoredLogo(logo.getContentType(), logo.getData());
    }

    private Project invitedProject(UUID actorId, UUID invitationId) {
        Objects.requireNonNull(actorId, "actorId is required");
        Objects.requireNonNull(invitationId, "invitationId is required");
        ProjectInvitation invitation = invitations.findById(invitationId)
                .filter(candidate -> actorId.equals(candidate.getInvitedUserId()))
                .orElseThrow(() -> new NoSuchElementException("Invitation not found"));
        return projects.findByIdAndArchivedAtIsNull(invitation.getProjectId())
                .orElseThrow(() -> new NoSuchElementException("Project not found"));
    }

    @Override
    @Transactional(readOnly = true)
    public Preview preview(String token) {
        ProjectInvitation invitation = requireExternalToken(token, false);
        Project project = projects.findByIdAndArchivedAtIsNull(invitation.getProjectId())
                .orElseThrow(() -> new NoSuchElementException("Invitation not found"));
        String inviter = users.findActiveById(invitation.getInvitedBy())
                .map(UserAccounts.AuthenticatedUser::nickname).orElse("PDA");
        return new Preview(project.getName(), inviter, invitation.getInitialRoles(), invitation.getMessage(),
                invitation.getEmail(), invitation.getInviteeFirstName(), invitation.getInviteeLastName(),
                invitation.getExpiresAt(), invitation.getStatus().name(),
                invitation.getTeamId() == null ? null : teams.teamNames(Set.of(invitation.getTeamId()))
                        .get(invitation.getTeamId()));
    }

    @Override
    @Transactional
    public Accepted acceptNewAccount(String token, UUID userId, String email, String firstName, String lastName) {
        ProjectInvitation invitation = requireExternalToken(token, true);
        if (!invitation.matchesIdentity(email, firstName, lastName)) {
            throw new IllegalArgumentException("Invitation identity mismatch");
        }
        return acceptedProject(invitation, acceptExternal(userId, invitation));
    }

    @Override
    @Transactional
    public Accepted acceptExistingAccount(String token, UUID userId) {
        ProjectInvitation invitation = requireExternalToken(token, true);
        String accountEmail = users.findActiveById(userId).map(UserAccounts.AuthenticatedUser::email)
                .orElseThrow(() -> new NoSuchElementException("Account not found"));
        if (!invitation.getEmail().equalsIgnoreCase(accountEmail.strip())) {
            throw new AccessDeniedException("Invitation is addressed to another account");
        }
        return acceptedProject(invitation, acceptExternal(userId, invitation));
    }

    private MemberSummary acceptExternal(UUID userId, ProjectInvitation invitation) {
        UUID projectId = invitation.getProjectId();
        if (projects.findByIdAndArchivedAtIsNull(projectId).isEmpty()) {
            throw new NoSuchElementException("Project not found");
        }
        if (memberships.findByProjectIdAndUserIdAndStatus(projectId, userId, MembershipStatus.ACTIVE).isPresent()) {
            throw new InvitationConflictException("User is already a project member");
        }
        String nickname = users.findActiveById(userId).map(UserAccounts.AuthenticatedUser::nickname)
                .orElseThrow(() -> new NoSuchElementException("Account not found"));
        ProjectMembership membership = memberships.findByProjectIdAndUserId(projectId, userId)
                .map(existing -> { existing.reactivate(invitation.getInitialRoles()); return existing; })
                .orElseGet(() -> ProjectMembership.active(projectId, userId, invitation.getInitialRoles()));
        ProjectMembership saved = memberships.saveAndFlush(membership);
        invitation.accept(clock.instant());
        invitations.saveAndFlush(invitation);
        events.publishEvent(new ProjectInvitationEvents.Accepted(invitation.getId(), projectId, userId,
                invitation.getInvitedBy(), invitation.getTeamId(), saved.getId()));
        return MemberSummary.from(saved, nickname);
    }

    private Accepted acceptedProject(ProjectInvitation invitation, MemberSummary ignored) {
        Project project = projects.findById(invitation.getProjectId()).orElseThrow();
        return new Accepted(project.getId(), project.getSlug());
    }

    private ProjectInvitation requireExternalToken(String token, boolean lock) {
        if (token == null || token.isBlank()) throw new IllegalArgumentException("Token is required");
        String hash = ProjectInvitation.hashToken(token);
        ProjectInvitation invitation = (lock ? invitations.lockByTokenHash(hash) : invitations.findByTokenHash(hash))
                .filter(candidate -> candidate.getInvitedUserId() == null && candidate.matchesToken(token)
                        && candidate.isPending(clock.instant()))
                .orElseThrow(() -> new NoSuchElementException("Invitation not found"));
        return invitation;
    }

    /** Cancels the existing pending invitation and issues a fresh one to the same target with the same roles. */
    @Transactional
    public CreatedInvitation resend(UUID actorId, UUID projectId, UUID invitationId) {
        Project project = requireManager(actorId, projectId);
        ProjectInvitation current = pendingInvitationIn(projectId, invitationId);
        current.cancel(clock.instant());
        invitations.saveAndFlush(current);

        String rawToken = generateToken();
        String teamName = current.getTeamId() == null ? null
                : teams.teamNames(Set.of(current.getTeamId())).get(current.getTeamId());
        ProjectInvitation next = current.getInvitedUserId() == null
                ? ProjectInvitation.forEmail(projectId, current.getEmail(), current.getInviteeFirstName(),
                        current.getInviteeLastName(), actorId, current.getInitialRoles(), current.getMessage(),
                        rawToken, clock.instant().plus(INVITATION_TTL))
                : ProjectInvitation.forRegisteredUser(projectId, current.getInvitedUserId(), actorId,
                        current.getInitialRoles(), current.getMessage(), rawToken, clock.instant().plus(INVITATION_TTL));
        if (current.getTeamId() != null) next.inTeam(current.getTeamId());
        ProjectInvitation saved = invitations.saveAndFlush(next);
        if (saved.getInvitedUserId() != null) events.publishEvent(new ProjectInvitationEvents.Created(
                saved.getId(), projectId, saved.getInvitedUserId(), actorId));

        String recipientEmail = current.getInvitedUserId() == null ? current.getEmail()
                : users.findActiveById(current.getInvitedUserId())
                        .map(UserAccounts.AuthenticatedUser::email).orElse(null);
        if (recipientEmail != null) {
            sendInvitationMailSafely(recipientEmail, project.getName(), teamName, saved, rawToken,
                    saved.getInvitedUserId() == null);
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
        rejectOwned(actorId, invitation, null);
    }

    @Transactional
    public void rejectMine(UUID actorId, UUID invitationId, String message) {
        ProjectInvitation invitation = ownPending(actorId, invitationId);
        rejectOwned(actorId, invitation, message);
    }

    private void rejectOwned(UUID actorId, ProjectInvitation invitation, String message) {
        if (!actorId.equals(invitation.getInvitedUserId()))
            throw new AccessDeniedException("This invitation is not addressed to you");
        invitation.reject(clock.instant(), message);
        invitations.saveAndFlush(invitation);
        events.publishEvent(new ProjectInvitationEvents.Rejected(invitation.getId(), invitation.getProjectId(),
                actorId, invitation.getInvitedBy()));
    }

    /**
     * The invitee accepts (HMZ-PROJ-15): the invitation is marked ACCEPTED and an ACTIVE {@link ProjectMembership}
     * is created (or reactivated, mirroring {@link ProjectMembershipService#addMember}) in the same transaction.
     */
    @Transactional
    public MemberSummary accept(UUID actorId, UUID projectId, UUID invitationId, String rawToken) {
        ProjectInvitation invitation = requireMatchingPendingInvitation(projectId, invitationId, rawToken);
        return acceptOwned(actorId, invitation);
    }

    @Transactional
    public MemberSummary acceptMine(UUID actorId, UUID invitationId) {
        return acceptOwned(actorId, ownPending(actorId, invitationId));
    }

    private MemberSummary acceptOwned(UUID actorId, ProjectInvitation invitation) {
        if (!actorId.equals(invitation.getInvitedUserId()))
            throw new AccessDeniedException("This invitation is not addressed to you");
        UUID projectId = invitation.getProjectId();
        String nickname = users.findActiveById(actorId)
                .map(UserAccounts.AuthenticatedUser::nickname)
                .orElseThrow(() -> new NoSuchElementException("Active user not found"));
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
        events.publishEvent(new ProjectInvitationEvents.Accepted(invitation.getId(), projectId,
                actorId, invitation.getInvitedBy(), invitation.getTeamId(), saved.getId()));
        return MemberSummary.from(saved, nickname);
    }

    private ProjectInvitation ownPending(UUID actorId, UUID invitationId) {
        ProjectInvitation invitation = invitations.lockById(invitationId)
                .filter(candidate -> actorId.equals(candidate.getInvitedUserId()))
                .orElseThrow(() -> new NoSuchElementException("Invitation not found"));
        if (!invitation.isPending(clock.instant())) throw new InvitationConflictException("Invitation is not pending");
        return invitation;
    }

    private ProjectInvitation requireMatchingPendingInvitation(UUID projectId, UUID invitationId, String rawToken) {
        Objects.requireNonNull(projectId, "projectId is required");
        Objects.requireNonNull(invitationId, "invitationId is required");
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("token is required");
        }
        ProjectInvitation invitation = invitations.lockByTokenHash(ProjectInvitation.hashToken(rawToken))
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
        ProjectInvitation invitation = invitations.lockById(invitationId)
                .filter(candidate -> candidate.getProjectId().equals(projectId))
                .orElseThrow(() -> new NoSuchElementException("Invitation not found"));
        if (!invitation.isPending(clock.instant())) {
            throw new IllegalStateException("Invitation is not pending");
        }
        return invitation;
    }

    /** Returns the team name (for the mail); a missing or foreign team is reported as not found. */
    private String requireActiveTeam(UUID projectId, UUID teamId) {
        if (teamId == null) throw new IllegalArgumentException("teamId is required");
        if (!teams.isActiveTeam(projectId, teamId)) throw new NoSuchElementException("Team not found");
        return teams.teamNames(Set.of(teamId)).get(teamId);
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
    private void sendInvitationMailSafely(String recipientEmail, String projectName, String teamName,
                                          ProjectInvitation invitation, String rawToken, boolean external) {
        UUID invitationId = invitation.getId();
        UUID projectId = invitation.getProjectId();
        UUID invitedBy = invitation.getInvitedBy();
        Set<ProjectRole> roles = invitation.getInitialRoles();
        String personalMessage = invitation.getMessage();
        java.time.Instant expiresAt = invitation.getExpiresAt();
        Runnable dispatch = () -> dispatchInvitationMail(recipientEmail, projectName, teamName, invitationId,
                projectId, invitedBy, roles, personalMessage, expiresAt, rawToken, external);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { dispatch.run(); }
            });
        } else {
            dispatch.run();
        }
    }

    private void dispatchInvitationMail(String recipientEmail, String projectName, String teamName,
            UUID invitationId, UUID projectId, UUID invitedBy, Set<ProjectRole> roles, String personalMessage,
            java.time.Instant expiresAt, String rawToken, boolean external) {
        try {
            ProjectInvitationMailPort mail = mailProvider.getIfAvailable();
            if (mail != null && mail.available()) {
                String link = external ? frontendUrl + "/register#invitation=" + rawToken
                        : frontendUrl + "/invitations/" + invitationId + "?projectId=" + projectId
                        + "&token=" + rawToken;
                String inviterName = users.findActiveById(invitedBy)
                        .map(UserAccounts.AuthenticatedUser::nickname).orElse("PDA");
                mail.sendInvitation(recipientEmail, projectName, teamName, inviterName, roles,
                        personalMessage, expiresAt, link);
            }
        } catch (RuntimeException exception) {
            log.warn("Project invitation mail dispatch failed; the invitation itself was still created.");
        }
    }

    private static String generateToken() {
        byte[] bytes = new byte[32];
        TOKEN_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
