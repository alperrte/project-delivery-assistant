# Tüm backend süre ölçümü — 2026-10-24

## Tamamlanan kapsam

Kullanıcının yalnız bütün backend paketinin ne kadar sürdüğünü ölçme isteğiyle `backend-tests.cmd -All` bir kez çalıştırıldı. Frontend, uygulama Docker derlemesi, Compose/deployment ve kanonik tam pre-push çalıştırılmadı. Arayüz geliştirmesine bu ölçüm sırasında devam edilmedi; uygulama veya test runner kodu değiştirilmedi.

## Değişen önemli dosyalar

Yalnız bu ölçüm kaydı eklendi. Git dışında `backend/target` altında Maven ve koşuma özel raporlar üretildi.

## Çalıştırılan doğrulama komutları

```powershell
$timer = [Diagnostics.Stopwatch]::StartNew()
.\pre-push\backend-tests.cmd -All
$exitCode = $LASTEXITCODE
$timer.Stop()
```

Koşuma ait 142 XML raporu ve `result.json` çapraz kontrol edildi; modül/sınıf süreleri XML `time` değerlerinden çıkarıldı. Yalnız o koşumun benzersiz son ekli raporları sayıldı.

## Test/doğrulama sonuçları

| Ölçüm | Sonuç |
| --- | --- |
| Komutun toplam duvar saati | **952,60 saniye — 15 dakika 52,60 saniye** |
| Runner içindeki Maven süreci | 948,52 saniye — 15 dakika 48,52 saniye |
| Maven'in kendi bildirimi | 15 dakika 46 saniye |
| Test sınıfı | 142 |
| Raporlanan test | 1.136 |
| Başarılı yürütülen test | 1.135 |
| Failure / error | 0 / 0 |
| Atlanan | 1 — `LiveKitRealSmokeTest`, mevcut opt-in koşulu |
| Maven / runner exit | 0 / 0 |

Çıktı `BUILD SUCCESS` ve `PDA BACKEND SELECTED CHECK PASSED` oldu. Gerçek PostgreSQL Testcontainers integration testleri dahil edildi; Docker yokluğu nedeniyle atlanan test olmadı.

Yerel kanıt dizini: `backend/target/scoped-test-results/20261024-214136-f5b012c8ca4b/` — `scope.json`, `result.json`, `maven.log` ve 142 XML raporu. Maven 24 Ekim 2026 21:57:25 Europe/Istanbul zamanında tamamlandı.

JUnit raporlarındaki sınıf sürelerinin paket bazında toplamında en büyük beş grup:

| Paket | Sınıf süreleri toplamı |
| --- | ---: |
| project | 181,87 sn |
| auth | 139,46 sn |
| chat | 103,90 sn |
| task | 76,06 sn |
| notification | 68,89 sn |

En uzun tek sınıflar `ChatApiIntegrationTest` 58,908 sn, `ChatWebSocketIntegrationTest` 44,476 sn ve `ContactApiIntegrationTest` 44,360 sn. Bu değerler JUnit sınıf zamanlarıdır; modülü bağımsız çalıştırmanın uçtan uca süresi veya toplam Maven duvar saati değildir.

## Açık kalan konular ve doğrulanmayan sınırlar

### Mevcut raporlardan süre analizi

Yeni koşum yapılmadan aynı XML/loglar analiz edildi:

- JUnit sınıf süreleri toplamı **935,848 sn**, test metodu süreleri toplamı **452,164 sn**. Fark **483,684 sn**; sınıf hazırlığı/yaşam döngüsü ve metot ölçümleri dışında kalan çalışmayı içerir. Tamamı kaldırılabilir maliyet değildir.
- Logda **61 Spring başlangıcı**, bildirilen başlangıç süreleri toplamı **258,69 sn**.
- **69 PostgreSQL container başlangıcı**, bildirilen başlangıç süreleri toplamı **184,72 sn**.
- **74 migration uygulama olayı**; bu sayı migration SQL dosyası sayısı değildir.
- Kaynakta **55 dosya `@DirtiesContext`** kullanıyor. Birçok sınıf kendi `@DynamicPropertySource` ve container'ını tanımlıyor. Task grubu ise zaten ortak `TaskTestBase` üzerinden ortam paylaşımı örneği içeriyor.

Bu ölçümler farklı zaman aralıklarını kapsar ve örtüşebilir; Spring/container süreleri sınıf/metot farkına ayrıca eklenmez. Ortak, koşum ömürlü PostgreSQL altyapısı; uygun repository sınıflarında kontrollü Spring context paylaşımı ve test beklentilerini koruyan hazırlık optimizasyonu yüksek öncelikli inceleme adaylarıdır. Migration testlerinin temiz/eski şema ihtiyacı ve veri izolasyonu korunmalıdır. İki ayrı Surefire JVM fork'u kontrollü karşılaştırma adayıdır; performans kazancı henüz ölçülmedi. JUnit yöntemlerini doğrudan paralelleştirmekle aynı şey değildir.

Teknik dayanaklar: [Spring context caching](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/ctx-management/caching.html), [Surefire fork seçenekleri](https://maven.apache.org/surefire/maven-surefire-plugin/examples/fork-options-and-parallel-execution.html), [Testcontainers JUnit 5 sınırlamaları](https://java.testcontainers.org/test_framework_integration/junit_5/). Bu analizde test kodu veya çalışma ayarı değiştirilmedi.

- Tek yerel ölçümdür. JDK 25.0.4.1+1, mevcut Maven/Docker bağımlılık önbellekleri ve önceden derlenmiş kaynaklarla artımlı `test` kullanıldı; Maven “Nothing to compile” bildirdi. Cold build, `clean verify`, CI ve başka makineler için süre garantisi değildir.
- Frontend ve tam pre-push süreleri ölçülmedi; önceki 1–1,5 saatlik gözlemin kalan aşamalarına kesin süre atanamaz.
- Pencereli arayüz işi bu isteğin öncesinden kalan ayrı kapsamdır; bu kayıt arayüzün tamamlandığı anlamına gelmez.

## Kullanıcının manuel kontrol adımları

`result.json` ve `maven.log` özetlerini inceleyin. Aynı ölçümü tekrar etmek için repo kökünde `.\pre-push\backend-tests.cmd -All`, `pre-push` dizininde `.\backend-tests.cmd -All` kullanın. Her tekrar tüm backend paketini yeniden çalıştırır.
