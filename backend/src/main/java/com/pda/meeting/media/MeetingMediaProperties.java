package com.pda.meeting.media;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Secrets are deployment supplied; this class deliberately has no generated toString. */
@Component
@ConfigurationProperties("pda.meeting.media")
public class MeetingMediaProperties {
    private boolean enabled;
    private String apiUrl = "";
    private String websocketUrl = "";
    private String apiKey = "";
    private String apiSecret = "";

    public void validate(Environment environment) {
        if (!enabled) return;
        boolean development = Arrays.asList(environment.getActiveProfiles()).contains("dev")
                && !Arrays.asList(environment.getActiveProfiles()).contains("prod");
        validateUrl(apiUrl, "https", "http", development);
        validateUrl(websocketUrl, "wss", "ws", development);
        if (apiKey == null || !apiKey.matches("[A-Za-z0-9_-]{1,128}") || apiSecret == null
                || !apiSecret.matches("[A-Za-z0-9_+/=-]{32,512}")
                || apiSecret.getBytes(StandardCharsets.UTF_8).length < 32)
            throw new IllegalStateException("Meeting media credentials are missing or invalid");
    }

    private static void validateUrl(String value, String secure, String localScheme, boolean development) {
        try {
            URI uri = URI.create(value);
            boolean local = "localhost".equalsIgnoreCase(uri.getHost()) || "127.0.0.1".equals(uri.getHost())
                    || "[::1]".equals(uri.getHost()) || "livekit".equalsIgnoreCase(uri.getHost());
            if (uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                    || !(uri.getPath().isEmpty() || "/".equals(uri.getPath()))
                    || !(secure.equals(uri.getScheme()) || (development && local && localScheme.equals(uri.getScheme()))))
                throw new IllegalArgumentException();
        } catch (RuntimeException e) { throw new IllegalStateException("Meeting media endpoint configuration is invalid"); }
    }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean value) { enabled = value; }
    public String getApiUrl() { return apiUrl; }
    public void setApiUrl(String value) { apiUrl = value; }
    public String getWebsocketUrl() { return websocketUrl; }
    public void setWebsocketUrl(String value) { websocketUrl = value; }
    public String getApiKey() { return apiKey; }
    public void setApiKey(String value) { apiKey = value; }
    public String getApiSecret() { return apiSecret; }
    public void setApiSecret(String value) { apiSecret = value; }
}
