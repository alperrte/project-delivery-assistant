# İşletme ve süreklilik rehberi (runbook)

Bu belge yayın ortamında ve yerel kurulumda uygulanacak işletme adımlarını toplar: yedekleme, olay müdahalesi, geri dönüş, migration, bakım, izleme, sertifika ve yayın sonrası kontrol. **Production hosting henüz seçilmedi** (`deployment.md` açık karar kaydı); sağlayıcıya bağlı adımlar bu yüzden "hosting seçilince" diye işaretlidir ve uygulanmış sayılmaz. Güvenlik kuralları için `SECURITY.md` esastır.

## 1. Yedekleme ve geri yükleme

Neyin yedeği alınır:

| Veri | Nerede | Yedek |
| --- | --- | --- |
| Hesaplar, projeler, görevler, sohbet, denetim kayıtları, proje logosu/banner'ı, profil fotoğrafı, görev ekleri | PostgreSQL (`pda_postgres_data`) | `pg_dump -Fc` |
| Organizasyon logo/kapak görselleri | Docker volume `pda_organization_media` (DB yalnız referans tutar) | `tar.gz` |
| Secret'lar (`JWT_SECRET`, `TOTP_ENCRYPTION_KEY`, `EMAIL_VERIFICATION_HMAC_KEY`) | `.env` / secret store | Repoya girmez; ayrıca ve şifreli saklanır |

Araçlar: `ops/backup.ps1` (DB + medya, varsayılan çıktı `.local/backups`, son 14 kopya) ve `ops/restore.ps1` (yedeği **geçici bir veritabanına** açar, tablo/Flyway/kullanıcı sayısını gösterir ve geçici veritabanını siler; canlı veritabanına dokunmaz).

```powershell
.\ops\backup.ps1                                   # yedek al
.\ops\restore.ps1 -DumpFile .local\backups\pda-db-<tarih>.dump   # geri yükleme tatbikatı
```

Kurallar:

- `TOTP_ENCRYPTION_KEY` yedeği olmadan alınan veritabanı yedeği 2FA sırlarını okunamaz bırakır; anahtar yedeği ayrıca tutulur.
- Yedek, verinin bulunduğu makinede kalmaz: haftalık en az bir kopya başka bir diske/depoya taşınır. Yedek dosyaları kişisel veri içerir ve şifreli/erişimi kısıtlı bir yerde durmalıdır; betiğin varsayılanı son 14 kopyayı (günlük yedekle yaklaşık 14 gün) tutmaktır. Yayın öncesi, yedeklerin saklama süresinin yayımlanan KVKK saklama metniyle uyumu veri sorumlularınca doğrulanmalıdır (silinen hesapların yedeklerde bir süre daha kalabileceği metinde belirtilmelidir).
- Hedefler (V1): en fazla 24 saatlik veri kaybı (günlük yedek), 4 saat içinde geri dönüş. Production'da sağlayıcının otomatik yedeği (ör. Neon point-in-time) varsa bu betikler ek güvencedir.
- Canlı veritabanına geri yükleme yalnız felaket durumunda: önce `docker compose stop backend`, sonra `restore.ps1 -Target <canlı-db> -ConfirmOverwrite`, ardından backend başlatılıp `/actuator/health` ve giriş denenir. `docker compose down -v` hiçbir zaman kullanılmaz (volume'leri siler).
- **Durum:** betikler çalışan yığında denendi (aşağıdaki "Doğrulama kaydı"). Aylık tatbikat bölüm 5'tedir.

## 2. Olay müdahale prosedürü

Önem derecesi: **P1** veri sızıntısı/hesap ele geçirme/yetkisiz admin erişimi; **P2** hizmet kesintisi veya yetki hatası; **P3** tek kullanıcı etkisi.

1. **Tespit ve kayıt.** Kaynak: admin paneli (Sistem durumu, Denetim kaydı, Davranış/hata raporları), kullanıcı bildirimi (`pdassistant.info@gmail.com`), bağımlılık/güvenlik uyarısı. Olayın saati, kapsamı ve kim tarafından görüldüğü bir olay notuna yazılır.
2. **Sınırlama.** Şüpheli oturumlar admin panelinden/oturum iptaliyle kapatılır; gerekiyorsa backend durdurulur; etkilenen secret döndürülür (JWT_SECRET değişimi tüm oturumları düşürür; `TOTP_ENCRYPTION_KEY` değişimi 2FA'yı sıfırlar, bu yüzden son çare). OAuth istemci secret'ı sızdıysa sağlayıcıdan yenilenir. SMTP uygulama şifresi sızdıysa Google hesabından iptal edilir.
3. **Kanıt koruma.** İlgili log ve denetim kayıtları silinmeden saklanır (denetim kaydı saklama süresi 24 ay; temizlik işi dondurmak için `RETENTION_CRON=-`). Loglarda secret yoktur; yine de dışarı paylaşılırken kontrol edilir.
4. **Giderme.** Kök neden düzeltilir, düzeltme `SECURITY.md` kurallarına göre gözden geçirilir, rollback seçeneği hazır tutulur (bölüm 3).
5. **Bildirim.** Kişisel veri ihlalinde veri sorumluları (Hamza Taşbay, Alper Temiz) etkilenen kişilere gecikmeden, Kişisel Verileri Koruma Kurulu'na **en geç 72 saat içinde** bildirim yükümlülüğünü değerlendirir (KVKK m.12); AB'de bulunan kişiler etkileniyorsa GDPR Art. 33/34 ayrıca değerlendirilir. Metinler: KVKK Aydınlatma Metni "Veri güvenliği ve ihlal bildirimi" bölümü.
6. **Kapanış.** Olay notuna kök neden, alınan önlemler ve süreç iyileştirmesi yazılır; gerekirse `SECURITY.md` ve testler güncellenir.

Güvenlik açığı bildirimleri `SECURITY.md` bölüm 20'ye göre özel kanaldan alınır.

## 3. Rollback stratejisi

- **Kod:** her yayın bir Git etiketiyle (`vMAJOR.MINOR.PATCH`) ve onunla üretilen imajla yapılır. Geri dönüş = bir önceki etiketin imajını yeniden dağıtmak (`docker compose up -d --build` önceki etiketten, ya da registry'deki önceki imaj). Frontend ve backend aynı etiketten çıkar; API sözleşmesi geriye uyumlu tutulduğu sürece ikisi ayrı da geri alınabilir.
- **Veritabanı:** Flyway yalnız ileri gider; migration'ı geri sarmak için "down" betiği yoktur. Bu yüzden her şema değişikliğinden önce yedek alınır (bölüm 1), değişiklikler geriye uyumlu yazılır (aşağıda) ve geri dönüşün yolu "önceki sürüm kodu + gerekirse yedekten geri yükleme"dir.
- **Karar anı:** yayın sonrası smoke test (bölüm 7) başarısızsa ve 15 dakika içinde düzeltilemiyorsa geri dönülür; geri dönüş kararını veri sorumlularından biri verir.

## 4. Veritabanı migration planı

- Şema sahibi Flyway'dir (`backend/src/main/resources/db/migration`, V1–V40); `ddl-auto=validate`, üretimde `update/create` yasaktır. Uygulanmış bir migration dosyası **asla düzenlenmez**; değişiklik yeni bir migration'dır (`SECURITY.md` §7).
- Adımlar: (1) migration yerelde boş DB'de çalıştırılır; `MigrationConsolidationTest` şema eşitliğini doğrular. (2) Üretim benzeri bir kopyada (yedekten açılmış geçici DB) denenir. (3) Yayın öncesi yedek alınır. (4) Backend açılırken Flyway uygular; başarısızsa uygulama açılmaz ve eski sürüme dönülür.
- Geriye uyumluluk: sütun/tablo kaldırma iki aşamalıdır (önce kodu kullanmaz hale getir ve yayınla, sonraki sürümde sil). Yeni zorunlu sütun, varsayılanla veya iki aşamada eklenir. Uzun süren veri taşımaları batch'li yapılır.
- 2026-10-11 geçmiş birleştirmesi yalnız tek kullanımlık geliştirme DB'leri içindi; eski V1–V71 geçmişiyle çalışmış bir DB'ye yeni imaj bağlanmaz (`deployment.md`).

## 5. Bakım ve güncelleme planı

| Sıklık | İş |
| --- | --- |
| Sürekli | Dependabot (`.github/dependabot.yml`) haftalık npm/Maven, aylık Docker/Actions PR'ları açar; güvenlik güncellemeleri GitHub tarafından ayrıca önerilir. CI (`.github/workflows/ci.yml`) geçmeden birleştirilmez. |
| Haftalık | Dependabot PR'larını incele; `npm audit --omit=dev`, Trivy ile Maven ve npm taraması (aşağıda) ve admin Sistem durumu sayfası; yedek kopyasının dışarı alındığını doğrula. |
| Aylık | Geçici bir veritabanında geri yükleme tatbikatı; denetim/saklama işlerinin çalıştığını (Sistem durumu) doğrula; `SECURITY.md` açık takipleri (ör. braces/ESLint zinciri) gözden geçir. |
| Üç ayda bir | JDK/Node LTS, Spring Boot, Next.js ana/ikincil sürüm güncellemesi (ayrı dal, tam test); Gmail uygulama şifresi ve OAuth secret'ları döndürme değerlendirmesi; hukuki metinlerin gözden geçirilmesi. |
| Kritik açık duyurulunca | 48 saat içinde değerlendirme; etkileniyorsa acil yama ve olay prosedürü (bölüm 2). |

Bağımlılık taraması (Docker ile, salt-okunur; Maven Central'ın hız sınırına takılmamak için yerel `.m2` önbelleği bağlanır):

```powershell
docker run --rm -v "${PWD}\backend\pom.xml:/scan/pom.xml:ro" -v "$env:USERPROFILE\.m2\repository:/root/.m2/repository:ro" -v trivy-cache:/root/.cache aquasec/trivy:latest fs --scanners vuln --severity HIGH,CRITICAL /scan
docker run --rm -v "${PWD}\frontend\package-lock.json:/scan/package-lock.json:ro" -v trivy-cache:/root/.cache aquasec/trivy:latest fs --scanners vuln --severity HIGH,CRITICAL /scan
```

2026-10-11 sonucu: Maven 0, npm üretim bağımlılıkları 0 (HIGH/CRITICAL); `npm audit` tam ağaçta yalnız bilinen 5 high (ESLint/braces geliştirme zinciri, `SECURITY.md` §16).

Güvenlik açısından hassas bağımlılık değişiklikleri `SECURITY.md` §16 ve §19 gereği onaylanır.

## 6. İzleme, alarm, sertifika ve domain

Mevcut: `/actuator/health` (liveness için tek açık actuator ucu), admin **Sistem durumu** (arka plan işleri, aktif oturum, 24 saatlik 4xx/5xx sayacı, TOTP anahtarı durumu), istemci hata raporları ve davranış analitiği, denetim kaydı. Süreç yeniden başlayınca sayaçlar sıfırlanır.

**Uptime izleme ve alarm (altyapı gerektirmez):** `.github/workflows/uptime.yml` her 30 dakikada `ops/smoke-test.mjs`'i çalıştırır ve sertifikanın en az 14 gün geçerli olduğunu sınar; günde bir `DOMAIN` (RDAP) kaydının en az 30 gün kaldığını sınar. Başarısız bir çalıştırma alarmdır: GitHub, depoyu izleyenlere kendi bildirim kanallarıyla haber verir (projenin mail hesabı kullanılmaz). Devreye almak için depoda `SITE_URL` (ör. `https://pda.example.org`) ve isteğe bağlı `DOMAIN` değişkenleri (Settings > Secrets and variables > Actions > Variables) tanımlanır; ayarlı değilse iş hiçbir şey yapmaz. Henüz GitHub'da çalıştırılmadı.

Hosting seçilince yapılacaklar (henüz uygulanmadı; yukarıdaki iş bir kısmını karşılar):

1. Dışarıdan çalışan bir uptime kontrolü (ör. ücretsiz bir ping servisi) `GET /actuator/health` ve ana sayfayı 1-5 dakikada bir yoklar; ardışık 2 hata e-posta alarmı üretir (alıcı: `pdassistant.info@gmail.com` ve bir kişisel adres).
2. Sağlayıcının CPU/bellek/disk uyarıları açılır; veritabanı disk kullanımı %80'de uyarı verir.
3. Alarm alındığında bölüm 2'deki P2 akışı izlenir.
4. TLS sertifikası: yönetilen platformlarda otomatik yenilenir (Let's Encrypt/ACME); yenilemenin son kullanma tarihinden **en az 14 gün önce** başarılı olduğu uptime aracının sertifika-süresi uyarısıyla izlenir. Domain kaydı otomatik yenilemeye ve ikinci bir iletişim e-postasına ayarlanır; sona erme tarihi takvime işlenir (30 ve 7 gün önce hatırlatma).
5. HSTS frontend'de production derlemesinde zaten gönderilir (`max-age=31536000; includeSubDomains`); TLS düzgün çalıştığı doğrulanmadan `preload` eklenmez.

## 6a. Production bileşimi: Caddy ile otomatik HTTPS (sağlayıcıdan bağımsız)

`docker-compose.prod.yml` + `ops/Caddyfile`: tek genel origin; Caddy `/` isteklerini Next.js'e, `/api/*` isteklerini (sohbet WebSocket'i `/api/v1/ws` dahil) backend'e iletir, sertifikayı kendisi alır/yeniler (genel bir `SITE_ADDRESS` için Let's Encrypt/ZeroSSL) ve `http://` → `https://` (308) yönlendirir. Güvenlik başlıklarını Caddy eklemez; Next.js (HSTS, nonce'lu CSP, nosniff, çerçeve, referrer) ve backend kendi başlıklarını gönderir. Aynı origin olduğu için CORS devreye girmez.

```powershell
# .env.prod: gerçek değerler Git dışında. Adlar: SITE_ADDRESS, SITE_URL (=https://<SITE_ADDRESS>), DB_NAME, DB_USERNAME, DB_PASSWORD,
# JWT_SECRET, EMAIL_VERIFICATION_HMAC_KEY, TOTP_ENCRYPTION_KEY, ADMIN_EMAIL, ADMIN_INITIAL_PASSWORD, MAIL_*/SMTP_* (isteğe bağlı: HTTP_PORT, HTTPS_PORT, ENV_FILE)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
node ops/smoke-test.mjs https://<SITE_ADDRESS>
```

- `APP_ENV=prod` (Secure çerezler) ve `API_DOCS_ENABLED=false` bileşimde sabittir; veritabanı dışarıya port açmaz; `TRUSTED_PROXY_CIDRS` Docker köprü aralığına ayarlıdır (rate limit gerçek ziyaretçiyi sayar).
- Frontend imajı genel adresleri **derleme anında** gömer (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`; CSP bunlardan türer): `SITE_URL` değişirse frontend imajı yeniden derlenmelidir.
- Caddy `caddy_data` volume'ünde sertifika ve ACME hesabını tutar; silinirse yeni sertifika istenir (Let's Encrypt hız sınırı). Yedek listesine eklenebilir.
- Yerelde denemek için `SITE_ADDRESS=localhost` (Caddy kendi CA'sını kullanır); `smoke-test.mjs`, kök sertifikaya `NODE_EXTRA_CA_CERTS` ile güvenilerek çalıştırılır (TLS doğrulaması kapatılmaz). Service worker, tarayıcı yerel CA'ya güvenmediği sürece o adreste kayıt olmaz; gerçek domain'de olur.
- **Doğrulama (2026-10-11, yerel CA, `localhost`):** `smoke-test.mjs` 25/25 PASS: 308 yönlendirme, HSTS, nonce'lu CSP (https/wss kaynakları, `upgrade-insecure-requests`), API başlıkları ve Secure çerez, Swagger/actuator kapalı, WebSocket yolu backend'e ulaşıyor (401), sitemap/robots/manifest/sw/offline, 36 sayfa/753 bağlantı. Tarayıcıda 8 sayfa: karışık içerik ve CSP ihlali 0, düz-http istek 0; iletişim formu Caddy üzerinden CSRF ile çalışıyor. Ölçüm sırasında bulunup giderilenler: production imajında `@next/bundle-analyzer` (devDependency) import'u yüzünden frontend çöküyordu; `X-Powered-By: Next.js` sızıyordu; dil çerezi https'te `Secure` değildi.
- **Gerçek domain'de hâlâ yapılacak:** DNS A/AAAA kaydı, 80/443 erişimi, sertifikanın gerçekten alınması (`smoke-test.mjs` bunu zaten sınar), izleme/alarm, yedek taşıma.

## 7. Yayın öncesi/sonrası kontrol listesi

Production ortam değişkenleri (adlar `.env.example`'da; değerler secret store'da):

- [ ] `APP_ENV=prod`, `API_DOCS_ENABLED=false`, `HIBERNATE_DDL_AUTO=validate`, `FLYWAY_ENABLED=true`.
- [ ] `JWT_SECRET`, `EMAIL_VERIFICATION_HMAC_KEY`, `TOTP_ENCRYPTION_KEY` yeni ve rastgele (örnek değerler kullanılmaz); `ADMIN_EMAIL` ve güçlü `ADMIN_INITIAL_PASSWORD`.
- [ ] `FRONTEND_URL` ve `ALLOWED_ORIGINS` gerçek HTTPS origin; `NEXT_PUBLIC_API_URL` ve `NEXT_PUBLIC_SITE_URL` gerçek adres (CSP `connect-src`/`img-src` bunlardan türetilir, bu yüzden **frontend derlenmeden önce** verilmelidir).
- [ ] `TRUSTED_PROXY_CIDRS` yalnız gerçek ters vekilin adresi (aksi halde rate limit tüm kullanıcıları tek kova sayar).
- [ ] `MAIL_ENABLED=true` ve geçerli `SMTP_*`; çerez `Secure=true`/`SameSite` seçimi gerçek domain topolojisiyle doğrulanmış.
- [ ] Veritabanı kullanıcısı en az yetkili; parola secret store'da.

Yayın sonrası smoke test (hepsi başarılı olmadan yayın "bitti" sayılmaz; 2-3. adımların büyük kısmını `node ops/smoke-test.mjs https://<domain>` otomatik yapar):

1. `GET /actuator/health` → `UP`.
2. `https://<domain>/` HTTP'den HTTPS'e yönleniyor; yanıtta `Strict-Transport-Security`, `Content-Security-Policy` ve diğer başlıklar var; tarayıcı konsolunda CSP ihlali yok.
3. `cd frontend; node scripts/check-site.mjs https://<domain>` → kırık bağlantı ve metadata hatası yok.
4. Kayıt → e-posta kodu → giriş → çıkış akışı bir test hesabıyla; `/pd-admin` girişi ve 2FA; çerezler `HttpOnly; Secure`.
5. Bir proje oluşturma, görev ekleme, sohbet mesajı (WebSocket `wss://`).
6. Admin Sistem durumu'nda tüm arka plan işleri görünüyor.
7. İlk yedek alındı ve geri yükleme tatbikatı başarılı.

## Doğrulama kaydı

| Tarih | Ne | Sonuç |
| --- | --- | --- |
| 2026-10-11 | `ops/backup.ps1` ve `ops/restore.ps1` PowerShell sözdizimi | Hata yok |
| 2026-10-11 | Yedek alma (`backup.ps1`) ve geçici DB'ye geri yükleme tatbikatı (`restore.ps1`) | Başarılı: DB dump ve medya arşivi alındı; geçici DB'ye açıldı (56 tablo, Flyway kayıtları, 1836 kullanıcı), sonra silindi; canlı DB'ye dokunulmadı |
