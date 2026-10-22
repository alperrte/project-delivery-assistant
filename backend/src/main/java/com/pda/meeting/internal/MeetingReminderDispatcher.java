package com.pda.meeting.internal;

import com.pda.meeting.MeetingPolicy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailParseException;
import org.springframework.stereotype.Service;

@Service
public class MeetingReminderDispatcher {
    private static final Logger log=LoggerFactory.getLogger(MeetingReminderDispatcher.class);
    private final MeetingReminderStore store;
    private final MeetingReminderMail mail;
    private final MeetingPolicy policy;
    public MeetingReminderDispatcher(MeetingReminderStore store,MeetingReminderMail mail,MeetingPolicy policy) {
        this.store=store; this.mail=mail; this.policy=policy;
    }
    public void dispatch() {
        if(!policy.isEnabled()||!mail.available()) return;
        store.reconcile();
        for(int i=0;i<100&&!Thread.currentThread().isInterrupted();i++) {
            var next=store.claim(); if(next.isEmpty()) return;
            var claim=next.get();
            try {
                var prepared=store.prepare(claim);
                if(prepared.isEmpty()) { store.cancel(claim); continue; }
                try { mail.send(prepared.get()); }
                catch(RuntimeException failure) {
                    boolean permanent=failure instanceof MailAuthenticationException||failure instanceof MailParseException;
                    store.failed(claim,permanent);
                    log.warn("Meeting reminder delivery={} attempt={} outcome={}",claim.id(),claim.attempts(),
                            permanent||claim.attempts()>=MeetingReminderStore.MAX_ATTEMPTS?"FAILED":"RETRY");
                    continue;
                }
                // If this commit fails AFTER SMTP acceptance, retain the lease for at-least-once crash recovery.
                store.sent(claim);
            } catch(RuntimeException persistenceFailure) {
                log.warn("Meeting reminder delivery={} outcome=RECOVERY_REQUIRED",claim.id());
            }
        }
    }
}
