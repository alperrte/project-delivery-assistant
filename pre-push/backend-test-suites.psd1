@{
    # Package ownership is recursive. New tests in these packages join automatically.
    Modules = @('task', 'meeting', 'squad', 'notification', 'project', 'auth', 'user', 'admin', 'chat', 'analytics', 'contact', 'reminder', 'shared', 'migration', 'architecture', 'backend')
    Baseline = @('com.pda.architecture.ModularityTest', 'com.pda.auth.api.SecurityBaselineTest')
    SupportClasses = @('com.pda.backend.TestBackendApplication', 'com.pda.backend.TestcontainersConfiguration', 'com.pda.shared.TestImages', 'com.pda.shared.testing.TestPostgres')
    ExpectedSkips = @('com.pda.meeting.media.LiveKitRealSmokeTest')
    # These shared infrastructure changes need all backend consumers, not a small sample.
    RequireAll = @('shared-service', 'migration-service', 'architecture-service', 'backend-service')
    Related = @{
        'task-service' = @(
            'com.pda.notification.TaskStatusNotificationFactoryTest', 'com.pda.notification.NotificationIntegrationTest',
            'com.pda.shared.FileSystemMediaStorageTest', 'com.pda.shared.ImageSnifferTest'
        )
        'meeting-service' = @(
            'com.pda.notification.MeetingHttpSecurityTest', 'com.pda.notification.MeetingNotificationFactoryTest',
            'com.pda.notification.MeetingNotificationIntegrationTest', 'com.pda.notification.MeetingPublicationRecoveryTest',
            'com.pda.auth.infrastructure.config.MeetingProxyRateLimitTest', 'com.pda.migration.MeetingReminderMigrationTest',
            'com.pda.migration.MeetingV55MigrationTest', 'com.pda.migration.MeetingV56MigrationTest'
        )
        'squad-service' = @(
            'com.pda.notification.TeamDeletionNotificationFactoryTest', 'com.pda.notification.TeamDeletionNotificationIntegrationTest',
            'com.pda.notification.TeamDeletionPublicationRecoveryTest', 'com.pda.notification.NotificationIntegrationTest',
            'com.pda.project.integration.ProblemDetailShapeApiIntegrationTest', 'com.pda.project.application.ProjectInvitationServiceTest'
        )
        'notification-service' = @(
            'com.pda.task.TaskProgressNotificationApiIntegrationTest', 'com.pda.task.TaskPoolAndMyTasksApiIntegrationTest',
            'com.pda.meeting.internal.MeetingCoreIntegrationTest', 'com.pda.squad.application.TeamDeletionConcurrencyTest'
        )
        'project-service' = @(
            'com.pda.notification.InvitationNotificationContextFactoryTest', 'com.pda.notification.NotificationIntegrationTest',
            'com.pda.notification.RepositoryCommitScanIntegrationTest', 'com.pda.migration.ProjectTypesMigrationTest',
            'com.pda.migration.LogoShapeMigrationTest', 'com.pda.shared.SmtpMailSettingsTest'
        )
        'auth-service' = @(
            'com.pda.user.application.UserSessionTest', 'com.pda.user.application.RolePolicyTest', 'com.pda.user.repository.UserPersistenceTest',
            'com.pda.admin.integration.AdminAuthMigrationTest', 'com.pda.admin.integration.RetentionJobsIntegrationTest',
            'com.pda.chat.infrastructure.websocket.ChatSocketRegistryTest', 'com.pda.chat.integration.ChatWebSocketIntegrationTest',
            'com.pda.shared.StrongPasswordValidatorTest', 'com.pda.shared.SmtpMailSettingsTest'
        )
        'user-service' = @(
            'com.pda.auth.integration.RefreshAndSessionsIntegrationTest', 'com.pda.auth.integration.SessionExpiryIntegrationTest',
            'com.pda.auth.integration.AccountDeletionIntegrationTest', 'com.pda.migration.NavbarPreferenceMigrationTest',
            'com.pda.migration.LanguageTransitionPreferenceMigrationTest'
        )
        'admin-service' = @(
            'com.pda.auth.integration.AdminAuthIntegrationTest', 'com.pda.auth.integration.AdminAuthHardeningIntegrationTest',
            'com.pda.user.application.RolePolicyTest', 'com.pda.contact.application.service.SupportRequestPreviewTest'
        )
        'chat-service' = @(
            'com.pda.migration.CentralChatMigrationTest', 'com.pda.auth.application.JwtTokensTest',
            'com.pda.user.application.UserSessionTest', 'com.pda.shared.ImageSnifferTest'
        )
        'analytics-service' = @(
            'com.pda.admin.integration.AdminAnalyticsIntegrationTest', 'com.pda.admin.integration.SupportAuditAnalyticsMigrationTest',
            'com.pda.admin.integration.RetentionJobsIntegrationTest'
        )
        'contact-service' = @(
            'com.pda.shared.SmtpMailSettingsTest', 'com.pda.admin.integration.AdminOperationsIntegrationTest',
            'com.pda.admin.integration.SupportAuditAnalyticsMigrationTest', 'com.pda.admin.integration.RetentionJobsIntegrationTest'
        )
        'reminder-service' = @('com.pda.shared.ScheduledJobRegistryTest')
        'migration-service' = @('com.pda.admin.integration.AdminAuthMigrationTest', 'com.pda.admin.integration.SupportAuditAnalyticsMigrationTest')
    }
}
