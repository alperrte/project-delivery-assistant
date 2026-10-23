package com.pda.meeting.internal;

import com.pda.project.ProjectAccess;
import com.pda.user.UserAccounts;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;

/** Short database transactions; no network mail call takes place under a database lock. */
@Service
public class MeetingReminderStore {
    public static final int MAX_ATTEMPTS = 8;
    private final JdbcTemplate db;
    private final MeetingRepository meetings;
    private final ProjectAccess projects;
    private final UserAccounts users;
    private final MeetingParticipantRepository participants;
    private final Clock clock;

    public MeetingReminderStore(JdbcTemplate db, MeetingRepository meetings, ProjectAccess projects,
            UserAccounts users, MeetingParticipantRepository participants, Clock clock) {
        this.db=db; this.meetings=meetings; this.projects=projects; this.users=users; this.participants=participants; this.clock=clock;
    }

    @Transactional
    public void reconcile() {
        Timestamp now=Timestamp.from(clock.instant());
        // Bounded restart recovery also discovers pre-migration meetings. Conflict protection spans all replicas.
        db.update("""
            INSERT INTO meeting_reminder_deliveries
                (id,meeting_id,recipient_user_id,reminder_revision,reminder_at,next_attempt_at,created_at)
            SELECT gen_random_uuid(),m.id,r.user_id,m.reminder_revision,m.starts_at-interval '1 hour',
                greatest(m.starts_at-interval '1 hour',?),?
            FROM meetings m CROSS JOIN LATERAL
                (SELECT m.organizer_id AS user_id UNION SELECT a.user_id FROM meeting_attendees a WHERE a.meeting_id=m.id) r
            WHERE m.status='SCHEDULED' AND m.starts_at>?
                AND NOT EXISTS (SELECT 1 FROM meeting_reminder_deliveries d WHERE d.meeting_id=m.id
                    AND d.recipient_user_id=r.user_id AND d.reminder_revision=m.reminder_revision)
            ORDER BY m.starts_at,m.id,r.user_id LIMIT 500
            ON CONFLICT (meeting_id,recipient_user_id,reminder_revision) DO NOTHING
            """,now,now,now);
        db.update("""
            WITH stale AS (
                SELECT d.id FROM meeting_reminder_deliveries d JOIN meetings m ON m.id=d.meeting_id
                WHERE (d.status IN ('PENDING','RETRY') OR (d.status='SENDING' AND d.lease_until<=?))
                    AND (m.status<>'SCHEDULED' OR m.starts_at<=? OR m.reminder_revision<>d.reminder_revision
                        OR (m.organizer_id<>d.recipient_user_id AND NOT EXISTS
                            (SELECT 1 FROM meeting_attendees a WHERE a.meeting_id=m.id AND a.user_id=d.recipient_user_id)))
                ORDER BY d.id LIMIT 500 FOR UPDATE OF d SKIP LOCKED
            ) UPDATE meeting_reminder_deliveries SET status='CANCELLED',claim_token=NULL,lease_until=NULL,
                error_code='NO_LONGER_ELIGIBLE' WHERE id IN (SELECT id FROM stale)
            """,now,now);
        int exhausted=db.update("""
            UPDATE meeting_reminder_deliveries SET status='FAILED',claim_token=NULL,lease_until=NULL,
                error_code='ATTEMPTS_EXHAUSTED' WHERE status='SENDING' AND lease_until<=? AND attempts>=8
            """,now);
        if(exhausted>0) org.slf4j.LoggerFactory.getLogger(getClass()).warn("Meeting reminder recovery exhausted count={}",exhausted);
    }

    @Transactional
    public Optional<Claim> claim() {
        Instant now=clock.instant(); UUID token=UUID.randomUUID();
        var rows=db.query("""
            WITH candidate AS (
                SELECT id FROM meeting_reminder_deliveries
                WHERE attempts<8 AND ((status IN ('PENDING','RETRY') AND next_attempt_at<=?)
                    OR (status='SENDING' AND lease_until<=?))
                ORDER BY next_attempt_at,id LIMIT 1 FOR UPDATE SKIP LOCKED
            ) UPDATE meeting_reminder_deliveries d SET status='SENDING',attempts=attempts+1,
                last_attempt_at=?,claim_token=?,lease_until=? FROM candidate c WHERE d.id=c.id
            RETURNING d.id,d.meeting_id,d.recipient_user_id,d.reminder_revision,d.attempts
            """,(rs,n)->new Claim(rs.getObject(1,UUID.class),rs.getObject(2,UUID.class),rs.getObject(3,UUID.class),
                rs.getLong(4),rs.getInt(5),token),Timestamp.from(now),Timestamp.from(now),Timestamp.from(now),token,Timestamp.from(now.plusSeconds(120)));
        return rows.stream().findFirst();
    }

    @Transactional(readOnly=true)
    public Optional<Envelope> prepare(Claim claim) { return Optional.ofNullable(inspect(claim).envelope()); }

    /**
     * Why a recipient is (not) eligible, evaluated once for both sending and recording a skip. Checks run in a fixed order and the
     * first failing one names the reason, so a skipped teammate is visible in the delivery row instead of silently disappearing.
     */
    private Inspection inspect(Claim claim) {
        Instant now=clock.instant();
        if(!Boolean.TRUE.equals(db.queryForObject("""
            SELECT EXISTS(SELECT 1 FROM meeting_reminder_deliveries WHERE id=? AND status='SENDING'
                AND claim_token=? AND lease_until>?)
            """,Boolean.class,claim.id(),claim.token(),Timestamp.from(now)))) return Inspection.skip("NO_LONGER_ELIGIBLE");
        var m=meetings.findById(claim.meetingId()).orElse(null);
        if(m==null||m.status!=Meeting.Status.SCHEDULED||m.reminderRevision!=claim.revision()
                ||!m.startsAt.isAfter(now)||m.startsAt.minusSeconds(3600).isAfter(now)) return Inspection.skip("NO_LONGER_ELIGIBLE");
        if(!m.organizerId.equals(claim.recipientId())&&!m.attendeeIds.contains(claim.recipientId())) return Inspection.skip("REMOVED_FROM_MEETING");
        var project=projects.taskContext(m.projectId);
        if(project==null||project.archived()) return Inspection.skip("PROJECT_UNAVAILABLE");
        if(!projects.isMember(m.projectId,claim.recipientId())) return Inspection.skip("NOT_A_PROJECT_MEMBER");
        if(participants.findByMeetingIdAndIdentity(m.id,"user-"+claim.recipientId()).map(p->p.revoked).orElse(false)) return Inspection.skip("REMOVED_FROM_MEETING");
        return users.findVerifiedMailRecipient(claim.recipientId()).map(recipient->new Inspection(new Envelope(m.id,project.slug(),
                m.title,m.startsAt,m.zoneId,users.findActiveById(m.organizerId).map(UserAccounts.AuthenticatedUser::nickname).orElse("PDA"),recipient),null))
            .orElseGet(()->Inspection.skip("RECIPIENT_UNAVAILABLE"));
    }
    private record Inspection(Envelope envelope,String reason) { static Inspection skip(String reason) { return new Inspection(null,reason); } }

    /** Records a skipped recipient together with the reason (no address, no names: only the delivery id and a code are logged). */
    @Transactional
    public void cancel(Claim claim) {
        String reason=inspect(claim).reason(); if(reason==null) reason="NO_LONGER_ELIGIBLE";
        org.slf4j.LoggerFactory.getLogger(getClass()).info("Meeting reminder delivery={} skipped reason={}",claim.id(),reason);
        finish(claim,"CANCELLED",null,reason,clock.instant());
    }
    @Transactional
    public void sent(Claim claim) { finish(claim,"SENT",clock.instant(),null,clock.instant()); }
    @Transactional
    public void failed(Claim claim,boolean permanent) {
        boolean terminal=permanent||claim.attempts()>=MAX_ATTEMPTS;
        finish(claim,terminal?"FAILED":"RETRY",null,permanent?"SMTP_PERMANENT":terminal?"ATTEMPTS_EXHAUSTED":"SMTP_TEMPORARY",
                clock.instant().plusSeconds(Math.min(900,30L << Math.min(claim.attempts()-1,5))));
    }
    private void finish(Claim claim,String status,Instant sentAt,String error,Instant next) {
        db.update("""
            UPDATE meeting_reminder_deliveries SET status=?,sent_at=?,error_code=?,next_attempt_at=?,
                claim_token=NULL,lease_until=NULL WHERE id=? AND status='SENDING' AND claim_token=?
            """,status,sentAt==null?null:Timestamp.from(sentAt),error,Timestamp.from(next),claim.id(),claim.token());
    }
    public record Claim(UUID id,UUID meetingId,UUID recipientId,long revision,int attempts,UUID token) {}
    public record Envelope(UUID meetingId,String projectSlug,String title,Instant startsAt,String zoneId,
                           String organizer,UserAccounts.MailRecipient recipient) {}
}
