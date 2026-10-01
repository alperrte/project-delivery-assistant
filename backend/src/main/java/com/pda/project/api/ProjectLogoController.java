package com.pda.project.api;

import com.pda.project.application.service.ProjectLogoService;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/logo")
public class ProjectLogoController {

    private final ProjectLogoService logos;

    public ProjectLogoController(ProjectLogoService logos) {
        this.logos = logos;
    }

    @PutMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload the project logo", description = "Multipart field `file`; PNG, JPEG or WebP up to "
            + "512 KB, detected from the file content. PROJECT_MANAGER only. Requires CSRF.")
    @ApiResponse(responseCode = "204", description = "Logo stored")
    public ResponseEntity<Void> replace(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                        @PathVariable UUID projectId,
                                        @RequestParam("file") MultipartFile file) throws IOException {
        logos.replace(AuthenticatedActor.id(principal), projectId, file.getBytes());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    @Operation(summary = "Remove the project logo", description = "PROJECT_MANAGER only. Requires CSRF.")
    @ApiResponse(responseCode = "204", description = "Logo removed")
    public ResponseEntity<Void> remove(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                       @PathVariable UUID projectId) {
        logos.remove(AuthenticatedActor.id(principal), projectId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    @Operation(summary = "Get the project logo", description = "Requires membership in this project. The URL is "
            + "versioned with `?v=` so the response can be cached for a year.")
    public ResponseEntity<byte[]> read(@AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
                                       @PathVariable UUID projectId) {
        ProjectLogoService.StoredLogo logo = logos.read(AuthenticatedActor.id(principal), projectId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(logo.contentType()))
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename("logo").build().toString())
                .cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(365)).cachePrivate().immutable())
                .body(logo.data());
    }
}
