# Çerez onayı, gizlilik odaklı analytics, admin paneli ve herkese açık iletişim formu (2026-10-09)

Plan ve ilerleme kaynağı: `PDA_COOKIE_ANALYTICS_ADMIN_CONTACT_PLAN.md` (kök). Şartname: `.agents/PDA_Cookie_Analytics_Admin_Contact_Plan_and_Implementation.md` (değiştirilmedi). Dal: `auth-service-backend`. Hiçbir commit/push/staging yapılmadı.

## Final verdict

**Tamamlandı; hukuki/iş verisi gerektiren alanlar dışında.** Dokuz görevin tamamı plan dosyasında `[x]`. Backend `./mvnw clean verify` 649 test, 0 hata (`ModularityTest` dahil); `npm run lint`, `npx tsc --noEmit`, `npm run build` temiz; kanonik `.\pre-push\pre-push.cmd` sonucu: **PRE-PUSH CHECK PASSED** (2026-10-09 son koşu: backend 649 test, lint, tsc, build, Playwright, Docker). Çerez Politikası teknik envantere dayanır; veri sorumlusu unvanı/adresi, VERBİS, hukuki dayanak metni ve analytics saklama süresi **uydurulmadı** ve "HUKUKİ İÇERİK GEREKLİ" olarak işaretlendi (bkz. "Pending legal/product decisions").

## Task checklist

| Görev | Durum | Kanıt |
| --- | --- | --- |
| 1 Ön denetim | [x] | Envanter ve bulgular plan dosyasında |
| 2 Onay temeli + Çerez Politikası | [x] | `cookie-consent.spec.ts` (public config), footer/public spec'leri |
| 3 Birinci taraf analytics | [x] | 45 backend testi + `analytics-collection.spec.ts` (gerçek PostgreSQL) |
| 4 İletişim formu + SMTP | [x] | 46 backend testi (GreenMail) + `contact-delivery.spec.ts` (Mailpit) |
| 5 Admin kullanıcılar + sonlandırma | [x] | `AdminIntegrationTest` (11) + `admin-users.spec.ts` |
| 6 Admin analytics paneli | [x] | `AdminAnalyticsIntegrationTest` (4) + `admin-analytics.spec.ts` |
| 7 Footer/i18n/a11y/responsive bütünleştirme | [x] | tr/en/de anahtar eşitliği taraması, beş genişlik × iki tema, dokümanlar |
| 8 Birleşik regresyon | [x] | `privacy-regression.spec.ts` + yukarıdaki gerçek-yığın senaryoları |
| 9 Kalite kapısı + bu belge | [x] | aşağıdaki "Test results" |

## Cookie inventory

Tam tablo plan dosyası Task 1'de ve herkese açık Çerez Politikası sayfasında (`/tr/cerez-politikasi`). Özet: zorunlu `PDA_ACCESS`, `PDA_REFRESH`, `PDA_SESSION` (HttpOnly, SameSite=Lax), `XSRF-TOKEN` (JS okur), `JSESSIONID` (yalnız OAuth akışı), `NEXT_LOCALE`; `localStorage`: `pda:cookie-consent`, `pda:last-session-refresh`; tercih depolaması: `theme`, `pda:motion`, `pda:theme-transition`, `pda:sidebar-collapsed`, `pda.teams.view`, `pda:task-mode-help:v1:<id>`, `pda.rememberedEmail`, `sessionStorage` `pda:last-project:<id>`, `pda:session-baseline`; analytics (yalnız izinle): `pda:analytics-visitor`, `pda:analytics-session`. Üçüncü taraf analytics/reklam aracı yoktur; hiçbir analytics çerezi (cookie) yazılmaz (`privacy-regression.spec.ts` üç onay durumunda çerez adlarını doğrular).

## Consent behavior

Onay **cihaz seviyesindedir** (`pda:cookie-consent`, `{version, necessary:true, analytics, updatedAt}`, merkezî `CONSENT_VERSION = 1`). Karar yoksa, kayıt bozuksa veya sürüm eskiyse analytics KAPALI ve banner yeniden sorar. "Tümünü reddet / Tercihleri yönet / Tümünü kabul et" eşit görsel ağırlıkta; tercih penceresinde Zorunlu AÇIK+devre dışı, Analitik varsayılan KAPALI; odak tuzağı ve Escape çalışır. Banner görünürken sayfanın altına banner yüksekliği kadar boşluk eklenir (hiçbir kontrol altında kalmaz). Footer (iki ton), hesap menüsü ve politika sayfasından tercih yeniden açılır. Geri çekme anında gönderimi durdurur ve tanımlayıcıları siler. Giriş/çıkış onayı değiştirmez.

## Analytics architecture

`com.pda.analytics` (V62): `analytics_sessions` + `analytics_page_views`. `POST /api/v1/analytics/events` (`PAGE_VIEW`, `ENGAGEMENT`): sıkı DTO, bilinmeyen tür 400, sunucu saati, gövde 2 KB, adres başına oran sınırı (varsayılan 600/10 dk), CSRF açık. Kullanıcı kimliği, e-posta, adres sorgusu, IP, user-agent **yoktur**. Tek gönderim fonksiyonu (`sendAnalyticsEvent`) her istekten önce ve istek çıkmadan hemen önce (`guard`) onayı yeniden okur; tanımlayıcılar onaydan önce üretilmez. Yol, `matchPath` ile **rota şablonuna** indirgenir (`/projects/[slug]/tasks`).

## Traffic source tracking

Sunucu tarafı sınıflandırma, yalnız oturumun ilk sayfasından: UTM varsa `CAMPAIGN`; yoksa yönlendiren host yoksa `DIRECT`; arama motoru listesindeyse `SEARCH`; değilse `REFERRAL`. Referrer yalnız host'a indirgenir (tam URL tarayıcıdan bile çıkmaz); kendi host'u kaynak sayılmaz; bozuk host ve işaretli UTM değerleri (HTML vb.) saklanmaz. Referrer'sız ziyaret "paylaşılan bağlantı" diye etiketlenmez (`DIRECT`).

## Session / engagement measurement

Süre yalnız sekme görünür **ve** pencere odaklıyken birikir (visibility/focus/blur, 15 sn kalp atışı, `pagehide` flush). Sunucu artışı çağrı başına 120 sn, son olaydan geçen gerçek süre + 5 sn ve oturum başına 6 saat ile sınırlar; oturum başına en çok 500 sayfa görüntüleme. Arka plan sekmesi süre biriktirmez (sahte saat testi); gerçek 15 sn'lik test DB'de 10–30 sn kredi gösterir. Ölçüm tarayıcı kapanması/çökmesi nedeniyle yaklaşıktır.

## Registration metrics

Kayıt sayısı `users.created_at` üzerinden hesaplanır (analytics olaylarından değil), seçilen saat diliminde günlere bölünür; çerez izni vermeyen kullanıcının kaydı da sayılır (e2e: reddeden bağlamda kayıt +1).

## Contact request metrics

`contact_requests` (V63): yalnız `id`, `created_at`, `delivery_status`. Yalnız `SENT` sayılır; `FAILED` sayıya girmez. Ad/e-posta/mesaj saklanmaz.

## Public Contact form

`/iletisim` (en `contact`, de `kontakt`), giriş gerekmez. Ad, Soyad, E-posta, Mesaj; react-hook-form + zod (sunucu kuralları aynalanır), alanlara bağlı `aria-describedby`/`role="alert"` hataları, karakter sayacı, çift gönderim koruması, "Mesajınız gönderildi." yalnız sunucu teslimi onayladıktan sonra. Tüm "İletişim" bağlantıları (footer iki ton, hesap menüsü, bilgi sayfası yan bloğu, hata sayfaları, taşınabilir 503.html) bu sayfaya gider; görünür `mailto` kalmadı.

## Email delivery / abuse protection

Mevcut SMTP env sözleşmesi (`MAIL_ENABLED`, `SMTP_*`, `MAIL_FROM`), yeni sır yok. `From` = `MAIL_FROM`, `To` = `pda.contact.recipient` (`CONTACT_RECIPIENT`, varsayılan `pdassistant@gmail.com`, başlangıçta tek adres olarak doğrulanır), `Reply-To` = ziyaretçi (sıkı tek adres), sabit konu, düz metin gövde. İstemci `to/cc/bcc/from/subject` gönderse de yok sayılır. Adlarda/e-postada CR/LF reddedilir (400), adaptör ayrıca `singleLine` uygular. Adres başına oran sınırı (5/10 dk), gövde 16 KB (413), aynı e-posta+mesaj 60 sn içinde 409, SMTP hatasında genel `503 CONTACT_DELIVERY_FAILED` (sunucu ayrıntısı sızmaz, satır `FAILED`), mail kapalıyken `503 CONTACT_UNAVAILABLE`. CAPTCHA eklenmedi (karar kapısı, bkz. bekleyen kararlar).

## Admin authorization

URL kuralı `hasRole("ADMIN")` + `AdminAuthorization`/`PlatformPermission` (mevcut model; yeni RBAC yok). Normal kullanıcı UI'da bağlantı görmez, `/admin/*` sayfasından panoya yönlendirilir, API'de 403 alır; anonim 401. Yeni uç: `GET /api/v1/admin/analytics` (`SYSTEM_VIEW`).

## User account management

`GET /api/v1/admin/users?page&size&search&status` — sunucu tarafı arama (e-posta/takma ad, büyük-küçük harf duyarsız, `%`/`_` kaçışlı) ve durum süzgeci, sunucu sayfalama. Arayüz: tablo (`md`+) / yığılmış liste, `PaginationBar`, durum için radyo satırları. Şifre/hash/jeton dönmez.

## Account termination / session revocation

"Üyeliği sonlandır" = mevcut **geri alınabilir `DISABLED`** durumu; onay penceresi etkiyi ve geri alınabilirliği söyler ve tam takma adı yazdırır; "Yeniden etkinleştir" vardır. Kendini ve son aktif admini sonlandıramaz (`ADMIN_SELF_DENIED`, `ADMIN_LAST_ADMIN`). Gerçek yığın kanıtı: B'nin açık oturumu gerçek **401** alır, giriş reddedilir, listede "Sonlandırıldı", B'nin projesi ve kullanıcı satırı silinmez, yeniden etkinleştirme girişi ve projeyi geri getirir. Fiziksel silme yoktur.

## Admin Analytics Dashboard

`/yonetim/analitik`: Genel bakış (6 kart), Trafik (günlük çizgi grafik, kaynak dağılımı, en çok yönlendiren siteler, UTM kampanyaları), Kayıtlar (günlük çubuk), Kullanıcılar (toplam/aktif/sonlandırılmış/doğrulama bekleyen/yönetici), İletişim talepleri (günlük çubuk). Aralık 7/30/90 gün veya özel (`date-picker`, en çok 366 gün), tarayıcı saat dilimi sunucuya `zone` olarak gider. Grafikler elle yazılmış SVG (yeni bağımlılık yok), her biri etiketli ve ekran okuyucu tablolu; süre `Intl` ile ("4 dk 32 sn"/"4 min 32 sec"/"4 Min. 32 Sek."). Yükleme/hata/boş durumlar var. "Aktif kullanıcı" = durumu aktif hesap (çevrimiçi değil; presence sistemi kurulmadı).

## Cookie Policy / Footer

`/tr/cerez-politikasi`, `/en/cookies`, `/de/cookie-richtlinie`: gerçek envantere dayalı sekiz bölüm, "Tercihleri yönet" düğmesi, `noindex` (gizlilik/KVKK gibi taslak). Footer'da "Çerez Politikası" bağlantısı ve "Çerez tercihlerini yönet" düğmesi; gizlilik sayfasının `browser-storage` bölümü ve KVKK/SSS iletişim metinleri güncellendi.

## Privacy / KVKK-oriented safeguards

Varsayılan red; onaydan önce tanımlayıcı ve istek yok (ağ yakalama ile kanıtlı); geri çekme anında durdurur; parmak izi yok; yalnız yol şablonu/host/UTM; sunucu otoritesi (kullanıcı/rol/zaman alanı bağlanmaz); operasyonel metrikler analytics'ten ayrı; mesaj içeriği saklanmaz ve analytics'e gitmez; düz metin render (XSS testleri). Analytics verisinin silinmesi/saklama süresi için otomatik süreç **uygulanmadı** (politika kararı).

## Cache / account isolation

Admin sorgu anahtarları `["admin", actorId, ...]`; `clearPrivateAdmin` çıkış, `SESSION_EXPIRED_EVENT`, 401 yolu ve giriş/kayıt/dış davet kayıt akışlarında çalışır. E2E: admin listesi doldurulur → çıkış → aynı sekmede normal kullanıcı girişi → istemci tarafı gezinme: admin satırı hiç görünmez, `/admin` isteği atılmaz. Analytics'te hesap kimliği hiç taşınmadığından hesap geçişinde eski kimlik sızamaz (testle kanıtlı); ziyaretçi kimliği tarayıcıya aittir, onay geçişte değişmez.

## Responsive / accessibility / i18n

tr/en/de tam (consent, contact, admin, politika; en/de anahtar ve yer tutucu eşitliği betikle doğrulandı). Banner, tercih penceresi, iletişim formu, kullanıcı listesi ve panel 320/390/768/1024/1440 px × açık/koyu × azaltılmış hareketle yatay taşmasız; klavye (Tab sırası, odak tuzağı, Escape), gerçek `button`lar, alan hata ilişkilendirmesi, `role="status"/"alert"`, grafik metin alternatifleri test edildi. Not: `node_modules/next/dist/docs` okuma izni bu ortamda reddedildi; Next 16 kalıpları depodaki çalışan koddan (proxy, route grupları, istemci bileşenleri) alındı.

## Database migrations

- **V62** `analytics_sessions`, `analytics_page_views` (kişisel sütun yok, FK `ON DELETE CASCADE`, tarih indeksleri).
- **V63** `contact_requests` (`id`, `created_at`, `delivery_status` SENT/FAILED).
`ddl-auto=validate` ile uyumlu; önceki migration'lara dokunulmadı.

## Changed files

Backend (yeni): `com/pda/analytics/**`, `com/pda/contact/**`, `admin/api/AdminAnalyticsController`, `admin/application/service/AdminAnalyticsService`, `auth/infrastructure/config/PublicBodyLimitFilter`, `V62`, `V63`, testler (`analytics/**`, `contact/**`, `AdminAnalyticsIntegrationTest`). Backend (değişen): `pom.xml` (GreenMail, test), `AuthRateLimitFilter`, `JwtCookieAuthenticationFilter`, `SecurityBaselineConfiguration`, `AdminUserController`, `UserAdministration(+Service)`, `UserRepository`, `application.properties`, `AdminIntegrationTest`.
Frontend (yeni): `features/{consent,analytics,contact}/**`, `features/admin/**`, `app/(public)/{cookies,contact}`, `app/(app)/admin/**`, e2e spec'leri (`cookie-consent`, `analytics-collection`, `contact-form`, `contact-delivery`, `admin-users`, `admin-analytics`, `privacy-regression`) ve yardımcılar (`consent-state`, `db`, `mailpit`). Frontend (değişen): `providers`, `site-footer`, `app-header`, `app-shell`, login/register/dış davet formları, `info-page`, `site-info`, `routing`, `proxy`, `authenticated-route`, `robots`, `sitemap`, `api/client`, `api/error-message`, `globals.css`, tr/en/de mesajları (hedefli ekleme), `error-content`, `public/errors/503.html` + iki betik, Playwright yapılandırmaları, `global-setup`, `footer-public-pages`/`error-pages` spec'leri; eskimiş üç e2e testi düzeltildi (`17-project-chat`: Depo bağlantısı yalnız depo bağlıyken var; `project-banner-lifecycle` ×2: proje oluşturma sonrası ekip istemi `declineTeamPrompt`).
Altyapı/doküman: `docker-compose.e2e.yml` (yeni), `docker-compose.yml`, `.env.example` (yer tutucu), `.agents/{SECURITY,api,database,folder-structure,frontend-design-rules,deployment}.md`, web kontrol listesi (İletişim kanalı), bu belge, `PDA_COOKIE_ANALYTICS_ADMIN_CONTACT_PLAN.md`.

## Test results

- Backend `./mvnw clean verify`: **649 test, 0 hata/başarısızlık/atlanan, BUILD SUCCESS** (`ModularityTest` geçti). Yeni/genişleyen sınıflar: `TrafficSourceClassifierTest` 30, `AnalyticsSessionTest` 4, `AnalyticsApiIntegrationTest` 11, `ContactMessageTest` 26, `ContactServiceTest` 5, `SmtpContactMailAdapterTest` 7, `ContactApiIntegrationTest` 8 (GreenMail), `AdminIntegrationTest` 11 (+2), `AdminAnalyticsIntegrationTest` 4.
- Frontend: `npm run lint`, `npx tsc --noEmit`, `npm run build` temiz.
- Playwright (pre-push kapısı, Chromium, gerçek yığın + Mailpit): **406 geçti, 1 atlandı, 0 hata** (atlanan: üretimde kapalı `/dev/error-test` testi)
- Playwright public yapılandırma (`playwright.public.config.ts`): **83 geçti, 1 atlandı, 0 hata** (backend'siz, yalnız public bayraklı spec'ler)
- Kapı: **PRE-PUSH CHECK PASSED** (2026-10-09 son koşu: backend 649 test, lint, tsc, build, Playwright, Docker)

### Kapı koşuları hakkında not

Kapı üç kez koşuldu. İlk iki koşuda tek tek şunlar düştü: (1) `landing-page` "desktop scroll choreography" (2 test): `frontend/.next/cache/images` içindeki `yazi-light.png` `w=256` WebP önbellek kopyası bozuktu (tarayıcıda "source image could not be decoded"; temiz `main` kopyasında aynı dosya çözülüyordu). Kaynak kodla ilgisi yok; yalnız o üretilmiş önbellek klasörü silinip sunucu yeniden başlatıldı ve test geçti. (2) `01-project-lifecycle` "connect a public GitHub repository": backend konteyneri o anda `api.github.com`'a ulaşamadı (`ResourceAccessException`, geçici dış ağ/DNS kesintisi); testin kendi 503 yeniden deneme mantığı da yetmedi. Tek başına üç kez ve son kapı koşusunda geçti. Bu test gerçek GitHub'a bağımlıdır; ağ kesilirse kapı düşebilir.

## Security / dependency audit

`npm audit --omit=dev`: **0 açık**. Tam `npm audit`: 5 yüksek (yalnız geliştirme bağımlılığı `eslint-config-next → … → braces`, `.agents/SECURITY.md` §16'da açık takip olarak kayıtlı, bu işle değişmedi; `--force` kullanılmadı). Yeni runtime bağımlılığı yok; backend'e yalnız test kapsamında GreenMail 2.1.14 eklendi.

## Remaining issues

- Referrer, `/faq` gibi proxy'nin 308 ile yönlendirdiği eski/yerelleşmemiş adreslere gelen dış tıklamalarda Playwright'ın araya girmesiyle kayboluyor; gerçek tarayıcılarda yönlendirme referrer'ı korur ancak bu otomasyonda doğrulanamadı (kanonik adreslerle test edildi).
- Yinelenen-mesaj koruması süreç içi bellektedir (tek örnek); çok örnekli kurulumda oran sınırı ek koruma sağlar.
- Analytics sayfa görüntüleme için yol şablonu sunucuda regex ile doğrulanır; bilinmeyen sayfalar `/not-found` olarak sayılır.
- E-posta doğrulama kararı (proje belleğinde "ertelenmiş") bu işte değiştirilmedi.
- `ADMIN_LAST_ADMIN` kodu entegrasyon testinde doğrudan tetiklenemedi (iki aktif admin gerektirir); davranış mevcut servis testlerinde ve kodda korunuyor.

## Pending legal/product decisions

LEGAL CONTENT REQUIRED: veri sorumlusu unvanı/adresi/MERSİS, VERBİS kaydı, hukuki dayanak metni (açık rıza/meşru menfaat), analytics saklama süresi ve silme esasları (şu an otomatik silme yok), yurt dışına aktarım beyanı, başvuru kanalı, tercih depolamasının (tema vb.) hukuki kategorisi. Ürün kararları: CAPTCHA ihtiyacı (gerçek kötüye kullanım testlerinde gerekirse ayrı karar), analytics verisi saklama/silme politikası, üretimde `MAIL_ENABLED`/`SMTP_*` yapılandırması ve `CONTACT_RECIPIENT`.

### Kullanıcının kontrol etmesi gereken adımlar

1. `docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --build` ve `cd frontend && npm run build && npm run start`.
2. Giriş yapmadan `http://localhost:3000` aç: banner görünür, "Tümünü reddet" sonrası ağ sekmesinde `analytics/events` isteği yoktur; "Tümünü kabul et" sonrası `204` yanıtları görülür.
3. `/tr/iletisim` formunu gönder; `http://localhost:8025` (Mailpit) içinde "Yeni PDA İletişim Talebi" postası: To `pdassistant@gmail.com`, Reply-To senin adresin.
4. Yönetici hesabıyla `/tr/yonetim/kullanicilar` ve `/tr/yonetim/analitik`; bir test kullanıcısını sonlandırıp yeniden etkinleştir.
5. Swagger (`API_DOCS_ENABLED=true`): `/api/v1/analytics/events`, `/api/v1/contact`, `/api/v1/admin/analytics`, `/api/v1/admin/users?search=&status=`.
