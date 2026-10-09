# Organization ↔ Project Integration Audit

Tarih: 2026-10-05. Kaynak: `.agents/PDA_Organization_Project_Integration_Audit_and_Plan.md` bölümler 1–39 ve implementation handoff'unun tamamı; `frontend/CLAUDE.md` ve yönlendirdiği `frontend/AGENTS.md` okundu. Bu teslim audit ve plan içerir; production düzeltmesi uygulanmadı.

## Remediation final status — 2026-10-05

**FULLY ALIGNED (approved Organization ↔ Project scope).** OP-001…OP-006 ve yeniden üretilen OP-R1 CLOSED. Nullable FK/cardinality, independent ProjectMembership ve retained archive policy korundu. Plan Task1–8 implementation→targeted test→DoD→checkbox sırasıyla tamamlandı. Final canonical gate exit0:464 backend tests,232 Chromium passed+1 expected production skip, lint/type/build/Docker build/start/health. Production audit0; existing5 high dev dependency debt ayrı.

| Feature | Final status / evidence |
| --- | --- |
| Standalone / linked create | CONNECTED; real UI/body/physical NULL-or-UUID |
| Assign / remove / move | CONNECTED; explicit none, SQL round-trip, owner/project scope |
| Organization projects list | CONNECTED; server pagination,101 boundary,loading/error/retry/filter-aware empty |
| Rename / affected cache | CONNECTED; warm client navigation, old/new prefixes, no mutation reload |
| Co-manager summary / navigation | CONNECTED; correct label, plain text without detail capability, owner-only API preserved |
| Archived organization Home | CONNECTED; Home200/null + retained FK, no rollback-only |
| Archive/association concurrency | CONNECTED; red→green deterministic PostgreSQL barrier, existing lock reuse |

Full changed-files/API/test/manual-control evidence is in [separate remediation completion](docs/compliation/2026-10-05-organization-project-integration-remediation.md). No commit/push/staging. **The original 17 sections below are the historical initial audit snapshot**, including its then-open findings and PARTIALLY ALIGNED verdict; they are retained as before/after evidence, not the current open issue list.

## 1. Executive Summary

Temel model gerçek ve doğru: `projects.organization_id` nullable UUID/FK; Organization 0..N Project, Project 0..1 Organization. Standalone ve organizasyonlu create gerçek browser POST + doğrudan PostgreSQL ile doğrulandı. Assign/remove/move backend'de persist ediyor; association proje üyeliği kazandırmıyor. Foreign organization UUID create/update 403, olmayan/archived hedef 404.

Ancak kullanıcı akışları eksiksiz değil: archive sonrası Project Home transaction hatası, UI'da association kaldırma seçeneğinin olmaması, move sonrası sıcak organization-project cache, co-manager için yanlış organization label ve erişemediği detail'a link. Organization proje listesinin hata/loading davranışı da eksik. Mevcut mimariyi değiştirmek gerekmiyor; sınırlı backend/UI/cache düzeltmeleri gerekiyor. [Checkbox planı](PDA_ORGANIZATION_PROJECT_INTEGRATION_PLAN.md).

## 2. Overall Verdict

**PARTIALLY ALIGNED**.

Data model ve güvenlik çekirdeği çalışıyor; remove UI ve archive/Home gibi önemli akışlar eksik/bozuk. FULLY ALIGNED denemez. Verdict bu kapsam içindir; tüm proje için security veya release sertifikası değildir.

İncelenen source: `project-service-backend`, HEAD `9831a0bb2b7bb853892043f6bca6e30532ada4d4`. Başlangıçta yalnız kullanıcı prompt'u untracked; tracked kaynak/index değiştirilmedi. Runtime mevcut localhost3000 Next dev, localhost8080 backend ve PostgreSQL container'ı. İmaj `sha256:cf841c0ff135e89d9fd77b90fe800dbc2188c609a3627ae7e65e5f9e114f09bf`; kaynakla birebir reproducible build hash eşlemesi yapılmadı, servisler rebuild/restart edilmedi. Code ve runtime aynı ilgili contract/bug yolunu gösteriyor; bu sınır rapora dahil edildi.

## 3. Current Data Model

[V21](backend/src/main/resources/db/migration/V21__project_organization_initial.sql), [Project](backend/src/main/java/com/pda/project/domain/entity/Project.java), [Organization](backend/src/main/java/com/pda/project/organization/domain/Organization.java), [V22](backend/src/main/resources/db/migration/V22__project_initial_membership.sql), V23:

```sql
organizations(id UUID PRIMARY KEY, owner_user_id UUID NOT NULL,
              status VARCHAR(20), archived_at TIMESTAMPTZ, ...)
projects(id UUID PRIMARY KEY,
         organization_id UUID REFERENCES organizations(id),
         created_by UUID NOT NULL, archived_at TIMESTAMPTZ, ...)
CREATE INDEX ix_projects_organization_active
  ON projects(organization_id, archived_at);
```

Gerçek DB inspection: organization_id `uuid`, nullable **YES**; `projects_organization_id_fkey` yukarıdaki FK, delete action **NO ACTION** (`confdeltype=a`); index fiziksel olarak mevcut. Association için unique organization_id veya proje sayısı CHECK'i yok. Bir scalar kolon Project'in tek organization'a bağlı olmasını sağlar; FK varlık bütünlüğünü korur, active/owner kontrolü service sorumluluğudur.

Archive soft lifecycle: Organization archive yalnız organization satırını değiştirir; Project FK'leri korunur, projeler standalone'a çevrilmez veya archive edilmez. Project archive organizasyonu/sibling projeleri değiştirmez. Hard-delete endpoint yok; FK referenced organization hard-delete'ini engeller, cascade data loss yok. Yeni migration/backfill temel ilişki için gerekli değil. Mevcut null projeler runtime ve repository round-trip'te korunur.

## 4. GitHub-Style Semantic Comparison

Buradaki karşılaştırma prompt'un kavramsal hedefidir; GitHub'ın güncel ürün yetkilerinin birebir kopyası değildir.

| Hedef | PDA | Sonuç |
| --- | --- | --- |
| Standalone Project | nullable FK, UI create → DB null | SUPPORTED |
| Organization altında Project | owned active hedef, UI POST → FK | SUPPORTED |
| Organization 0..N Project | 3 linked proje runtime; DB business count cap yok | SUPPORTED |
| Project yalnız tek organization | scalar organization_id | SUPPORTED |
| Association opsiyonel | backend null; UI ilk create'te seçmemek mümkün | SUPPORTED |
| Association/access ayrı | ProjectMembership + RolePolicy; owner auto access yok | SUPPORTED |
| Organization'dan çıkarma | PUT null persist ediyor; UI seçeneği yok | PARTIAL |
| Başka organization'a taşıma | UI PUT ve DB A→B çalışıyor, eski liste cache'i kalıyor | PARTIAL |
| Org archive proje verisini korur | FK retained, proje detail200; Home403 bug | PARTIAL |
| Org sahibi bütün projeleri otomatik görür | association + active project membership filtresi | DIFFERENT BY DESIGN |

100+ organization picker doğrulandı. 100+ **project** runtime boundary bu turda kurulmadı; sorgu/DB'de toplam100 business limiti yok, API page size max100 ve UI sayfalaması var. Sınırsız performans garantisi verilmez.

## 5. Endpoint Inventory

Kaynaklar: [OrganizationController](backend/src/main/java/com/pda/project/organization/api/OrganizationController.java), [ProjectController](backend/src/main/java/com/pda/project/api/ProjectController.java), [SecurityBaselineConfiguration](backend/src/main/java/com/pda/auth/infrastructure/config/SecurityBaselineConfiguration.java). Session=mevcut cookie authentication; mutasyonlar CSRF ister. Body'deki owner/sender değil principal kullanılır. Unauthorized401, yetki/CSRF403, missing/archived404; malformed/validation400. İlgili controller'lar PageRequest için page≥0/size1..100, name ascending uygular.

| Method | Path (`/api/v1` altında) | Auth | Request | Response | Organization etkisi |
| --- | --- | --- | --- | --- | --- |
| POST | `/organizations` | session+CSRF | name, description?, notes?, website?, contactEmail?, location? | 201 OrganizationResponse+Location | principal owner |
| GET | `/organizations` | session | page/size | 200 owned active page | picker kaynağı |
| GET | `/organizations/{id}` | active owner | UUID | 200 OrganizationResponse | başka owner403 |
| PUT | `/organizations/{id}` | active owner+CSRF | full metadata | 200 profile | rename; association değişmez |
| POST | `/organizations/{id}/archive` | active owner+CSRF | body yok | 204 | FK retained; hedef yeni assignment'a kapanır |
| GET | `/organizations/{id}/projects` | session; active org+project membership | page/size | 200 PageResponse<ProjectResponse> | owner kontrolü **yok**, yalnız caller-visible projeler |
| POST | `/projects` | session+CSRF | name, description?, organizationId?, projectType?, tagline?, techStack? | 201 ProjectResponse+Location | null veya owned active FK; ilk manager |
| GET | `/projects` | session | page/size | 200 membership-scoped card page | standalone ve linked aynı ProjectResponse |
| GET | `/projects/{id}` | PROJECT_VIEW | UUID | 200 ProjectResponse | nullable organizationId |
| GET | `/projects/by-slug/{slug}` | PROJECT_VIEW | slug | 200 ProjectResponse | settings kaynağı |
| GET | `/projects/{id}/home` | PROJECT_VIEW | UUID | 200 HomeResponse normalde | organization id/name/slug veya null; archived linked case gerçek403 bug |
| PUT | `/projects/{id}` | PROJECT_UPDATE+CSRF | name, priority, status zorunlu; diğer metadata ve organizationId? | 200 ProjectResponse | assign/remove/move; changed non-null hedef owner/active |
| POST | `/projects/{id}/archive` | PROJECT_ARCHIVE+CSRF | body yok | 204 | org/sibling korunur; aktif listeden çıkar |

Ayrı assignment/removal endpoint yok; full project PUT kullanılır. **PUT'ta organizationId null/eksik temizler**; aynı ID korunur. Değişmeyen ID için org owner denetimi tekrarlanmaz: başka co-manager metadata'yı kaydedebilir. Yeni/changed ID yalnız actor-owned active org olabilir. Archived ID aynı kalırken edit policy ayrıca regression'da korunmalı; bunu yeni assignment ile karıştırmamak gerekir.

Safe bodies: `{"name":"Example Project","projectType":"WEB"}`, `{"name":"Example Project","priority":"MEDIUM","status":"PLANNING","organizationId":null}`. Non-null UUID gerçek owned active QA organization ile değiştirilmeli. Organization metadata/media yardımcı yolları association inventory kapsamı dışıdır; mevcut owner media policy değişmez. Swagger mevcut izinle `http://localhost:8080/swagger-ui/index.html`; cookie session/CSRF normal akış. ENV/security açılmadı.

## 6. Backend Integration

[ProjectService](backend/src/main/java/com/pda/project/application/service/ProjectService.java): create non-null org için `organizations.detail(actor,id)` ardından Project ve ilk manager membership saveAndFlush; null için organization lookup yok. Update önce PROJECT_UPDATE, changed non-null organization için owner/active check; domain `updateDetails` organizationId'yi doğrudan değiştirir. Remove/move transaction içinde gerçek persistence.

[OrganizationService](backend/src/main/java/com/pda/project/organization/application/OrganizationService.java) detail/listOwned owner-scoped; update/archive mevcut `lockedOwned` ve organization PESSIMISTIC_WRITE kullanır. Project association doğrulaması ise **unlocked detail** kullanır; archive↔assignment check/write yarışı için ortak lock yok (OP-R1 risk; kontrollü concurrency reproduction bu turda yapılmadı).

[ProjectRepository](backend/src/main/java/com/pda/project/infrastructure/repository/ProjectRepository.java) `findVisibleInOrganization`: organization_id + project.archivedAt=null + active caller membership EXISTS. Scalar entity fields üzerinden page ve count; organization/member başına lazy relation fetch yok. History'deki farklı internal `findByOrganizationIdAndArchivedAtIsNull` public visible endpoint yerine kullanılmıyor. Ölçülmüş SQL sayısı/latency benchmark bu turda yok; geniş N+1 garantisi yerine bu scoped sorgu analiz edildi.

## 7. Frontend Integration

- [create](frontend/src/features/projects/components/project-create-page.tsx): allOwned query, optional organization field; `organizationId || undefined` gerçek POST body. İlk seçim yapılmazsa omitted field server'da null. Select yalnız owned org seçenekleri içeriyor; **bir org seçildikten sonra geri “none” item'ı yok**.
- [settings](frontend/src/features/projects/components/project-settings-form.tsx): ProjectResponse.organizationId form default; owned picker; gerçek PUT. Select yalnız owned items, none item yok. Liste boşsa entire field gizleniyor; foreign-owned mevcut association owned listede bulunmazsa label “Organizasyon yok” fallback'i veriyor, UUID hâlâ gerçek Project'te mevcut.
- [org detail](frontend/src/features/organizations/components/organization-detail.tsx): profile owner GET başarılı olunca ayrı backend projects query; gerçek ProjectRow ve PaginationBar. Profile403 ise member-scoped projects API erişilebilir olsa bile detail ekranı açılamaz. Projects query için loading/error/refetch UI yok.
- [Home](frontend/src/features/projects/components/project-overview.tsx): gerçek Home.organization id/name/slug → link; null branch güvenli. Link organization ownership capability'sini dikkate almıyor; co-manager403.
- [ProjectResponse](backend/src/main/java/com/pda/project/api/dto/response/ProjectResponse.java), [cards](frontend/src/features/projects/components/project-card.tsx): global list aynı project sistemi, yalnız organizationId; organization name/logo kartta gösterilmiyor. Bu sunum eksikliği temel relation'ın sahte olması değildir; kart badge/logo eklemek ayrı ürün tercihi, bu planda zorunlu yeni özellik yapılmadı.

## 8. Frontend ↔ Backend Mapping

| Feature | Frontend | Backend API | DB persistence | Authorization | Status |
| --- | --- | --- | --- | --- | --- |
| Standalone Project | create→API→detail/Home/settings | POST projects, GET by-slug/home | browser POST omitted → direct DB null | session, ilk manager | CONNECTED |
| Project → Organization | create picker/allOwned | POST projects | selected UUID doğrudan FK | active owner target | CONNECTED |
| Organization → Projects list | detail/query/ProjectRow/pagination | GET org/id/projects→visibleInOrganization | organization_id query | caller project membership; profile owner-only | PARTIAL |
| Remove Organization | settings none seçimi yok | PUT null mevcut | direct DB null + Home null doğrulandı | PROJECT_UPDATE | PARTIAL |
| Move Organization | settings select/save | PUT A→B | DB B, server A excludes/B includes | update + target owner | PARTIAL |
| Rename propagation | org form→invalidation→Home/pickers | PUT org, GET Home | fresh name | owner mutation/member Home | CONNECTED |
| Current org co-manager label | owned-only name lookup | Project detail/Home doğru ID/name | non-null association | co-manager metadata edit allowed | BROKEN |
| Archived org Project Home | overview/home query | GET home | FK korunuyor | member yetkili olmasına rağmen runtime403 | BROKEN |
| Global standalone/linked Project list | same ProjectCard/Row | GET projects | aynı Project entity | membership scoped | CONNECTED |

Mapping chain: UI input → API serialization → controller DTO → ProjectService owner/permission → domain field → repository/FK → response.organizationId/Home.organization → Query cache → UI. Son UI/cache halkasındaki PARTIAL/BROKEN sonuçlar server association'ın mock olduğunu göstermez.

## 9. Authorization & IDOR

Runtime: own active assignment201/200; foreign UUID create/update403; unknown UUID404; archived new assignment404. Non-owner organization detail403 fakat aynı organization projects API active project membership ile200; bu kasıtlı endpoint ayrımı. Global ADMIN owner veya project member yerine geçmez (source policy + ProjectApiIntegrationTest mevcut authorization case'leri); bu turdaki runtime hesaplar normal QA manager/co-manager, runtime ADMIN matrisi kurulmadı.

Project access association'dan türetilmez. Ortak yönetici zaten bağlı olunan başka sahibin organization ID'sini değişmeden kaydedebilir; bu IDOR bypass değildir. Yeni foreign ID reddedilir. Organization ownership/üyelik modeli genişletilmemeli. Owner bütün linked projeleri değil, aktif üyeliğinin olduğu projeleri görür.

## 10. Database Persistence

`.local/org-project-audit/runtime.json` doğrudan `projects WHERE id IN (yalnız QA UUID)` okumalarını içerir. Browser standalone→NULL, linked→A; API ile iki ek linked proje→A (server total3); UI move→B; API remove→NULL; standalone assign→A. Project archive yalnız o project's archived_at; organization active kalır. Org archive diğer aktif projelerin FK'sini A tutar, project detail200; hard-delete/data-loss yok.

`.local/org-project-audit/schema.json` fiziksel nullable/FK/index ve image/health kanıtı. Repository testi yeni EntityManager/clear ile organization metadata round-trip ve linked/archived/standalone filtreyi doğrular. Eski migration'lar değiştirilmedi; audit sırasında schema veya migration uygulanmadı.

## 11. Cache Consistency

[organizationKeys/helper](frontend/src/features/organizations/queries.ts): `['organizations']` root, list/detail/projects(id,page)/picker; org mutation root + `['projects',id,'home']` predicate invalidate ediyor. Rename mevcut 101-picker ve Home regression testinde **geçti**. Kartta org adı bulunmadığından rename stale-card iddiası yapılmaz.

Project settings save/archive ve linked create ise yalnız `['projects']` invalidate ediyor. Organization projects ayrı root altında, buna dahil değil. Provider staleTime30s, focus refetch kapalı. Gerçek client navigation: sıcak A detail → P1 → settings B/save → org list → A; UI P1'i hâlâ gösterdi, bağımsız server GET A'da yoktu. Reload sonrası kayboldu. OP-003 kesin CACHE ISSUE. Create/archive/metadata update sibling tüketicileri aynı eksik invalidation'ı paylaşıyor; bu ayrı varyantların hepsi runtime tekrarlanmış sayılmaz, plana regression olarak eklendi.

## 12. Runtime / E2E Evidence

| Koşum | Gerçek sonuç |
| --- | --- |
| `backend/mvnw.cmd -Dtest=ProjectApiIntegrationTest,ProjectRepositoryTest,OrganizationServiceTest,OrganizationRepositoryTest test` | exit0; 24 passed, fail/error/skip0 (15+4+2+3), Docker/Testcontainers mevcut |
| `node .local/org-project-audit/runtime.cjs` | final exit0; 16 case gözlemi; gerçek Chromium, HTTP body/status, direct DB; **harness exit0 bulguların düzeldiği anlamına gelmez**, bozuk davranışları da kaydeder |
| `npx.cmd playwright test e2e/organization-integration-regressions.spec.ts --project=chromium` | final exit0, 2 passed; 101. owned organization ve warm rename→Home |
| Runtime backend logs | `UnexpectedRollbackException`, `marked as rollback-only`, `ProjectHomeService.summary`; filtered home-transaction.log |
| Git source check | HEAD9831a0b, tracked/index diff yok; production/test/config kaynakları değişmedi |

Başlangıç runtime harness locator yanlış Türkçe etikete bakıyordu; gerçek katalog etiketi ve form-specific submit locator ile düzeltildi. Bir reuse-auth koşumunda expired eski fixture nedeniyle project.slug undefined ve404 oluştu; application regression sayılmadı. Normal global setup/taze auth ile iki test geçti, final wrapper stderr uyarısından bağımsız process exit0 kaydetti. Bu hatalar gizlenmedi.

Normal başarılı akışlarda route.fulfill kullanılmadı. Kullanıcı kaynaklarına dokunulmadı; harness yalnız kendi oluşturduğu projeleri/organizasyonları archive etti. QA hesapları/arşivli satırlar DB'de kalabilir; başarısız ilk harness'in foreign QA org'u cleanup kapsamından çıkmış olabilir, kullanıcı verisini silmek için genel cleanup yapılmadı. Auth/password/token ham kayıtları rapora/trace linkine konmadı; özel artifacts `.local/org-project-audit/` Git dışında. Full regression/pre-push **bu audit turunda çalıştırılmadı**; implementation yapılmadığı için eski full gate sonuçları yeni kanıt sayılmadı. Remediation final kapısında zorunlu.

## 13. Mock / Fake Audit

Scoped production files `mock/fake/dummy/placeholder/TODO/stub/local-only/preview` bağlamıyla tarandı. Association gerçek JSON DTO/service/FK'de; fake organization project count, local-only link veya client-side relation filtering bulunmadı. UI initial draft/selection ve TanStack server cache persistence yerine geçirilmedi. Organization form/ProjectCard preview unsaved görsel draft: **INTENTIONAL**; landing demo verisi **DEV/DEMO**; E2E fixtures/auth **TEST-ONLY**. Preview object URL production POST/FK kanıtı değildir. Finding “Organizasyon yok” yanlış lookup fallback'idir, sahte backend relation değil.

## 14. Findings by Severity

| ID | Severity / sınıf | Kanıt, kök neden | Minimum öneri |
| --- | --- | --- | --- |
| OP-001 | HIGH / BUG | Org archive sonrası project detail200 ama Home403. ProjectHomeService.organizationSummary catch ediyor; proxied OrganizationService.requireActive REQUIRED transaction'ı rollback-only işaretliyor. Log UnexpectedRollbackException; HTTP error dispatch bunu403 sunuyor. | Normal absent/archived durum için exception atmayan optional active lookup; outer transaction sağlıklı kalsın. Home200+organization:null regression. Auth/error dispatch'i gevşetme. |
| OP-002 | MEDIUM / MISSING FEATURE + UX MISMATCH | Settings ve create SelectContent yalnız org items; runtime12 item, none item0. Backend PUT null/remove çalışıyor; kullanıcı UI'dan yapamıyor/selection'ı geri alamıyor. Liste empty ise settings field gizleniyor. | Açık none sentinel→create omitted/update null mapping, schema uyumu; linked→standalone gerçekUI/DB testi. |
| OP-003 | MEDIUM / CACHE ISSUE | A→B UI/DB doğru; warm A UI hâlâ P1, server excludes; reload temizler. Project mutation yalnız projects root invalidation. | affected old/new org projects prefix invalidation; create/update/archive varyantları gerçek client-navigation regression. |
| OP-004 | MEDIUM / BUG | Co-manager project.organizationId=A; settings label “Organizasyon yok”. allOwned listesinde A yok, fallback yanlış. | Mevcut safe Project Home organization summary ile current label; target seçenekleri owned kalsın. Archived/current unavailable branch doğru açıklansın; null ile karıştırma. |
| OP-005 | LOW / UX MISMATCH | Co-manager Home organization link→detail403, project membership geçerli; API detail owner-only. | Safe capability ile link/plain-text ayrımı; owner/permission genişletme. |
| OP-006 | LOW / UX MISMATCH | OrganizationDetail projects query data dışında isLoading/isError/refetch kullanmıyor; başarısız/slow GET boş section bırakır. Ayrıca noProjects “hiç projesi yok” diyor, actual list yalnız caller-visible. | Ayrı projects loading/error/retry ve membership-filtered empty metni TR/EN/DE; gerçek normal akış ve ayrı TEST-ONLY failure. |

**OP-R1 (MEDIUM risk; doğrulanmış bug değil):** create/update changed organization için unlocked detail check ve archive exclusive lock aynı synchronization boundary'yi paylaşmıyor. Concurrent archive/association TOCTOU mümkün görünüyor; bu turda deterministik concurrency runtime kanıtı yok. Önce barrier PostgreSQL testinde yeniden üret; teyit edilirse mevcut lockedOwned veya uygun shared organization lock'u write transaction boyunca kullan. Global trigger/new infrastructure tasarlama.

Kartta org name/logo yok (INFO, mevcut sunum); buna yönelik zorunlu yeni ürün taskı uydurulmadı. Organization project PageResponse/ProjectRow yolunda dead endpoint kanıtı yok; tüm repo dead-code garantisi verilmez.

## 15. Bugs vs Missing Features vs Different-by-Design

OP-001/004 BUG, OP-003 CACHE ISSUE; OP-002 UI desteği eksik, OP-005/006 UX MISMATCH. OP-R1 kanıt bekleyen DATA INTEGRITY risk. Nullable scalar FK, independent membership, owner-only profile, membership-filtered projects ve retained associations archive policy **DIFFERENT BY DESIGN**, bunları GitHub'a benzetmek için değiştirme. Kesin IDOR/security bypass veya temel cardinality DATA MODEL ISSUE bulunmadı; sınırlı kanıt global güvenlik garantisi değildir.

## 16. Remediation Plan

[PDA_ORGANIZATION_PROJECT_INTEGRATION_PLAN.md](PDA_ORGANIZATION_PROJECT_INTEGRATION_PLAN.md): baseline/policy → Home transaction+conditional race → optional association UI → current summary/capability → affected cache → projects-list states → real DB/browser/security/performance → full gate/documentation. Hiçbir implementation checkbox bu audit'te [x] yapılmadı. Yeni DB model/org membership/microservice gerekmez. Product archive policy B (retain inactive org FK) korunur; otomatik detach/cascade planlanmadı.

## 17. Final Recommendation

Temel Organization–Project mimarisini koru. Önce HIGH Home bug'ı, sonra remove/current-label/cache akışlarını düzelt. Mevcut 24+2 test yeşil olsa da kabul boşlukları gerçek runtime'da çıktı; yeni regression case'leri şart. Remediation sonrasında FULLY ALIGNED verdict ancak create/assign/remove/move/archive/cache/IDOR + fresh DB/browser ve full pre-push kanıtıyla verilmeli.

Bu teslim yalnız rapor/plan ve [audit completion](docs/compliation/2026-10-05-organization-project-integration-audit.md) içerir; production code, migration, ENV/security, test source veya Git index değişmedi. Commit/push/pull/merge/branch değişimi yok. Kullanıcı planı onaylamadan düzeltme uygulanmaz.
