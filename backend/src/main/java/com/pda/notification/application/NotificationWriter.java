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
    public void saveStatusChanged(UUID recipient, UUID actor, UUID project, UUID task, TaskStatusChange change) {
        if (recipient != null && !recipient.equals(actor))
            repository.save(factory.statusChanged(recipient, actor, project, task, change));
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveRepositoryCommits(UUID recipient, UUID project, RepositoryCommits commits) {
        if (recipient != null) repository.save(factory.repositoryCommits(recipient, project, commits));
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveInvitation(UUID recipient, UUID actor, UUID project, UUID invitation,
                               NotificationType type, String projectName) {
        if (recipient != null && !recipient.equals(actor))
            repository.save(factory.invitation(recipient, actor, project, invitation, type, projectName));
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void save(UUID recipient, UUID actor, UUID project, ResourceType resourceType, UUID resource,
                     NotificationType type) {
        if (recipient != null && !recipient.equals(actor))
            repository.save(factory.create(recipient, actor, project, resourceType, resource, type));
    }
}
