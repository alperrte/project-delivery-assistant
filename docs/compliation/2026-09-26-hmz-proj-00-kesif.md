# HMZ-PROJ-00 — Project Service kaynak durum keşfi

**Tarih:** 2026-09-26
**Durum:** FAZ 0 keşfi tamamlandı. Uygulama veya migration yapılmadı.

## Kapsam ve task öncesi değerlendirme

- **Amaç:** Project Service, Squad, bağımlı modüller, frontend, migration ve yapılandırmanın gerçek durumunu doğrulamak; HMZ-PROJ-01 için dosya ve test kapsamı çıkarmak.
- **Bağımlılık:** Keşif için hazır. Project persistence uygulaması için veritabanı migration'ı, kullanıcı kimliği sözleşmesi ve Spring paket tarama kapsamı henüz hazır değil.
- **Dokunulan dosya:** Yalnız bu keşif kaydı. Kullanıcının önceden değiştirdiği `.agents/faz-md/hamza.md` korunmuştur.
- **Migration / ENV / API etkisi:** Bu taskta yok. Yeni ENV, dependency, endpoint veya rol sözleşmesi oluşturulmadı.
- **Güvenlik ve çakışma:** Backend yetkilendirmesi, proje sınırı ve Auth/User public contract henüz uygulanmamış. Auth migration ve ortak yapılandırma işleri Alper'in çalışmasıyla çakışabilir.
- **Acceptance:** Gerçek dosya ağacı ve bağımlılıkların doğrulanması, kod değişikliği olmadan sonraki task için somut kapsam çıkarılması.

## Doğrulanan mevcut durum

1. `backend/src/main/java/com/pda/project/` ve `squad/` altında yalnız `.gitkeep` dosyaları var. Project, ProjectMembership, Organization, Invitation, Squad entity/service/controller/repository veya repository integration kodu yok.
2. `auth/`, `user/`, `admin/`, `task/`, `shared/`, `mail/`, `notification/`, `activity/`, `dashboard/`, `search/` paketleri de placeholder. Auth/User public facade, canonical role enum veya permission policy; Work/Task public read contract; mail transport adapter ve notification uygulaması yok.
3. Backend'deki tek uygulama sınıfı [BackendApplication.java](../../backend/src/main/java/com/pda/backend/BackendApplication.java). `@SpringBootApplication` paketi `com.pda.backend`; `com.pda.project` ve diğer kardeş paketleri kapsayan açık `scanBasePackages` / entity / repository tarama ayarı yok. Project kodu eklendiğinde component ve persistence taraması çözülmeli; bu ortak, yüksek çakışma riskli yapılandırma değişikliğidir.
4. Tek gerçek Flyway dosyası [V1__spring_modulith_event_publication.sql](../../backend/src/main/resources/db/migration/V1__spring_modulith_event_publication.sql). Project, organization veya user tablosu yok. Kullanıcının sonraki numara tahsisine göre `V1`–`V20` Alper/Auth, `V21`–`V40` Hamza/Project Service aralığıdır. Mevcut V1 ortak altyapı dosyası yerinde kalır; Auth için yeni numaralar `V2`–`V20` arasından seçilir.
5. [application.properties](../../backend/src/main/resources/application.properties) datasource, `ddl-auto=validate`, Flyway ve Swagger ayarlarını içeriyor. Spring Security dependency'si [pom.xml](../../backend/pom.xml) içinde; projede özel `SecurityFilterChain` veya project authorization implementasyonu yok. Dolayısıyla rollerin ve cross-project erişiminin uygulandığı iddia edilemez.
6. Backend testlerinde yalnız `backend` paketindeki Spring context ve Testcontainers iskeleti var. Project/Squad repository, application, API veya security testi yok.
7. Frontend'de gerçek UI yalnız varsayılan [page.tsx](../../frontend/src/app/page.tsx), layout ve global CSS. `features/projects`, `invitations`, `squads`, `dashboard`, `activity` ile `lib/api` placeholder. Organization, member, settings ve project home arayüzü yok.
8. Kodda HTTP client veya GitHub integration bulunmadı. `spring-boot-starter-webmvc` mevcut; public GitHub REST için şu anda yeni dependency zorunluluğu gösteren bir gereksinim yok. Client seçimi ve URL doğrulama ayrı GitHub tasklarında netleştirilmeli. Public repository yaklaşımında yeni secret/ENV ihtiyacı saptanmadı.
9. `docs/compliation/` içinde bu kayıttan önce yalnız [README.md](README.md) bulunuyordu; önceki tamamlanmış Project Service teslimi yok.

## Plan ve sözleşme farkları

- [api.md](../../.agents/api.md), [authentication.md](../../.agents/authentication.md) ve [er-diagram.md](../../.agents/er-diagram.md) eski `BACKEND_ENGINEER`, `FRONTEND_ENGINEER`, `UI_DESIGNER` gibi plan rollerini anıyor. [hamza.md](../../.agents/faz-md/hamza.md) ve [alper.md](../../.agents/faz-md/alper.md) içindeki yeni kilitli rol listesi ve `PROJECT_MANAGER` / `MODERATOR` ayrımı sonraki uygulama kararına esas alınmalı. Hiçbir rol henüz kodda canonical değil.
- Yeni plan Organization'ı opsiyonel ve Project Service'in parçası yapıyor; ayrı root Modulith modülü öngörmüyor. Project hard delete yerine archive, creator için ilk `PROJECT_MANAGER` üyeliği, yalnız public/read-only GitHub, Auth/User ve Work modülleriyle public contract sınırı yeni kurallardır. Eski belgeler uygulanmış kod değildir.
- `mail`, `notification`, `activity`, `dashboard`, `search` kök klasörleri mevcut fakat yalnız placeholder; silinmedi veya taşınmadı.

## HMZ-PROJ-01 handoff

**Önerilen gerçek klasörler:** `backend/src/main/java/com/pda/project/domain/entity/`, `domain/enums/`, `infrastructure/repository/`; test için `backend/src/test/java/com/pda/project/repository/` ve gerekirse `application/`. Bu klasörler mevcut, içlerinde uygulama dosyası yok. HMZ-PROJ-01 yalnız Project modelini kapsar; Organization, Membership, Invitation, API ve Squad sonraki tasklardır.

**Model/test kapsamı:** Project id, name, unique slug, description, status, priority, nullable dates/goal/tech stack/organization id, V1 private visibility, createdBy kullanıcı kimliği, timestamps ve archive alanları. User entity'sine doğrudan ilişki yerine public contract ile uyumlu kimlik yaklaşımı kullanılmalı. Repository testleri unique slug, alan doğrulaması ve archive edilmiş kayıtların normal listeden elenmesini sınamalı. PostgreSQL/Flyway ile gerçek repository testi migration olmadan geçemez; HMZ-PROJ-03 için `V21`–`V40` aralığındaki kullanılmamış numara seçilmeli.

**Ön karar gerektiren noktalar:** `com.pda.backend` paket tarama düzeltmesi ortak yapılandırmaya dokunacak; ilgili güvenlik/mimari onay kuralı uygulanmalı. Yeni ENV, dependency veya Auth role contract değişikliği gerekirse önce raporlanmalı. HMZ-PROJ-01 için API endpoint'i, Work Service veya GitHub entegrasyonu gerekmiyor.

## Doğrulama ve kullanıcı kontrolü

- Çalıştırılan komutlar: `rg --files --hidden` ile backend, frontend, migration ve teslim klasörleri; `rg -n --glob '*.java'` ile entity/controller/security/client/contract araması; ilgili dosyalarda `Get-Content`; `git status --short`.
- Sonuç: Yukarıdaki iskelet ve V1 migration bulguları doğrulandı. Kod/test çalıştırılmadı; bu task salt keşifti.
- Kullanıcı kontrolü: Project ve Squad klasörlerindeki `.gitkeep` dışında uygulama dosyası bulunmadığını, Flyway dizinindeki tek SQL'in V1 olduğunu ve uygulama giriş sınıfının paketini kontrol edin. Migration tahsisinin Auth için `V1`–`V20`, Project için `V21`–`V40` olarak kaydedildiğini doğrulayın; HMZ-PROJ-01 öncesinde ortak paket tarama değişikliğinin sahipliğini netleştirin.

## Açık konular

- Auth/User kimlik ve rol public contract'ı, Work Service read contract'ı ve mail adapter henüz yok.
- Spring paket taraması ile olası entity/repository taraması implementasyon başlamadan çözülmeli.
- HMZ-PROJ-01 repository testleri için gerekli migration, planda HMZ-PROJ-03 olarak daha sonra sıralanmış; kabul kapısı bu bağımlılığa göre düzenlenmeli.
- Project tarafında `V21` uygulanmadan önce gerekli Auth migration'larının hazır ve uygulanmış olması doğrulanmalı; düşük numaralı migration'ları daha sonra eklemek Flyway sırasını bozabilir.

**27 Eylül güncellemesi:** Alper'in yeni teslimi `BackendApplication` sınıfını `com.pda` köküne taşıdı ve Auth `V2` migration'ını ekledi. Yukarıdaki tarama ve ilk migration sırası bulguları keşif anındaki durumu anlatır; kök paket sorunu artık çözülmüştür. Auth giriş/kimlik ve canonical project role public contract'ı hâlâ beklenmektedir.
