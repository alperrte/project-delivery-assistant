package com.pda.auth.application.service;

public interface VerificationMailPort {
    boolean available();

    /** Registration: the code that proves the mailbox belongs to the new account. */
    void sendVerificationCode(String recipientEmail, String code, MailLocale locale);

    /** Same transport as {@link #sendVerificationCode}, a distinct template for a password-reset code. */
    void sendPasswordResetCode(String recipientEmail, String code, MailLocale locale);

    /** Account settings: the code that opens the change-password form. */
    void sendPasswordChangeCode(String recipientEmail, String code, MailLocale locale);

    /** Account deletion: a mail with a confirmation link instead of a code. {@code link} is built by the server. */
    void sendAccountDeletionLink(String recipientEmail, String link, MailLocale locale);
}
