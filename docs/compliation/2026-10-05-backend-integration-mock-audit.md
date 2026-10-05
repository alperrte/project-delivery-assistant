# Backend Integration & Mock Audit

## Teslim ve durum

2026-10-05. Faz 1–8: static endpoint/alan zinciri, mock analizi, gerçek Chromium/API/PostgreSQL/filesystem, container force-recreate ve final doğrulama. Source of truth: [yürütülen plan](../../PDA_END_TO_END_BACKEND_INTEGRATION_MOCK_AUDIT_PLAN.md). Ayrıntılı 14 bölüm: [audit raporu](../../PDA_BACKEND_INTEGRATION_MOCK_AUDIT_REPORT.md).

Verdict: FULLY CONNECTED (yalnız audit kapsamı). Audit başlangıcındaki staged geliştirmeler korundu; commit/push/pull/merge/branch değişimi/staging yapılmadı. Backend, migration, ENV ve auth/CSRF/CORS kaynakları audit kapsamında değiştirilmedi.

## Yapılanlar ve onaylı minimum düzeltmeler

- AUD-001 MEDIUM: ilk 100 organization ile sınırlı picker. Gerçek tüm sayfaları okuyan `organizationsApi.allOwned`; create/settings kullanır. 101. kayıt create UI seçimi ve settings label/option regresyonu.
- AUD-002 MEDIUM: rename sonrası sıcak Project Home eski adı. Organization ve yalnız Project Home query invalidation helper; gerçek client navigation + yeni Home GET/regresyon.
- AUD-003 MEDIUM: renewal sırasında iki subscription aynı mesaj için unread'ı iki artırıyordu. Generation-scoped, bounded message-ID dedup; gerçek iki subscription ile tek mesaj UI/backend unread eşleşmesi.

Her bug yeniden üretilip raporlandı; her düzeltme için ayrı açık kullanıcı onayı alındı. Production değişiklikleri yalnız [org API](../../frontend/src/features/organizations/api.ts), [org queries](../../frontend/src/features/organizations/queries.ts), [form](../../frontend/src/features/organizations/components/organization-form-page.tsx), [detail](../../frontend/src/features/organizations/components/organization-detail.tsx), [project create](../../frontend/src/features/projects/components/project-create-page.tsx), [project settings](../../frontend/src/features/projects/components/project-settings-form.tsx), [chat provider](../../frontend/src/features/chat/chat-provider.tsx).

Testler: yeni [organization regresyonları](../../frontend/e2e/organization-integration-regressions.spec.ts); mevcut [chat renewal](../../frontend/e2e/17-project-chat.spec.ts) overlap kanıtıyla genişletildi. Baseline 993 kaynak hash'i, final 7 frontend değişikliği, backend değişikliği yok ve değişen dosyaların index blob'ları baseline ile aynı. Özel QA artifacts `.local/integration-audit/` içinde Git dışında; secrets rapora alınmadı.

## Doğrulama

| Komut / kontrol | Sonuç |
|---|---|
| `backend/mvnw.cmd -Dtest=OrganizationDomainTest,OrganizationServiceTest,OrganizationRepositoryTest,OrganizationProfileMigrationTest,ProjectApiIntegrationTest,FileSystemMediaStorageTest,ChatApiIntegrationTest,ChatWebSocketIntegrationTest test` | 66 passed, 0 fail/error/skip |
| `npx.cmd playwright test e2e/13-organizations.spec.ts e2e/organization-profile.spec.ts e2e/project-logo-settings.spec.ts e2e/17-project-chat.spec.ts --project=chromium` | 44 passed baseline |
| `node .local/integration-audit/runtime.cjs` | 7 PASS; create/edit/reload/network/DB/bytes + gerçek backend force-recreate |
| `python .local/integration-audit/chat-db.py` | POST201, direct DB message match, history GET PASS |
| `npx.cmd playwright test e2e/organization-integration-regressions.spec.ts --project=chromium` | 2 passed |
| `node .local/integration-audit/overlap-probe.cjs` | Baseline iki subscribed socket: UI unread2/server1; fixed UI1/server1 PASS |
| `.\pre-push\pre-push.cmd` baseline | PASSED; 415 backend + 180 Chromium, 1 expected skip |
| `.\pre-push\pre-push.cmd` organization fixes | PASSED; 415 backend + 182 Chromium, 1 expected skip |
| `.\pre-push\pre-push.cmd` final three fixes | PASSED, exit 0; 415 backend + 182 Chromium + 1 expected skip, lint/TypeScript/build/Docker health |

Kapı Maven clean verify, lint, TypeScript, production build, tüm Chromium E2E, Docker build/start ve health smoke içerir. Test-only controlled crash route production'da kapalı olduğu için 1 expected skip; başarısız test gibi gizlenmedi. Expiry header acceleration yalnız renewal'ı hızlandırır, gerçek gövde/WS teslimini değiştirmez. Önceki completion kayıtları başarı kanıtı yerine kullanılmadı.

## API ve Swagger

SECURITY §11 gereğince tüm method/path/auth/scope/request/response/status ve önemli hatalar [rapor §3](../../PDA_BACKEND_INTEGRATION_MOCK_AUDIT_REPORT.md#3-endpoint-inventory) içinde endpoint bazında yazıldı: organization JSON create/list/detail/update/projects/archive ve iki medyanın PUT/GET/DELETE; project detail/home/logo; chat overview/members/direct/history/send/read/WS. Yeni endpoint veya yetki modeli yok.

Güvenli JSON örneği: `{"name":"Example Studio","description":"Kısa açıklama","notes":"Ek notlar","website":"https://example.com","contactEmail":"team@example.com","location":"İstanbul"}`. Mutasyonlar mevcut cookie session ve CSRF ister; organization metadata/media owner-scoped. `/organizations/{id}/projects` mevcut aktif org + proje üyeliği filtresini kullanır; bu endpoint için genel "tüm okumalar owner" özeti yerine gerçek policy esas alındı. Project logo PROJECT_VIEW/PROJECT_UPDATE, chat active membership + conversation participant.

Mevcut ortamda `/v3/api-docs` GET200; notes schema ve 12 scoped path doğrulandı. Manuel: `http://localhost:8080/swagger-ui/index.html`; normal login/CSRF, mutation için mevcut header. ENV veya security gevşetmesi yapılmadı.

## Açık konular ve sınırlar

- Açık kesin entegrasyon bug'ı kalmadı; üç MEDIUM bulgu ayrı onayla giderildi. Backend healthy; Next dev yeniden başlatıldı.
- Organization media private named volume; DB + volume birlikte yedeklenmeli. Ledger dışı elle bırakılan dosyalar için genel reconciliation scanner yok; archive dosyaları fiziksel silmez.
- Chat panel/draft client navigation state'i; full document/locale reload persistence özelliği değil. Mesaj geçmişi gerçek PostgreSQL'de.
- Project logosu mevcut BYTEA; organization görselleri filesystem. Normal zincirde sahte başarı/server verisi görülmedi; fixture/draft/landing demo ayrı sınıflandırıldı. Kapsam yollarında doğrulanmış dead endpoint yok; tüm repo için dead-code garantisi verilmedi.
- QA media silindi; QA organization/projeler archive API ile arşivlendi. Test hesapları/arşivli metadata/chat DB'de kalabilir; kullanıcı kayıtları/volume'ler silinmedi.

## Kullanıcı kontrolü

1. 100'den fazla owned organization varsa son kaydı project create/settings picker'da seç; kayıtlı organization adı görünmeli.
2. Project Home'u aç, organization adını edit et, sidebar üzerinden Home'a dön; güncel adı görünmeli.
3. Organization tüm metadata + logo/cover kaydet, reload; replace/remove Save sonrasında yansımalı. Project settings logosunu doğrudan açıp reload et.
4. Chat bar ile Tasks → Calendar → Teams → global workspace; panel/taslak korunmalı. X sonrası navigasyon tekrar açmamalı; proje/hesap değişiminde önceki state taşınmamalı.
5. Detaylı rapordaki kanıtları ve kabul edilen sınırları incele. Commit/push kullanıcıya bırakıldı.
