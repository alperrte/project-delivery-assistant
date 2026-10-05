# PDA — Backend Integration & Mock Audit Planı

Tarih: 2026-10-05

Durum: Faz 1–8 tamamlandı. Üç doğrulanmış bug ayrı kullanıcı onaylarıyla düzeltildi; son kaynak tam kapısı PASSED (exit 0). Final verdict: FULLY CONNECTED (yalnız tanımlanan audit kapsamı).

Kaynak: `.agents/PDA_End_to_End_Backend_Integration_Mock_Audit.md` belgesinin A–R bölümlerinin tamamı. İlk teslim yalnız plandı; yürütme sonuçları bu belge ve `PDA_BACKEND_INTEGRATION_MOCK_AUDIT_REPORT.md` içinde güncellenir. Önceki completion kayıtları ve başarılı test sayıları yeni audit'in kanıtı sayılmadı.

## 1. Amaç ve sınırlar

Organization profilinin name, description, notes, website, contactEmail, location, logo ve cover alanlarını; create/edit/detail/list/card/preview akışlarını; project settings logosunu ve minimized chat yaşam döngüsünü gerçek kod, API, PostgreSQL, dosya sistemi ve Chromium üzerinden doğrulamak.

- Yeni ürün özelliği veya geniş refactor yapılmayacak. Audit sırasında production kodu değiştirilmeyecek; kesin bug'lar için ayrı kullanıcı onayı sonrası minimum düzeltme yapılabilir. Onaylanan istisnalar: AUD-001 picker pagination, AUD-002 Project Home cache invalidation, AUD-003 socket overlap MESSAGE dedup.
- Kesin bug bulunursa önce yeniden üretim, kök neden, severity ve minimum fix önerisi raporlanacak. Düzeltme kullanıcı kararından sonra ayrı adım olacak.
- Commit, push, pull, merge, branch değişimi ve staging yapılmayacak. Mevcut staged/unstaged değişiklikler korunacak.
- `.env`, güvenlik politikası, yetki modeli, CSRF ve CORS değiştirilmeyecek. İhtiyaç doğarsa SECURITY kuralları kapsamında somut değişiklik ayrıca sunulacak.
- Test fixture, hata enjeksiyonu, form önizlemesi ve production veri akışı ayrı değerlendirilecek.

## 2. Plan hazırlığında koddan görülen başlangıç noktaları

Bu gözlemler çalışma rotasını belirler; uçtan uca başarı sonucu değildir.

| Alan | Mevcut dosya / gözlem | Audit'te tamamlanacak kanıt |
|---|---|---|
| Organization API | `frontend/src/features/organizations/api.ts`: metadata için POST/PUT, medya için multipart PUT ve DELETE; versioned GET kaynakları | Gerçek browser istekleri, controller sözleşmesi, DB ve yeniden yüklenen UI eşleşmesi |
| Controller | `backend/src/main/java/com/pda/project/organization/api/OrganizationController.java`, `OrganizationMediaController.java` | Security matcher ve service owner denetimiyle birlikte endpoint inventory |
| Metadata migration | `V52__organization_profile_and_media.sql`: website/contact_email/location/logo_key/cover_image_key ve media ledger; `V53__organization_notes.sql`: notes VARCHAR(1000) | Uygulanan Flyway history, entity eşleşmesi ve yeni transaction'da DB okuması |
| Form | `organization-form-page.tsx`: önce metadata, sonra iki medya işlemi, sonra detail okuması; başarısız medya için retry | Gerçek başarısızlıkta yanlış success, mükerrer POST veya kaybolan metadata olup olmadığı |
| Query | `queries.ts`: ortak `["organizations"]` kökü, list/detail/projects/picker anahtarları | Tüm gerçek tüketicilerle prefix eşleşmesi ve mutation sonrası taze görüntü |
| Storage config | `docker-compose.yml`: `pda_organization_media` volume; `application.properties`: configurable storage path | Çalışan container mount'u, byte eşitliği ve yeniden oluşturma sonrası dosya kalıcılığı |
| Project logo | `project-logo-field.tsx`: projectsApi upload/delete ve `["projects"]` invalidation | Soğuk settings açılışında backend detail GET, logo GET, cache kapalı yeniden yükleme |
| Chat | `app-shell.tsx`: ortak ChatProvider/ChatRoot; provider generation ve socket cleanup kodu | Navigasyon, proje/hesap değişimi, X, logout ve gerçek iki kullanıcı mesaj teslimi |

### Mevcut testlerde görülen kanıt boşlukları

- `frontend/e2e/organization-profile.spec.ts` create testi API detail ve kart görsellerini kontrol ediyor; create sonrası bütün alanların reload ile doğrulanması açıkça yok. Edit testi notes ve yeni logo sürümünü kontrol ediyor; reload adımı medya kaldırma ve enjekte edilen cover 404 senaryosunun sonunda bulunuyor. Notes/location + logo replacement sonrasında ayrı reload kanıtı alınacak.
- `frontend/e2e/project-logo-settings.spec.ts` mevcut logo, replacement, cache, fallback ve hata senaryolarını içeriyor; dosyada açık `page.reload()` adımı yok. Cache'den bağımsız settings açılışı özellikle doğrulanacak.
- Organization normal akış testlerinde her POST/PUT/multipart/DELETE için method, body ve status doğrulaması ayrı ayrı yapılmıyor. Hata enjeksiyonu testlerindeki request sayımı normal başarılı akışın yerine geçmeyecek.
- Bunlar test kapsamı/kanıt boşluklarıdır; şu aşamada uygulama bug'ı ilan edilmeyecek. Bu plan hazırlanırken testler çalıştırılmadı.

## 3. Uygulama sırası ve çıktılar

### Faz 1 — Çalışma durumu ve güvenli kanıt toplama

1. Git branch/HEAD, staged/unstaged dosya listesi ve çalışma zamanı sürümlerini kaydet. Kaynak değişikliklerinin audit sırasında aynı kaldığını kontrol et.
2. Backend health, frontend portu, PostgreSQL durumu ve container/image kimliğini salt okunur incele. Çalışan imajın güncel kaynakla eşleşmediği durumda bunu test koşulu olarak raporla.
3. İlgili API/database/auth/deployment belgelerini ve kabul edilmiş ADR'leri kodla karşılaştır. Plan/checklist başarı işareti kanıt sayılmayacak.
4. Yerel özel QA çıktılarını `.local/integration-audit/` altında tut. Çerez/token/password/gerçek ENV değerleri rapora, screenshot'a veya request kayıtlarına alınmayacak. Ham trace/auth dosyaları Git'e eklenmeyecek.

Çıktı: ortam özeti, kapsam listesi ve kanıt indeksi.

### Faz 2 — Gerçek endpoint inventory (B, F, J)

1. Organization iki controller'ının class/method mapping'lerini birleştir. Logo ve cover çoklu mapping'lerini ayrı satırlara aç.
2. POST create, GET list/detail/projects, PUT update, POST archive ve PUT/GET/DELETE logo/cover yollarını gerçek DTO/status bilgisiyle kaydet.
3. Project settings logo ve chat'in REST + WebSocket endpointlerini kendi controller/config dosyalarından çıkar; frontend API client base URL, credentials, CSRF ve refresh davranışıyla karşılaştır.
4. Her endpoint için method, tam path, auth/owner/project permission, request/response, başarı/hata status'ları, gerçek frontend çağıran dosya ve kullanım/dead durumunu yaz.
5. Frontend referansı yoksa tüm repo referanslarını kontrol et; başka tüketicisi olan endpointi otomatik dead code sayma.

Çıktı: controller'dan türetilmiş Endpoint Inventory. Swagger açıksa mevcut `/v3/api-docs` ile karşılaştır; kapalıysa yalnız audit için ENV değiştirme. Manuel Swagger yolu mevcut izinle `/swagger-ui/index.html`, normal login/CSRF akışıdır.

### Faz 3 — Alan bazında tam veri zinciri (A, C, F, G)

Her alanı ayrı satırla şu zincirde izle:

`input/state → API method/path/body → controller → DTO validation → service → entity/repository → DB column → response DTO → query/cache → gerçek UI`

- Name/description/notes ayrımı, sınırlar, trim, null/blank, full PUT'ta eksik alan davranışı ve eski kayıt uyumluluğu.
- V52/V53, `organizations` kolonları, `organization_media_objects` constraints ve entity mapping'leri. DB okumasında yalnız QA kayıtlarını seç; JPA first-level cache yerine yeni transaction/EntityManager temizliği veya doğrudan parametrik SQL kullan.
- Create/edit/detail/list/card/preview tüketicilerini ayrı incele. Preview unsaved draft gösterebilir; bunu server persistence olarak değerlendirme. Görünmesi ürün gereği olmayan alanları kartta eksik bağlantı sayma.
- Organization list/detail/picker/settings ve varsa header/sidebar'ın gerçek query anahtarlarını çıkar; invalidate köküyle eşleştir. Mutation sonrası geri dönme, tekrar açma ve reload senaryolarında eski veri/görsel kalıp kalmadığını gözle.
- Logo/cover version kaynağının gerçek response'dan geldiğini ve replacement/remove sonrası değiştiğini/null olduğunu doğrula.

Çıktı: tüm kapsam satırlarını içeren Frontend ↔ Backend Mapping ve Database Persistence tabloları.

### Faz 4 — Medya yaşam döngüsü (D)

1. Multipart formdan bounded okuma, signature/dimension/type/size validation, `MediaStorage`, `FileSystemMediaStorage`, object key ve DB ledger zincirini izle.
2. Organization bytes'ın private filesystem'de, metadata/reference'ın PostgreSQL'de bulunduğunu gerçek adaptör ve çalışan mount'tan kanıtla. Project logo BYTEA akışını organization storage ile karıştırma.
3. Logo ve cover için replace/remove sonrası eski reference, dosya ve ledger durumlarını kontrol et; başarılı silme, silme hatası/retry, yazma hatasında önceki görselin korunması, expired PENDING ve concurrent replacement senaryolarını mevcut testlerle doğrula.
4. Scheduler'ın cleanup kapsamını incele: ledger ile takip edilen yarım upload/silme ile ledger dışı dosyaları ayır. Tüm orphan türleri temizleniyor varsayma.
5. Host default path ile Docker ENV/mount hedefini karşılaştır. UUID/path containment/symlink ve GET yetki/header denetimlerini incele.
6. QA logo **ve cover** upload → byte hash + metadata → backend container force-recreate → health → tekrar GET/hash + metadata eşitliği. `restart` ve container yeniden oluşturma aynı kanıt değildir; persistent volume iddiası için yeniden oluşturma kullanılacak.

Çıktı: storage lifecycle matrisi; dosya/DB temizliği ve restart kalıcılığı kanıtı. Kullanıcı volume'leri silinmeyecek; `down -v` çalıştırılmayacak.

### Faz 5 — Mock/fake ve dead code (E, F)

1. Repo genelinde prompt'taki tüm sözcükleri `rg` ile ara: mock, fake, dummy, placeholder, hardcoded, TODO, FIXME, temporary, stub, sample, preview-only, local-only, setTimeout, Math.random.
2. Son taskların production yolunu, ortak component/API client'ı, landing demo/dev kodunu ve test fixture'larını takip et. Arama eşleşmelerini bağlamıyla değerlendir; tek başına sözcük bulmak bug değildir.
3. API yerine uydurulan veri, yalnız object URL upload, request olmadan success, cached/mock settings, olmayan endpoint ve persist etmeyen service için semantik inceleme yap.
4. Object URL'nin Save öncesi preview ömrünü ve cleanup'ını; Save'in gerçek multipart'a geçmesini doğrula. Default cover/fallback artwork'ü uploaded image gibi sunuluyorsa ayrıca raporla.
5. Her davranışı INTENTIONAL, DEV-ONLY, TEST-ONLY veya UNINTENTIONAL / BUG olarak sınıflandır; dosya/satır, çağrı yolu, üretime erişim ve gerekçe ekle.

Çıktı: Mock / Fake Audit ve doğrulanmış Dead Code listesi; tahmine dayalı silme yok.

### Faz 6 — Project logo ve chat (H, I)

**Project logo:** kart pencil → settings, backend detail/by-slug response ve logo GET; yeni browser context ile settings URL'sine doğrudan giriş; Chromium cache kapalı reload; version/naturalWidth/backend bytes doğrulaması. Upload/replace/remove sonrası settings/card/header/chat fallback ve yetkiler kontrol edilecek. Network failure fixture'ı persistence kanıtı sayılmayacak.

**Chat:** AppShell/layout/provider mount, selected project ve user kimliği, generation guard, query cleanup, WS/STOMP subscription/renewal cleanup incelenecek. Gerçek iki kullanıcıyla mesaj teslimi ve history DB persistence doğrulanacak. Aynı projede open → bar/compact → Tasks → Calendar → Teams; ayrıca Dashboard/Projects/Organizations/Settings akışı; konuşma/taslak korunması; X → navigation'da yeniden açılmama; proje değişimi, logout ve başka hesapta state izolasyonu test edilecek.

Kalıcı mesaj verisi ile panel UI durumunu ayır: panel durumunun DB'ye yazılmaması tek başına mock değildir. Tam belge/locale reload davranışı ayrı kaydedilecek; kabul edilen navigasyon kapsamıyla karşılaştırılacak. Token renewal sırasında planlı kısa iki socket örtüşmesi kalıcı duplicate bağlantı gibi raporlanmayacak; örtüşme sonunda eski socket cleanup ve mesaj ID dedup kanıtı alınacak.

### Faz 7 — Runtime ve test kanıtları (K, L, M)

Mevcut testlerin gerçek case/body/assertion'larını incele, ardından güncel kaynak üzerinde çalıştır. Eksik kanıtı önce geçici audit harness veya manuel Chromium kontrolüyle tamamla; kalıcı test değişikliği gerekiyorsa kapsamını raporla. Production kodu değiştirilmeden doğrulama yapılacak.

| Senaryo | Başarı kanıtı |
|---|---|
| Org create, 6 metin alanı + logo/cover | Gerçek JSON POST 201; iki multipart PUT 204; ayrı GET 200; cache kapalı reload'da metadata ve gerçek image bytes; QA DB eşleşmesi |
| Org edit notes/location + logo replace | PUT 200 body; logo PUT 204; yeni version/hash; reload'da değişen ve korunması gereken alanlar |
| Logo ve cover remove | Save öncesi request yok; Save'de DELETE 204; DB reference null, cleanup ve reload'da fallback; tekrar remove idempotent |
| Partial upload/retry | Metadata persist eder; kısmi hata açık gösterilir; retry mükerrer create yapmaz; başarı gerçek server response'a bağlıdır |
| Yetki/validation/storage error | Anonymous, foreign owner, ADMIN owner bypass yok, CSRF, geçersiz görsel, storage failure; reddedilen işlem mevcut kaydı bozmaz |
| Migration | Eski organization kayıtları V52/V53 sonrası korunur; notes null; fiziksel round-trip |
| Volume recreate | Logo/cover hash ve metadata recreate öncesi/sonrası aynı |
| Project logo | Soğuk settings + hard reload gerçek detail/image GET ve görünür logo; replace/remove tüm tüketicilerde güncel |
| Chat | Aynı proje navigasyonunda state korunur; X/proje/oturum sınırı doğru; gerçek REST+WS teslim ve kalıcı history; duplicate yok |

Network gözlemcileri işlemden **önce** kurulacak. Yalnız ilgili QA resource method/path/body/content-type/status kaydedilecek; auth header/cookie veya ham HAR paylaşılmayacak. Normal başarılı senaryolarda `route.fulfill` kullanılmayacak. Hata enjeksiyonları ayrı TEST-ONLY kanıt olarak raporlanacak. `page.reload()` tek başına browser image cache'ini bypass etmez; Chromium CDP cache kapatma veya yeni context ile network GET kanıtı tamamlanacak.

Mevcut backend test kaynakları:

- `OrganizationDomainTest`, `OrganizationServiceTest`, `OrganizationRepositoryTest`
- `OrganizationProfileMigrationTest`
- `ProjectApiIntegrationTest`: `organizationExpandedMetadataValidatesAndPreservesMedia`, `organizationNotesRoundTripValidateAndStayOwnerScoped`, `organizationMediaLifecycleSecurityAndCleanupRecovery`
- `FileSystemMediaStorageTest`
- `ChatApiIntegrationTest`, `ChatWebSocketIntegrationTest`, ilgili socket/session testleri

Planlanan hedefli komutlar:

```powershell
# Repo kökündeki terminal; Java/Maven ve Docker/Testcontainers koşulları doğrulandıktan sonra
Push-Location backend
.\mvnw.cmd '-Dtest=OrganizationDomainTest,OrganizationServiceTest,OrganizationRepositoryTest,OrganizationProfileMigrationTest,ProjectApiIntegrationTest,FileSystemMediaStorageTest,ChatApiIntegrationTest,ChatWebSocketIntegrationTest' test
Pop-Location

# Güncel frontend/backend hazırken; eski auth storage'ı tekrar kullanmadan
Push-Location frontend
npx.cmd playwright test e2e/13-organizations.spec.ts e2e/organization-profile.spec.ts e2e/project-logo-settings.spec.ts e2e/17-project-chat.spec.ts --project=chromium
Pop-Location
```

Başarısız komut exit code ve gerçek nedenle raporlanacak. JDK/Maven eksikse mevcut proje Docker test yöntemine geçilecek; container'a Docker socket bağlama gibi özel yetki gerektiren adımlar gerektiğinde somut olarak sunulacak. Gerçek ENV değerleri ekrana basılmayacak; mevcut pre-push betiğinin geçici DB/OAuth hazırlığı korunacak.

Tam pre-push kapısı hedefli audit sonrası ve servis etkileri değerlendirilerek son doğrulama olarak çalıştırılacak:

```powershell
# Repo kökü
.\pre-push\pre-push.cmd
```

Bu betik Maven clean verify, lint, TypeScript/build, tüm E2E ve Docker build/start içerir. Backend runtime audit başlamadan güncel imajla hazır olmalı; betiğin sonundaki build daha önceki E2E'nin güncel backend'i kullandığını tek başına kanıtlamaz. 3000 portunda mevcut süreç varsa yalnız ilgili Next süreci geçici durdurulur ve sonunda önceki servis başlatılır; gerekli servis etkileri kullanıcıya önceden açıklanır. Audit için full gate'den önce ilgili imajı güncellemek/recreate etmek gerekirse mevcut izin kapsamı değerlendirilir.

Test çıktıları test adı, zaman, komut, exit code, pass/fail/skip gerekçesi, source HEAD/dirty durumu ve artifact yolu ile kaydedilecek. Runtime engelliyse test geçti denmeyecek; static kanıt ve doğrulanamayan davranış açıkça ayrılacak. Yalnız QA'nın oluşturduğu kaynaklar temizlenecek; kullanıcı kayıtları korunacak.

### Faz 8 — Sonuç ve teslim (J, N–R)

Mapping tablosunun zorunlu sütunları:

`Feature | Frontend file | API call | Backend endpoint | DB persistence | Status`

Her metadata alanı, create/update/detail/list/card/preview, iki medyanın upload/replace/remove/read, project logo ve chat UI persistence ayrı değerlendirilecek. Status yalnız `CONNECTED`, `PARTIAL`, `MOCK`, `BROKEN`, `DEAD CODE`, `TEST-ONLY`. Full chain kod ve runtime kanıtı tamamlanmadan CONNECTED verilmeyecek; runtime kanıtı eksik satır PARTIAL ve sınırlama açıklamasıyla kaydedilecek. Chat panel state için API/DB n/a; mesaj geçmişi için gerçek backend/DB ayrı satır olacak.

Her bulgu: ID, CRITICAL/HIGH/MEDIUM/LOW/INFO, etkilenen akış, beklenen/gerçek davranış, dosya/satır + endpoint/test kanıtı, yeniden üretim, kök neden, minimum fix. Kanıt eksikliği ile kesin bug ayrı tutulacak. Bulgu yoksa uydurulmayacak.

Final audit raporu prompt'taki sırayı aynen kullanacak:

1. Executive Summary
2. Overall Integration Verdict
3. Endpoint Inventory
4. Frontend ↔ Backend Mapping
5. Database Persistence
6. Media Storage
7. Mock / Fake Audit
8. Project Settings Logo Audit
9. Chat Persistence Audit
10. Runtime / E2E Evidence
11. Findings by Severity
12. Missing Connections
13. Dead Code
14. Final Recommendation

Verdict tek değer olacak: `FULLY CONNECTED`, `MOSTLY CONNECTED`, `PARTIALLY CONNECTED`, `MOCK-INCOMPLETE` (prompt Q biçimi; P'deki MOCK / INCOMPLETE karşılığı). Doğrulanamayan kritik halkalar varken FULLY CONNECTED verilmeyecek. FULLY CONNECTED tüm kapsam kanıtlı; MOSTLY CONNECTED sınırlı ikincil eksik; PARTIALLY CONNECTED önemli bağlantı/kanıt eksik; MOCK-INCOMPLETE temel akışın gerçek server/persistence'a ulaşmaması anlamında kullanılacak.

Audit tamamlanınca `docs/compliation/YYYY-MM-DD-backend-integration-mock-audit.md`, ilgili README biçimiyle hazırlanacak; endpoint/Swagger kontrol yolu, gerçek komutlar, sonuçlar, açık konular ve manuel kontrol adımlarını içerecek. Plan için tamamlanmış audit kaydı oluşturulmayacak. Web checklist'te yalnız bu audit'in gerçekten doğruladığı ilgili davranışlara sınırlı not eklenebilir; global standartlar topluca tamamlanmış sayılmayacak.

## 4. Başlama kararı

İlk teslim yalnız plandı; uygulama/test/config değiştirilmemişti. Kullanıcının başlama kararı sonrasında fazlar sırayla uygulandı: static chain/endpoint inventory → runtime/browser/DB/storage → bulguların bildirimi ve ayrı onaylı minimum düzeltmeler → final kapı/verdict. Audit baseline boyunca production hash'leri aynıydı; düzeltmeler ayrı onay sonrası yapıldı. Commit/push/pull/merge/branch değişimi/staging yapılmadı.

## 5. Yürütme sonucu — 2026-10-05

- Faz 1–2: mevcut Git/runtime durumu, gerçek controller inventory ve OpenAPI GET200 doğrulandı; secrets kaydedilmedi.
- Faz 3–4: tüm metadata, logo/cover replacement/remove, gerçek PostgreSQL ve dosya hash'leri; container ID değişen force-recreate sonrasında iki görsel ve metadata aynı. Project logo yeni context/cache-disabled reload ile gerçek GET/BYTEA kanıtı.
- Faz 5–6: draft preview/landing/test fixture sınıflandırıldı; scoped dead endpoint doğrulanmadı. Gerçek iki kullanıcı REST/WS/history DB; navigation/X/project/account sınırları doğrulandı. Renewal overlap unread bug'ı ayrıca yeniden üretildi.
- Faz 7: hedefli 66 backend ve 44 Chromium test; runtime harness 7 PASS; org fix regresyonları 2 PASS; final tam kapı 415 backend + 182 Chromium + 1 expected skip, lint/TypeScript/build/Docker smoke PASSED.
- Faz 8: AUD-001 picker pagination, AUD-002 Project Home cache, AUD-003 overlap MESSAGE dedup ayrı kullanıcı onaylarıyla RESOLVED. Final verdict FULLY CONNECTED; tek-host volume/ledger cleanup ve panel reload kapsamı raporda açıklandı.
- Final kaynak/index kontrolü: 993 baseline production/config dosyasına göre yalnız 7 onaylı frontend production değişikliği; backendChanged ve değişen kaynakların indexBaselineMismatch listeleri boş. Mevcut staging korundu. Next dev yeniden başlatıldı.

14 bölümlü sonuç ve tüm kanıt tabloları: [audit raporu](PDA_BACKEND_INTEGRATION_MOCK_AUDIT_REPORT.md). Manuel kontrol ve komutlar: [completion kaydı](docs/compliation/2026-10-05-backend-integration-mock-audit.md). Özel evidence `.local/integration-audit/` altında Git dışındadır.
