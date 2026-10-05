package com.pda.chat.application.service;

import org.springframework.stereotype.Component;
import java.time.Clock;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** Independent from message sends; bounded per-instance 60 attempt/minute/user brake. */
@Component
public class ChatReactionRateLimiter {
    private final Clock clock;
    private final Map<UUID,ArrayDeque<Long>> attempts = new HashMap<>();
    private long calls;
    public ChatReactionRateLimiter(Clock clock) { this.clock=clock; }
    public synchronized boolean tryAcquire(UUID actor) {
        long now=clock.millis();
        if(++calls%256==0 || attempts.size()>=20_000) attempts.values().removeIf(queue -> {trim(queue,now); return queue.isEmpty();});
        var queue=attempts.get(actor);
        if(queue==null){if(attempts.size()>=20_000)return false; queue=new ArrayDeque<>();attempts.put(actor,queue);}
        trim(queue,now);
        if(queue.size()>=60)return false;
        queue.addLast(now);return true;
    }
    private void trim(ArrayDeque<Long> queue,long now){while(!queue.isEmpty()&&queue.peekFirst()<=now-60_000)queue.removeFirst();}
}
