package com.pda.auth.application.service;

import com.pda.audit.AdminAuditLog;
import com.pda.audit.AuditAction;
import com.pda.audit.AuditOutcome;
import com.pda.audit.AuditTargetType;
import com.pda.auth.application.service.LocalLoginService.LoginTokens;
import com.pda.auth.domain.entity.AdminAuthTicket;
import com.pda.auth.domain.entity.AdminAuthTicket.Purpose;
import com.pda.auth.infrastructure.repository.AdminAuthTicketRepository;
import com.pda.user.GlobalRole;
import com.pda.user.UserAccounts;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The separate administrator sign-in. An administrator never gets a session from the password alone: a correct password
 * only yields a single-use ticket, and a session (the only kind the administrator API accepts) is opened after a
 * current authenticator code, or after the first authenticator code of an enrolment. Every refusal for "no such
 * account", "wrong password", "not an administrator" and "disabled" is the same {@link InvalidCredentialsException}.
 *
 * <p>Log lines carry the account id and the outcome only, never an email, password, secret, code or token. The final
 * result of every sign-in attempt is also written to the persistent audit trail ({@code ADMIN_SIGN_IN}): SUCCESS when a
 * verified session opened, FAILURE for wrong credentials, a wrong code or a bad ticket, DENIED when the account is locked
 * or two-factor is unavailable. The actor id is recorded only when the account is known; never an email.
 */
@Service
public class AdminAuthService {

    public static final String MFA_TOKEN_USE = "admin_mfa";
    public static final String ENROLL_TOKEN_USE = "admin_enroll";
    public static final Duration MFA_LIFETIME = Duration.ofMinutes(5);
    public static final Duration ENROLL_LIFETIME = Duration.ofMinutes(10);
    private static final Duration KEEP_EXPIRED = Duration.ofDays(1);
    private static final Logger log = LoggerFactory.getLogger(AdminAuthService.class);

    private final UserAccounts users;
    private final TotpService twoFactor;
    private final LocalLoginService login;
    private final JwtTokens tokens;
    private final AdminAuthTicketRepository tickets;
    private final AdminAuditLog audit;
    private final Clock clock;

    public AdminAuthService(UserAccounts users, TotpService twoFactor, LocalLoginService login, JwtTokens tokens,
                            AdminAuthTicketRepository tickets, AdminAuditLog audit, Clock clock) {
        this.users = users;
        this.twoFactor = twoFactor;
        this.login = login;
        this.tokens = tokens;
        this.tickets = tickets;
        this.audit = audit;
        this.clock = clock;
    }

    public enum NextStep { SECOND_FACTOR, ENROLLMENT }

    /** What the password step produced: the ticket to hand out as a cookie and the step the client must show next. */
    public record FirstFactor(NextStep step, JwtTokens.IssuedToken ticket) {}

    public record Enrolled(TotpService.Result result, List<String> recoveryCodes, LoginTokens tokens) {}

    public record SignedIn(TotpService.Result result, LoginTokens tokens) {}

    /**
     * The password step. Fails closed with {@link TwoFactorUnavailableException} when no encryption key is configured
     * (checked first, so the answer reveals nothing about the account).
     */
    @Transactional
    public FirstFactor login(String email, String password) {
        if (!twoFactor.available()) {
            log.warn("Administrator sign-in unavailable: two-factor encryption key is not configured.");
            auditSignIn(null, AuditOutcome.DENIED);
            throw new TwoFactorUnavailableException();
        }
        UserAccounts.AuthenticatedUser admin = users.authenticateLocal(email, password)
                .filter(user -> GlobalRole.ADMIN.name().equals(user.globalRole()))
                .orElse(null);
        if (admin == null) {
            log.warn("Administrator sign-in rejected: credentials or account not eligible.");
            auditSignIn(null, AuditOutcome.FAILURE);
            throw new InvalidCredentialsException();
        }
        boolean enrolled = twoFactor.isEnabled(admin.id());
        Purpose purpose = enrolled ? Purpose.ADMIN_MFA : Purpose.ADMIN_ENROLL;
        JwtTokens.IssuedToken ticket = issueTicket(admin.id(), purpose);
        NextStep step = enrolled ? NextStep.SECOND_FACTOR : NextStep.ENROLLMENT;
        log.info("Administrator password accepted. userId={} next={}", admin.id(), step);
        return new FirstFactor(step, ticket);
    }

    /** Starts (or restarts) the enrolment; the secret is returned to this caller only. Does not use up the ticket. */
    @Transactional
    public TotpService.Setup beginEnrollment(String ticketCookie) {
        Verified verified = verify(ticketCookie, Purpose.ADMIN_ENROLL).orElseThrow(AdminTicketException::new);
        TotpService.Setup setup = twoFactor.beginSetup(verified.user().id(), verified.user().email())
                .orElseThrow(AdminTicketException::new);
        log.info("Administrator authenticator enrolment started. userId={}", verified.user().id());
        return setup;
    }

    /**
     * The first authenticator code. Right: two-factor is on, the ticket is used up and a verified session opens. Wrong
     * or locked: nothing changes (two-factor stays off, the ticket stays usable until it expires).
     */
    @Transactional
    public Enrolled completeEnrollment(String ticketCookie, String code, String userAgent) {
        Verified verified = verify(ticketCookie, Purpose.ADMIN_ENROLL).orElseThrow(AdminTicketException::new);
        UUID userId = verified.user().id();
        TotpService.Enabled enabled = twoFactor.enable(userId, code);
        if (enabled.result() != TotpService.Result.OK) {
            log.warn("Administrator authenticator enrolment code rejected. userId={} result={}", userId, enabled.result());
            auditSignIn(userId, outcomeOf(enabled.result()));
            return new Enrolled(enabled.result(), List.of(), null);
        }
        consume(verified.ticketId());
        LoginTokens opened = login.openAdminSession(userId, userAgent);
        log.info("Administrator authenticator enrolled; verified session opened. userId={}", userId);
        auditSignIn(userId, AuditOutcome.SUCCESS);
        return new Enrolled(TotpService.Result.OK, enabled.recoveryCodes(), opened);
    }

    /** The authenticator (or backup) code of a regular administrator sign-in. */
    @Transactional
    public SignedIn completeSignIn(String ticketCookie, String code, String userAgent) {
        Verified verified = verify(ticketCookie, Purpose.ADMIN_MFA).orElseThrow(AdminTicketException::new);
        UUID userId = verified.user().id();
        TotpService.Result result = twoFactor.verify(userId, code);
        if (result != TotpService.Result.OK) {
            log.warn("Administrator second factor rejected. userId={} result={}", userId, result);
            auditSignIn(userId, outcomeOf(result));
            return new SignedIn(result, null);
        }
        consume(verified.ticketId());
        LoginTokens opened = login.openAdminSession(userId, userAgent);
        log.info("Administrator signed in with the second factor; verified session opened. userId={}", userId);
        auditSignIn(userId, AuditOutcome.SUCCESS);
        return new SignedIn(TotpService.Result.OK, opened);
    }

    private JwtTokens.IssuedToken issueTicket(UUID userId, Purpose purpose) {
        Instant now = clock.instant();
        Duration lifetime = purpose == Purpose.ADMIN_MFA ? MFA_LIFETIME : ENROLL_LIFETIME;
        tickets.deleteExpiredBefore(now.minus(KEEP_EXPIRED));
        // Only the newest password step counts: an older ticket of this account stops working.
        tickets.deleteAllOf(userId);
        AdminAuthTicket row = tickets.saveAndFlush(AdminAuthTicket.issue(userId, purpose, now, now.plus(lifetime)));
        return tokens.issueTicket(userId, tokenUse(purpose), row.getId().toString(), lifetime);
    }

    private Optional<Verified> verify(String cookieValue, Purpose purpose) {
        Instant now = clock.instant();
        Optional<Verified> verified = tokens.parseTicket(cookieValue, tokenUse(purpose))
                .flatMap(ticket -> uuid(ticket.ref())
                        .flatMap(tickets::findById)
                        .filter(row -> row.getUserId().equals(ticket.userId()) && row.getPurpose() == purpose
                                && row.isUsable(now))
                        .flatMap(row -> users.findActiveById(row.getUserId())
                                .filter(user -> GlobalRole.ADMIN.name().equals(user.globalRole()))
                                .filter(user -> purpose != Purpose.ADMIN_ENROLL || !twoFactor.isEnabled(user.id()))
                                .map(user -> new Verified(row.getId(), user))));
        if (verified.isEmpty()) {
            log.warn("Administrator sign-in ticket rejected: missing, expired, used or not valid for this step.");
            auditSignIn(null, AuditOutcome.FAILURE);
        }
        return verified;
    }

    /** One sign-in result in the audit trail; the account is its own target. Written even when this transaction rolls back. */
    private void auditSignIn(UUID userId, AuditOutcome outcome) {
        audit.record(AuditAction.ADMIN_SIGN_IN, userId, userId == null ? AuditTargetType.SYSTEM : AuditTargetType.USER,
                userId, outcome);
    }

    private static AuditOutcome outcomeOf(TotpService.Result result) {
        return switch (result) {
            case OK -> AuditOutcome.SUCCESS;
            case INVALID -> AuditOutcome.FAILURE;
            case LOCKED -> AuditOutcome.DENIED;
        };
    }

    /** Exactly one caller can use a ticket up; a concurrent second use rolls the whole sign-in back. */
    private void consume(UUID ticketId) {
        if (tickets.consume(ticketId, clock.instant()) != 1) {
            throw new AdminTicketException();
        }
    }

    private static String tokenUse(Purpose purpose) {
        return purpose == Purpose.ADMIN_MFA ? MFA_TOKEN_USE : ENROLL_TOKEN_USE;
    }

    private static Optional<UUID> uuid(String text) {
        try {
            return text == null ? Optional.empty() : Optional.of(UUID.fromString(text));
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    private record Verified(UUID ticketId, UserAccounts.AuthenticatedUser user) {}
}
