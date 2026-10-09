package com.pda.contact.api;

import com.pda.contact.api.dto.request.ContactMessageRequest;
import com.pda.contact.application.service.ContactMessage;
import com.pda.contact.application.service.ContactService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The public contact form. No login is needed; the recipient is server configuration and never a request field. */
@RestController
@RequestMapping("/api/v1/contact")
public class ContactController {

    private final ContactService contact;

    public ContactController(ContactService contact) {
        this.contact = contact;
    }

    public record ContactResponse(String status) {}

    @PostMapping
    @Operation(summary = "Send a message to the PDA team",
            description = "Public with CSRF, rate limited per address (5 per 10 minutes by default), body of at most 16 KB. "
                    + "Fields firstName, lastName, email, message only; any other property is ignored. The mail goes "
                    + "to the fixed configured recipient with the submitter's address as Reply-To and the configured "
                    + "PDA sender as From. Nothing but delivery status and time is stored.")
    @ApiResponse(responseCode = "200", description = "The mail server accepted the message")
    @ApiResponse(responseCode = "400", description = "Invalid fields (code CONTACT_INVALID)")
    @ApiResponse(responseCode = "409", description = "The same message was just sent (code CONTACT_DUPLICATE)")
    @ApiResponse(responseCode = "413", description = "Body larger than 16 KB")
    @ApiResponse(responseCode = "429", description = "Rate limit exceeded")
    @ApiResponse(responseCode = "503", description = "Mail is off (CONTACT_UNAVAILABLE) or delivery failed (CONTACT_DELIVERY_FAILED)")
    public ResponseEntity<ContactResponse> send(@RequestBody ContactMessageRequest request) {
        contact.submit(ContactMessage.validated(request.firstName(), request.lastName(), request.email(),
                request.message()));
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(new ContactResponse("SENT"));
    }
}
