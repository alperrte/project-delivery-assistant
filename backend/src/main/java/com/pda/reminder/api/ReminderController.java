package com.pda.reminder.api;

import com.pda.reminder.api.dto.request.CreateReminderRequest;
import com.pda.reminder.api.dto.request.UpdateReminderRequest;
import com.pda.reminder.api.dto.response.ReminderResponse;
import com.pda.reminder.application.service.ReminderService;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/reminders")
public class ReminderController {

    private final ReminderService reminders;

    public ReminderController(ReminderService reminders) {
        this.reminders = reminders;
    }

    @GetMapping
    @Operation(summary = "List reminders in a date range",
            description = "Project members only. Returns every PROJECT reminder plus the caller's own PERSONAL ones "
                    + "between from and to (inclusive, a range of at most 93 days).")
    public List<ReminderResponse> list(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                       @PathVariable UUID projectId,
                                       @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                       @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reminders.list(actorId(principal), projectId, from, to).stream().map(ReminderResponse::from).toList();
    }

    @PostMapping
    @Operation(summary = "Create a reminder",
            description = "Project members create PERSONAL reminders (the default). Only PROJECT_MANAGER may create "
                    + "scope PROJECT. Requires CSRF.")
    public ResponseEntity<ReminderResponse> create(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                                   @PathVariable UUID projectId,
                                                   @Valid @RequestBody CreateReminderRequest request) {
        ReminderResponse body = ReminderResponse.from(reminders.create(actorId(principal), projectId,
                request.scope(), request.type(), request.title(), request.description(), request.date(),
                request.time()));
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @GetMapping("/{reminderId}")
    @Operation(summary = "Get a reminder", description = "Project members; someone else's PERSONAL reminder is 404.")
    public ReminderResponse detail(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                   @PathVariable UUID projectId, @PathVariable UUID reminderId) {
        return ReminderResponse.from(reminders.detail(actorId(principal), projectId, reminderId));
    }

    @PatchMapping("/{reminderId}")
    @Operation(summary = "Edit a reminder",
            description = "Replaces title, description, type, date and time. PERSONAL: its creator only. PROJECT: "
                    + "PROJECT_MANAGER only. The scope cannot be changed. Requires CSRF.")
    public ReminderResponse update(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                   @PathVariable UUID projectId, @PathVariable UUID reminderId,
                                   @Valid @RequestBody UpdateReminderRequest request) {
        return ReminderResponse.from(reminders.update(actorId(principal), projectId, reminderId, request.type(),
                request.title(), request.description(), request.date(), request.time()));
    }

    @DeleteMapping("/{reminderId}")
    @Operation(summary = "Delete a reminder",
            description = "PERSONAL: its creator only. PROJECT: PROJECT_MANAGER only. Requires CSRF.")
    @ApiResponse(responseCode = "204", description = "Reminder deleted")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                       @PathVariable UUID projectId, @PathVariable UUID reminderId) {
        reminders.delete(actorId(principal), projectId, reminderId);
        return ResponseEntity.noContent().build();
    }

    private static UUID actorId(UserAccounts.AuthenticatedUser principal) {
        if (principal == null || principal.id() == null) {
            throw new AccessDeniedException("Authentication required");
        }
        return principal.id();
    }
}
