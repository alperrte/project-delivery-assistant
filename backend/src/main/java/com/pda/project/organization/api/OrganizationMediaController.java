package com.pda.project.organization.api;
import com.pda.project.api.AuthenticatedActor;
import com.pda.project.organization.application.OrganizationMediaService;
import com.pda.project.organization.application.OrganizationMediaException;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.UUID;
@RestController
@RequestMapping("/api/v1/organizations/{organizationId}")
public class OrganizationMediaController {
    private final OrganizationMediaService media;
    public OrganizationMediaController(OrganizationMediaService media){this.media=media;}
    @PutMapping(value={"/logo","/cover"},consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary="Replace organization logo or cover",description="Active owner + CSRF. Multipart file; PNG/JPEG/WebP. Logo 512 KiB, cover 2 MiB; pixel limits enforced.")
    @ApiResponse(responseCode="204",description="Organization image stored")
    public ResponseEntity<Void> upload(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,@PathVariable UUID organizationId,@RequestParam("file") MultipartFile file,jakarta.servlet.http.HttpServletRequest request) throws IOException {
        String kind=kind(request); int limit="LOGO".equals(kind)?524288:2097152;
        // Check authorization before reading a bounded multipart body.
        media.authorize(AuthenticatedActor.id(principal),organizationId);
        if(file.getSize()>limit) throw new OrganizationMediaException("ORGANIZATION_MEDIA_TOO_LARGE");
        try(var stream=file.getInputStream()){
            media.replace(AuthenticatedActor.id(principal),organizationId,kind,stream.readNBytes(limit+1));
        }
        return ResponseEntity.noContent().build();
    }
    @DeleteMapping({"/logo","/cover"})
    @Operation(summary="Remove organization logo or cover",description="Active owner + CSRF; idempotent.")
    @ApiResponse(responseCode="204",description="Organization image removed")
    public ResponseEntity<Void> remove(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,@PathVariable UUID organizationId,jakarta.servlet.http.HttpServletRequest request){
        media.remove(AuthenticatedActor.id(principal),organizationId,kind(request));return ResponseEntity.noContent().build();
    }
    @GetMapping({"/logo","/cover"})
    @Operation(summary="Read organization logo or cover",description="Active owner only. Private no-store; version query is a URL cache buster.")
    public ResponseEntity<byte[]> read(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,@PathVariable UUID organizationId,jakarta.servlet.http.HttpServletRequest request){
        var image=media.read(AuthenticatedActor.id(principal),organizationId,kind(request));
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.contentType())).header("X-Content-Type-Options","nosniff")
            .header(HttpHeaders.CONTENT_DISPOSITION,"inline; filename=organization-image")
            .header("Content-Security-Policy","default-src 'none'; sandbox").header(HttpHeaders.CACHE_CONTROL,"private, no-store").body(image.data());
    }
    private static String kind(jakarta.servlet.http.HttpServletRequest request){return request.getRequestURI().endsWith("/logo")?"LOGO":"COVER";}
}
