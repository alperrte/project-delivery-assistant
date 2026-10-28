# Backend test hızlandırması — 2026-10-24

## Tamamlanan kapsam

Kullanıcının dört optimizasyonu uygulama talebi tek ana oturumda tamamlandı:

1. PostgreSQL her sınıfta yeniden başlatılmak yerine JVM/image başına paylaşılır. Her handle ayrı, temiz, rastgele isimli veritabanı kullanır; kapanan sınıf yalnız kendi DB'sini kaldırır. Mevcut PostgreSQL 16/17/18 image seçimleri ve migration senaryoları korunur. Koşumlar arası container reuse veya kalıcı volume yoktur.
2. Altı project ve bir squad repository sınıfı `RepositoryTestBase` üzerinden aynı JPA slice/configuration'ı paylaşır. Her metot `DataJpaTest` transaction rollback'iyle izole kalır. Diğer HTTP/async/migration testlerinin ayrı DB/context ihtiyaçları ve `DirtiesContext` işaretleri korunur.
3. Surefire varsayılanı iki ayrı, tekrar kullanılan JVM'dir; JVM içindeki JUnit yöntemleri sıralıdır. Medya ve JaCoCo dosyaları fork/koşum bazında ayrılır, yalnız mevcut koşumun coverage verisi birleşir. `-Forks 1` veya Maven `-Dpda.test.forks=1` geri dönüşü vardır.
4. Yavaş chat API/WebSocket fixture'larında her kullanıcı için tekrar edilen HTTP login hazırlığı kaldırılıp gerçek `UserSessions`/`JwtTokens` üzerinden yeni normal oturum açılır. Kullanıcı kaydı, gerçek BCrypt, JWT/session denetimleri ve tüm auth giriş testleri korunur. WebSocket'in ikinci gerçek login senaryosu değişmedi. Negatif güvenlik gözlem pencereleri veya timeout'lar kısaltılmadı.

Test senaryosu arşivlenmedi/silinmedi. Üretim kaynakları, migration SQL'leri, ENV dosyaları ve güvenlik/kimlik sözleşmesi değiştirilmedi. Frontend veya production çalıştırılmadı. Pencereli launcher işi bu teslimin kapsamına dahil değildir.

## Değişen önemli dosyalar

- `backend/src/test/java/com/pda/shared/testing/TestPostgres.java`: ortak geçici server, izole DB handle ve JUnit Startable lifecycle.
- `RepositoryTestBase.java`: uyumlu repository context cache'i.
- `RegularSessionFactory.java`: chat fixture'larına yeni gerçek normal oturum.
- `backend/src/test/java/com/pda/shared/TestPostgresIsolationTest.java`: yeni iki izolasyon/allowlist testi.
- Mevcut testlerdeki PostgreSQL setup/importları; yedi repository sınıfının yinelenen configuration blokları; iki chat sınıfının fixture hazırlığı.
- `backend/pom.xml`: iki fork, sıralı JUnit, ayrı medya/JaCoCo ve güncel koşuma ait merge.
- `pre-push/backend-tests.ps1`: `-Forks 1|2`, varsayılan iki JVM ve raporda seçim bilgisi.
- `pre-push/backend-test-suites.psd1`: yeni destek sınıfının açık tanımı.
- `pre-push/BACKEND_TESTS.md`, `.agents/folder-structure.md`: kullanım ve kalıcı test altyapısı özeti.

## Çalıştırılan doğrulama komutları

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File pre-push/tests/backend-tests.tests.ps1
.\pre-push\backend-tests.cmd -List
.\pre-push\backend-tests.cmd -Service project-service -Forks 1
.\pre-push\backend-tests.cmd -All -Forks 2
git -c core.safecrlf=false diff --check
```

PowerShell AST ve POM XML parse edildi. Önceki/son XML'lerin sınıf + testcase adı anahtarları karşılaştırıldı. JaCoCo iki fork dosyası, merge çıktısı, medya yolları ve mevcut koşum PostgreSQL container kimliklerinin Docker'dan kaldırıldığı doğrulandı. Docker denetimi salt okunurdu; başka container'lara müdahale edilmedi.

## Test/doğrulama sonuçları

| Ölçüm | Önce | Son başarılı koşum |
| --- | ---: | ---: |
| Toplam komut süresi | 952,60 sn — **15:52,60** | 413,10 sn — **6:53,10** |
| Runner içindeki Maven süreci | 948,52 sn | 407,57 sn |
| Maven kendi bildirimi | 15:46 | 6:43 |
| Test sınıfı | 142 | 143 |
| Raporlanan test | 1.136 | 1.138 |
| Failure / error | 0 / 0 | 0 / 0 |
| Beklenen LiveKit skip | 1 | 1 |
| PostgreSQL başlangıcı | 69 | 7 |
| Spring başlangıcı | 61 | 57 |
| Yeni koşumda kalan PostgreSQL container'ı | — | 0 |

Toplam süre **539,50 saniye (yaklaşık 9 dakika), %56,63** azaldı; yaklaşık **2,31 kat** hızlı. İki ek test, yeni PostgreSQL handle'larının tablo ve kapanış izolasyonunu ve izin verilen image sınırını kontrol eder. Önceki **1.136 senaryo anahtarının hiçbiri eksik değil**; yeni iki test dışında senaryo eklenmedi. Hazırlık helper'ındaki yinelenen login kontrolleri auth testleriyle aynı şey sayılmaz; buradaki bilinçli değişiklik fixture hazırlığıdır.

- Hafif runner kontrolleri **40 PASS**.
- İlk tek-JVM proje kapsamı **35 sınıf, 212 test, 0 hata/skip**, 200,06 sn. Altı proje repository sınıfı yalnız bir Spring başlangıcı paylaştı; üç PostgreSQL server açıldı.
- İlk iki-JVM tam koşum **1.138/0/0/1**, 437,88 sn Maven süreci: testler başarılıydı fakat JVM kapanışında 30 saniyelik forced-shutdown uyarısı oluştu. Thread dump Spring shutdown'un bağlantı beklediğini gösterdi; özel server-stop JVM hook'u Spring'den önce DB'yi kapatıyordu. Hook kaldırıldı; standart Testcontainers/Ryuk temizliği JVM kapanışından sonra çalışır.
- Son tam koşumda forced-shutdown uyarısı **0**; Maven ve runner exit **0**, `BUILD SUCCESS` ve `PDA BACKEND SELECTED CHECK PASSED`.
- İki JaCoCo dosyası dolu ve ayrı: fork 1 **1.245.262 byte**, fork 2 **1.272.763 byte**; merge ve 802 üretim sınıfına ait rapor başarıyla üretildi.
- Son koşumdaki yedi PostgreSQL container kimliğinin tamamı Docker listesinden otomatik temizlendi.

Kanıt dizinleri:

- Önce: `backend/target/scoped-test-results/20261024-214136-f5b012c8ca4b/`.
- Tek-JVM proje kontrolü: `20261024-221438-415e9b179254/`.
- İlk iki-JVM koşum ve kapanış bulgusu: `20261024-221946-f6a4a8d07ed4/`.
- **Son başarılı:** `backend/target/scoped-test-results/20261024-222927-60759dadac63/`.

## Açık kalan konular ve doğrulanmayan sınırlar

- Ölçümler bu yerel Windows/JDK25/Docker ortamına aittir; CI ve cold-cache süre garantisi değildir. Son ölçüm test kaynaklarının yeniden derlenmesini de içerdi. Son başarılı koşumdan sonra uygulama/test davranışı değiştirilmedi.
- Maven/pre-push/CI aynı POM varsayılanını kullanır; frontend, kanonik tam pre-push, CI veya production deployment bu görevde koşturulmadı. ENV ve uzak repo ayarları değiştirilmedi.
- Yalnız rollback yapan uyumlu repository grubu Spring context paylaşır. HTTP/async testler kontrolsüz biçimde aynı DB'ye geçirilmedi; her migration handle'ı temiz DB alır.
- Düşük kaynaklı makinelerde iki JVM yerine `-Forks 1` kullanılabilir. Aynı working tree'de iki ayrı Maven komutunu paralel çalıştırmayın; iki JVM tek Maven koşumuna aittir.

## Kullanıcının manuel kontrol adımları

1. Repo kökünde `.\pre-push\backend-tests.cmd -All` çalıştırın; varsayılan artık iki JVM'dir. `pre-push` içindeyseniz `.\backend-tests.cmd -All` kullanın.
2. Son koşumun `scope.json`, `result.json` ve `maven.log` özetlerini inceleyin. Tek JVM gerektiğinde aynı komuta `-Forks 1` ekleyin.
3. Ana dala entegrasyon/release/deployment öncesinde mevcut tam kapı kuralını uygulayın; backend sonucu frontend/tam proje sonucu değildir.
