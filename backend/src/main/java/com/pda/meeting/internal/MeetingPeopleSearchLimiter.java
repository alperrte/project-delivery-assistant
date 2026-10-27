package com.pda.meeting.internal;

import org.springframework.stereotype.Component;
import java.time.Clock;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** Brake on the global attendee lookup so it cannot be used to walk the user directory: bounded per-instance, 30 searches/minute/user. */
@Component
public class MeetingPeopleSearchLimiter {
    private final Clock clock;
    private final Map<UUID,ArrayDeque<Long>> attempts = new HashMap<>();
    private long calls;
    public MeetingPeopleSearchLimiter(Clock clock) { this.clock=clock; }
    public synchronized boolean tryAcquire(UUID actor) {
        long now=clock.millis();
        if(++calls%256==0 || attempts.size()>=20_000) attempts.values().removeIf(queue -> {trim(queue,now); return queue.isEmpty();});
        var queue=attempts.get(actor);
        if(queue==null){if(attempts.size()>=20_000)return false; queue=new ArrayDeque<>();attempts.put(actor,queue);}
        trim(queue,now);
        if(queue.size()>=30)return false;
        queue.addLast(now);return true;
    }
    private void trim(ArrayDeque<Long> queue,long now){while(!queue.isEmpty()&&queue.peekFirst()<=now-60_000)queue.removeFirst();}
}
