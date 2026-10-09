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
import com.pda.contact.infrastructure.repository.ContactRequestRepository;
import java.time.Clock;
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
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-09T10:00:00Z"), ZoneOffset.UTC);
    private final ContactDuplicateGuard guard = new ContactDuplicateGuard(clock);

    @SuppressWarnings("unchecked")
    private ContactService service(ContactMailPort port) {
        ObjectProvider<ContactMailPort> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(port);
        return new ContactService(provider, requests, guard, clock);
    }

    @Test
    void mailThatIsSwitchedOffAnswersUnavailableAndStoresNothing() {
        when(mail.available()).thenReturn(false);
        assertThrows(ContactUnavailableException.class, () -> service(mail).submit(MESSAGE));
        assertThrows(ContactUnavailableException.class, () -> service(null).submit(MESSAGE));
        verify(mail, never()).send(any());
        verify(requests, never()).save(any());
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
