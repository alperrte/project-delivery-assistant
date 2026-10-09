package com.pda.contact.application.service;

/** Outgoing mail for the contact form. The recipient is part of the adapter's configuration, never of the message. */
public interface ContactMailPort {

    /** False when mail is switched off or not configured. */
    boolean available();

    /** Delivers the message to the configured recipient with the submitter's address as Reply-To. */
    void send(ContactMessage message) throws ContactDeliveryException;

    /** The mail server did not accept the message. Carries no server detail on purpose. */
    class ContactDeliveryException extends RuntimeException {
        public ContactDeliveryException(Throwable cause) {
            super("Contact message could not be delivered", cause);
        }
    }
}
