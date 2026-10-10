package com.pda.contact.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.pda.contact.application.service.ContactMailPort.ContactDeliveryException;
import com.pda.contact.application.service.ContactService.ContactDuplicateException;
import com.pda.contact.application.service.ContactService.ContactUnavailableException;
import com.pda.contact.domain.entity.ContactRequest;
import com.pda.contact.domain.enums.DeliveryStatus;
import com.pda.contact.SupportCategory;
import com.pda.contact.SupportStatus;
import com.pda.contact.domain.entity.SupportRequest;
import com.pda.contact.infrastructure.repository.ContactRequestRepository;
import com.pda.contact.infrastructure.repository.SupportRequestRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;

class ContactServiceTest {

    private static final ContactMessage MESSAGE =
            ContactMessage.validated("Ece", "Yıldız", "ece@example.com", "Merhaba, bir sorum var.");

    private final ContactMailPort mail = mock(ContactMailPort.class);
    private final ContactRequestRepository requests = mock(ContactRequestRepository.class);
    private final SupportRequestRepository supportRequests = mock(SupportRequestRepository.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-09T10:00:00Z"), ZoneOffset.UTC);
    private final ContactDuplicateGuard guard = new ContactDuplicateGuard(clock);

    @SuppressWarnings("unchecked")
    private ContactService service(ContactMailPort port) {
        ObjectProvider<ContactMailPort> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(port);
        return new ContactService(provider, requests, supportRequests, guard,
                new ContactAntiAbuse(clock, Duration.ofSeconds(3), Duration.ofHours(24), false), clock);
    }

    @Test
    void mailThatIsSwitchedOffAnswersUnavailableAndStoresNothing() {
        when(mail.available()).thenReturn(false);
        assertThrows(ContactUnavailableException.class, () -> service(mail).submit(MESSAGE));
        assertThrows(ContactUnavailableException.class, () -> service(null).submit(MESSAGE));
        verify(mail, never()).send(any());
        verify(requests, never()).save(any());
        verify(supportRequests, never()).save(any());
    }

    @Test
    void aDeliveredMessageIsStoredAsASupportRequestWithItsCategoryAndOptionalLastName() {
        when(mail.available()).thenReturn(true);
        service(mail).submit(ContactMessage.validated("Ece", null, "ece@example.com", "Merhaba, bir sorum var.",
                SupportCategory.BUG));
        ArgumentCaptor<SupportRequest> saved = ArgumentCaptor.forClass(SupportRequest.class);
        verify(supportRequests).save(saved.capture());
        assertEquals(SupportCategory.BUG, saved.getValue().getCategory());
        assertEquals("Ece", saved.getValue().getFirstName());
        assertEquals(null, saved.getValue().getLastName());
        assertEquals("ece@example.com", saved.getValue().getEmail());
        assertEquals("Merhaba, bir sorum var.", saved.getValue().getMessage());
        assertEquals(SupportStatus.NEW, saved.getValue().getStatus());
        assertEquals(DeliveryStatus.SENT, saved.getValue().getDeliveryStatus());
        assertEquals(clock.instant(), saved.getValue().getStatusChangedAt());
    }

    @Test
    void aBotLikeSubmissionIsNeitherMailedNorStoredAndNeverFails() {
        when(mail.available()).thenReturn(true);
        long now = clock.instant().toEpochMilli();
        ContactService service = service(mail);
        // Filled honeypot, and a form sent one second after it was shown: same quiet return as a real message.
        service.submit(new ContactService.Submission("Bot", "Y", "bot@example.com", "Ucuz saat satiyorum burada.",
                SupportCategory.GENERAL, "http://spam.example", now - 60_000));
        service.submit(new ContactService.Submission("Bot", "Y", "bot@example.com", "Ucuz saat satiyorum burada.",
                SupportCategory.GENERAL, "", now - 1_000));
        // Even an invalid body gets no 400 from a bot (the traps run before validation).
        service.submit(new ContactService.Submission("", "", "nope", "x", null, "x", now));
        verify(mail, never()).send(any());
        verify(requests, never()).save(any());
        verify(supportRequests, never()).save(any());
    }

    @Test
    void aSlowEnoughHumanSubmissionIsDelivered() {
        when(mail.available()).thenReturn(true);
        long now = clock.instant().toEpochMilli();
        service(mail).submit(new ContactService.Submission("Ece", "", "ece@example.com", "Merhaba, bir sorum var.",
                null, "", now - 10_000));
        verify(mail).send(any());
        verify(supportRequests).save(any());
    }

    @Test
    void aStaleOrFutureTimestampIsAnInvalidFieldNotASilentDrop() {
        when(mail.available()).thenReturn(true);
        long now = clock.instant().toEpochMilli();
        for (long startedAt : new long[] {now - 25L * 3_600_000, now + 10L * 60_000, -1}) {
            var thrown = assertThrows(ContactMessage.InvalidContactException.class, () -> service(mail).submit(
                    new ContactService.Submission("Ece", "", "ece@example.com", "Merhaba, bir sorum var.", null, "",
                            startedAt)));
            assertEquals(java.util.List.of("startedAt"), thrown.fields());
        }
        verify(mail, never()).send(any());
    }

    @Test
    void aDeliveredMessageIsRecordedAsSentWithoutAnyContent() {
        when(mail.available()).thenReturn(true);
        service(mail).submit(MESSAGE);
        verify(mail).send(MESSAGE);
        ArgumentCaptor<ContactRequest> saved = ArgumentCaptor.forClass(ContactRequest.class);
        verify(requests).save(saved.capture());
        assertEquals(DeliveryStatus.SENT, saved.getValue().getDeliveryStatus());
        assertEquals(clock.instant(), saved.getValue().getCreatedAt());
    }

    @Test
    void theSameMessageFromTheSameAddressTwiceInAMinuteIsADuplicate() {
        when(mail.available()).thenReturn(true);
        ContactService service = service(mail);
        service.submit(MESSAGE);
        assertThrows(ContactDuplicateException.class, () -> service.submit(MESSAGE));
        // The address is compared case-insensitively; another message or another address is fine.
        assertThrows(ContactDuplicateException.class, () -> service.submit(
                ContactMessage.validated("X", "Y", "ECE@example.com", "Merhaba, bir sorum var.")));
        service.submit(ContactMessage.validated("Ece", "Yıldız", "ece@example.com", "Bambaşka bir mesaj yazıyorum."));
        service.submit(ContactMessage.validated("Ece", "Yıldız", "baska@example.com", "Merhaba, bir sorum var."));
        verify(mail, times(3)).send(any());
    }

    @Test
    void aFailedDeliveryIsRecordedAsFailedAndMayBeRetriedAtOnce() {
        when(mail.available()).thenReturn(true);
        doThrow(new ContactDeliveryException(new RuntimeException("smtp down"))).when(mail).send(any());
        ContactService service = service(mail);
        assertThrows(ContactDeliveryException.class, () -> service.submit(MESSAGE));
        ArgumentCaptor<ContactRequest> saved = ArgumentCaptor.forClass(ContactRequest.class);
        verify(requests).save(saved.capture());
        assertEquals(DeliveryStatus.FAILED, saved.getValue().getDeliveryStatus());
        // The message is kept (marked FAILED) so the outage does not lose it.
        ArgumentCaptor<SupportRequest> stored = ArgumentCaptor.forClass(SupportRequest.class);
        verify(supportRequests).save(stored.capture());
        assertEquals(DeliveryStatus.FAILED, stored.getValue().getDeliveryStatus());
        // The failure released the duplicate lock, so the same message is tried again instead of answering 409.
        assertThrows(ContactDeliveryException.class, () -> service.submit(MESSAGE));
    }

    @Test
    void duplicateGuardForgetsAfterTheWindow() {
        ContactDuplicateGuard first = new ContactDuplicateGuard(clock);
        String key = ContactDuplicateGuard.keyOf(MESSAGE);
        assertTrue(first.tryAcquire(key));
        assertFalse(first.tryAcquire(key));
        ContactDuplicateGuard later = new ContactDuplicateGuard(Clock.fixed(clock.instant().plusSeconds(61), ZoneOffset.UTC));
        assertTrue(later.tryAcquire(key));
    }
}
