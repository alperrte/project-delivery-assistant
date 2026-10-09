# PDA — Cookie Consent, Gizlilik Odaklı Analytics, Admin Paneli ve Public İletişim — Uygulama Planı

Bu dosya uygulama boyunca tek doğruluk kaynağıdır. Kaynak şartname: `.agents/PDA_Cookie_Analytics_Admin_Contact_Plan_and_Implementation.md`
(Bölüm A–N, 81 madde, 46 kritik kural). Dal: `auth-service-backend`. Son mevcut migration **V61**; yeni migration'lar **V62**'den başlar.

Çalışma kuralları: `git commit/push/add/stash` yapılmaz; kullanıcıya ait `.agents/PDA_*.md` dosyalarına dokunulmaz; `.env` değiştirilmez
ve sır değerleri yazdırılmaz. Bir kutu yalnız ilgili test gerçekten geçtikten sonra `[x]` yapılır.

## Kullanıcı kararları (sabit)

1. **Üyelik sonlandırma = mevcut `DISABLED` durumu** (geri alınabilir). UI: "Üyeliği sonlandır" + "Yeniden etkinleştir"; onay penceresi etkinin geri alınabilir
   olduğunu açıkça söyler. Şema değişikliği yok, kullanıcı fiziksel silinmez.
2. **Mail testleri:** backend'de GreenMail (test kapsamı), E2E'de Mailpit (`docker-compose.e2e.yml` override'ı). Üretim yolu gerçek yapılandırılmış SMTP'yi kullanır;
   test maili hiçbir zaman Gmail'e gitmez.
3. **Tüm "İletişim" bağlantıları** (footer iki ton, hesap menüsü bilgi grubu, bilgi sayfası yan bloğu, hata sayfası) yeni iletişim sayfasına gider; görünür `mailto` kaldırılır.
   Footer'a "Çerez Politikası" bağlantısı ve "Çerez tercihlerini yönet" düğmesi eklenir.
4. Docker yerel veritabanı `down -v` ile sıfırlandı (Adım 0 tamamlandı); ilk admin `.env`'den yeniden oluşturuldu (zorunlu ilk şifre değişimi).

Benim kararlarım (raporda belirtilir): onay **cihaz seviyesinde** `localStorage` anahtarı `pda:cookie-consent` (`CONSENT_VERSION = 1`); analytics'e **kullanıcı kimliği yazılmaz**
(yalnız anonim ziyaretçi/oturum); alıcı sunucu yapılandırması `pda.contact.recipient` (varsayılan `pdassistant@gmail.com`, istemciden asla gelmez); grafikler elle yazılmış SVG (yeni bağımlılık yok);
analytics saklama süresi uygulanmaz, politika kararı olarak raporlanır; E2E admini, global-setup'ta `psql` ile `global_role='ADMIN'` yapılan test kullanıcısıdır (yalnız yerel).

## Bağımlılık sırası

`Task 1 (denetim) → Task 2 (onay + çerez politikası) → Task 3 (analytics) → Task 4 (iletişim) → Task 5 (admin kullanıcılar) → Task 6 (analytics paneli) → Task 7 (bütünleşik yüzey) → Task 8 (regresyon) → Task 9 (kalite kapısı)`.
Onay temeli, analytics toplamadan önce biter (kritik kural: default-deny sözleşmesi kurulmadan izleme açılmaz). Task 5, Task 6'dan önce gelir çünkü panel admin yetkisi ve kullanıcı sayımlarına dayanır;
Task 4, Task 6'dan önce gelir çünkü panel iletişim sayımını gösterir.

---

## Task 1 — Ön denetim: cookie, storage, analytics, admin, kullanıcı yaşam döngüsü, mail, güvenlik

### Amaç
Üretim kodu değiştirmeden mevcut altyapıyı çıkarmak; var olan sistemin paralel kopyasını kurmamak; hukuki/şirket verisi gerektiren alanları `LEGAL CONTENT REQUIRED` olarak işaretlemek.

### Neden bu sırada?
Cookie Politikası gerçek envantere dayanmak zorunda; admin/mail/rate-limit altyapısı bilinmeden yeni modüller yanlış yere kurulur.

### Prerequisite
Yok (Adım 0: Docker `down -v` + `up -d --build`, `/actuator/health` UP — tamamlandı).

### Etkilenecek alanlar
- Backend: yalnız okuma (`com.pda.admin`, `com.pda.user`, `com.pda.auth`, `com.pda.mail`, `SecurityBaselineConfiguration`, `AuthRateLimitFilter`).
- Database: yalnız okuma (V1–V61).
- Frontend: yalnız okuma (footer, routing, i18n, app-shell, API istemcisi).
- Authentication: oturum/iptal akışı okunur.
- Privacy: çerez/storage envanteri çıkarılır.
- Analytics: mevcut sağlayıcı aranır.
- Email: SMTP sözleşmesi okunur.
- Cache: private query temizleme yardımcıları okunur.
- Security: rate limit, CSRF, CORS, 401 giriş noktası listesi okunur.
- i18n/a11y: tr/en/de mesaj yapısı okunur.
- Tests: mevcut Playwright/Testcontainers kalıpları okunur.

### Denetim bulguları

**Çerez ve tarayıcı depolama envanteri (gerçek kod):**

| Ad | Sahip | Amaç | Kategori | Süre | HttpOnly | Secure | SameSite | İstemci okuyabilir |
|---|---|---|---|---|---|---|---|---|
| `PDA_ACCESS` | PDA backend | Kısa ömürlü erişim JWT'si, `Path=/api` | Zorunlu | JWT_ACCESS_TOKEN_EXPIRATION_MINUTES (varsayılan 15 dk) | evet | üretimde veya HTTPS'te | Lax | hayır |
| `PDA_REFRESH` | PDA backend | Dönen yenileme jetonu, `Path=/api/v1/auth` | Zorunlu | JWT_REFRESH_TOKEN_EXPIRATION_DAYS (varsayılan 7 gün) | evet | üretimde veya HTTPS'te | Lax | hayır |
| `PDA_SESSION` | PDA backend | Jeton taşımayan oturum ipucu; frontend proxy'si korumalı sayfa kabuğunu göndermemek için bakar (`Path=/`) | Zorunlu | refresh süresi | evet | üretimde veya HTTPS'te | Lax | hayır (proxy sunucu tarafında okur) |
| `XSRF-TOKEN` | Spring Security (CSRF) | CSRF çift gönderim jetonu | Zorunlu | oturum çerezi | hayır (JS okuyup başlığa koyar) | HTTPS'te | Spring varsayılanı (ayarlanmaz) | evet (zorunlu) |
| `JSESSIONID` | Tomcat | Yalnız OAuth giriş akışında; anonim istekte üretilmez (`NullRequestCache`) | Zorunlu | ~30 dk | evet | HTTPS'te | Tomcat varsayılanı | hayır |
| `NEXT_LOCALE` | Frontend (proxy + dil değiştirici) | Seçilen dil | Zorunlu/işlevsel tercih | 1 yıl | hayır | hayır | Lax | evet |
| `localStorage theme` | next-themes | Tema tercihi | İşlevsel tercih | kalıcı | — | — | — | evet |
| `localStorage pda:motion`, `pda:theme-transition` | Frontend | Hareket / tema geçişi tercihi | İşlevsel tercih | kalıcı | — | — | — | evet |
| `localStorage pda:sidebar-collapsed` | Frontend | Kenar çubuğu durumu | İşlevsel tercih | kalıcı | — | — | — | evet |
| `localStorage pda.teams.view` | Frontend | Ekipler görünümü | İşlevsel tercih | kalıcı | — | — | — | evet |
| `localStorage pda:task-mode-help:v1:<userId>` | Frontend | Görev modu yardımını gizleme | İşlevsel tercih | kalıcı | — | — | — | evet |
| `localStorage pda.rememberedEmail` | Frontend | "Beni hatırla" ile yalnız e-posta (kullanıcı onayıyla) | İşlevsel tercih | kalıcı | — | — | — | evet |
| `localStorage pda:last-session-refresh` | Frontend | Sekmeler arası oturum yenileme zamanı | Zorunlu | kalıcı | — | — | — | evet |
| `sessionStorage pda:last-project:<userId>` | Frontend | Son seçilen proje | İşlevsel tercih | sekme | — | — | — | evet |
| `sessionStorage pda:session-baseline` | Frontend | Oturum başı dil/tema tabanı | İşlevsel tercih | sekme | — | — | — | evet |
| `localStorage pda:cookie-consent` (yeni, Task 2) | Frontend | Onay kararı (`version`, `analytics`, `updatedAt`) | Zorunlu (onay kaydı) | kalıcı | — | — | — | evet |
| `localStorage pda:analytics-visitor`, `pda:analytics-session` (yeni, Task 3) | Frontend | Anonim ziyaretçi/oturum kimliği | **Analytics** — yalnız onay sonrası üretilir, geri çekilince silinir | ziyaretçi kalıcı / oturum 30 dk hareketsizlik | — | — | — | evet |

**Analytics sağlayıcısı:** `package.json`, kaynak ve HTML'de GA/GA4/gtag/GTM/Plausible/Matomo/PostHog/Umami/Vercel Analytics/FingerprintJS/Sentry/Hotjar izi **yok**. Üçüncü taraf betik yok. Mevcut onay mekanizması yok
(gizlilik sayfasının `browser-storage` bölümü "analitik yok, onay mekanizması yok" diyor; Task 2'de güncellenir). → Karar kapısı D: birinci taraf, gizlilik odaklı, mevcut yığınla uyumlu çözüm.

**Admin altyapısı (zaten var, yeniden kurulmayacak):** `com.pda.admin` — `GET /api/v1/admin/users` (sayfa/boyut, arama/filtre yok), `GET /users/{id}`, `POST /users/{id}/disable|enable`,
oturum listesi/iptali, `GET /admin/overview`, `/admin/projects`, `/admin/system/status`; `AdminAuthorization` + `PlatformPermission` (USER_MANAGE, SESSION_MANAGE, AUDIT_VIEW, SYSTEM_VIEW);
URL kuralı `/api/v1/admin/**` GET/POST `hasRole("ADMIN")`; `AdminBootstrapRunner`. `AdminIntegrationTest` 9 senaryo. **Frontend admin yüzeyi yok** (`features/admin/**` yalnız `.gitkeep`).

**Kullanıcı yaşam döngüsü:** `AccountStatus {PENDING_VERIFICATION, ACTIVE, DISABLED}`; kullanıcı fiziksel silinmez; etki alanı tabloları kullanıcıyı çıplak UUID ile referanslar.
Giriş ve `JwtCookieAuthenticationFilter` her istekte ACTIVE hesap + etkin oturum ister; refresh ACTIVE olmayan hesapta başarısız; `UserAdministrationService.disable` kendini engeller, son aktif admini korur,
`accountStatus=DISABLED` yapar ve tüm oturumları iptal eder; sohbet WebSocket'leri `ChatSocketRegistry` ile ≤30 sn'de kapanır. → "Üyeliği sonlandır" = bu mekanizmanın admin arayüzü.

**Mail:** iki kopya SMTP adaptörü (`SmtpVerificationMailAdapter`, `SmtpProjectInvitationMailAdapter`), env sözleşmesi `MAIL_ENABLED/MAIL_PROVIDER/MAIL_FROM/SMTP_HOST/SMTP_PORT/SMTP_USERNAME/SMTP_PASSWORD/SMTP_AUTH/SMTP_STARTTLS`;
düz `SimpleMailMessage`, Reply-To yok; CRLF temizleyici `singleLine`; `ObjectProvider<…MailPort>` kalıbı; SMTP kutusu (GreenMail/Mailpit) yok; `com.pda.mail` boş yer tutucu.

**Rate limit:** `AuthRateLimitFilter` (yol tablosu, `auth.rate-limit.*` ile yapılandırılabilir, 10 dk pencere, IP başına), `ProjectInvitationRateLimitFilter`, `ChatSendRateLimiter`. Analytics/iletişim/onay için yok.

**Güvenlik yapılandırması:** `SecurityBaselineConfiguration` — `csrf.spa()`, açık `permitAll` listesi, `denyAll` son kural, CORS yalnız kayıtlı önekler, 401 giriş noktası listesi.

**Online/presence:** güvenilir `lastSeen`/presence sistemi **yok** (şartname gereği kurulmaz); "aktif kullanıcı" = `AccountStatus.ACTIVE` sayısı.

**Frontend:** yerelleştirilmiş rota tablosu (`i18n/routing.ts`), `proxy.ts` `PROTECTED_PATHS`, `authenticated-route.ts` (Playwright ile gerçek `(app)` sayfalarıyla karşılaştırılır), `PublicInfoPage` + `SiteFooter`;
`CONTACT_EMAIL` (`pda-info@gmail.com`) dört yerde kullanılıyor; chart kütüphanesi yok (elle SVG: `burndown-chart.tsx`); `ConfirmDialog` `requireText` destekler; Switch bileşeni yok (ayarlar radyo satırları kullanır);
özel önbellek temizleyiciler `clearPrivateInvitations/Notifications/Teams`.

**LEGAL CONTENT REQUIRED (uydurulmaz, raporlanır):** veri sorumlusu şirket unvanı/adres/MERSİS, VERBİS kaydı, hukuki dayanak (açık rıza / meşru menfaat) metni, analytics verisi saklama süresi,
veri sorumlusu iletişim kanalı, yurt dışına aktarım beyanı, ziyaretçi hakları başvuru yolu. Teknik Çerez Politikası bu alanlar olmadan tamamlanır; ilgili alanlar "hukuki inceleme gerekli" notuyla işaretlenir.

### Checklist
- [x] 1.1 Çerez ve tarayıcı depolama envanteri koddan çıkarıldı (tablo yukarıda)
- [x] 1.2 Mevcut analytics sağlayıcısı/izleyici aranıp yok olduğu doğrulandı
- [x] 1.3 Admin altyapısı (rol, yetki, uç noktalar, bootstrap) çıkarıldı; yeniden kurulmayacağı kararlaştırıldı
- [x] 1.4 Kullanıcı yaşam döngüsü, giriş/refresh/oturum iptali, sohbet soketi kapatma incelendi
- [x] 1.5 Mail altyapısı, env sözleşmesi, `singleLine` temizleyicisi ve test SMTP kutusu eksikliği çıkarıldı
- [x] 1.6 Rate limit, CSRF, CORS, 401 listesi, Modulith sınırları incelendi
- [x] 1.7 Frontend rota/footer/i18n/cache altyapısı ve etkilenen testler (`footer-public-pages`, `error-pages`, `authenticated-history`) belirlendi
- [x] 1.8 Presence/lastSeen sistemi olmadığı raporlandı
- [x] 1.9 `LEGAL CONTENT REQUIRED` listesi çıkarıldı

### Definition of Done
- [x] Envanter tablosu ve bulgular bu dosyada yazılı
- [x] Üretim kodu değişmedi
- [x] Hukuki/şirket verisi uydurulmadı

---

## Task 2 — Onay (consent) temeli, tercih arayüzü ve Çerez Politikası sayfası

### Amaç
Analytics varsayılan **KAPALI** olan cihaz seviyesinde onay sözleşmesini kurmak; banner + tercih penceresi; footer'dan tercihleri yeniden açma; gerçek envantere dayanan, tr/en/de Çerez Politikası sayfası.

### Neden bu sırada?
Analytics toplama (Task 3) yalnız onay sözleşmesi hazır olduktan sonra açılabilir (kritik kural 2, 3, 8).

### Prerequisite
Task 1.

### Etkilenecek alanlar
- Backend: yok.
- Database: yok.
- Frontend: `src/features/consent/` (`contract.ts`, `consent-store.ts`, `cookie-banner.tsx`, `consent-dialog.tsx`, `consent-provider.tsx`), `components/providers.tsx`, `features/public-info/*`, `components/layout/site-footer.tsx`, `app/(public)/cookies/page.tsx`, `i18n/routing.ts`, `app/sitemap.ts`/`robots.ts`.
- Authentication: yok (onay hesaptan bağımsız, cihaz seviyesi).
- Privacy: varsayılan red; sürüm uyuşmazlığında yeniden sorma; geri çekmede tanımlayıcı silme.
- Analytics: yok (yalnız onay durumu; tanımlayıcılar Task 3'te).
- Email: yok.
- Cache: yok.
- Security: kullanıcı girdisi yok; düz metin.
- i18n/a11y: tr/en/de; odak tuzağı, Escape, gerçek `button`, radyo/onay satırı etiketleri, banner iki temada.
- Tests: Playwright (public config, backend gerektirmez).

### Checklist
- [x] 2.1 `contract.ts`: `CONSENT_VERSION`, kategoriler, depolama anahtarı, `readConsent()` (varsayılan red; sürüm uyuşmazlığı ⇒ yeniden sor)
- [x] 2.2 `consent-store.ts`: `useSyncExternalStore` + pencere olayı; yazma/geri çekme; geri çekmede tanımlayıcıları temizleme kancası
- [x] 2.3 `cookie-banner.tsx`: Tümünü kabul et / Tümünü reddet / Tercihleri yönet, eşit görsel ağırlık, engelleyici olmayan alt panel
- [x] 2.4 `consent-dialog.tsx`: Zorunlu AÇIK+devre dışı, Analytics varsayılan KAPALI, Dialog odak tuzağı + Escape
- [x] 2.5 `ConsentProvider` `providers.tsx` içine bağlandı (public + auth + app), SSR/ilk render'da güvenli (hidrasyon uyuşmazlığı yok)
- [x] 2.6 `INFO_LINKS`/`PAGE_ROUTES`/`SEGMENTS`/sitemap/robots'a `cookies` (tr `cerez-politikasi`, de `cookie-richtlinie`) eklendi
- [x] 2.7 `publicPages.cookies` tr/en/de (gerçek envanter, varsayılan kapalı, geri çekme, `LEGAL CONTENT REQUIRED` notları); gizlilik `browser-storage` bölümü ve SSS depolama cevabı güncellendi
- [x] 2.8 Footer'a "Çerez Politikası" bağlantısı (INFO_LINKS ile) + "Çerez tercihlerini yönet" düğmesi (iki ton); Çerez Politikası sayfasında da düğme
- [x] 2.9 Playwright (public): ilk ziyarette banner, varsayılan KAPALI, reddet/kabul kalıcılığı, footer'dan yeniden açma, klavye/a11y, 320–1440 px iki tema
- [x] 2.10 `npm run lint`, `npx tsc --noEmit` temiz; i18n JSON dosyaları `node require` ile ayrışıyor

### Definition of Done
- [x] Karar yokken/ret iken hiçbir analytics tanımlayıcısı yok; kabul → kayıt `pda:cookie-consent` içinde
- [x] Banner iki temada ve 320 px'te kullanılabilir, kullanıcıyı kabule zorlamıyor
- [x] Çerez Politikası footer'dan erişilebilir ve gerçek envantere dayanıyor
- [x] Targeted Playwright geçti

---

## Task 3 — Birinci taraf analytics (backend + onay kapılı toplama)

### Amaç
`com.pda.analytics` modülü: oturum ve sayfa görüntüleme kaydı; kaynak sınıflandırması (DIRECT/SEARCH/REFERRAL/CAMPAIGN), UTM, etkileşim süresi. Frontend'de **tek** gönderim fonksiyonu her istekte onayı doğrular.

### Neden bu sırada?
Onay temeli hazır (Task 2); Admin paneli (Task 6) toplanmış veriye ihtiyaç duyar.

### Prerequisite
Task 2.

### Etkilenecek alanlar
- Backend: `com.pda.analytics` (api/application/domain/infrastructure + kök `AnalyticsReporting` arayüzü), `SecurityBaselineConfiguration` (permitAll POST, CORS öneki), `AuthRateLimitFilter` (analytics yolu, yapılandırılabilir sınır), gövde boyutu sınırı.
- Database: **V62** `analytics_sessions`, `analytics_page_views` (kişisel veri sütunu yok, `user_id` yok).
- Frontend: `src/features/analytics/` (tek transport, tanımlayıcılar, route izleyici, etkileşim kalp atışı), `lib/api/client.ts` (`keepalive`, `NO_REFRESH`).
- Authentication: CSRF açık kalır; kimlik/kullanıcı alanı kabul edilmez.
- Privacy: onay öncesi tanımlayıcı yok; geri çekme anında dinler ve temizler; yalnız yol şablonu (query yok), UTM yalnız ilk giriş URL'sinden, referrer yalnız host.
- Analytics: olay şeması, sunucu otoritesi, tavanlar.
- Email: yok.
- Cache: yok.
- Security: sıkı DTO, bilinmeyen tür 400, gövde ve oran sınırı, sahte `userId/role/eventType` reddi.
- i18n/a11y: yok (görünmez).
- Tests: backend birim (sınıflandırıcı, doğrulama, tavan) + entegrasyon (Testcontainers, PostgreSQL satırları, 429, PII sütunu yok); Playwright gerçek backend ile.

### Checklist
- [x] 3.1 V62 migration + JPA varlıkları (Hibernate `validate` ile birebir)
- [x] 3.2 `TrafficSourceClassifier` (referrer host + UTM; arama motoru listesi; UTM yoksa referrer'sız = DIRECT; CAMPAIGN yalnız UTM ile)
- [x] 3.3 `POST /api/v1/analytics/events` (`PAGE_VIEW`, `ENGAGEMENT`), sıkı doğrulama, sunucu saati, etkileşim tavanları (çağrı başına ve geçen süreye göre), kullanıcı alanı kabul edilmez
- [x] 3.4 Güvenlik: permitAll POST, CORS öneki, CSRF açık, rate limit (yapılandırılabilir), gövde boyutu sınırı
- [x] 3.5 Frontend tek transport (`sendAnalyticsEvent`) her istekte `readConsent().analytics` kontrol eder; tanımlayıcılar yalnız onay sonrası üretilir
- [x] 3.6 Route değişiminde sayfa görüntüleme (yol şablonu; query yok), UTM yalnız iniş URL'sinden bir kez, referrer host'a indirgenir
- [x] 3.7 Etkileşim yalnız sekme görünür+odakta; `visibilitychange`/`pagehide` flush
- [x] 3.8 Geri çekme: anında gönderim durur, tanımlayıcılar silinir
- [x] 3.9 Backend birim + entegrasyon testleri geçti
- [x] 3.10 Playwright (gerçek backend): varsayılan/ret ⇒ `/analytics/events` isteği yok; kabul ⇒ PostgreSQL satırları; geri çekme ⇒ yeni istek yok; arka plan sekmesi etkileşim biriktirmez; direct/referral/UTM kaynakları

### Definition of Done
- [x] Ağ yakalama ile onaysız sıfır istek kanıtlandı
- [x] Kabul sonrası gerçek PostgreSQL satırları kanıtlandı
- [x] `ModularityTest` geçti, Flyway `validate` geçti
- [x] Analytics isteğinde kimlik, e-posta, token, query bulunmadığı test edildi

---

## Task 4 — Public İletişim formu, SMTP teslimi ve operasyonel metrik

### Amaç
Giriş gerektirmeyen `/contact` sayfası; sunucu doğrulaması; sabit alıcıya (`pdassistant@gmail.com`) mevcut SMTP sözleşmesiyle e-posta; `Reply-To` = kullanıcı; teslim durumu kaydı (mesaj saklanmaz).

### Neden bu sırada?
Analytics'ten bağımsız ama dashboard (Task 6) iletişim sayısını gösterir; admin'den önce hazır olmalı.

### Prerequisite
Task 3 (rate-limit tablosu ve public-POST güvenlik kalıbı yerleşti).

### Etkilenecek alanlar
- Backend: `com.pda.contact` (api/application/domain/infrastructure + kök `ContactReporting` arayüzü), `SmtpContactMailAdapter`, güvenlik yapılandırması, rate limit tablosu.
- Database: **V63** `contact_requests` (`id`, `created_at`, `delivery_status` SENT/FAILED — ad/e-posta/mesaj yok).
- Frontend: `/contact` sayfası (tr `iletisim`, de `kontakt`), form (react-hook-form + zod), `NO_REFRESH`, tüm "İletişim" bağlantıları, `footer-public-pages`/`error-pages` testleri.
- Authentication: yok (public); CSRF açık.
- Privacy: mesaj/ad/e-posta kalıcı saklanmaz, analytics'e gönderilmez.
- Analytics: yok (başarılı gönderim sayısı operasyonel metrik, onaydan bağımsız).
- Email: MimeMessage, From=`MAIL_FROM`, To=`pda.contact.recipient`, Reply-To=kullanıcı, sabit konu, düz metin gövde, `singleLine`.
- Cache: yok.
- Security: relay koruması (to/cc/bcc/from yok sayılır), CRLF/başlık enjeksiyonu, rate limit, tekrar gönderim koruması (409), gövde sınırı.
- i18n/a11y: tr/en/de form, doğrulama, başarı/hata; hatalar alanlarla `aria-describedby`.
- Tests: GreenMail entegrasyon, Playwright gerçek yığın + Mailpit.

### Checklist
- [x] 4.1 V63 + `ContactRequest` varlığı + `ContactReporting` kök arayüzü
- [x] 4.2 `POST /api/v1/contact` doğrulama (kırp, uzunluklar, e-posta biçimi, mesaj 10–5000, kontrol karakteri reddi; bilinmeyen alanlar yok sayılır)
- [x] 4.3 `SmtpContactMailAdapter` (mevcut env sözleşmesi; From/To/Reply-To; sabit konu; `singleLine`)
- [x] 4.4 SMTP hatası ⇒ 503 `CONTACT_DELIVERY_FAILED` + FAILED satırı; mail kapalı ⇒ 503 `CONTACT_UNAVAILABLE`; IP başına rate limit (yapılandırılabilir) + tekrar koruması (409 `CONTACT_DUPLICATE`)
- [x] 4.5 Güvenlik: permitAll POST, CORS öneki, CSRF açık
- [x] 4.6 Frontend `/contact` sayfası, çift gönderim koruması, başarı mesajı, anlaşılır hata; `NO_REFRESH`; hata kodları `error-message.ts` + `errors.*`
- [x] 4.7 Tüm "İletişim" bağlantıları yeni sayfaya; görünür `mailto` kaldırıldı; testler güncellendi
- [x] 4.8 `docker-compose.e2e.yml` (Mailpit + SMTP geçersiz kılma + gevşek limitler); `.env.example` (`CONTACT_RECIPIENT` vb. yer tutucu)
- [x] 4.9 GreenMail entegrasyon testleri (To sabit, Reply-To kullanıcı, From yapılandırılmış, CRLF, to/cc yok sayma, SMTP kapalı ⇒ 503, satır SENT/FAILED, 429, 409)
- [x] 4.10 Playwright: çıkış yapmış tarayıcı gerçek gönderim ⇒ Mailpit API'de posta (To/Reply-To/From) ⇒ operasyonel sayı +1

### Definition of Done
- [x] Mailpit'te gerçek posta görüldü (To sabit, Reply-To kullanıcı, From yapılandırılmış)
- [x] İstemci alıcı/başlık belirleyemiyor (test)
- [x] Sızıntı yok: kullanıcıya SMTP ayrıntısı dönmüyor
- [x] `ModularityTest` geçti

---

## Task 5 — Admin temeli: kullanıcı listesi ve üyelik sonlandırma

### Amaç
Mevcut admin API'si üzerine admin arayüzü: sunucu taraflı arama/durum filtresi/sayfalama ile kullanıcı listesi; "Üyeliği sonlandır" (DISABLED) ve "Yeniden etkinleştir".

### Neden bu sırada?
Analytics paneli (Task 6) admin yetkisi, rota koruması ve kullanıcı sayımlarına dayanır.

### Prerequisite
Task 4 (E2E yığını + Mailpit) ve Task 1 bulguları.

### Etkilenecek alanlar
- Backend: `UserAdministration.list(page,size,search,status)` + kayıt günlük sayıları, `AdminUserController`, problem gövdelerine `code` (`ADMIN_SELF_DENIED`, `ADMIN_LAST_ADMIN`, `USER_NOT_FOUND`).
- Database: yok.
- Frontend: `src/features/admin/`, `/admin` rotası `(app)` içinde, yalnız `globalRole === "ADMIN"` için menü bağlantısı + rota koruması, `clearPrivateAdmin`, `PAGE_ROUTES`/`PROTECTED_PATHS`/`authenticated-route.ts`/`robots.ts`.
- Authentication: sonlandırılan kullanıcının açık oturumu 401 alır; giriş engellenir.
- Privacy: şifre/jeton/hash dönmez; düz metin render.
- Analytics: yok.
- Email: yok.
- Cache: sorgu anahtarları `["admin", actorId, …]`; çıkış, `SESSION_EXPIRED_EVENT`, 401 yollarında temizlenir; girişte de temizlenir.
- Security: backend `hasRole("ADMIN")` + `AdminAuthorization`; IDOR; self-deny; son-admin kilidi.
- i18n/a11y: tr/en/de; tablo başlıkları, onay penceresi etiketleri.
- Tests: `AdminIntegrationTest` genişletme; Playwright (sonlandırma gerçek 401).

### Checklist
- [x] 5.1 `UserAdministration.list(...)`: `search` (e-posta/takma ad, büyük-küçük harf duyarsız, özel karakter kaçışlı) ve `status`; sunucu sayfalama korunur
- [x] 5.2 Admin problem gövdelerine `code`; `UserSummary` sır içermez (test)
- [x] 5.3 Frontend `/admin` rota grubu, yalnız ADMIN için yan menü/hesap menüsü bağlantısı, rota koruması (yönlendirme), `authenticated-route.ts`/`routing.ts`/`proxy.ts`/`robots.ts`
- [x] 5.4 "Kullanıcılar" sayfası (tablo, arama, durum filtresi, `PaginationBar`, yükleme/boş/hata durumları)
- [x] 5.5 "Üyeliği sonlandır" (`ConfirmDialog` + `requireText` = takma ad; etkiyi ve geri alınabilirliği belirtir) ve "Yeniden etkinleştir"; kendine uygulanamaz
- [x] 5.6 `clearPrivateAdmin`; çıkış/oturum bitişi/401/giriş-kayıt yollarına eklendi
- [x] 5.7 Backend entegrasyon testleri (arama/durum, kodlar, normal kullanıcı 403, IDOR)
- [x] 5.8 Playwright: admin B'yi sonlandırır ⇒ B'nin açık oturumu gerçek 401 ⇒ B giriş yapamaz ⇒ liste DISABLED ⇒ B'nin proje verisi diğerlerinde durur; normal kullanıcı /admin'den yönlendirilir, API 403

### Definition of Done
- [x] Gerçek 401 ve giriş engeli kanıtlandı
- [x] Normal kullanıcı UI'da ve API'de reddedildi
- [x] Önbellek izolasyonu (admin → kullanıcı) kanıtlandı
- [x] Fiziksel silme yok, geçmiş veri bozulmadı

---

## Task 6 — Admin Analytics paneli

### Amaç
Admin için: Genel bakış, Trafik, Kayıtlar, Kullanıcılar, İletişim talepleri bölümleri; tarih aralığı (7/30/90 gün + özel); saat dilimi tutarlılığı; elle SVG grafikler; erişilebilir tablolar.

### Neden bu sırada?
Veri kaynakları (analytics Task 3, iletişim Task 4, kullanıcı sayımları Task 5) hazır.

### Prerequisite
Task 3, 4, 5.

### Etkilenecek alanlar
- Backend: `GET /api/v1/admin/analytics?from=&to=&zone=` (admin modülü, kamu sözleşmelerinden birleştirir), `AnalyticsReporting`, `ContactReporting`, `UserAdministration` kayıt günlükleri.
- Database: yok (okuma).
- Frontend: "Analitik" admin sayfası, SVG grafikler, `date-picker`, süre biçimi (Intl), boş/yükleme/hata.
- Authentication: yalnız ADMIN (`SYSTEM_VIEW`).
- Privacy: trafik yalnız onaylı veri; kayıt/hesap/iletişim operasyonel kaynaktan.
- Analytics: toplulaştırma.
- Email: yok.
- Cache: `["admin", actorId, "analytics", …]`.
- Security: aralık ≤ 366 gün, saat dilimi doğrulanır, 403 normal kullanıcı.
- i18n/a11y: tr/en/de; sr-only tablolar; süre "4 dk 32 sn".
- Tests: entegrasyon (aralık, dilim, tohumlanmış satırlar, 403); Playwright (sayılar gerçek kayıt/iletişim/sayfa görüntülemeyle hareket eder).

### Checklist
- [x] 6.1 `AnalyticsReporting` + `ContactReporting` + kullanıcı kayıt günlükleri; operasyonel sayılar analytics olaylarından hesaplanmaz
- [x] 6.2 `GET /api/v1/admin/analytics` (aralık ≤366 gün, `zone` doğrulaması, boş günler sıfırla doldurulur, başarısız iletişim hariç)
- [x] 6.3 Frontend sayfa: bölümler, tarih aralığı, saat dilimi (tarayıcı), kartlar
- [x] 6.4 SVG çizgi/çubuk grafikleri (`burndown-chart.tsx` kalıbı) + sr-only tablolar
- [x] 6.5 Süre biçimi Intl (tr/en/de), boş/yükleme/hata durumları
- [x] 6.6 Backend entegrasyon testleri
- [x] 6.7 Playwright: gerçek kayıt, gerçek iletişim, onaylı sayfa görüntülemelerinden sonra sayılar artar

### Definition of Done
- [x] Sayılar gerçek PostgreSQL kaynaklarıyla eşleşiyor
- [x] Onay vermeyen kullanıcı kayıt sayımından düşmüyor
- [x] Normal kullanıcı 403/yönlendirme

---

## Task 7 — Footer, politika, i18n, erişilebilirlik ve duyarlılık bütünleştirmesi

### Amaç
Tüm yeni yüzeylerin footer/hesap menüsü/bilgi/hata sayfalarında tutarlı bağlanması; tr/en/de tamlığı; a11y; 320–1440 px.

### Neden bu sırada?
Önceki task'ların yüzeyleri oluştu; bütünleşik denetim şimdi anlamlı.

### Prerequisite
Task 2–6.

### Etkilenecek alanlar
- Backend: yok.
- Database: yok.
- Frontend: footer (iki ton), hesap menüsü bilgi grubu, bilgi sayfası yan bloğu, hata sayfası, a11y düzeltmeleri.
- Authentication: yok.
- Privacy: gizlilik/KVKK metinlerinin gerçek davranışla tutarlılığı.
- Analytics: yok.
- Email: yok.
- Cache: yok.
- Security: yok.
- i18n/a11y: eksik anahtar taraması; klavye/odak/aria; 320/390/768/1024/1440; açık/koyu/azaltılmış hareket.
- Tests: Playwright (public + mocked-API menü testleri güncellemesi).

### Checklist
- [x] 7.1 Footer bağlantıları/düğmesi iki tonda; hesap menüsü bilgi grubu (Çerez Politikası, Çerez tercihlerini yönet, İletişim → sayfa)
- [x] 7.2 Tüm yeni metinler tr/en/de; `en`/`de` anahtar eşitliği taraması
- [x] 7.3 Banner, diyalog, iletişim formu, admin tablo/grafiklerinin klavye/odak/aria incelemesi
- [x] 7.4 320/390/768/1024/1440 × açık/koyu × azaltılmış hareket doğrulaması
- [x] 7.5 Dokümanlar: `.agents/SECURITY.md`, `api.md`, `database.md`, `folder-structure.md`, `frontend-design-rules.md`, `deployment.md`; `.env.example`; web kontrol listesi etkilenen maddeler

### Definition of Done
- [x] Eksik çeviri anahtarı yok
- [x] Yatay taşma ve kırık odak yok
- [x] Dokümanlar gerçek davranışla uyumlu

---

## Task 8 — Birleşik gizlilik / güvenlik / hesap izolasyonu regresyonu

### Amaç
Şartname §69–81 senaryolarını gerçek yığında (tarayıcı → frontend → API → PostgreSQL) kanıtlamak; backend güvenlik testlerini tamamlamak.

### Neden bu sırada?
Tüm özellikler bitmeden birleşik regresyon eksik kalır.

### Prerequisite
Task 7.

### Etkilenecek alanlar
- Backend: güvenlik testleri (admin IDOR, sahte olay türü, aşırı gövde, başlık enjeksiyonu).
- Database: satır doğrulamaları (`psql`/admin API).
- Frontend: yok (test).
- Authentication: sonlandırma, hesap geçişi.
- Privacy: varsayılan red, ret, kabul, geri çekme, hesap geçişinde kimlik.
- Analytics: kaynaklar, süre.
- Email: kötüye kullanım senaryoları.
- Cache: admin → kullanıcı çıplak veri akışı yok.
- Security: relay, XSS düz metin.
- i18n/a11y: yok.
- Tests: `e2e/*.spec.ts` yeni dosyalar, backend test sınıfları.

### Checklist
- [x] 8.1 §69 varsayılan red / §70 ret / §71 kabul / §72 geri çekme
- [x] 8.2 §73 kaynak (direct, search-style referrer, referral, UTM) / §74 süre (ön/arka plan)
- [x] 8.3 §75 kayıt metriği (onaydan bağımsız) / §76 iletişim / §77 kötüye kullanım (geçersiz e-posta, boş, aşırı uzun, hızlı tekrar, CRLF, keyfi alıcı)
- [x] 8.4 §78 admin yetkisi / §79 sonlandırma / §80 hesap izolasyonu / §81 analytics hesap geçişi
- [x] 8.5 Backend güvenlik testleri

### Definition of Done
- [x] Tüm senaryolar geçti; başarı yolları `route.fulfill` olmadan kanıtlandı

---

## Task 9 — Kalite kapısı ve tamamlama dokümanı

### Amaç
Tam doğrulama zinciri ve `docs/compliation/<tarih>-cookie-analytics-admin-contact.md` teslim kaydı (şartnamenin 25 başlığı).

### Neden bu sırada?
Tam regresyon ve kanonik pre-push geçmeden tamamlandı sayılmaz (kritik kural 45).

### Prerequisite
Task 8.

### Etkilenecek alanlar
- Backend: `mvnw clean verify`.
- Database: yok.
- Frontend: lint, tsc, build, tam Chromium paketi.
- Authentication: yok.
- Privacy: bekleyen hukuki/ürün kararları raporlanır.
- Analytics: yok.
- Email: yok.
- Cache: yok.
- Security: `npm audit` raporlanır (`--force` yok).
- i18n/a11y: yok.
- Tests: `.\pre-push\pre-push.cmd`.

### Checklist
- [x] 9.1 `./mvnw clean verify` (ModularityTest dahil)
- [x] 9.2 `npm run lint`, `npx tsc --noEmit`, `npm run build`
- [x] 9.3 Tam Chromium paketi + public yapılandırma
- [x] 9.4 `.\pre-push\pre-push.cmd` ⇒ PRE-PUSH CHECK PASSED
- [x] 9.5 `npm audit` raporu
- [x] 9.6 Tamamlama dokümanı (25 başlık) ve `git diff --check`

### Definition of Done
- [x] Kapı geçti; yığın ve frontend çalışır bırakıldı
- [x] Tamamlama dokümanı yazıldı
