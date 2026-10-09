# PDA — Backend Integration & Mock Audit

Tarih: 2026-10-05. Branch: `project-service-frontend`. HEAD: `164c7fd015414114d5210eb199d12ee9db732ae2` + mevcut staged geliştirmeler. Kaynak plan: `PDA_END_TO_END_BACKEND_INTEGRATION_MOCK_AUDIT_PLAN.md`.

Durum: Audit ve kullanıcı onaylı üç minimum düzeltme tamamlandı; son kaynak üzerinde tam pre-push kapısı PASSED (exit 0). Commit/push yapılmadı.

## 1. Executive Summary

Organization metadata ve dosya görselleri gerçek API/DB/storage zincirini kullanıyor. Project settings logosu boş browser cache/context'inde gerçek detail ve image GET ile yükleniyor. Chat paneli ortak provider'da gerçek REST/WebSocket verisiyle çalışıyor; aynı projede navigasyon, X, proje/hesap değişimi ve oturum sonu testleri geçti.

Audit'te üç gerçek MEDIUM bulgu yeniden üretildi: organization picker ilk 100 kayıtta kalıyordu; organization rename sonrası sıcak Project Home cache'i eski adı gösteriyordu; socket yenilemesi sırasında tek mesaj UI unread sayacını iki artırıyordu. Her biri kullanıcıya ayrı bildirildi, ayrı açık onay alındı ve yalnız ilgili frontend akışı düzeltildi. Backend, migration, ENV, auth/CSRF/CORS ve storage implementation'ı değiştirilmedi.

Kanıtlar bu audit'te yeniden toplandı. Önceki completion kayıtları test sonucu yerine kullanılmadı. İlk 993 production/config kaynak dosyasının baseline audit boyunca değişmediği hash ile doğrulandı (`.local/integration-audit/baseline-source-check.json`).

## 2. Overall Integration Verdict

**FULLY CONNECTED** — bu audit'in organization profile/media, project settings logo ve chat kapsamındaki gerçek API/DB/storage/UI zincirleri kanıtlandı. Üç baseline MEDIUM bug ayrı kullanıcı onayıyla giderildi ve gerçek regresyonlarla doğrulandı. Bu sonuç tüm repo için kusursuzluk veya production deployment onayı değildir; aşağıdaki kabul edilen ürün/storage sınırları geçerlidir.

## 3. Endpoint Inventory

Tüm yollar `/api/v1` ile başlar. Organization mapping kaynağı: [OrganizationController](backend/src/main/java/com/pda/project/organization/api/OrganizationController.java), [OrganizationMediaController](backend/src/main/java/com/pda/project/organization/api/OrganizationMediaController.java). Auth allowlist/401/CSRF/CORS: [SecurityBaselineConfiguration](backend/src/main/java/com/pda/auth/infrastructure/config/SecurityBaselineConfiguration.java). Owner denetimi: [OrganizationService](backend/src/main/java/com/pda/project/organization/application/OrganizationService.java).

| Method / path | Auth ve kapsam | Request | Başarı / response | Gerçek frontend tüketicisi | Kullanım |
|---|---|---|---|---|---|
| POST `/organizations` | Oturum + CSRF; owner principal'dan | CreateOrganizationRequest JSON | 201 OrganizationResponse + Location | organizationsApi.create → organization-form-page | Kullanılıyor |
| GET `/organizations` | Oturum; yalnız owned active liste | page/size, size 1–100 | 200 PageResponse<OrganizationResponse> | organization-list; project create/settings picker | Kullanılıyor |
| GET `/organizations/{id}` | Aktif owner | UUID | 200 OrganizationResponse | organization-detail; edit loader; submit sonrası refresh | Kullanılıyor |
| PUT `/organizations/{id}` | Aktif owner + CSRF | UpdateOrganizationRequest JSON | 200 OrganizationResponse | edit form | Kullanılıyor |
| GET `/organizations/{id}/projects` | Oturum; organization aktif, yalnız caller'ın üyeliği olan projeler | UUID, page/size | 200 PageResponse<ProjectResponse> | organization-detail | Kullanılıyor |
| POST `/organizations/{id}/archive` | Aktif owner + CSRF | Body yok | 204 | organization-detail confirm | Kullanılıyor |
| PUT `/organizations/{id}/logo` | Aktif owner + CSRF | multipart `file`, PNG/JPEG/WebP ≤512 KiB | 204 | form logo upload/replace | Kullanılıyor |
| GET `/organizations/{id}/logo` | Aktif owner | UUID, optional v | 200 detected MIME + bytes | organizationImageSource → header/card/edit | Kullanılıyor |
| DELETE `/organizations/{id}/logo` | Aktif owner + CSRF | Body yok | 204 idempotent | form Save sonrası remove | Kullanılıyor |
| PUT `/organizations/{id}/cover` | Aktif owner + CSRF | multipart `file`, PNG/JPEG/WebP ≤2 MiB | 204 | form cover upload/replace | Kullanılıyor |
| GET `/organizations/{id}/cover` | Aktif owner | UUID, optional v | 200 detected MIME + bytes | organizationImageSource → header/card/edit | Kullanılıyor |
| DELETE `/organizations/{id}/cover` | Aktif owner + CSRF | Body yok | 204 idempotent | form Save sonrası remove | Kullanılıyor |

`GET .../projects` owner-only profile GET ile aynı yetki kuralı değildir: [ProjectService.visibleInOrganization](backend/src/main/java/com/pda/project/application/service/ProjectService.java) aktif organization kontrolünden sonra üyelikle filtreler. Bu fark endpoint inventory'ye koddan yazıldı; policy metnindeki genel "all reads owner" ifadesi bu endpoint için birebir doğru değildir. Başka organization'ın özel profile/media verisini açmaz; bunu owner bypass bulgusu olarak değerlendirmedim.

Project kaynağı: [ProjectController](backend/src/main/java/com/pda/project/api/ProjectController.java), [ProjectLogoController](backend/src/main/java/com/pda/project/api/ProjectLogoController.java), [ProjectLogoService](backend/src/main/java/com/pda/project/application/service/ProjectLogoService.java).

| Method / path | Auth | Request | Başarı | Frontend tüketicisi | Kullanım |
|---|---|---|---|---|---|
| GET `/projects/by-slug/{slug}` | PROJECT_VIEW | slug | 200 ProjectResponse + logoVersion | project-detail/use-selected-project | Kullanılıyor |
| GET `/projects/{id}/home` | PROJECT_VIEW | UUID | 200 ProjectHomeResponse | project overview, organization label | Kullanılıyor |
| PUT `/projects/{id}/logo` | PROJECT_UPDATE + CSRF | multipart file ≤512 KiB | 204 | project-logo-field/projectsApi.uploadLogo | Kullanılıyor |
| GET `/projects/{id}/logo` | PROJECT_VIEW | UUID, version cache buster | 200 MIME + BYTEA bytes | projectLogoSource → settings/card/header/chat | Kullanılıyor |
| DELETE `/projects/{id}/logo` | PROJECT_UPDATE + CSRF | Body yok | 204 | project-logo-field/projectsApi.deleteLogo | Kullanılıyor |

Chat kaynağı: [ChatController](backend/src/main/java/com/pda/chat/api/ChatController.java), [ChatService](backend/src/main/java/com/pda/chat/application/service/ChatService.java), [frontend API](frontend/src/features/chat/api.ts).

| Method / path | Auth | Request | Başarı / response | Frontend tüketicisi | Kullanım |
|---|---|---|---|---|---|
| GET `/projects/{p}/chat/conversations` | Aktif proje üyesi | Body yok | 200 Overview | overview query/provider | Kullanılıyor |
| GET `/projects/{p}/chat/members` | Aktif proje üyesi | Body yok | 200 Member[] | member query/conversation list | Kullanılıyor |
| POST `/projects/{p}/chat/direct/{user}` | Aktif üye + CSRF, aynı proje hedefi | Body yok | 200 Conversation | openDirect mutation | Kullanılıyor |
| GET `/projects/{p}/chat/conversations/{c}/messages` | Üye + konuşma katılımcısı | before/after/limit | 200 MessagePage | history query/socket catch-up | Kullanılıyor |
| POST `/projects/{p}/chat/conversations/{c}/messages` | Katılımcı + CSRF | SendMessageRequest `{content}` | 201 Message | composer/send | Kullanılıyor |
| POST `/projects/{p}/chat/conversations/{c}/read` | Katılımcı + CSRF | Body yok | 204 | markRead | Kullanılıyor |
| GET `/ws` WebSocket upgrade | Geçerli cookie session + allowed Origin; STOMP yalnız kendi user queue'su | WS handshake/STOMP SUBSCRIBE | 101 upgrade, `/user/queue/chat` delivery | use-chat-socket | Kullanılıyor |

Önemli hatalar: organization metadata validation 400, anonymous 401, owner/CSRF 403, missing/archived/no image 404; media storage 503, conflict 409; chat invalid content/cursor 400, foreign conversation 404, non-member 403, rate limit 429. JSON/file sözleşmelerinin gerçek case kanıtı `ProjectApiIntegrationTest`, `ChatApiIntegrationTest`, `ChatWebSocketIntegrationTest` içindedir ve bu audit'te çalıştırıldı.

Swagger mevcut ayarla `/swagger-ui/index.html`, JSON `/v3/api-docs`; normal login + `GET /api/v1/auth/csrf` ve mutation CSRF header kullanılır. ENV değiştirilmedi. Envanter Swagger varsayımından değil controller mapping'lerinden çıkarıldı. Runtime OpenAPI GET 200; 12 scoped organization/chat/project-logo path ve OrganizationResponse.notes schema mevcut: `.local/integration-audit/openapi-evidence.json`.

## 4. Frontend ↔ Backend Mapping

Dosya kısaltmaları: **Form** = [organization-form-page.tsx](frontend/src/features/organizations/components/organization-form-page.tsx), **Detail** = [organization-detail.tsx](frontend/src/features/organizations/components/organization-detail.tsx), **List/Card** = [organization-list.tsx](frontend/src/features/organizations/components/organization-list.tsx) / [organization-card.tsx](frontend/src/features/organizations/components/organization-card.tsx), **OrgAPI** = [api.ts](frontend/src/features/organizations/api.ts), **LogoField** = [project-logo-field.tsx](frontend/src/features/projects/components/project-logo-field.tsx), **Chat** = [chat-provider.tsx](frontend/src/features/chat/chat-provider.tsx). Tablodaki CONNECTED sonuçları runtime.json, chat DB ve geçen gerçek testlerle birlikte okunmalıdır.

| Feature | Frontend file | API call | Backend endpoint | DB persistence | Status |
|---|---|---|---|---|---|
| Organization name | Form/Detail/List/Card + OrgAPI | JSON POST/PUT → GET | organizations create/update/detail/list | organizations.name | CONNECTED |
| Description | Form/Detail/Card + OrgAPI | POST/PUT → GET | aynı metadata controller | organizations.description | CONNECTED |
| Notes | Form/Detail + OrgAPI | POST/PUT → GET | aynı metadata controller | organizations.notes | CONNECTED |
| Website | Form/Detail + OrgAPI | POST/PUT → GET | aynı metadata controller | organizations.website | CONNECTED |
| Contact email | Form/Detail + OrgAPI | POST/PUT → GET | aynı metadata controller | organizations.contact_email | CONNECTED |
| Location | Form/Detail + OrgAPI | POST/PUT → GET | aynı metadata controller | organizations.location | CONNECTED |
| Create | Form | POST JSON 201 | POST organizations | OrganizationRepository saveAndFlush | CONNECTED |
| Update/edit | Form | PUT JSON 200 | PUT organizations/{id} | locked entity save | CONNECTED |
| Detail | Detail + OrgAPI | GET 200 | GET organizations/{id} | owned active repository read | CONNECTED |
| List/card | List/Card | GET paginated + image GET | GET organizations, logo/cover | real records + versions | CONNECTED |
| Preview | Form + shared card/header | Unsaved state/blob; Save sends real APIs | n/a before Save; POST/PUT on Save | Intentional pre-submit draft | CONNECTED |
| Logo upload | Form + OrgAPI | multipart PUT 204 | PUT organizations/{id}/logo | logo_key + ledger; bytes private volume | CONNECTED |
| Logo replace | Form + OrgAPI | multipart PUT → GET | same logo endpoint | new key, old ledger/file cleanup | CONNECTED |
| Logo remove | Form + OrgAPI | Save DELETE 204 → GET/reload | DELETE logo | reference null + cleanup | CONNECTED |
| Logo read/render | header/card/edit | versioned GET 200 | GET logo | active ledger + private bytes | CONNECTED |
| Cover upload | Form + OrgAPI | multipart PUT 204 | PUT organizations/{id}/cover | cover_image_key + ledger + volume | CONNECTED |
| Cover replace | Form + OrgAPI | multipart PUT → reload GET | same cover endpoint | new key, old ledger/file cleanup | CONNECTED |
| Cover remove | Form + OrgAPI | Save DELETE 204 → reload | DELETE cover | reference null + cleanup | CONNECTED |
| Cover read/render | header/card/edit | versioned GET 200 | GET cover | active ledger + private bytes | CONNECTED |
| Archive | Detail | POST 204 | POST archive | archived_at/status; media retained | CONNECTED |
| Organization picker | project-create-page/project-settings-form | allOwned real paginated GET | GET organizations page 0..N | Owned active organization records | CONNECTED |
| Org rename → Project Home | Form + project-overview | PUT then fresh home GET | PUT org + GET project home | organizations.name read into aggregate | CONNECTED |
| Project settings logo | LogoField + project-detail | by-slug GET, logo GET/PUT/DELETE | projects/by-slug, projects/{id}/logo | project_logos.data BYTEA + projects version | CONNECTED |
| Chat panel persistence | Chat + AppShell/layout | n/a UI ownership; REST/WS stay live | provider/layout; /ws | UI mode/draft n/a | CONNECTED |
| Chat message/history | Chat + hooks/API | POST 201/history GET + WS event | chat controller + delivery | chat_messages/conversations/read_states | CONNECTED |
| Chat unread during renewal overlap | Chat handleEvent + cache | İki canlı WS subscription, tek gerçek POST | /ws + overview GET | Server unread=1, fixed UI=1 | CONNECTED |

Picker/cache satırları audit başlangıcında PARTIAL idi; kullanıcı onaylı düzeltmelerden sonra gerçek regresyon testleriyle CONNECTED oldu. Preview satırı backend upload iddiası değildir: draft görselin Save sonrası gerçek dosyaya geçişi doğrulandı.

## 5. Database Persistence

[V21](backend/src/main/resources/db/migration/V21__project_organization_initial.sql), [V52](backend/src/main/resources/db/migration/V52__organization_profile_and_media.sql), [V53](backend/src/main/resources/db/migration/V53__organization_notes.sql), [Organization entity](backend/src/main/java/com/pda/project/organization/domain/Organization.java), [repository](backend/src/main/java/com/pda/project/organization/infrastructure/OrganizationRepository.java), [response](backend/src/main/java/com/pda/project/organization/api/OrganizationResponse.java) zinciri incelendi; alanlar gerçek migration içeriğinden çıkarılmıştır.

| DB column | Tip/sınır | Nullable | Gerçek doğrulama |
|---|---|---|---|
| name | VARCHAR(160) | Hayır | UI POST → direct DB → reload |
| description | VARCHAR(2000) | Evet | ayrı description/notes korunması |
| website | VARCHAR(2048) | Evet | HTTP(S) + host, userinfo/control reddi; persisted URL |
| contact_email | VARCHAR(254) | Evet | DTO Email + domain format; direct DB |
| location | VARCHAR(200) | Evet | create + update/reload + direct DB |
| notes | VARCHAR(1000) | Evet | create/update/null/boundary; notes description'dan ayrı |
| logo_key | VARCHAR(36) | Evet | UUID reference + ACTIVE ledger |
| cover_image_key | VARCHAR(36) | Evet | cover UUID reference + ACTIVE ledger |

Çalışan DB'de Flyway 51,52,53 `success=true`. `information_schema.columns` tip/sınır/nullability çıktısı `.local/integration-audit/runtime-evidence.json` içindedir. QA create/edit/removed snapshot'ları doğrudan ayrı `psql` işlemiyle okunmuştur; React Query/JPA cache'i DB kanıtı yerine kullanılmadı.

POST owner'ı principal'dan alır. Full PUT'ta optional alanlar missing/blank→null, trim edilir; media reference'lar metadata update ile değişmez. Response opaque versions taşır, storage path veya bytes metadata JSON'a eklenmez.

`OrganizationRepositoryTest.expandedProfileRoundTripsWithNullableLegacyFields` EntityManager.clear sonrası gerçek kolonları okur. `OrganizationProfileMigrationTest.legacyOrganizationSurvivesUpgrade` V51 legacy row → V52 location → V53 notes null uyumluluğunu test eder; ikisi bu audit'te geçti.

## 6. Media Storage

Gerçek zincir: Form File → OrgAPI FormData `file` → OrganizationMediaController bounded read → ImageSniffer → OrganizationMediaService → [MediaStorage](backend/src/main/java/com/pda/shared/MediaStorage.java) / [FileSystemMediaStorage](backend/src/main/java/com/pda/shared/FileSystemMediaStorage.java) → özel dosya → [OrganizationMediaRepository](backend/src/main/java/com/pda/project/organization/infrastructure/OrganizationMediaRepository.java) ledger + entity reference → authenticated GET → versioned img.

- Organization BYTEA/public/static/in-memory değildir. Çalışan mount: `project-delivery-assistant_pda_organization_media` → `/app/organization-media`; Docker named volume. ENV `ORGANIZATION_MEDIA_STORAGE_PATH`; host property default `.local/organization-media`.
- Server UUID key; filename/client MIME path seçmez. Signature/dimension sınırı, ≤6000 edge/24M pixels; logo 512 KiB, cover 2 MiB. Bu validation tam image decode/EXIF sanitation iddiası değildir.
- UUID containment, ancestor/object symlink kontrolleri; CREATE_NEW/NOFOLLOW temp write, force ve atomic move.
- Kalıcı PENDING staging; object ve organization row lock; başarılı reference swap → ACTIVE, önceki object DELETE_PENDING. Metadata transaction ile byte IO aynı atomic DB transaction değildir; ledger crash/retry protokolü bunu koordine eder.
- Remove reference'ı null yapar; cleanup dosya + ledger siler. Storage delete hatasında ledger sonraki 60s scan için kalır. Expired PENDING lease 5 dakika; scan limit 50; SKIP LOCKED/referenced guard.
- GET active owner, private/no-store, nosniff/sandbox; `v` yalnız cache buster, tarihî sürüm endpoint'i değildir.
- Archive reference/dosyayı korur ve erişimi kapatır. Ledger dışına elle bırakılmış dosyaların genel scanner'ı yoktur; mevcut cleanup ledger-managed yaşam döngüsünü kapsar. Bu kabul edilmiş sınır, storage mock'u veya kanıtlanmış yeni bug değildir.

Gerçek runtime: logo replacement ve ayrıca cover replacement sonrası önceki key'in DB satırı ve fiziksel dosyası yok; remove sonrası iki reference null ve QA ledger count=0; double delete 204. Backend container ID'si değiştirilerek force-recreate yapıldı, logo **ve cover** GET SHA256'ları ve DB snapshot aynı kaldı. `.local/integration-audit/runtime-final.log` / `runtime-evidence.json`.

Test-only IOException enjeksiyonları, `ProjectApiIntegrationTest` içindeki `@MockitoSpyBean MediaStorage` üzerinden yapılır: eski logo write failure'da korunur, delete failure ledger'de kalır ve recovery sonrası temizlenir. Bunlar normal başarılı upload'ın yerine geçmedi; ayrıca gerçek volume testi yapıldı.

## 7. Mock / Fake Audit

Repo production kaynaklarında prompt'taki sözcükler tarandı; ilgili akışlar semantik olarak incelendi. Test/fixture/dev yolları ayrıca ayrıldı. `.local/integration-audit/mock-search.txt` arama indeksi; sözcüklerin kendisi bug kabul edilmedi.

| Davranış | Sınıf | Dosya ve gerekçe |
|---|---|---|
| Unsaved File → object URL | INTENTIONAL | use-picked-image.ts revoke on change/unmount; Form Save gerçek multipart'a geçiyor |
| Preview ID/status/empty name/date label | INTENTIONAL | organization-form-page/Card preview; inert link, kullanıcı draft'ı; DB kaydı gibi sunulmuyor |
| Cover fallback artwork/initial | INTENTIONAL | organization-cover.tsx, EntityMark/EntityCover; gerçek yükleme varmış gibi metadata üretmiyor |
| Placeholder input text | INTENTIONAL | Form/i18n hint; backend verisi değil |
| Chat timers | INTENTIONAL | use-chat-socket renewal/retry/overlap, conversation-view 500ms read debounce; fake teslim değil |
| Public landing static data | INTENTIONAL | landing-pda-demo-provider ayrı QueryClient; gerçek query kapalı, mutation reddediliyor; ChatProvider disabled |
| Error-test route | DEV-ONLY | production'da kapalı kontrollü error route; production E2E bu nedenle expected skip |
| Playwright route.fulfill 503/404/delay | TEST-ONLY | organization-profile/project-logo/chat failure/race tests; başarılı audit zincirinde fulfill kullanılmadı |
| Renewal expiry header acceleration | TEST-ONLY | Gerçek route.fetch cevabında yalnız expiry header 20s; gerçek REST gövdesi ve iki WS subscription, mock mesaj yok |
| Mockito repositories/storage spy | TEST-ONLY | Service tests ve storage failure injection; ayrı DB/runtime proof mevcut |
| Production API yerine fake organization/logo/chat verisi | UNINTENTIONAL / BUG bulunmadı | Gerçek request/status/body/DB/bytes + iki kullanıcı WS E2E kanıtı |

Draft/outbox optimistic state ile server-confirmed message ayrılıyor; generation guard yanlış proje/oturum callback'lerini engelliyor. Fake success toast yerine metadata ve iki media operation sonucu okunuyor; kısmi başarısızlık warning/retry olarak gösteriliyor.

## 8. Project Settings Logo Audit

[project-detail.tsx](frontend/src/features/projects/components/project-detail.tsx) by-slug query ile backend ProjectResponse'u alır; LogoField `projectLogoSource` versioned endpoint kullanır. LogoField update/delete `["projects"]` prefix invalidation yapar. Gerçek list/by-slug/home/sidebar-default anahtarları bu kökle eşleşir.

Kanıt: `project-logo-settings.spec.ts` mevcut logo/pencil, replace, dirty text korunması, card/header/chat, server failure/validation, cancel/remove/fallback testleri geçti. Ek runtime aracı cache-disabled reload ve **yeni context** ile settings URL'sine doğrudan girerek 200 by-slug + 200 logo GET, doğal image width ve server bytes hash doğruladı. `project_logos.data` BYTEA octet_length gerçek dosyayla aynı. Client cache'te kalan fake logo bulunmadı.

## 9. Chat Persistence Audit

AppShell içindeki tek ChatProvider/ChatRoot page bileşenlerinin dışında; logical route/selected-project context üzerinden mode, active conversation, drafts/outbox korunuyor. Provider account/project generation ve query cancel/remove; socket hook cleanup client/timer deactivation içeriyor. X UI'ı kapatırken aynı context'te unread bağlantısı çalışabilir; X logout anlamına gelmez.

`17-project-chat.spec.ts` bu audit'te gerçek iki browser hesabıyla geçti: direct/group live delivery, full/bar/compact; Tasks/Calendar/Teams + global çalışma alanı navigasyonu; taslak/history; X sonrası yeniden açılmama; project change/late response, logout/başka hesap izolasyonu, token renewal ve revoked session. `socketStats` open/subscribe/close sayıları navigasyon öncesi/sonrası eşit; renewal handover sonrasında gerçek live message teslimi kontrol edildi. Planlı 3s iki socket overlap'ı kalıcı duplicate sayılmadı; message ID dedup/cache kodu ayrıca incelendi.

Panel mode/draft browser storage veya DB'ye persist edilmez; bu, kabul edilen client navigation kapsamının UI state'idir. Full document/locale reload provider'ı yeniden kurar; reload'da paneli otomatik açmak ayrı ürün özelliği değildir. Mesajlar ise gerçek DB'dedir: `.local/integration-audit/chat-db.py` POST 201 → ayrı PostgreSQL JOIN ile message/conversation/project match=1 → ayrı history GET aynı ID. QA projesi kontrol sonunda arşivlendi.

Backend `ChatApiIntegrationTest` ve `ChatWebSocketIntegrationTest` auth/IDOR/cross-project/conversation privacy, CSRF, delivery ve session revocation kontrolleri geçti. Auth tokenları local/sessionStorage'a taşınmadı.

Son ayrıca kontrol edilen overlap senaryosunda mesaj listesi dedup'ının unread side effect'ini kapsamadığı ortaya çıktı (AUD-003). Ayrı onayla provider'da delivery ID dedup eklendi; iki gerçek subscribed socket sırasında tek mesaj için baseline UI=2/server=1, fixed UI=1/server=1. Normal expiry/renewal/handover davranışı korunuyor. Mevcut yenileme testi bu örtüşme sırasında server/UI sayacı ve tek mesaj satırını kontrol edecek şekilde genişletildi.

## 10. Runtime / E2E Evidence

| Bu audit'te çalıştırılan komut | Sonuç | Kanıt |
|---|---|---|
| backend/mvnw.cmd hedefli 8 sınıf test | 66 passed; 0 failure/error/skip | backend-targeted.log; gerçek Surefire sonuçları |
| playwright test 13-organizations + organization-profile + project-logo-settings + 17-project-chat | 44 passed | browser-targeted.log |
| node .local/integration-audit/runtime.cjs | 7 PASS | runtime-final.log + runtime-evidence.json; reload/network/DB/files/recreate |
| python .local/integration-audit/chat-db.py | PASS | chat-db-evidence.json |
| picker-setup.py + picker-browser.cjs | Baseline gerçek settings bug yeniden üretildi | picker-api-evidence.json / picker-browser-evidence.json |
| cache-probe.cjs | Baseline eski Project Home adı yeniden üretildi | cache-probe-evidence.json |
| playwright organization-integration-regressions.spec.ts | 2 passed after fixes | fix-regressions.log |
| pre-push/pre-push.cmd baseline | PASSED: 415 backend, 180 Chromium + 1 expected skip | pre-push.log |
| pre-push/pre-push.cmd source after org fixes | PASSED: 415 backend, 182 Chromium + 1 expected skip | pre-push-fixed.log |
| node overlap-probe.cjs baseline → fixed | Gerçek iki subscription: baseline UI=2/server=1; fixed UI=1/server=1 | overlap-baseline-evidence.json / overlap-fixed-evidence.json |
| pre-push/pre-push.cmd final source (3 fixes) | PASSED, exit 0: 415 backend; 182 Chromium + 1 expected skip; lint/tsc/build/Docker smoke | pre-push-final.log |

Loglar `.local/integration-audit/` altında Git dışındadır; ham cookies/credentials/trace paylaşılmadı. Normal network proof method/path/body/status ve multipart content-type; Chromium binary multipart body'yi vermediği için FormData field/size pass-through gözlemci ve gerçek GET bytes/DB tamamlayıcı kanıt olarak kullanıldı. Audit scriptlerinin QA logo/cover'ları silindi; organization/projeleri mevcut archive API ile arşivlendi. Archive DB satırlarını fiziksel olarak silmez; test hesapları ve arşivlenmiş QA metadata/chat geçmişi yerel DB'de kalabilir. Kullanıcının gerçek kayıtları veya volume'leri silinmedi.

Harness hataları uygulama bug'ı sayılmadı: ilk multipart binary request-body assertion araca aitti; ilk picker create baseline gözlemci global search'ü açmıştı ve bu satır kanıt dosyasında INVALID olarak işaretlendi. Settings baseline 100-option/"Organizasyon yok" kanıtı geçerli; create root cause aynı list(0,100) kodundan ve gerçek 101-record API boundary'den çıkarıldı. Yeni testte doğru form combobox ve selected label'in decorative ▼ simgesini toleranslı kontrolü kullanıldı. Son iki test gerçek server ile geçti; sahte response yok.

## 11. Findings by Severity

### AUD-001 — MEDIUM — Organization picker pagination eksikliği — RESOLVED

Kök neden: project-create-page:73 ve project-settings-form:78 yalnız `organizationsApi.list(0,100)` okuyordu. Backend list gerçekten paginated; 101. owned record page 1'de. Project organizationId kaydedilebiliyor ama settings seçili adını bulamayıp "Organizasyon yok" gösteriyordu.

Yeniden üretim: izole QA user, 101 organization; page0=100, page1=1; proje son organization'a bağlı; settings UI 100 option ve fallback label. Kullanıcı ayrı açık onay verdi.

Minimum fix: OrgAPI.allOwned gerçek sayfaları sonuna kadar okuyup ID ile birleştirir; yalnız content sözleşmesiyle iki picker tüketir. Mevcut query key ve server endpoint/permission değişmedi. Yeni regression 101. organization'ı **create UI'dan seçip** POST sonucu organizationId ve settings gerçek label/option'ını kontrol eder.

### AUD-002 — MEDIUM — Organization rename sonrası sıcak Project Home cache — RESOLVED

Kök neden: Form ve archive yalnız organization prefix'ini invalidated ediyordu; home.organization.name Project Home query altında (`["projects", id, "home"]`) ve provider default staleTime=30s. Gerçek client navigation ile DB/API renamed iken home link eski adı gösterdi.

Minimum fix, ayrı kullanıcı onayıyla: ortak invalidateOrganizationQueries org kökü + yalnız Project Home query'lerini invalidate eder. Form ve archive kullanır; diğer project cache'leri veya auth/session invalidation'ı genişletilmedi. Yeni regression sıcak Home → org edit → client Home dönüşünde taze 200 Home response ve yeni link adını doğrular.

### AUD-003 — MEDIUM — Socket renewal overlap unread duplicate — RESOLVED

Kök neden: [chat-provider.tsx:243](frontend/src/features/chat/chat-provider.tsx#L243) her MESSAGE olayında `applyMessageToOverview` çağırıyordu; [cache.ts:79](frontend/src/features/chat/cache.ts#L79) unread'ı koşulsuz artırıyordu. `appendMessages` sadece mesaj listesini ID ile ayıklıyordu. [use-chat-socket.ts](frontend/src/features/chat/use-chat-socket.ts) handover'da önceki subscription'ı 3 saniye tutuyor; aynı gerçek mesaj iki kez gelebiliyor.

Yeniden üretim: iki gerçek QA hesabı, yeni proje, iki aktif SUBSCRIBE, küçültülmüş panel; tek POST 201 sonrası UI unread=2 ve ayrı recipient overview GET unread=1. Sadece expiry response header'ı TEST-ONLY hızlandırıldı; API cevap gövdesi ve WS teslimi gerçek. İlk harness yanlış invitation kabul yolu/body kullanıyordu; düzeltilen harness sonucu kanıttır. Baseline `overlap-baseline-evidence.json`; fixed `overlap-fixed-evidence.json`.

Kullanıcıya ayrı bildirildi ve açık onay alındı. Minimum fix: provider generation'a ait son 1000 delivery ID'si MESSAGE side effect'lerini bir kez çalıştırır; proje/hesap değişiminde set yeniden kurulur. READ, REST history, API, socket handover süresi ve yetki modeli değişmedi. Gerçek yeniden üretim fixed UI=1/server=1 verdi. Kalıcı renewal E2E, tek mesajı iki subscription açıkken gönderip server+UI unread=1 ve mesaj satırı=1 kontrol eder; mevcut handover sonrası teslim kontrolünü de korur.

### INFO — Kabul edilmiş sınırlar / kanıt sınıfları

Tek host private volume; DB+volume backup birlikte gerekli. Ledger dışı elle bırakılmış dosyalar için genel reconciliation scanner yok. File type kontrolü full decode değildir. Chat panel durumu reload persistence özelliği değildir. Test aracı hataları ve önceki testlerde eksik reload assertion'ları, runtime kanıtı tamamlandıktan sonra açık integration bug olarak bırakılmadı.

CRITICAL/HIGH/LOW yeni kesin bug bulunmadı. Üç MEDIUM bulgu RESOLVED; final-source kapı geçti. Baseline gate de geçmişti ama bu bulguları yakalamıyordu; yeni/genişletilen regresyonlar kanıt boşluğunu kapattı.

## 12. Missing Connections

Metadata, media upload/read/replace/remove, DB references, project logo ve chat REST/WS yollarında eksik server bağlantısı bulunmadı. Baseline picker page>0, Project Home invalidation ve overlap unread dedup bağlantıları eksikti; onaylı fix + gerçek regresyonlarla giderildi. Yanıt DTO'sunda olup ürün gereği karta basılmayan notes/contact alanları missing integration sayılmadı.

## 13. Dead Code

İncelenen endpoint/client zincirlerinde üretime ulaşmayan organization/logo/chat endpointi doğrulanmadı. Domain compatibility overload'ları, planlı landing fixture ve TEST-ONLY yardımcıları otomatik dead code kabul edilmedi. Repo genelindeki her modül için dead-code analizi yapıldığı iddia edilmez; tarama son taskların production yollarına odaklandı.

## 14. Final Recommendation

Üç minimum düzeltme dışında geliştirme gerekmedi. Final kapı exit 0; backend ve frontend health geçti, Next dev yeniden başlatıldı. Baseline 993 production/config hash'i karşılaştırıldı: yalnız onaylı 7 frontend production dosyası değişti; backendChanged ve indexBaselineMismatch boş (`final-source-check.json`). Backend/migration/storage/ENV/security kaynakları değişmedi. Commit ve push kullanıcıya bırakıldı.

Değişen production dosyaları: organization `api.ts`, `queries.ts`, form/detail; project create/settings picker queryFn; chat provider MESSAGE dedup. Yeni kalıcı test: `frontend/e2e/organization-integration-regressions.spec.ts`; mevcut `17-project-chat.spec.ts` renewal testi overlap assertion'larıyla genişletildi. Özel QA script/evidence `.local/` içinde. [Yürütülen plan](PDA_END_TO_END_BACKEND_INTEGRATION_MOCK_AUDIT_PLAN.md) sonuç/status ile güncellendi; [completion kaydı](docs/compliation/2026-10-05-backend-integration-mock-audit.md) manuel kontrolleri içerir.

Manuel kontrol: 100'den fazla owned org varsa son kaydı create/settings picker'dan seç; organization adını değiştirip client linkle Project Home'a dön; logo/cover Save → reload; project settings logo reload; minimized chat Tasks→Calendar→Teams ve X sonrası navigasyon. Tam kanıt ve completion kaydını incelemeden runtime raporunu yalnız UI screenshot üzerinden yorumlama.
