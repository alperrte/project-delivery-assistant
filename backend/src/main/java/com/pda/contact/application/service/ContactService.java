package com.pda.contact.application.service;

import com.pda.contact.application.service.ContactMailPort.ContactDeliveryException;
import com.pda.contact.domain.entity.ContactRequest;
import com.pda.contact.domain.enums.DeliveryStatus;
import com.pda.contact.infrastructure.repository.ContactRequestRepository;
import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * Sends a validated contact message to the configured inbox and keeps a delivery record (no content). The success
 * response is only possible after the mail server accepted the message.
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

    private final ObjectProvider<ContactMailPort> mail;
    private final ContactRequestRepository requests;
    private final ContactDuplicateGuard duplicates;
    private final Clock clock;

    public ContactService(ObjectProvider<ContactMailPort> mail, ContactRequestRepository requests,
                          ContactDuplicateGuard duplicates, Clock clock) {
        this.mail = mail;
        this.requests = requests;
        this.duplicates = duplicates;
        this.clock = clock;
    }

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
            record(DeliveryStatus.FAILED);
            throw exception;
        }
        record(DeliveryStatus.SENT);
    }

    private void record(DeliveryStatus status) {
        try {
            requests.save(ContactRequest.of(status, clock.instant()));
        } catch (RuntimeException exception) {
            // The message is already delivered (or the failure already reported); only the counter is lost.
            log.warn("Could not record the contact delivery status {}.", status);
        }
    }
}
