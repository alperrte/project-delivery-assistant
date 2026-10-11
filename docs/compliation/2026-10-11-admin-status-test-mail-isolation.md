# Admin sistem durumu testinde mail ayarı izolasyonu

## Teslim ve durum

11 Ekim 2026: pre-push'ta başarısız olan admin sistem durumu testinin yerel mail ayarından etkilenmesi düzeltildi. Commit veya push yapılmadı.

## Yapılanlar

`backend/src/test/java/com/pda/admin/integration/AdminOperationsIntegrationTest.java`: `DynamicPropertySource` içinde `MAIL_ENABLED=false` sabitlendi. Sınıfın mail-kapalı durum beklentisi artık geliştiricinin ortamından bağımsızdır. Mevcut assertion korunur; uygulama davranışı, `.env`, `.env.example` ve production ayarları değişmedi.

## Doğrulama

- `backend` içinde `$env:MAIL_ENABLED='true'; .\mvnw.cmd '-Dtest=AdminOperationsIntegrationTest' test`: **8 test, 0 failure, 0 error, 0 skip; BUILD SUCCESS**. Özellikle dış ortamda mail açıkken sınıfın mail-kapalı beklentisinin çalıştığı doğrulandı. Başarısız test bu sınıfın içindedir.
- `git diff --check`: başarılı.
- Kullanıcı yalnız başarısız test kapsamının doğrulanmasını istediği için tam pre-push yeniden çalıştırılmadı. Yukarıdaki sınıf koşumu bu yönlendirme gelmeden başlatılmıştı ve tamamlandı; ek test koşumu yapılmadı.

## Açık konular

Bu sonuç yalnız ilgili backend test sınıfını doğrular; tam pre-push'ın geçtiği anlamına gelmez. Önceki tam koşum backend aşamasında durmuştu, frontend/build/smoke aşamalarına geçmemişti.

## Kullanıcı kontrolü

Diff'teki test ortamı sabitlemesini inceleyin ve merge commitine eklemek için bu test dosyasını stage edin. İsterseniz bu completion kaydını da ekleyin. Commit/push kullanıcıya bırakıldı.
