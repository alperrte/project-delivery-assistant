package com.pda.contact.application.service;

import com.pda.contact.application.service.ContactAntiAbuse.Verdict;
import com.pda.contact.application.service.ContactMailPort.ContactDeliveryException;
import com.pda.contact.application.service.ContactMessage.InvalidContactException;
import com.pda.contact.domain.entity.ContactRequest;
import com.pda.contact.domain.entity.SupportRequest;
import com.pda.contact.domain.enums.DeliveryStatus;
import com.pda.contact.infrastructure.repository.ContactRequestRepository;
import com.pda.contact.infrastructure.repository.SupportRequestRepository;
import java.time.Clock;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * Handles a contact-form submission: the bot traps first, then validation, then delivery by mail. The message is kept as a
 * support request (12 months) whether or not the mail server accepted it, so an outage never loses a message; a content-free
 * delivery record is kept for the dashboard as before. The success response is only possible after the mail server accepted
 * the message - except for a bot-like submission, which gets the same answer and is dropped without trace.
 */
@Service
public class ContactService {

    private static final Logger log = LoggerFactory.getLogger(ContactService.class);

    /** Mail is switched off or not configured: nothing can be delivered. */
    public static class ContactUnavailableException extends RuntimeException {
        public ContactUnavailableException() {
            super("Contact mail is unavailable");
        }
    }

    /** The same message from the same address was submitted a moment ago. */
    public static class ContactDuplicateException extends RuntimeException {
        public ContactDuplicateException() {
            super("Duplicate contact message");
        }
    }

    /** The raw form fields, exactly as the browser sent them. */
    public record Submission(String firstName, String lastName, String email, String message,
                             com.pda.contact.SupportCategory category, String website, Long startedAt) {}

    private final ObjectProvider<ContactMailPort> mail;
    private final ContactRequestRepository requests;
    private final SupportRequestRepository supportRequests;
    private final ContactDuplicateGuard duplicates;
    private final ContactAntiAbuse antiAbuse;
    private final Clock clock;

    public ContactService(ObjectProvider<ContactMailPort> mail, ContactRequestRepository requests,
                          SupportRequestRepository supportRequests, ContactDuplicateGuard duplicates,
                          ContactAntiAbuse antiAbuse, Clock clock) {
        this.mail = mail;
        this.requests = requests;
        this.supportRequests = supportRequests;
        this.duplicates = duplicates;
        this.antiAbuse = antiAbuse;
        this.clock = clock;
    }

    /**
     * Validates and delivers one submission. Returns normally for a delivered message and also for a bot-like one (which
     * is not delivered); the caller answers both with the same success body.
     *
     * @throws InvalidContactException a field (or {@code startedAt}) is invalid
     */
    public void submit(Submission form) {
        Verdict verdict = antiAbuse.judge(form.website(), form.startedAt());
        if (verdict == Verdict.BOT) {
            return;
        }
        if (verdict == Verdict.STALE_OR_INVALID_TIMESTAMP) {
            throw new InvalidContactException(List.of("startedAt"));
        }
        submit(ContactMessage.validated(form.firstName(), form.lastName(), form.email(), form.message(),
                form.category()));
    }

    /** Delivers an already validated message. */
    public void submit(ContactMessage message) {
        ContactMailPort port = mail.getIfAvailable();
        if (port == null || !port.available()) {
            throw new ContactUnavailableException();
        }
        String key = ContactDuplicateGuard.keyOf(message);
        if (!duplicates.tryAcquire(key)) {
            throw new ContactDuplicateException();
        }
        try {
            port.send(message);
        } catch (ContactDeliveryException exception) {
            duplicates.release(key);
            record(message, DeliveryStatus.FAILED);
            throw exception;
        }
        record(message, DeliveryStatus.SENT);
    }

    private void record(ContactMessage message, DeliveryStatus status) {
        try {
            requests.save(ContactRequest.of(status, clock.instant()));
        } catch (RuntimeException exception) {
            // The message is already delivered (or the failure already reported); only the counter is lost.
            log.warn("Could not record the contact delivery status {}.", status);
        }
        try {
            supportRequests.save(SupportRequest.received(message.category(), message.firstName(), message.lastName(),
                    message.email(), message.message(), status, clock.instant()));
        } catch (RuntimeException exception) {
            // Nothing about the message is logged.
            log.warn("Could not store the support request (delivery {}).", status);
        }
    }
}
