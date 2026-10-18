package com.pda.meeting;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import java.time.Duration;

@Component
@ConfigurationProperties(prefix="pda.meeting")
public class MeetingPolicy {
    private boolean enabled;
    private int maxParticipants = 50;
    private Duration emptyGrace = Duration.ofMinutes(10);
    private Duration tokenTtl = Duration.ofSeconds(60);
    private boolean retainChat;
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean value) { enabled=value; }
    public int getMaxParticipants() { return maxParticipants; }
    public void setMaxParticipants(int value) { if(value<2||value>100) throw new IllegalArgumentException(); maxParticipants=value; }
    public Duration getEmptyGrace() { return emptyGrace; }
    public void setEmptyGrace(Duration value) { if(value==null||value.compareTo(Duration.ofMinutes(1))<0||value.compareTo(Duration.ofHours(24))>0) throw new IllegalArgumentException(); emptyGrace=value; }
    public Duration getTokenTtl() { return tokenTtl; }
    public void setTokenTtl(Duration value) { if(value==null||value.compareTo(Duration.ofSeconds(15))<0||value.compareTo(Duration.ofSeconds(120))>0) throw new IllegalArgumentException(); tokenTtl=value; }
    public boolean isRetainChat() { return retainChat; }
    public void setRetainChat(boolean value) { retainChat=value; }
}
