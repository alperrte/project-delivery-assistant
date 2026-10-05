# PDA — Organization ↔ Project Integration Remediation Planı

Tarih: 2026-10-05. Durum: **Task 1–8 tamamlandı; full gate PASSED.**

Source of truth: `.agents/PDA_Organization_Project_Integration_Audit_and_Plan.md` bölümler1–39, kritik kurallar ve implementation handoff; bulgular [audit raporu](PDA_ORGANIZATION_PROJECT_INTEGRATION_AUDIT_REPORT.md). Bu plan mevcut production kodu, controller, migration, gerçek Chromium/API/PostgreSQL ve hedefli testler üzerinden hazırlanmıştır. Eski completion/checklist başarı kanıtı sayılmadı.

Kullanıcı 2026-10-05 tarihinde implementation için açık onay verdi. Task sırası ve her taskta **implementation → targeted test → Definition of Done → [x] → next task** korunur. İlk plan tesliminde kutular açıktı; [x] işaretleri implementation/test/DoD kanıtından sonra güncellendi. Commit/push/staging/pull/merge/branch değişimi yok; kullanıcı değişiklikleri korunur.

## Korunacak sözleşme

- Project 0..1 nullable Organization FK, Organization0..N Project; mevcut schema temeli yeterli. V21 veya başka uygulanmış migration değiştirilmez. Gerçek schema ihtiyacı doğmadıkça yeni migration eklenmez.
- ProjectMembership/RolePolicy proje erişiminin kaynağıdır; Organization ownership otomatik proje üyeliği/yetkisi vermez. ADMIN bypass yok.
- Yeni/changed non-null assignment hedefi active actor-owned organization. Aynı mevcut ID'yi gönderen co-manager metadata'yı kaydedebilir. Remove için PROJECT_UPDATE yeterli; hedef owner kontrolü null'da gerekmez.
- Archive policy **B**: association retained, organization inactive; projeler archive/detach edilmez. Project archive organization/sibling'ı değiştirmez. Home archived organization'ı güvenli null olarak sunmalı.
- PUT full metadata: null/omitted organizationId clear; same ID preserve. Create seçim yokken omitted→DBnull. UI none sentinel UUID olarak backend'e gönderilmez.
- Owner profile/detail/media erişimi değişmez. Non-owner project member yalnız zaten izinli safe organization summary'yi kullanır; restricted profile GET'e dayanılmaz.
- Cookie/CSRF/CORS/ENV/auth modeline dokunma. Yeni güvenlik mimarisi veya ENV ihtiyacı varsa somut öneriyi ayrıca onaya sun.
- Card organization badge/logo yeni ürün tercihidir; bu remediation'da zorunlu yeni özellik değil. Yeni org membership, transfer ownership, otomatik inheritance veya mikroservis tasarlama.

## Task 1 — Preflight, audit reproduction ve contract freeze

**Bağımlılık:** yok. **Dosyalar:** bu plan, rapor, controller/service/entity/repository ve mevcut frontend API/schema/query files.

- [x] 1.1 Güncel HEAD/branch/index/worktree/source snapshot al; audit HEAD9831a0b ile kaynak farklarını değerlendir, kullanıcı değişikliklerini koru. Runtime image/source eşleşmesini doğrula; stale backend'i başarı kanıtı sayma.
- [x] 1.2 OP-001..006 reproduction'ını mevcut kaynak üzerinde doğrula: archive Home, none absence, A→B warm cache, co-manager label/link, projects query loading/error.
- [x] 1.3 Retained archive policy, full PUT clear semantics, current co-manager exception ve ownership/membership ayrımını sabitle. Changed hedef sahibi dışında actor kabul etme.
- [x] 1.4 `['organizations','projects',id,page]`, project list/detail/by-slug/home/picker gerçek tüketicilerini inventory'ye yaz. Her planned fix'i ID'ye bağla.
- [x] 1.5 QA artifact/auth dosyalarını `.local/org-project-audit/` gibi Git dışında tut; secrets rapor/network/screenshot'a alma. Runtime port/service etkilerini değerlendirmeden mevcut süreci durdurma.

### Definition of Done

- [x] Endpoint, lifecycle ve yetki sözleşmesinde implementation'ı engelleyen belirsizlik yok; audit'ten beri değişen source ayrı değerlendirildi.
- [x] Reproduction/ortam/Git snapshot kaydı var; implementation ve test sonuçları henüz PASS diye işaretlenmedi.

## Task 2 — Archive sonrası Home transaction güvenliği ve association race kontrolü

**Bağımlılık:** Task1. **Bulgu:** OP-001 HIGH; OP-R1 conditional risk. **Dosyalar:** OrganizationService/OrganizationRepository, ProjectHomeService, gerekirse ProjectService; ProjectHomeApiIntegrationTest/ProjectApiIntegrationTest ve deterministic concurrency testi. **DB/API:** nullable FK ve existing200/null response korunur, yeni endpoint yok.

- [x] 2.1 Expected absent/archived organization için **exception atmayan optional active lookup** oluştur/kullan. ProjectHome summary aynı outer transaction'da healthy kalsın; normal yokluk exception ile rollback-only üretmesin.
- [x] 2.2 `requireActive` ownership/security use-case'lerinde mevcut reject davranışını koru. Global noRollbackFor, auth/error dispatch permitAll veya exception swallow ile security gevşetme.
- [x] 2.3 Gerçek PostgreSQL/API test: linked create → org archive → fresh Home200 organization:null; project detail200/FKretained, project metadata edit ve explicit detach200. Nonmember hâlâ403; archived/missing yeni target404. Standalone Home ve active summary regresyonu.
- [x] 2.4 OP-R1 için archive↔create/changed assignment barrier testi: validation ile write arasındaki pencereyi deterministik aç; timeout/commit-order ve DB state'i ölç. Risk yeniden üretilemiyorsa bunu açıklayıp gereksiz locking ekleme.
- [x] 2.5 Yarış teyit edilirse mevcut organization `lockedOwned` veya uygun shared-row lock ile **validation+association commit** aynı synchronization boundary'de kalsın. Archive aynı row lock ile serialize olsun. Same-ID co-manager save ve null removal'ı gereksiz owner check'e bağlama; lock order/deadlock regression ekle.

### Definition of Done

- [x] Arşivli/absent organization Project Home'u bozmaz; gerçek API200/null ve DBretained kanıtı var; rollback-only log oluşmuyor.
- [x] IDOR/permission ve current co-manager save korunuyor. OP-R1 ya deterministik test+minimum fix ile kapatıldı ya da kanıtlı açıklaması var; belirsizlik sessizce PASS sayılmadı.

## Task 3 — Explicit standalone seçimi ve remove/assign/move UI

**Bağımlılık:** Task2. **Bulgu:** OP-002. **Dosyalar:** project-create-page, project-settings-form, projects/schemas.ts/api.ts, TR/EN/DE katalogları; yeni organization-project association E2E.

- [x] 3.1 Create ve Settings için açık “Organizasyon yok / Bağımsız proje” option ekle. Controlled Select'in none değeri için UUID olmayan UI sentinel kullan; schema/API sınırında create undefined, update explicit null'a dönüştür.
- [x] 3.2 Settings association alanını owned liste boşken de göster: kullanıcı var olan bağlantıyı kaldırabilsin. Picker loading/error'da seçim/label yanlışlıkla null'a çevrilmesin.
- [x] 3.3 Create'te A seç → none dön → POST omitted/null→DBnull; existing linked A→none→PUTnull→DBnull→reload/Home/settings çalışır. Standalone→A ve A→B gerçek request/DB zinciri.
- [x] 3.4 Create/Settings dirty/reset/cancel, diğer metadata/status/date/type/task-mode alanları ve nested forms/submit davranışı korunsun. Backend full PUT clear semantics açıkça belgelensin.
- [x] 3.5 TR/EN/DE none/standalone terminolojisi, keyboard Select, 320/390/768/1440px/light-dark kontrolü. Görsel değişiklik öncesi frontend-design-rules ve globals.css token'larını oku; yeni component library ekleme.

### Definition of Done

- [x] Kullanıcı ilişkiyi UI'da seçebilir/kaldırabilir/taşıyabilir; gerçek body, backend status ve fresh DBnull/UUID eşleşir.
- [x] Null seçim diğer metadata'yı istemeden temizlemez; form save/cancel/reset ve existing project ayarları geçer.

## Task 4 — Current organization summary ve yetkili navigasyon

**Bağımlılık:** Task3. **Bulgular:** OP-004/005. **Dosyalar:** ProjectHomeService/ProjectHomeResponse gerekirse additive safe capability, ProjectDetail/SettingsForm/Overview, types/kataloglar ve co-manager testleri.

- [x] 4.1 Settings mevcut org label'ını owned options'dan tek başına üretmesin. Var olan authorized Home summary (id/name/slug) current association kaynağı olsun; current non-owned ID yeni unrestricted picker listesinden gelmesin.
- [x] 4.2 Current non-owned association preservation ile yeni foreign assignment ayrımını UI'da koru. None removal mümkün; save sonrası mevcut response/state yenilensin. Org archived/unavailable olduğunda non-null FK'yi “standalone” diye yalanlama; açıklayıcı retained/unavailable state kullan.
- [x] 4.3 Home link yalnız organization detail'a mevcut policy ile erişebilen actor'a sunulsun. En küçük safe capability (ör. `canViewOrganization` boolean) server summary'ye gerekirse additive ekle; diğer actor için ad plain text. OwnerUserId/email/profile/media erişimi açma, frontend'i security boundary sayma.
- [x] 4.4 Own owner label/link, non-owner co-manager label/plain-text, same-ID metadata save, explicit remove, foreign changed-target reject, archived current association ve late response regression.

### Definition of Done

- [x] Non-null current association doğru ad/durumla görünür; co-manager aynı ilişkiyi koruyarak edit edebilir ve authorized remove yapabilir.
- [x] UI izin verilmeyen organization detail'a yönlendirmez; backend owner/membership/ADMIN ayrımı ve IDOR reddi değişmez.

## Task 5 — Association ve ProjectRow cache tutarlılığı

**Bağımlılık:** Task4. **Bulgu:** OP-003. **Dosyalar:** ortak query invalidation helper ve project create/settings/archive; organization query factory; association cache E2E. **API/DB:** yeni endpoint/schema yok.

- [x] 5.1 Project mutation sonucunda projects list/detail/by-slug/home/picker mevcut invalidation'ı koru; **old ve new organization projects query prefix**'lerini de invalidate et (bütün page'ler).
- [x] 5.2 Linked create için new org; remove/archive için old org; move için old+new; aynı org'da project name/priority/techStack değişimi için ilgili ProjectRow cache'i güncellensin. Organization metadata/media cache'ini gereksiz full reload etme.
- [x] 5.3 Gerçek client navigation ve warm query: A→B, A→none, none→A, linked create, project archive ve project rename; DB/server GET + rendered old/new list + new network request kanıtı al. Reload gerektirerek bug'ı gizleme.
- [x] 5.4 Organization rename→detail/list/Home/settings/create picker mevcut helper/regression'larını koru; no-op veya rejected mutation sahte success/cache patch üretmesin.

### Definition of Done

- [x] Mutation sonrası eski ilişki/list-row gösterilmiyor; affected old/new page'ler taze, Home/global list/settings tutarlı.
- [x] 101. owned organization picker ve warm org rename→Home testleri yeni source üzerinde geçti; hard reload fix sayılmadı.

## Task 6 — Organization projects loading/error/visibility UX

**Bağımlılık:** Task5. **Bulgu:** OP-006. **Dosyalar:** organization-detail.tsx, mevcut PageFailure/EmptyState/Skeleton/PaginationBar ve TR/EN/DE katalogları; scoped E2E.

- [x] 6.1 Profile query ve projects query loading/error/retry state'lerini ayrı yönet; org header/meta başarılı olsa da projects HTTP failure görünür ve retry çalışır.
- [x] 6.2 Membership-filtered no-visible-projects metni gerçek API semantics'i anlatsın; “organization kesinlikle hiç project içermiyor” iddiası kurmasın. Normal zero-project empty ile yetki filtresi uygun nötr dille ayrılır.
- [x] 6.3 Server pagination ve count korunur; yeni client-side fake filter/count yok. Page değişimi/empty last page/error-after-page ve project archive sonrası pagination clamp davranışını doğrula.
- [x] 6.4 Normal success gerçek backend; ayrı TEST-ONLY slow/failure injection loading/error/retry; keyboard/status/aria ve mobile layout kontrolü.

### Definition of Done

- [x] Proje listesi silent blank yerine açıklayıcı loading/error/empty gösterir; retry gerçek GET gönderir.
- [x] Visibility metni backend filtresiyle uyumlu; metadata owner policy ve project access genişlemez.

## Task 7 — Birleşik PostgreSQL/API/browser/security/performance regresyonu

**Bağımlılık:** Task6. **Dosyalar:** ProjectApiIntegrationTest, ProjectHomeApiIntegrationTest, ProjectRepositoryTest, Organization testleri; yeni `organization-project-association.spec.ts` ve mevcut organization-integration-regressions.spec.ts. Yeni ad final source ile doğrulanır.

- [x] 7.1 Browser standalone/linked create → reload → direct parametrik QA SQL; multiple3 projeler, assign/remove/move → A/B global list/Home/settings ve fresh DB.
- [x] 7.2 Foreign/unknown/archived target, unauthorized move/nonmember/ADMIN bypass yok, missing CSRF/anonymous, same-ID co-manager; failed mutation eski association'ı korur. Normal başarılı yolda route.fulfill yok.
- [x] 7.3 Owner project visibility yalnız membership; removed co-manager, archived org retained FK/Homenull, project archive sibling/org isolation ve schema FK/no-cascade/nullability round-trip.
- [x] 7.4 101 owned organization picker ve **101 linked project pagination** boundary; UI bütün sayfalarla erişilebilir, max page size business toplam limitine dönüşmez. Page/member sorgu sayısı30/100 gibi iki hacimde ölçülür; per-project organization/member REST/JPA fetch eklenmez.
- [x] 7.5 TR/EN/DE, mobile/desktop/light-dark, keyboard/focus, dirty/cancel/error/retry; screenshot incele. Existing chat/sidebar/navigation/task-mode/project logo/banner regresyonlarını dahil et.
- [x] 7.6 QA kaynaklarını yalnız own IDs ile archive/cleanup; kullanıcı kayıtları ve volume'ler korunur. Auth trace/token/password artifacts Git dışında; fail/skip/exit gerçek nedenleriyle kaydedilir.

### Definition of Done

- [x] Her önemli feature için component→API→controller→service→DB→response→cache→UI mapping kanıtlı; no IDOR/inheritance/new fake relation.
- [x] Yeni acceptance ve mevcut hedefli regression/security testleri geçerli ortamda başarılı; unresolved critical/high issue varsa sonraki taska tamamlandı diye geçilmez.

## Task 8 — Full gate, yeniden verdict, belgeler ve teslim

**Bağımlılık:** Task7. **Dosyalar:** plan/report, API/SECURITY §11/database/architecture/folder/design kısa notları gerektiği ölçüde, etkilenen web checklist ve docs/compliation kaydı.

- [x] 8.1 Güncel backend hazırken backend full tests, frontend lint/type/build ve tüm Chromium E2E çalıştır. Stale image/expired auth fixture veya Testcontainers disabled skip PASS sayılmasın.
- [x] 8.2 Repo kökü `./pre-push/pre-push.cmd` canonical kapısını çalıştır: Maven clean verify, lint/type/build, E2E, Docker build/start/health. Port/service çatışmasında önce gerçek proje sürecini doğrula ve izin kapsamını değerlendir; ENV veya security quota gevşetme.
- [x] 8.3 Endpoint additive capability/body/null/status/error/Swagger ve archive semantics belgelerini güncelle. Checklist'te yalnız etkilenen scoped kanıtı ekle; proje genelini kısmi sonuçla [x] yapma.
- [x] 8.4 Findings kapanış kanıtlarını rapora ekle; FULLY ALIGNED ancak zorunlu runtime/DB/cache/authorization zincirleri ve full gate geçtiğinde ver. Scope dışı kart UI/npm dev debt gibi sınırları ayrı kaydet.
- [x] 8.5 `docs/compliation/YYYY-MM-DD-organization-project-integration-remediation.md` gerçek tamamlanınca oluştur; önemli dosyalar, komut/exit/count, remaining issues ve manuel kontroller. Audit completion'ı implementation completion diye kullanma.
- [x] 8.6 Final source/index/HEAD kontrolü; commit/push/staging yok. Servisleri gerekiyorsa eski dev çalışma biçimine döndür; yalnız blocker yoksa “Kalan blocker yok.” yaz.

### Definition of Done

- [x] Full gate PASSED; bütün önceki DoD/maddeler gerçek kanıtla [x]; açık critical/high acceptance bug yok.
- [x] Güncel verdict ve kullanıcı kontrolü/completion hazır; çalışma ağacı korunmuş, Git/dış yayın işlemi yapılmamış.

## Komut planı

Çalıştırılmamış implementation komutları başarı kanıtı değildir. Test isimleri eklenen gerçek dosyalara göre güncellenir; Docker/JDK ve runtime image doğrulandıktan sonra:

```powershell
Push-Location backend
.\mvnw.cmd '-Dtest=ProjectApiIntegrationTest,ProjectHomeApiIntegrationTest,ProjectRepositoryTest,OrganizationServiceTest,OrganizationRepositoryTest' test
Pop-Location
Push-Location frontend
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
npx.cmd playwright test e2e/organization-project-association.spec.ts e2e/organization-integration-regressions.spec.ts --project=chromium
npx.cmd playwright test --project=chromium
Pop-Location
.\pre-push\pre-push.cmd
```

## Prompt kapsam eşlemesi

| Prompt bölümleri | Plan / rapor kapsamı |
| --- | --- |
| 1–5,25 | Nullable FK/cardinality/independent membership; Task1/2/7, report3/4/6 |
| 6–9,21–23,33 | UI create/assign/remove/move + IDOR + direct DB; Task2/3/4/7 |
| 10–16,32 | org projects visibility/lifecycle/Home/rename/cache; Task2/4/5/6/7 |
| 17–20,24 | Controller inventory/mapping/mock/current test gaps; report5/8/12/13, Task1/7 |
| 26–31,34–36 | severity/classification/dependency plan/race/performance/i18n; report14/15, Task2–7 |
| 37–39 + implementation handoff | verdict,17-section report, unchanged user source, gated delivery; Task8 |

İlk plan teslimi kod değişikliği yetkisi değildi; kullanıcı onayıyla implementation yürütüldü; audit bulguları ve uygulanacak en küçük düzeltme sınırları review için somutlaştırıldı. Yeni soru/karar çıkarsa bağımlı adım bekler; tamamlanmamış task [x] yapılmaz.

### Task 1 evidence

HEAD9831a0b ve temiz tracked/index baseline doğrulandı. Güncel backend Docker build/start exit0; current-source runtime probe exit0 OP-001..005 yeniden üretildi, OP-006 query state code incelemesi doğrulandı. nullable FK/retained archive/full PUT/current co-manager/owned target ve query key sözleşmesi sabitlendi. QA artifacts Git dışında; servis portları ve mevcut dev3000 korundu.

### Task 2 evidence

OP-001 optional lookup fix: ProjectHome API3 passed. OP-R1 baseline red: archiveCommittedBeforeAssociation=true; existing lockedOwned serialization sonrası create ve changed update false. Hedefli PostgreSQL paket28 passed, fail/error/skip0, exit0; ownership/membership/retained FK/same-ID edit/remove korunuyor. task2-race-red.log ve task2-green.log.

### Task 3 evidence

Lint/type/build exit0 ve güncel backend üzerinde9 Chromium test passed. Create A seç→none POST omitted/direct PostgreSQLnull; standalone→A→B→null UI PUT/body/GET/direct parametrik DB her adımda doğru, reload correct. TR/EN/DE keyboard, 320/390/768/1440 light/dark ve screenshot incelemesi passed; mevcut create/media/dirty akışları korundu. task3-ui.log; helper organization-project-db.ts.

### Task 4 evidence

Backend20 passed, UI5 passed, lint/type/build exit0. Own capabilitytrue, co-managerfalse; profile GET403 korunurken safe name plain-text. Co-manager current label doğru, same-ID PUT200+DBretain; archived label unavailable/Home200, explicit UIremove DBnull. 101 picker/rename ve Task3 regressions pass. task4-backend.log/task4-ui.log.

### Task 5 evidence

Ortak invalidateProjectMutation projects root ve affected old/new org projects prefix/bütün page cachelerini invalidate ediyor. Lint/type/build exit0; final6 Chromium passed. Sıcak UI client navigation move/remove/assign/rename/create/archive her varyantta server/DB/list doğru, mutation sonrası reload yok; unrelated root GET zorlanmıyor. 101 picker ve rename→Home korundu. task5-pass-ui.log.

### Task 6 evidence

Lint/type/build exit0;15 Chromium tests passed. Ayrı projects loading/error/retry metadata headerı koruyor; TEST-ONLY abort/latency sonrası success gerçek GET. Membership-filtered TR/EN/DE empty metni.21 linked fixture last page empty→retry prefix invalidation→page0 fresh total20; pagination clamp/focus/browser regresses pass. task6-pass-ui.log.

### Task 7 evidence

PostgreSQL backend31 passed fail/error/skip0; broad real Chromium68 passed.101 owned picker/101 linked6page boundary, UI/API/direct parameterized SQL matrix, actual ADMIN/member/removed-owner/CSRF/IDOR, retained archive/Home200, no inheritance, screenshots/i18n/themes/keyboard ve cache/metadata/TaskMode/chat/logo/banner/landing regressions pass. Org page query size30=5/size100=5. task7-backend.log/task7-ui-final-ui.log/task7-junit.json.

## Implementation handoff

Ayrı [remediation completion](docs/compliation/2026-10-05-organization-project-integration-remediation.md) current final verdict, closed findings, API/DB/cache/security, commands/results ve manuel kontrol adımlarını içerir. İlk audit completion implementation kanıtı olarak kullanılmadı.

### Task 8 evidence

Canonical pre-push PASSED exit0: full backend464 fail/error/skip0; ESLint/TypeScript/production build; full Chromium232 passed+1 expected production crash-route skip; Docker build/start/health. Bağımsız full Chromium232+1 skip de exit0. OP-001..006/OP-R1 CLOSED, FULLY ALIGNED yalnız approved scope. Ayrı remediation completion ve API/security/DB/architecture/design/checklist/report güncel. Branch/HEAD/index korundu; package/lock/ENV/Compose/migration unchanged; npm dev5 high debt separate/prod0. Dev3000 ve backend8080 HTTP200. Commit/push/staging yok.
