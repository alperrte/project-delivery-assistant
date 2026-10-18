package com.pda.meeting.internal;
import com.pda.meeting.MeetingException;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
@RestControllerAdvice(basePackages="com.pda.meeting")
public class MeetingApiErrors {
    @ExceptionHandler(MeetingException.class) public ResponseEntity<ProblemDetail> meeting(MeetingException e) { return problem(e.status(),e.code()); }
    @ExceptionHandler({IllegalArgumentException.class,org.springframework.web.bind.MethodArgumentNotValidException.class,org.springframework.http.converter.HttpMessageNotReadableException.class,org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ProblemDetail> badRequest(Exception e) { return problem(400,"MEETING_INVALID_REQUEST"); }
    @ExceptionHandler({org.springframework.dao.DataIntegrityViolationException.class,org.springframework.dao.PessimisticLockingFailureException.class,org.springframework.orm.ObjectOptimisticLockingFailureException.class})
    public ResponseEntity<ProblemDetail> conflict(Exception e) { return problem(409,"MEETING_CONFLICT"); }
    static ResponseEntity<ProblemDetail> problem(int status,String code) {
        var body=ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(status),"Meeting request could not be completed");
        body.setProperty("code",code);
        var response=ResponseEntity.status(status).header("Cache-Control","no-store");
        if(status==429) response.header("Retry-After","MEETING_TOKEN_RATE_LIMITED".equals(code)?"2":"1");
        if("MEETING_RECONNECT_PENDING".equals(code)) response.header("Retry-After","10");
        return response.body(body);
    }
}
