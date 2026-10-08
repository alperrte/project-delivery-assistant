package com.pda.project.api;

import com.pda.project.application.service.GitHubIntegrationException;
import com.pda.project.application.service.InvitationConflictException;
import com.pda.project.application.service.MembershipConflictException;
import com.pda.project.application.service.PrivateRepositoryException;
import com.pda.project.application.service.RepositoryAdvancedRequiredException;
import com.pda.project.application.service.RepositoryReadLimitException;
import com.pda.project.application.service.ProjectBannerException;
import com.pda.project.application.service.ProjectLogoException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import java.util.List;
import java.util.NoSuchElementException;

@RestControllerAdvice(basePackages = "com.pda.project")
public class ProjectApiErrorHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> invalidFields(MethodArgumentNotValidException exception) {
        List<String> fields = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField())
                .distinct()
                .sorted()
                .toList();
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Invalid request fields");
        body.setProperty("invalidFields", fields);
        return ResponseEntity.badRequest().header("Cache-Control", "no-store").body(body);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class, IllegalArgumentException.class})
    ResponseEntity<ProblemDetail> invalidInput() {
        return problem(HttpStatus.BAD_REQUEST, "Invalid request");
    }

    @ExceptionHandler(com.pda.project.organization.application.OrganizationMediaException.class)
    ResponseEntity<ProblemDetail> organizationMedia(com.pda.project.organization.application.OrganizationMediaException exception) {
        HttpStatus status = exception.code().endsWith("UNAVAILABLE") ? HttpStatus.SERVICE_UNAVAILABLE
                : exception.code().endsWith("CONFLICT") ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;
        ProblemDetail body=ProblemDetail.forStatusAndDetail(status,"Organization media request failed");
        body.setProperty("code",exception.code());
        return ResponseEntity.status(status).header("Cache-Control","no-store").body(body);
    }

    @ExceptionHandler(ProjectLogoException.class)
    ResponseEntity<ProblemDetail> invalidLogo(ProjectLogoException exception) {
        return imageProblem("Invalid project logo", exception.code());
    }

    @ExceptionHandler(ProjectBannerException.class)
    ResponseEntity<ProblemDetail> invalidBanner(ProjectBannerException exception) {
        return imageProblem("Invalid project banner", exception.code());
    }

    /** The servlet multipart limit trips before the service can measure the file. */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ProblemDetail> imageTooLarge(HttpServletRequest request) {
        if (request.getRequestURI().startsWith("/api/v1/organizations/"))
            return imageProblem("Invalid organization image", "ORGANIZATION_MEDIA_TOO_LARGE");
        return isBanner(request)
                ? imageProblem("Invalid project banner", ProjectBannerException.TOO_LARGE)
                : imageProblem("Invalid project logo", ProjectLogoException.TOO_LARGE);
    }

    @ExceptionHandler({MissingServletRequestPartException.class, MultipartException.class})
    ResponseEntity<ProblemDetail> missingImagePart(HttpServletRequest request) {
        if (request.getRequestURI().startsWith("/api/v1/organizations/"))
            return imageProblem("Invalid organization image", "ORGANIZATION_MEDIA_EMPTY");
        return isBanner(request)
                ? imageProblem("Invalid project banner", ProjectBannerException.EMPTY)
                : imageProblem("Invalid project logo", ProjectLogoException.EMPTY);
    }

    private static boolean isBanner(HttpServletRequest request) {
        return request.getRequestURI().endsWith("/banner");
    }

    @ExceptionHandler(NoSuchElementException.class)
    ResponseEntity<ProblemDetail> notFound() {
        return problem(HttpStatus.NOT_FOUND, "Resource not found");
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ProblemDetail> forbidden() {
        return problem(HttpStatus.FORBIDDEN, "Access denied");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ProblemDetail> conflict() {
        return problem(HttpStatus.CONFLICT, "Resource conflicts with existing data");
    }

    @ExceptionHandler(IllegalStateException.class)
    ResponseEntity<ProblemDetail> illegalState() {
        return problem(HttpStatus.CONFLICT, "Membership change conflicts with project rules");
    }

    @ExceptionHandler(com.pda.project.domain.exception.ProjectTaskModeConflictException.class)
    ResponseEntity<ProblemDetail> archivedTaskPolicy() {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "Project is archived");
        body.setProperty("code", "PROJECT_ARCHIVED");
        return ResponseEntity.status(HttpStatus.CONFLICT).header("Cache-Control", "no-store").body(body);
    }

    @ExceptionHandler(MembershipConflictException.class)
    ResponseEntity<ProblemDetail> membershipConflict(MembershipConflictException exception) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "Membership change conflicts with project rules");
        if (exception.code() != null) body.setProperty("code", exception.code());
        return ResponseEntity.status(HttpStatus.CONFLICT).header("Cache-Control", "no-store").body(body);
    }

    @ExceptionHandler(InvitationConflictException.class)
    ResponseEntity<ProblemDetail> invitationConflict() {
        return problem(HttpStatus.CONFLICT, "Invitation conflicts with existing project rules");
    }

    /** Never forwards GitHub's own response body/message; only the safe, pre-classified reason. */
    @ExceptionHandler(GitHubIntegrationException.class)
    ResponseEntity<ProblemDetail> gitHubIntegration(GitHubIntegrationException exception) {
        return switch (exception.getReason()) {
            case NOT_FOUND -> problem(HttpStatus.NOT_FOUND, "GitHub repository not found");
            case RATE_LIMITED -> problem(HttpStatus.TOO_MANY_REQUESTS, "GitHub rate limit reached");
            case UNAVAILABLE -> problem(HttpStatus.SERVICE_UNAVAILABLE, "GitHub is currently unavailable");
        };
    }

    /** The caller's own read budget (not GitHub's) is spent: retry after the window slides. */
    @ExceptionHandler(RepositoryReadLimitException.class)
    ResponseEntity<ProblemDetail> repositoryReadLimit() {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.TOO_MANY_REQUESTS,
                "Too many repository requests");
        body.setProperty("code", "REPOSITORY_READ_LIMIT");
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).header("Cache-Control", "no-store")
                .header("Retry-After", "60").body(body);
    }

    @ExceptionHandler(PrivateRepositoryException.class)
    ResponseEntity<ProblemDetail> privateRepository() {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Only public repositories can be connected");
        body.setProperty("code", PrivateRepositoryException.CODE);
        return ResponseEntity.badRequest().header("Cache-Control", "no-store").body(body);
    }

    /** Branch-level reads need the advanced mode; the client switches the mode instead of retrying. */
    @ExceptionHandler(RepositoryAdvancedRequiredException.class)
    ResponseEntity<ProblemDetail> repositoryAdvancedRequired() {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "Branch details need the advanced repository mode");
        body.setProperty("code", RepositoryAdvancedRequiredException.CODE);
        return ResponseEntity.status(HttpStatus.CONFLICT).header("Cache-Control", "no-store").body(body);
    }

    private static ResponseEntity<ProblemDetail> imageProblem(String detail, String code) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, detail);
        body.setProperty("code", code);
        return ResponseEntity.badRequest().header("Cache-Control", "no-store").body(body);
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String detail) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        return ResponseEntity.status(status).header("Cache-Control", "no-store").body(body);
    }
}
