# Backend servis test menüsü

Repo kökünde Windows PowerShell 5.1 ile:

```powershell
.\pre-push\backend-tests.cmd
.\pre-push\backend-tests.cmd -List
.\pre-push\backend-tests.cmd -Service task-service
.\pre-push\backend-tests.cmd -Service task-service,meeting-service
.\pre-push\backend-tests.cmd -Service meeting-service -DryRun
.\pre-push\backend-tests.cmd -All
.\pre-push\backend-tests.cmd -All -Forks 1
.\pre-push\backend-tests.cmd -Service task-service -JavaHome 'C:\path\to\jdk-25'
```

Parametresiz çağrı numaralı menüyü açar. `1,3` gibi çoklu seçim, `A` tüm backend, `0` çıkıştır. Otomasyonda `-Service` veya `-All` kullanılır. `-List` ve `-DryRun` Java/Docker başlatmaz ve dosya yazmaz. Gerçek koşum JDK **25** ister. Açık `-JavaHome` önceliklidir; verilmezse `JAVA_HOME`, repo içindeki `.local/toolchains/*` ve PATH içinden uygun JDK 25 seçilir. Sistem Java ayarı değişmez. Gerekli integration testleri varsa yerel Docker zorunludur. Eksik araç nedeniyle test atlamak başarı kabul edilmez. Runner JDK indirmez, servis başlatmaz, Compose/deployment çalıştırmaz.

Kurulum doğrulamasında resmî Eclipse Temurin 25.0.4.1+1 Windows paketi SHA-256 doğrulanarak `.local/toolchains/` altına hazırlandı. Git dışında kalır ve sistem Java ayarını değiştirmez. Bu yerel dizin temizlenirse başka bir JDK 25 sağlamak gerekir.

## Backend çalışma hızı

Varsayılan **iki ayrı JVM** çalışır (`-Forks 2`); her JVM içinde JUnit sıralıdır. Daha düşük kaynak kullanımı veya hata ayıklama için `-Forks 1` seçilebilir. POM'daki aynı varsayılan, mevcut Maven/pre-push/CI koşumları için de geçerlidir; standalone Maven'de `-Dpda.test.forks=1` kullanılabilir.

- `shared/testing/TestPostgres`: her JVM'de PostgreSQL image sürümü başına tek geçici sunucu; her sınıf/handle için benzersiz temiz veritabanı. JUnit handle kapanınca yalnız kendi DB'sini kaldırır; ortak sunucu JVM sonunda kapanır, Ryuk zorla sonlandırma temizliğini de sağlar. Koşumlar arasında container reuse veya kalıcı volume kullanılmaz. Migration'ların PostgreSQL 17/18 ve temiz/eski şema kontrolleri korunur.
- `shared/testing/RepositoryTestBase`: altı project ve bir squad repository sınıfı aynı JPA slice/context'i kullanır. `DataJpaTest` her metodu rollback yapar. HTTP, async veya migration-upgrade testleri bu paylaşımı kullanmaz; diğer `DirtiesContext` işaretleri otomatik kaldırılmadı.
- İki JVM'in medya dizinleri ve JaCoCo dosyaları ayrı tutulur; yalnız güncel koşumun coverage dosyaları rapordan önce `jacoco.exec` altında birleştirilir.
- Chat fixture'ları kayıt/BCrypt'i ve her kullanıcı için yeni gerçek oturumu korur; tekrar eden HTTP login hazırlığı `RegularSessionFactory` üzerinden yapılır. Auth login ve websocket ikinci-login senaryoları gerçek endpoint'i sınamaya devam eder. Güvenlik gözlem pencereleri ve timeout'lar kısaltılmadı.

`TestPostgresIsolationTest`, aynı sunucudaki iki handle'ın tablo ve yaşam döngülerinin bağımsızlığını doğrular. Yeni testlerin kapsamına üretim API'si veya deployment ayarı eklenmez.

## Servis sahipliği ve ilişkili kapsam

Sahiplik kaynakların `com.pda.<modül>` paketinden alt paketleriyle keşfedilir. Mevcut 143 test sınıfı sabit sayı değildir; aynı pakete yeni sınıf eklenince kapsama otomatik girer. Test içermeyen boş modüller menüye eklenmez. Destek/configuration sınıfları test gibi sayılmaz; tanınmayan test biçimi veya sahipsiz paket sessizce atlanmak yerine hata verir.

| Seçim | Asıl paket / önemli kapsam | İlave sınır testleri |
| --- | --- | --- |
| task-service | task; sprint/worklog dahil | Task bildirimleri, notification integration, dosya/görsel doğrulama |
| meeting-service | meeting/internal ve media | Meeting HTTP güvenliği/fanout/recovery, auth proxy limitleri, meeting migration'ları |
| squad-service | squad | Team deletion bildirim/recovery, invitation ve squad hata sözleşmesi |
| notification-service | notification | Task progress/pool, meeting core ve team deletion olay üreticileri |
| project-service | project; organization/criteria/invitation/repository dahil | Invitation/commit bildirimleri, project types/logo migration, SMTP |
| auth-service | auth | User session/role/persistence, admin migration/retention, chat websocket, parola/SMTP |
| user-service | user | Refresh/session expiry/account deletion, navbar/dil tercih migration'ları |
| admin-service | admin | Admin auth/hardening, role ve support preview |
| chat-service | chat | Central chat migration, JWT/session ve görsel doğrulama |
| analytics-service | analytics | Admin analytics, migration ve retention |
| contact-service | contact | SMTP, admin support/operations, migration ve retention |
| reminder-service | reminder | Scheduled job registry |
| shared-service | shared | Ortak tüketiciler nedeniyle tüm backend'e genişler |
| migration-service | migration | Tüm backend'e genişler; admin altındaki migration testleri de dahil |
| architecture-service | architecture | Tüm backend'e genişler |
| backend-service | backend uygulama başlangıcı | Tüm backend'e genişler |

Tam sınıf adları ve ilişkiler `backend-test-suites.psd1` içindedir. Örneğin `notification/MeetingHttpSecurityTest` meeting controller'larını, `project/integration/ProblemDetailShapeApiIntegrationTest` squad hata davranışlarını test eder. İlişkiler açık sınır kontrolleridir; her tüketicinin eksiksiz geçişli etki grafiği değildir. API/olay sözleşmesi değiştiğinde tüketici servisleri de seçin; etki belirsizse `-All` kullanın.

Her seçime `ModularityTest` ve `SecurityBaselineTest` eklenir. Bunlar tam auth/integration paketinin yerine geçmez. Ortak security-chain/auth ayarı, model/DB, POM veya paylaşılan sözleşmeler değiştiğinde `-All` gerekir. Shared/migration/architecture/backend seçimi bunu otomatik yapar.

## Koşum ve rapor

Maven wrapper ile artımlı `test` çalışır; `clean`, packaging, frontend build/Playwright ve Docker uygulama build/smoke aşamaları yoktur. Maven yine tüm test kaynaklarını derleyebilir. Testcontainers/Spring başlangıç maliyeti ve ilk bağımlılık/derleme maliyeti devam eder; süre kazancı gerçek koşumlarla ölçülmelidir.

ENV dosyaları okunmaz veya değiştirilmez. Maven child process'i yalnız işletim sistemi için gerekli ortam değişkenlerini ve test varsayılanlarını alır. Gerçek datasource/SMTP/OAuth/GitHub/LiveKit değerleri veya Spring/JVM/Maven override'ları miras alınmaz. DB/SMTP fallback'i kapalı loopback portudur; testin kendi Testcontainers/GreenMail ayarı önceliklidir. Medya çıktısı koşum dizinine yönlenir. Uzak Docker endpoint'leri kabul edilmez.

Her koşum `backend/target/scoped-test-results/<run-id>/` altında kapsam, commit, dirty durumu, süre ve sonuç JSON'u ile canlı terminale de aktarılan `maven.log` dosyasını tutar. Yalnız o koşumun benzersiz Surefire son ekli XML raporları okunur. Eksik sınıf raporu, sıfır yürütülen test, beklenmeyen skip, Maven hatası veya test hatası başarısızdır. `LiveKitRealSmokeTest` mevcut opt-in testi olduğundan beklenen skip olarak ayrıca görünür. Başarılı mesaj yalnız **PDA BACKEND SELECTED CHECK PASSED** olur.

Surefire seçenekleri [resmî test goal belgelerine](https://maven.apache.org/surefire/maven-surefire-plugin/test-mojo.html) dayanır. `reportsDirectory` için CLI user property bulunmadığından POM değiştirilmeden `surefire.reportNameSuffix` ile koşumlar ayrılır.

## Push/entegrasyon kuralı

`.agents/SECURITY.md` bölüm 2'ye göre backend-only feature branch push'unda ilgili backend kapsamı yeterlidir. Frontend/mixed branch'lerinde frontend aşaması ayrılana kadar mevcut tam kapı devam eder. Ana dala entegrasyon, release ve deployment öncesi bütün branch'ler için `pre-push.cmd` tam kapısı zorunludur. Bu araç Git hook yüklemez, otomatik push yapmaz ve branch adına bakarak yeterlilik tahmin etmez. Her değişiklikten sonra ilgili kapı yeniden çalıştırılır.

Aracın hafif kontrolleri (uygulama paketi çalışmaz):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File pre-push/tests/backend-tests.tests.ps1
```

Keşif anotasyonları, kalıtımı ve test yardımcılarını inceler. Özel composed JUnit anotasyonları, varsayılan Surefire adları dışındaki testler veya farklı framework eklenirse keşif ve self-testler birlikte güncellenmelidir. Aynı working tree üzerinde paralel Maven koşuları başlatmayın; ortak `target` derleme çıktıları paylaşılır.
