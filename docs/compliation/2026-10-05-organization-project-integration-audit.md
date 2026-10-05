# Organization ↔ Project Integration Audit ve Plan

## Teslim ve durum

2026-10-05. [Kaynak prompt](../../.agents/PDA_Organization_Project_Integration_Audit_and_Plan.md) bütünüyle ve `frontend/CLAUDE.md`/AGENTS yönlendirmesi okundu. Mevcut schema/domain/API/authorization/frontend/cache, gerçek Chromium+backend+PostgreSQL ve mevcut hedefli testler incelendi.

**Audit verdict: PARTIALLY ALIGNED.** Audit/plan teslimi tamamlandı; remediation **başlamadı**. [17 bölümlü rapor](../../PDA_ORGANIZATION_PROJECT_INTEGRATION_AUDIT_REPORT.md) ve [8 task checkbox planı](../../PDA_ORGANIZATION_PROJECT_INTEGRATION_PLAN.md) hazır. Bütün implementation checkbox'ları açık.

Source `project-service-backend`, HEAD `9831a0b`; tracked production/test/config, index ve branch değişmedi. Commit/push/pull/merge/staging yapılmadı. `.env`, security/CSRF/CORS veya migration değiştirilmedi; çalışan servis rebuild/restart edilmedi. QA artifacts `.local/org-project-audit/` Git dışında; auth/secrets rapora alınmadı.

## Yapılanlar

- Fiziksel PostgreSQL organization_id nullable UUID, gerçek FK/NO ACTION ve organization-active index doğrulandı; temel 0..N / 0..1 ilişki gerçek.
- UI standalone ve linked create requestleri + direct QA SQL, multiple3 linked project, UI A→B move, API detach/assign, foreign/missing/archived ID reject, lifecycle ve rename propagation doğrulandı.
- Organization ownership ile ProjectMembership ayrı; org projects endpoint yalnız caller-visible projeleri sunuyor, otomatik erişim yok.
- Kesin bulgular: **HIGH** archived org→Home transaction/403; **MEDIUM** none/remove UI eksik, move sonrası organization-list cache, co-manager yanlış current-org label; **LOW** forbidden detail link ve projects list loading/error/visibility metni. Race ayrıca kanıt bekleyen risk olarak ayrıldı.
- Production fix yapılmadı. Mevcut mimari korunarak minimum backend/UI/cache taskları hazırlandı; yeni org membership veya kapsam dışı kart redesign'i eklenmedi.

## Doğrulama

| Komut / kontrol | Sonuç |
| --- | --- |
| `backend/mvnw.cmd -Dtest=ProjectApiIntegrationTest,ProjectRepositoryTest,OrganizationServiceTest,OrganizationRepositoryTest test` | exit0; 24 passed, failure/error/skip0; gerçek Testcontainers PostgreSQL |
| `node .local/org-project-audit/runtime.cjs` | final exit0; 16 case gözlemi; gerçek Chromium/API/network/direct DB; bozuk davranışlar da kayıtlı |
| `npx.cmd playwright test e2e/organization-integration-regressions.spec.ts --project=chromium` | final exit0, 2 passed; 101. owned org picker ve warm rename→Home |
| Backend filtered transaction log | UnexpectedRollbackException / rollback-only / ProjectHomeService.summary; archived Home403 root cause |
| Direct DB schema | nullable YES; FK organizations(id), confdeltype=a; index(organization_id,archived_at) |

İlk harness locator'ları ve render beklemesi düzeltildi; eski reuse-auth fixture koşumu404/undefined slug nedeniyle fail oldu. Taze auth ile final regresyonlar geçti. Bu probe hataları application bug olarak raporlanmadı. Full regression/pre-push bu **audit** turunda çalıştırılmadı; eski teslim sayıları yeni kanıt sayılmadı. Plan implementation final gate'i zorunlu tutar.

## API ve Swagger

Controller'dan çıkarılan **method/path/auth/request/response/org effect** inventory ve önemli400/401/403/404 durumları [rapor §5](../../PDA_ORGANIZATION_PROJECT_INTEGRATION_AUDIT_REPORT.md#5-endpoint-inventory) içinde: organization create/list/detail/update/archive/projects ve project create/list/detail/by-slug/home/update/archive. Yeni endpoint yok. Assignment/removal mevcut project PUT üzerinden; null/omitted clear, changed non-null owner+active check. Safe body: `{"name":"Example Project","priority":"MEDIUM","status":"PLANNING","organizationId":null}`.

Owner profile/media ile membership-filtered organization projects ayrımı açıkça kaydedildi. Swagger mevcut ortam izinleriyle `http://localhost:8080/swagger-ui/index.html`; mevcut cookie session/CSRF kullanılır, ENV veya yetki gevşetilmez.

## Açık konular

- Altı bulgu açık; kullanıcı implementation onayından sonra plan sırasıyla düzeltilecek. Temel cardinality/FK/auth association için architecture rewrite gerekli değil.
- Archive policy retained FK; otomatik detach veya project cascade yok. Home403 düzeltmesi bu policy'yi değiştirmemeli.
- Concurrent archive/assign, 101 linked project boundary ve SQL query-count ölçümü yeni regression kapsamına planlandı; bu turda runtime tamamlandı denmedi.
- Source/image reproducible-build fingerprint birebir doğrulanmadı; gözlenen runtime ve mevcut source aynı ilgili contract/exception yolunu gösteriyor.
- Own QA project/org kayıtları archive edildi; QA hesapları/archived satırlar kalabilir. Başarısız ilk harness'te foreign QA org cleanup kapsamı dışında kalmış olabilir; kullanıcı verisi/volume silinmedi.

## Kullanıcı kontrolü

1. Raporun bulgular ve authorization/lifecycle ayrımını, ardından checkbox planını incele.
2. Mevcut linked projede Settings organization picker'ını aç: none seçeneğinin olmadığına bak; API detach desteğiyle UI boşluğunu ayır.
3. QA org A detail→proje settings B/save→client navigation A: sıcak eski listeyi reload sonrası server görünümüyle karşılaştır.
4. Başka sahibin org'una bağlı projede co-manager Settings label ve Home link davranışını kontrol et.
5. Yalnız test organization'ında archive→linked Project Home akışını kontrol et; kendi gerçek organization'ını test amacıyla archive etme (geri dönüş yok).
6. Uygulama onaylanırsa plan Task1–8, targeted tests→DoD→checkbox ve final pre-push sırasıyla ilerler. Bu teslim için commit/push kullanıcıya bırakıldı.
