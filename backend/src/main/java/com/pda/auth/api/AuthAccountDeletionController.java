package com.pda.auth.api;

import com.pda.auth.api.dto.request.AccountDeletionRequestBody;
import com.pda.auth.api.dto.request.ConfirmAccountDeletionRequest;
import com.pda.auth.application.service.AccountDeletionService;
import com.pda.auth.application.service.MailLocale;
import com.pda.auth.infrastructure.config.AuthCookies;
import com.pda.project.ProjectOwnership;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Account deletion in two steps: a signed-in user asks for a confirmation mail, and the mailed link opens a public page
 * that deletes the account once the user has entered the email, the password and, if on, the authenticator code.
 */
@RestController
@RequestMapping("/api/v1/auth/account/deletion")
public class AuthAccountDeletionController {

    private final AccountDeletionService deletion;
    private final AuthCookies cookies;

    public AuthAccountDeletionController(AccountDeletionService deletion, AuthCookies cookies) {
        this.deletion = deletion;
        this.cookies = cookies;
    }

    public record OwnedResponse(String kind, String id, String name, String slug) {}

    @PostMapping("/request")
    @Operation(summary = "Mail me the account deletion link",
            description = "Requires a valid access cookie and CSRF. Mails a single-use link (valid 15 minutes) to the account address in the site language; nothing is deleted yet. A repeat inside 60 seconds is ignored.")
    @ApiResponse(responseCode = "202", description = "The mail was sent")
    @ApiResponse(responseCode = "403", description = "administrator_cannot_delete: platform administrators cannot delete their account")
    @ApiResponse(responseCode = "409", description = "owns_resources: hand over or delete the listed projects and organizations first")
    @ApiResponse(responseCode = "503", description = "Mail is not available")
    public ResponseEntity<Object> request(@Valid @RequestBody(required = false) AccountDeletionRequestBody body,
                                          @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        AccountDeletionService.Requested result = deletion.request(principal.id(),
                MailLocale.from(body == null ? null : body.locale()));
        return switch (result.outcome()) {
            case SENT -> ResponseEntity.accepted().header("Cache-Control", "no-store").build();
            case OWNS_RESOURCES -> ownsResources(result.owned());
            case ADMINISTRATOR -> administrator();
            case ACCOUNT_UNAVAILABLE -> problem(HttpStatus.UNAUTHORIZED, "account_unavailable", "Account is unavailable");
        };
    }

    @PostMapping("/confirm")
    @Operation(summary = "Delete my account with the mailed link",
            description = "Public with CSRF: the token from the mailed link is the proof of the mailbox, the email and password (accounts without a password need only the email) prove the person, and an authenticator or backup code is added when two-factor is on. On success the account is anonymised for good and the cookies are cleared. Five wrong confirmations cancel the link.")
    @ApiResponse(responseCode = "204", description = "The account was deleted")
    @ApiResponse(responseCode = "400", description = "deletion_link_invalid, deletion_link_expired, deletion_credentials_invalid or two_factor_code_invalid")
    @ApiResponse(responseCode = "403", description = "two_factor_required (send the code) or administrator_cannot_delete")
    @ApiResponse(responseCode = "409", description = "owns_resources: hand over or delete the listed projects and organizations first")
    @ApiResponse(responseCode = "429", description = "two_factor_locked")
    public ResponseEntity<Object> confirm(@Valid @RequestBody ConfirmAccountDeletionRequest request,
                                          HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        AccountDeletionService.Confirmed result = deletion.confirm(
                request.token(), request.email(), request.password(), request.code());
        return switch (result.outcome()) {
            case DELETED -> {
                cookies.clear(servletRequest, servletResponse);
                yield ResponseEntity.noContent().header("Cache-Control", "no-store").build();
            }
            case INVALID_LINK -> problem(HttpStatus.BAD_REQUEST, "deletion_link_invalid",
                    "The deletion link is not valid anymore");
            case EXPIRED -> problem(HttpStatus.BAD_REQUEST, "deletion_link_expired", "The deletion link has expired");
            case CREDENTIALS_INVALID -> problem(HttpStatus.BAD_REQUEST, "deletion_credentials_invalid",
                    "The email or password is not correct");
            case TWO_FACTOR_REQUIRED -> problem(HttpStatus.FORBIDDEN, "two_factor_required",
                    "Enter the code from your authenticator app");
            case TWO_FACTOR_INVALID -> problem(HttpStatus.BAD_REQUEST, "two_factor_code_invalid",
                    "The code is not valid");
            case TWO_FACTOR_LOCKED -> problem(HttpStatus.TOO_MANY_REQUESTS, "two_factor_locked",
                    "Too many wrong codes; try again in 15 minutes");
            case OWNS_RESOURCES -> ownsResources(result.owned());
            case ADMINISTRATOR -> administrator();
        };
    }

    private static ResponseEntity<Object> administrator() {
        return problem(HttpStatus.FORBIDDEN, "administrator_cannot_delete",
                "Platform administrator accounts cannot be deleted");
    }

    private static ResponseEntity<Object> ownsResources(List<ProjectOwnership.OwnedResource> owned) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "Hand over or delete your projects and organizations first");
        body.setProperty("code", "owns_resources");
        body.setProperty("owned", owned.stream().map(resource -> new OwnedResponse(resource.kind().name(),
                resource.id().toString(), resource.name(), resource.slug())).toList());
        return ResponseEntity.status(HttpStatus.CONFLICT).header("Cache-Control", "no-store").body(body);
    }

    private static ResponseEntity<Object> problem(HttpStatus status, String code, String detail) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setProperty("code", code);
        return ResponseEntity.status(status).header("Cache-Control", "no-store").body(body);
    }
}
