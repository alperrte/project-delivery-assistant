# Backend servis test menüsü — 2026-10-24

## Tamamlanan kapsam

Kullanıcının onayladığı backend-first planıyla terminalde çoklu servis seçimi, komut satırından hedefli koşum, katalog/kuru koşum ve tüm backend seçeneği eklendi. Gerçek Java kaynakları incelenerek 142 somut test sınıfı 16 sahip pakete ayrıldı. Testler taşınmadı veya kaldırılmadı. İlgili çapraz modül kontrolleri ve ortak mimari/güvenlik baseline'ı seçimlere katılır. Shared/migration/architecture/backend seçimleri bütün backend'e genişler.

Frontend aşaması eklenmedi. Backend koşumu frontend, uygulama Docker build'i, Compose QA/deployment veya runtime smoke çalıştırmaz. Maven `clean verify` yerine artımlı `test` çalıştırır; tüm kaynakların test derlemesi ve seçilen integration testlerinin Spring/Testcontainers başlangıcı devam eder.

## Değişen önemli dosyalar

- `pre-push/backend-tests.cmd`, `backend-tests.ps1`: Windows terminal menüsü ve bağımsız backend komutu.
- `pre-push/backend-tests-lib.psm1`: kaynak keşfi, seçim, izole child ortamı, benzersiz koşum raporu doğrulaması.
- `pre-push/backend-test-suites.psd1`: sahiplik, ilişkili testler, iki ortak baseline sınıfı ve mevcut opt-in skip listesi.
- `pre-push/tests/backend-tests.tests.ps1`: framework bağımlılığı olmayan hafif runner kontrolleri.
- `pre-push/BACKEND_TESTS.md`, `PRE_PUSH_CHECKLIST.md`, `.agents/SECURITY.md` bölüm 2/21 ve `.agents/folder-structure.md`: kullanım ve onaylı kalite kapısı ayrımı.

Backend-only feature branch push'unda seçilen ilgili kapsam geçerlidir. Frontend/mixed branch'lerinde mevcut tam kapı devam eder; ana dala entegrasyon, release ve deployment öncesi tam kapı zorunludur. Eski `pre-push.cmd/.ps1`, CI, POM ve uygulama kodu değişmedi. Git hook/uzak branch ayarı eklenmedi; push/merge/deployment yapılmadı.

Alt ajanlar kullanıcı isteği üzerine durdurulduktan sonra uygulama ve doğrulama tek ana oturumda tamamlandı. Tek ajan yönergesi değişikliği ayrı kayıt: `2026-10-24-tek-ajan-calisma.md`.

## Çalıştırılan doğrulama komutları

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File pre-push/tests/backend-tests.tests.ps1
.\pre-push\backend-tests.cmd -List
.\pre-push\backend-tests.cmd -Service task-service,meeting-service -DryRun
.\pre-push\backend-tests.cmd -Service missing-service -DryRun
.\pre-push\backend-tests.cmd -Service reminder-service -JavaHome '<yerel-JDK21>'
.\pre-push\backend-tests.cmd -Service reminder-service
git diff --check
git status --short
```

Ayrıca dört yeni PowerShell/data dosyası PowerShell 5.1 AST parser ile doğrulandı. Docker erişimi testler için yerel motorda doğrulandı. ENV dosyaları okunmadı/değiştirilmedi.

## Test/doğrulama sonuçları

- **37 runner kontrolü PASS:** gerçek katalog, kendi/ilişkili/baseline seçimleri, tekilleştirme, ortak kapsam genişlemesi, geçersiz/boş seçim, yeni sınıf keşfi, inherited test/Docker, stale manifest, tanınmayan anotasyon, eski/eksik rapor, beklenmeyen skip, beklenen opt-in skip, sıfır yürütülen test, XML DTD ve ortam izolasyonu.
- `-List`: 16 grup, 142 sınıf. Mevcut toplamlar: task 17, meeting 21, squad 13, notification 19, project 35, auth 36, user 16, admin 12, chat 11, analytics 9, contact 12, reminder 5. Ortak altyapı grupları 142'ye genişler.
- Task + meeting kuru koşumu: 22 kendi + 12 ilişkili + 2 ortak = 36 benzersiz sınıf; uygulama testi/build/Docker ve dosya yazımı yok.
- Geçersiz servis ve açık JDK21 seçimi doğru şekilde exit 1 verdi; test başlatılmadı.
- Gerçek reminder kapsamı: **5 sınıf, 34 test; 0 failure, 0 error, 0 skip; Maven exit 0, runner exit 0; 61,62 saniye.** Gerçek PostgreSQL Testcontainers kullanıldı; unit/mock olmayan API integration testleri dahil.
- Son başarılı koşum: `backend/target/scoped-test-results/20261024-212715-b9509b1f2f8c/` (`scope.json`, `result.json`, `maven.log`, beş XML raporu). Çıktı `PDA BACKEND SELECTED CHECK PASSED`.
- İlk gerçek koşumda Maven 34/0/0/0 ile 93,66 saniyede başarılıydı; PowerShell XML adapter'ının `name` niteliğini `.Name` üzerinden döndürmesi rapor doğrulamasını hatalı durdurdu. Okuyucu underlying XML node adına düzeltildi, gerçek rapor biçimi self-test'e eklendi ve yukarıdaki başarılı koşum yapıldı. Eski hata kaydı başarı diye değiştirilmedi.
- PowerShell parse ve `git diff --check` PASS. Global Git ignore dosyasına sandbox erişim uyarısı vardı; komutlar exit 0 ile tamamlandı.

## Açık kalan konular ve doğrulanmayan sınırlar

- Tam 142 sınıf, diğer servislerin gerçek koşumları, frontend ve kanonik tam pre-push bu görevde çalıştırılmadı. Bir dakikalık örnek bütün servisler için süre garantisi değildir.
- Etki haritası açık çapraz sınır testlerinden oluşur, eksiksiz geçişli tüketici grafiği değildir. Ortak sözleşme/security-chain/DB/build değişikliklerinde tüm backend seçilmelidir. Yeni ilişki veya servis eklendiğinde manifest ve kontroller güncellenir.
- İlk teslimde parametresiz menü tuşla doğrulanmamıştı. Kullanıcı geri bildirimiyle başlangıç parametresinin null/boş dizi hatası düzeltildi; gerçek PTY'de parametresiz açılış, `0` çıkışı ve `1,3` çoklu seçimli kuru koşum doğrulandı. Takip kaydı: `2026-10-24-backend-test-menusu-parametresiz-cagri.md`.
- PATH JDK21 olduğundan resmî Eclipse Temurin **25.0.4.1+1** Windows JDK'sı `.local/toolchains/` altında hazırlandı ve runner tarafından otomatik bulundu. Paket SHA-256: `00c847d804f4a78e9f04f2683faf14fed898535b177b7fc704486cb0284e9283`; vendor release kaynağı Adoptium API/GitHub temurin25-binaries. İndirilen ZIP doğrulama/açma sonrası kaldırıldı. Sistem JAVA_HOME/PATH değişmedi; JDK, raporlar ve derleme çıktıları Git dışında. Bu dizin temizlenirse yeni JDK25 gerekir.
- Windows native Maven logunda bazı Türkçe yol karakterleri görüntülenirken encoding farkı görülebilir; komut, rapor ve dosya yolları çalıştı. Aynı working tree'de paralel Maven koşuları başlatılmamalıdır.

## Kullanıcının manuel kontrol adımları

1. Repo kökünde `.\pre-push\backend-tests.cmd` çalıştırın; numarayla bir veya virgülle birkaç servis seçin. `A` bütün backend, `0` çıkış.
2. Çalıştırmadan listeyi görmek için `.\pre-push\backend-tests.cmd -Service task-service -DryRun` kullanın.
3. Kapsamı ve sonuç JSON'unu inceleyin. Eksik/atlanan test veya başarısız sonuçta ilerlemeyin; seçilen kapsamı tam regresyon sonucu saymayın.
4. Ana dala entegrasyon/yayın öncesinde mevcut tam `pre-push.cmd` kapısını çalıştırın. Frontend seçimi sonraki görevdir.
