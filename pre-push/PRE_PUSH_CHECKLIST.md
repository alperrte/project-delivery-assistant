# PDA — Pre-Push Quality Gate

Bu klasör servis bazlı backend kontrolünü ve tam proje kalite kapısını içerir. Onaylı kuralın kaynağı `.agents/SECURITY.md` bölüm 2'dir.

## Backend servis branch'leri

Frontend değişmeyen servis branch'lerinde seçilen servisler, ilişkili testler ve ortak mimari/güvenlik kontrolleri bağımsız çalıştırılır:

```powershell
.\pre-push\backend-tests.cmd
.\pre-push\backend-tests.cmd -Service task-service,meeting-service
.\pre-push\backend-tests.cmd -All
```

İlk komut çoklu seçimli terminal menüsünü açar. `-List` kataloğu, `-DryRun -Service task-service` çalıştırılacak sınıfları gösterir; ikisi de test geçişi sayılmaz. Ayrıntılar: [BACKEND_TESTS.md](BACKEND_TESTS.md).

Ortak auth/security-chain, veri modeli, migration, build bağımlılığı veya kapsamı belirsiz değişikliklerde tüm backend çalıştırılır. Shared/migration/architecture/backend seçimi otomatik genişler. Başarılı sonuç `PDA BACKEND SELECTED CHECK PASSED` ve o çalıştırmanın `result.json` raporudur; frontend veya tam proje başarısı anlamına gelmez.

Frontend/mixed branch'leri için mevcut tam kapı devam eder. Ana dala birleştirme, release veya deployment öncesinde branch türünden bağımsız tam kapı zorunludur. Git hook, push veya uzak branch ayarı bu araç tarafından değiştirilmez.

## Tam proje komutu

Repository kökünde:

```powershell
.\pre-push\pre-push.cmd
```

Tam browser paketi, gerçek güncel backend ve kayıt/şifre/iletişim senaryoları için Mailpit posta yakalayıcısı gerektirir. Yerel QA Compose override dosyasını şu parametreyle verin (yol repository köküne göre veya mutlak olabilir):

```powershell
.\pre-push\pre-push.cmd -QaComposeFile "<yerel-QA-override-dosyasi>"
```

Override, temel `docker-compose.yml` üzerine eklenir; dosyanın varlığı ve birleşik Compose yapılandırması doğrulanır. Mevcut QA dosyanız backend SMTP bağlantısını Mailpit'e yönlendirmeli, testlerin beklediği Mailpit HTTP adresini ve mevcut backend portunu sağlamalıdır. Parametre verilmezse yalnız temel Compose kullanılır; ortam Mailpit gereksinimini sağlamıyorsa mail kullanan E2E testleri başarılı olamaz. Script `.env` veya profil dosyalarını değiştirmez. Frontend Docker dışında Node.js ile çalışır; frontend portunda başka sunucu olmamalıdır.

Herhangi bir adım başarısız olursa script `exit 1` ile durur ve push yapılmamalıdır.

QA override kullanıldığında normal çıkış, hata ve PowerShell'in işleyebildiği kesintilerde `finally` temizliği temel Compose ile backend ayarını geri yükler; Mailpit/QA SMTP ayarı normal uygulamada bırakılmaz. Process'in zorla öldürülmesi veya terminalin kapanması bu temizliği atlayabilir. Böyle bir kesintiden sonra teslimden önce repo kökünde şu komutu çalıştırın ve etkin backend SMTP ayarını doğrulayın:

```powershell
docker compose -f docker-compose.yml up -d --force-recreate backend
```

Bu komut ENV dosyalarını değiştirmez; mevcut normal SMTP yapılandırmasını yeniden uygular. Test verisi veya Mailpit container'ı silinmez.

## Tam proje kapısındaki kontroller

1. Repository / secret güvenliği
   - `.env` Git tarafından track edilmemeli veya staged olmamalı.
   - `.pem`, `.key`, `.p12`, `.pfx`, `.jks` gibi hassas dosyalar staged olmamalı.
   - `git diff --check` whitespace / conflict kalıntılarını kontrol eder.

2. Docker erişimi
   - Docker daemon erişilebilir olmalı.
   - Temel Compose ve varsa temel + QA override için `config --quiet` başarılı olmalı.

3. PostgreSQL
   - `docker compose up -d postgres`
   - PostgreSQL healthcheck başarılı olana kadar beklenir.

4. Backend
   - `backend\mvnw.cmd clean verify`
   - Mevcut ve gelecekte eklenecek JUnit, Spring, Security, repository, integration, Spring Modulith ve Testcontainers testleri Maven lifecycle üzerinden çalışır.
   - JaCoCo `verify` aşamasında rapor üretir.
   - Maven aşamasında operatörün OAuth kimlik bilgileri geçici olarak temizlenir ve `MAIL_ENABLED=false` olur. Mail testleri kendi GreenMail ayarlarını açıkça sağlar; Docker/E2E öncesinde özgün mail/OAuth ayarları geri yüklenir. `.env` dosyası değişmez.

5. E2E için güncel backend
   - Maven sonrasında, frontend E2E öncesinde temel Compose + varsa QA override ile `up -d --build` çalışır.
   - Backend ve override içindeki Mailpit gibi QA servisleri başlatılır.
   - Backend `http://localhost:${BACKEND_PORT}/actuator/health` kontrolü başarılı olmadan frontend aşamasına geçilmez.
   - Önceki çalıştırmadan kalan backend image'ı ile yeni frontend test edilmez.

6. Frontend
   - Gerekirse `npm ci`
   - `npm run lint`
   - `npx tsc --noEmit`
   - `npm run build`
   - Bundle bütçeleri uyarı olarak raporlanır; bu kontrol gate'i durdurmaz.
   - Yeni production build, geçici Node.js sunucusuyla çalıştırılır.
   - Mevcut `test:e2e` npm scripti üzerinden Playwright paketi zorunlu çalışır; hata gate'i durdurur.

7. Temel Docker Compose'a dönüş
   - `docker compose up -d --build`
   - E2E sonrasında QA override olmadan temel backend/PostgreSQL stack'i yeniden başlatılır; backend'in normal `.env` ayarları kullanılır.
   - Frontend image'ı bu yerel Compose'da yoktur; smoke sırasında aynı Node.js production sunucusu kullanılır.

8. Runtime smoke test
   - Backend: `http://localhost:${BACKEND_PORT}/actuator/health`
   - Frontend: `http://localhost:${FRONTEND_PORT}/tr/ana-sayfa`
   - Her iki HTTP kontrolü de başarılı olmalıdır.
   - Frontend test sunucusu başarıda ve kontrollü hata çıkışında durdurulur.

## Her push'ta çalıştırılmayacak testler

Bunlar proje planında daha sonraki gate/release aşamalarına uygundur:

- Chromium + Firefox + WebKit tam browser matrisi
- k6 load/stress/spike/soak
- SonarQube Cloud analizi
- Release'e özel full regression senaryoları

Bunlar geliştikçe ilgili fazlarda ayrıca çalıştırılır.

## Başarılı sonuç

```text
PDA PRE-PUSH CHECK PASSED
Safe to git push.
```

Tam kapının zorunlu olduğu frontend/mixed branch veya entegrasyon/yayın adımlarında bu mesaj görülmeden ilerlenmez. Backend-only feature branch için yukarıdaki servis kapısı geçerlidir; kapsam değişirse kontrol tekrar çalıştırılır.
