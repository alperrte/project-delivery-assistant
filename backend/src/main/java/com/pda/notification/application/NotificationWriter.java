package com.pda.notification.application;

import com.pda.notification.domain.*;
import com.pda.notification.infrastructure.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

@Service
public class NotificationWriter {
    private final NotificationRepository repository;
    private final NotificationFactory factory;
    public NotificationWriter(NotificationRepository repository, NotificationFactory factory) {
        this.repository = repository; this.factory = factory;
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void save(UUID recipient, UUID actor, UUID project, ResourceType resourceType, UUID resource,
                     NotificationType type) {
        if (recipient != null && !recipient.equals(actor))
            repository.save(factory.create(recipient, actor, project, resourceType, resource, type));
    }
}
