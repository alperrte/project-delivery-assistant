package com.pda.meeting.internal;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.assertEquals;

class MeetingApiErrorsTest {
    @Test void unavailableMediaKeepsItsStatusInsteadOfFallingIntoTheDeniedErrorDispatch() {
        var response=new MeetingApiErrors().status(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Meeting media service is unavailable"));
        assertEquals(503,response.getStatusCode().value());
        assertEquals("MEETING_MEDIA_UNAVAILABLE",response.getBody().getProperties().get("code"));
        assertEquals("no-store",response.getHeaders().getCacheControl());
    }
    @Test void otherStatusesAreKeptWithAGenericCode() {
        var response=new MeetingApiErrors().status(new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Invalid media webhook"));
        assertEquals(401,response.getStatusCode().value());
        assertEquals("MEETING_REQUEST_REJECTED",response.getBody().getProperties().get("code"));
    }
}
