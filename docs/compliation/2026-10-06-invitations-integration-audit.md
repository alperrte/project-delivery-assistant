# Invitations End-to-End Integration Audit

> Historical audit snapshot. Four findings were subsequently remediated after explicit approval; current implementation evidence is in [separate remediation completion](2026-10-06-invitations-integration-remediation.md). Original audit verdict/counts below were not overwritten as implementation proof.

## Teslim ve durum

2026-10-06. **Audit tamamlandı; remediation uygulanmadı. Verdict: PARTIALLY CONNECTED.**

Source of truth: [.agents prompt](../../.agents/PDA_Invitations_End_to_End_Integration_Audit.md), 1–44 ve kritik kurallar. [Ayrıntılı 19 bölümlük audit raporunu incele](../../PDA_INVITATIONS_END_TO_END_INTEGRATION_AUDIT_REPORT.md).

Başlangıç/final branch `project-service-backend`, HEAD `63a2127`. Production/frontend/backend/migration/test source/config kaynakları değişmedi. Commit/push/staging/pull/merge yok. Kullanıcının prompt'u korundu. Bu kayıt audit teslimidir; implementation completion veya güvenli-release onayı değildir.

## Yapılanlar

- Registered ve email invitation UI form → real request201 → PostgreSQL invitation/roles/teamId.
- Global accept200 → ACTIVE project membership + exact roles + squad_members; warm client navigation güncel project card.
- Global reject204 → REJECTED; no membership/team; later accept409.
- Legacy accept real DB success → warm project UI stale bug.
- Cross-user/project/team/CSRF/duplicate enforcement; same-invitation double accept ve accept-vs-reject concurrency.
- External identity400 → correct register200/login200 → membership/team + token replay404; actual registration UI redirect da doğrulandı.
- Başka hesaba ait gerçek cached invitation'ın nonmember üçüncü hesapta görünmesi; gecikmeli gerçek GET sonrası kaybolması.
- Expiry için yalnız QA UUID expires_at fixture; manager/recipient/DB state karşılaştırması.
- Endpoint inventory, mock/test-only ayrımı, SMTP ve doğrulanmayan scope sınırları.

## Bulgular ve öneriler

| ID | Severity | Konu | Minimum öneri |
| --- | --- | --- | --- |
| INV-AUD-003 | HIGH | Same-document account switch private invitation cache leak | actor-scoped query keys + private cache/in-flight boundary cleanup + regression |
| INV-AUD-001 | MEDIUM | Expired physical PENDING blocks new invite/resend/cancel | locked expiry transition + consistent conflict/status/action semantics |
| INV-AUD-002 | MEDIUM | Token accept lacks projects/me invalidation | prefix invalidation + real warm navigation regression |
| INV-AUD-004 | LOW | External preview429 shown as invalid/expired | status-aware error copy/retry;404 versus429 distinction |

Kanıt, kök neden, security/data impact ve scope rapor §17'de. Backend unauthorized grant bulunmadı; HIGH bulgu frontend cache data exposure'dır. Sorunlar düzeltildi diye kaydedilmedi.

## Doğrulama

| Komut | Sonuç |
| --- | --- |
| `backend/mvnw.cmd -Dtest=ProjectInvitationDomainTest,ProjectInvitationServiceTest,ProjectInvitationRepositoryTest,ProjectInvitationApiIntegrationTest,SquadApiIntegrationTest,SmtpProjectInvitationMailHeaderTest test` |45 passed,0 failure/error/skip,exit0 |
| `node .local/invitations-audit/runtime.cjs` final |exit0; gerçek Chromium/API/fresh prepared DB; bulgular da kaydedildi |
| `node .local/invitations-audit/account-cache.cjs` final |exit0; C project403/own list excludes, eski B invitation UI visible; delayed real GET sonrası temiz |
| `node .local/invitations-audit/forms.cjs` final |exit0; gerçek registered/external form201, DB; external UI register/login200/project redirect/team |

Private probe exit0 = kanıt toplandı; her davranış başarılı sayılmadı. Yanlış probe URL'si ve erken SSR generic-form fill düzeltilip yeniden koşuldu; failed attempts PASS sayılmadı. Gerçek rate-limit429 separate LOW finding olarak tutuldu. Normal UI koşumu için yalnız yerel backend bağımsız restart edildi; ENV/limit/security gevşetilmedi. Audit Next dev'i durdurmadı. Probes sonrası final kontrolde Docker daemon pipe erişilemezdi ve3000/8080 listener yoktu; final health/Swagger GET PASS sayılmadı. Servislerin bu son durumunun nedeni doğrulanmadı; finalde Docker Desktop yeniden başlatılmadı.

Bu tur full regression/pre-push veya mevcut frontend spec CLI paketi koşulmadı; eski gate sayıları yeni audit kanıtı yerine kullanılmadı. Private Playwright scripts gerçek Chromium kullandı. Mevcut route.fulfill UI specs sadece TEST-ONLY contract kanıtı olarak sınıflandırıldı.

## API / Swagger

SECURITY §11 method/path/auth/body/response/scope/DB effect/error inventory [rapor §4](../../PDA_INVITATIONS_END_TO_END_INTEGRATION_AUDIT_REPORT.md#4-api-inventory)'te. Yeni endpoint yok. `http://localhost:8080/swagger-ui/index.html`, `/v3/api-docs`; mevcut login ve CSRF gerekir. Güvenli create örneği: `{"teamId":"<QA-team-uuid>","userId":"<QA-user-uuid>","roles":["TESTER"],"message":"Ekibe katılın"}`. Raw token, cookie, password veya credentials yayınlanmadı.

## Açık konular / sınırlar

- Dört kesin bulgu açık; **implementation için kullanıcı onayı bekleniyor**.
- MAIL_ENABLED=false; SMTP/inbox teslimi doğrulanmadı. Adapter sonrası commit/best-effort ve English mail template source'tan doğrulandı; başarılı token handoff gerçek email teslimi sayılmadı.
- General Team otomatik oluşturma yok; seçilen ekip gerçek. Eski dokümanlarda migration V35 yerine gerçek V36 esas alındı.
- ADMIN nonmember/disabled-account live browser ve deterministic team-archive/issuer-demotion races bu tur koşulmadı; sınırlar raporda açık.
- Privacy GET delay ve expires_at mutation yalnız TEST-ONLY QA fixture; gerçek server response kullanıldı. QA projeleri kendi UUID'leriyle archive API üzerinden temizlendi. Kullanıcı kayıtları/volume'leri silinmedi; QA account/archived metadata kalabilir.
- `.local/invitations-audit/` Git dışı güvenli status/body-field/DB/screenshot kanıtıdır; raw secrets rapora alınmadı.

## Kullanıcı kontrolü / karar

1. Rapor §17'deki dört finding'i ve minimum önerileri incele.
2. Öncelik önerisi: actor cache isolation → expiry lifecycle → legacy mutation cache → external error mapping.
3. Gerçek kullanıcı verileriyle expiry/role/archiving deneyi yapma; kanıtlar QA UUID'lerinden alındı.
4. **Bu bulguları minimum kapsamla düzeltmemi ister misin?** Onay alınmadan source/test/config remediation yapılmayacak.
