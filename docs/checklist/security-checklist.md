# Güvenlik Checklist Raporu

> Tarih: 2026-10-08 · Dal: `task-service-frontend` · Kaynak: `.agents/SECURITY.md` (22 bölüm + §21 kontrol listesi)
> Bu rapor **sadece inceleme** sonucudur. Kod, `.env`, `.env.example` ve `SECURITY.md` değişmedi. Hiçbir gizli değer rapora yazılmadı (yalnız anahtar adları).

## Nasıl okunur?

| İşaret | Anlamı |
| --- | --- |
| ✅ Geçti | Kodda var ve (mümkünse) canlıda çalıştığı görüldü |
| ⚠️ Var ama eksik | Var, ama kuralın tamamını karşılamıyor |
| ❌ Yok | Yapılmamış |
| ➖ N/A | Bu denetimde ölçülecek bir şey yok (süreç kuralı vb.) |
| 🔍 Doğrulanamadı | Canlı ortam, GitHub ayarı ya da bu denetimde çalıştırılmayan bir kapı gerekir |

**Ne yaptım, ne yapmadım?**
- Backend (Docker, `localhost:8080`) ve frontend (production modu, `localhost:3000`) çalışırken **veri oluşturmayan** istekler yaptım: oturumsuz isteklerde 401/403 ayrımı, CSRF'siz POST, yabancı `Origin` ile CORS, güvenlik header'ları, Swagger/actuator açıklığı, hata gövdeleri, giriş denemesinde kullanıcı sızıntısı.
- `SecurityBaselineConfiguration.java` baştan sona okundu; 36 controller, matcher listesiyle tek tek karşılaştırıldı.
- `npm audit` (salt okunur), Dockerfile'lar, `docker-compose.yml`, `.dockerignore`, `.github/`, yükleme sınıfları (`AttachmentPolicy`, `ImageSniffer`, `TaskAttachmentService`) incelendi.
- Backend konteyner logunun son 400 satırı okundu: hata/exception/gizli değer yok (yalnız WebSocket istatistik satırları).
- **Yapılmadı:** tam `.\pre-push\pre-push.cmd` kapısı (konteynerleri yeniden kurar, çok uzun) ve belgeli test kullanıcısıyla canlı giriş. Bu yüzden "çerezde `Secure` bayrağı" ve "testler geçiyor" maddeleri kod ve **tarihsel** kayıtla desteklenir, bugünkü ölçüm değildir. Tarihsel kayıt: `SECURITY.md` ve master checklist notları "548 backend testi, 0 hata; 328 Chromium geçti" diyor (2026-10-08 teslim notu).
- Production yok (`.agents/deployment.md` TBD): HTTPS, production çerez bayrakları, production DB hesabı 🔍 kaldı.

## Özet

| Toplam kural satırı | ✅ Geçti | ⚠️ Var ama eksik | ❌ Yok | ➖ N/A | 🔍 Doğrulanamadı |
| --- | --- | --- | --- | --- | --- |
| **99** | **71** | **14** | **3** | **3** | **8** |

(§21'in 17 maddesi ayrıca, sayfanın en altındaki tabloda değerlendirildi; yukarıdaki sayıya o tablo **dahil değildir**.)

**Production'ı durduran maddeler**

| # | Blocker | Neden |
| --- | --- | --- |
| 1 | Next.js 16.3.6 güvenlik açıkları açık | `npm audit --omit=dev`: **1 high** (Next). Tam audit: **6 high** (Next + ESLint/braces zinciri). Düzeltilmiş sürüm 16.3.8, npm şu an 16.4.0 öneriyor (16.4.0'a geçiş uyumluluk kararı ister). `SECURITY.md` sonundaki kendi notu da "release muafiyeti değil" diyor |
| 2 | HSTS ve CSP yok | `frontend/next.config.ts` bilinçli olarak CSP koymuyor (nonce işi `proxy.ts`'e bırakılmış); HSTS hiçbir katmanda tanımlı değil |
| 3 | Zafiyet bildirim kanalı yok | Kök dizinde `SECURITY.md` yok (yalnız `.agents/SECURITY.md` var); `.github/ISSUE_TEMPLATE/config.yml` "SECURITY.md izlenmeli" diyor ama böyle bir dosya yok. `/.well-known/security.txt` 404 |
| 4 | Konteynerler root olarak çalışıyor | `backend/Dockerfile` ve `frontend/Dockerfile` içinde `USER` satırı yok |
| 5 | Production çerez/HTTPS doğrulaması yok | `Secure` bayrağı kodda `production || request.isSecure()` ile bağlı; canlıda ölçülemedi |

---

## §1 — Ortam değişkenleri ve gizli değerler

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 1.1 | Gizli değer kodda/Dockerfile'da/frontend paketinde sabit olmamalı | ✅ | Takip edilen dosyalarda AWS/GitHub/özel anahtar/`sk-` kalıpları: **0 eşleşme**. `password = "…"` sabiti: 0. Dockerfile'larda kimlik bilgisi yok | — | — | — |
| 1.2 | Gerçek `.env` asla commit edilmemeli | ✅ | `.gitignore:11` `.env`; `git ls-files` yalnız `.env.example` döndürüyor | — | — | — |
| 1.3 | `.env.example` sadece örnek değer içermeli | ✅ | Yalnız anahtar adları incelendi (JWT, DB, ADMIN, FRONTEND_URL, TRUSTED_PROXY_CIDRS…); gerçek bir sır görülmedi | Değerlerin hepsinin "örnek" olduğu satır satır tartışılmadı | Her yeni anahtarda değerin sahte olduğunu gözle kontrol et | Düşük |
| 1.4 | `NEXT_PUBLIC_*` sır içermemeli | ✅ | Tek değişken `NEXT_PUBLIC_API_URL` (adres). Kodda `NEXT_PUBLIC_SITE_URL` de kullanılıyor (adres) | `NEXT_PUBLIC_SITE_URL` **`.env.example`'da ve Dockerfile'da yok** → Docker imajı bu değişkeni göremez, canonical/sitemap hep localhost yazar | Onay alarak `.env.example`'a ekle, Dockerfile'a `ARG` ekle (§1 onay kuralı) | Yüksek |
| 1.5 | Production'da sır bundle'a girmemeli | ✅ | Frontend yalnız API adresini build'e alıyor (`frontend/Dockerfile` satır 23-24) | — | — | — |
| 1.6 | ENV ekleme/değiştirme öncesi onay + `.env.example` güncel | ⚠️ | `.env.example` içinde `ALLOWED_ORIGINS` var ama **kodda hiçbir yerde okunmuyor**; gerçek CORS kaynağı `FRONTEND_URL`. `SECURITY.md` §9 da `ALLOWED_ORIGINS` diyor | Belge ve örnek dosya koddan sapmış | Karar ver: `ALLOWED_ORIGINS`'i sil ya da gerçekten kullan; `SECURITY.md` §9'u buna göre düzelt (onayla) | Orta |
| 1.7 | Eksik güvenlik ayarında production açılmamalı (fail-fast) | ✅ | `FRONTEND_URL` boşsa/URL değilse başlatma hatası (`SecurityBaselineConfiguration` satır 271-285); JWT anahtarı en az 32 bayt değilse hata (`JwtTokens`) | Tüm hassas değişkenler için tek bir "production başlangıç kontrolü" yok | Production profilinde zorunlu anahtar listesi doğrulaması düşün | Düşük |

## §2 — GitHub ve depo güvenliği

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 2.1 | Ajan push/merge/release yapmamalı | ✅ | Bu denetimde commit/push yapılmadı; `git status` temiz | — | — | — |
| 2.2 | Push öncesi `pre-push` kapısı | ⚠️ | `pre-push/` ve `.github/pre-push.cmd`, `.ps1`, `PRE_PUSH_CHECKLIST.md` mevcut. Çalıştırılmadı | Kapıyı **zorlayan** bir CI yok: `.github/workflows/` klasörü yok. Yani kural insan disiplinine bağlı | GitHub Actions ile en azından build + test + audit çalıştır | Yüksek |
| 2.3 | Depo güvenlik ayarları (branch protection, secret scanning, Dependabot) | 🔍 | `.github/CODEOWNERS` var (`* @alperrte @HmzT270`) ve kendi yorumu "branch protection ayrıca yapılandırılmalı" diyor. `.github/dependabot.yml` **yok** | GitHub ayarları koddan okunamaz | GitHub → Settings'ten branch protection, secret scanning, Dependabot alerts ve private vulnerability reporting'i aç | Yüksek |

## §3 — Token saklama

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 3.1 | Token `localStorage`/`sessionStorage`/IndexedDB'de olmamalı | ✅ | `frontend/src` içindeki tüm kullanımlar tek tek okundu: yalnız son yenileme zamanı (`api/client.ts`), tema/hareket/kenar çubuğu/görünüm tercihleri, seçili proje adı, taslak ayar özeti ve "e-postamı hatırla" (`login-form.tsx`). **Token yok** | "E-postamı hatırla" kişisel veri sayılır (e-posta adresi `localStorage`'da) | Gizlilik sayfasında belirt; paylaşılan bilgisayar uyarısı düşün | Düşük |
| 3.2 | Access/refresh token HttpOnly çerezde | ✅ | `AuthCookies.java`: `PDA_ACCESS`, `PDA_REFRESH` HttpOnly. `PDA_SESSION` yalnız "oturum var" ipucu çerezi (token değil) | — | — | — |
| 3.3 | Production'da `Secure`, açık `SameSite`, doğru path | ⚠️ | Kodda: `Secure` = `production || request.isSecure()`; `SameSite=Lax`; access çerezi `Path=/api` | Production'da gerçek `Set-Cookie` görülemedi 🔍. HTTPS'in proxy arkasında `X-Forwarded-Proto` ile nasıl anlaşılacağı belgelenmemiş | Production dağıtımında `Set-Cookie` çıktısını ölç; proxy başlığını belgele | Yüksek |
| 3.4 | Çerez kimlik doğrulamasında CSRF kapatılmamalı | ✅ | `csrf.spa()` aktif | — | — | — |

## §4 — JWT ve oturum güvenliği

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 4.1 | İmza sırrı yalnız backend ortamından gelir, frontend'e gitmez | ✅ | `JwtTokens` ortam değişkeninden okur, en az 32 bayt şartı var | — | — | — |
| 4.2 | Access token kısa ömürlü | ✅ | `JWT_ACCESS_TOKEN_EXPIRATION_MINUTES` (belgede 15 dk) | — | — | — |
| 4.3 | Refresh token yenileme (rotation) ve iptal | ✅ | `/auth/refresh`, `/auth/sessions/*/revoke`, `revoke-others`; log: "Refresh token reuse detected; session revoked" (`UserSessionService`) | — | — | — |
| 4.4 | Refresh token düz metin saklanmaz, özet (hash) saklanır | ✅ | `JwtTokens.java` ve `VerificationCodeHasher` hash kullanıyor | Hash algoritmasının tam adı bu denetimde teyit edilmedi | Kod yorumuna algoritmayı yaz | Düşük |
| 4.5 | Logout oturumu iptal eder | ✅ | `POST /auth/logout` + oturum yönetimi uçları | — | — | — |
| 4.6 | İptal edilmiş refresh token yeni oturum açmaz | ✅ | Yeniden kullanım tespiti oturumu iptal ediyor (log satırı) | — | — | — |
| 4.7 | Hassas kimlik değerleri loglanmaz | ✅ | `log.*(…token/password/secret/cookie…)` taraması: yalnız sabit metinli log satırları; konteyner logu temiz | — | — | — |
| 4.8 | Oturumsuz istek `JSESSIONID` üretmemeli | ✅ | `NullRequestCache` (satır 98); `SecurityBaselineTest` bunu koruyor | — | — | — |

## §5 — Parola güvenliği

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 5.1 | Parola düz metin/geri döndürülebilir şifreleme ile saklanmaz | ✅ | `BCryptPasswordEncoder` (`UserAccountService`, `UserAdministrationService`) | — | — | — |
| 5.2 | Parola log/exception/Swagger/denetim çıktısında yok | ✅ | Log taraması temiz; Swagger örneklerinde `secret/token/password` içeren örnek yok | — | — | — |
| 5.3 | İlk/sıfırlama parolası düz metin tutmaz | ✅ | `AdminBootstrapRunner`: parola yalnız ortamdan, 12-72 karakter kuralı, "ilk girişte parola değiştirme zorunlu" | — | — | — |

## §6 — Yetkilendirme ve RBAC

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 6.1 | Yetki her zaman backend'de | ✅ | Matcher'lar + servis katmanı (`ProjectAccess`, `RolePolicy`); frontend gizlemesi sadece arayüz | — | — | — |
| 6.2 | Varsayılan reddet (deny-by-default) | ✅ | `anyRequest().denyAll()` (satır 265). Canlı: bilinmeyen yol 403 | — | — | — |
| 6.3 | Hiçbir uç istemeden herkese açık olmamalı | ✅ | 182 REST ucunun tamamı matcher listesiyle eşleşti, **sapma yok** (bkz. §11 tablosu) | — | — | — |
| 6.4 | Public uçlar açıkça listelenmiş ve belgeli | ✅ | 9 public uç + koşullu olanlar `SecurityBaselineConfiguration` satır 129-155'te tek tek yazılı | — | — | — |
| 6.5 | Korunan her uçta kimlik doğrulama + yetki | ⚠️ | Kimlik doğrulama matcher'da. Yetki (rol/üyelik) servislerde | `GET /api/v1/projects/**` ve `/organizations/**` gibi **geniş joker** kurallar var: yeni bir GET ucu eklendiğinde matcher kontrolü tek başına yetki sağlamaz | Yeni uçlarda servis yetki testi zorunlu kalsın (zaten test yazılıyor) | Düşük |
| 6.6 | Global ve proje yetkisi karışmamalı | ✅ | Admin uçları `hasRole("ADMIN")` (satır 177-178); proje uçları servis düzeyinde üyelik/rol | — | — | — |
| 6.7 | Teknik pozisyonlar (BACKEND_ENGINEER vb.) API yetkisi vermez | 🔍 | `RolePolicy` yetki matrisinin pozisyon-yetki ayrımı bu denetimde satır satır okunmadı; `SECURITY.md` ve testler ayrımı belirtiyor | Bu oturumda kanıtlanmadı | `RolePolicyTest` sonuçlarına bak veya matrisi elle oku | Orta |
| 6.8 | Başka projeye ID bilerek erişilemez | ✅ | Proje/sohbet/kriter entegrasyon testleri çapraz-proje senaryolarını içeriyor (`ProjectApiIntegrationTest`, `ChatApiIntegrationTest`, `ProjectCriterionApiIntegrationTest`) | Canlıda yabancı hesapla deneme yapılmadı (test kullanıcısı yok) | `pre-push` çalışınca teyit et | Orta |

## §7 — SQL ve veritabanı

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 7.1 | JPA/parametreli sorgu kullanımı | ✅ | Spring Data JPA; 10 native sorgunun hepsi `:param` bağlamalı (`ChatMessageRepository`, `ChatConversationRepository`, `ProjectMembershipRepository`…) | — | — | — |
| 7.2 | Girdi SQL'e birleştirilmez | ✅ | Tek `+` birleştirme `ProjectMembershipRepository.findPreviewMembers`: yalnız sabit metin parçaları | — | — | — |
| 7.3 | Sıralama/filtre alanı allow-list | ✅ | `PageRequest.of` çağrıları sabit `Sort.by("createdAt"/"name")` kullanıyor, kullanıcıdan alan adı gelmiyor | — | — | — |
| 7.4 | DB bilgileri ortamdan | ✅ | `application.properties` satır 7-9 | — | — | — |
| 7.5 | Production DB hesabı en az yetkiyle | 🔍 | Tek hesap (`DB_USERNAME`) hem migration hem uygulama için kullanılıyor görünüyor | Production hesabı yok; ayrı "yalnız uygulama" hesabı tanımlı değil | Migration ve uygulama için ayrı DB kullanıcıları planla | Orta |
| 7.6 | `ddl-auto` `create/update` olmamalı, Flyway | ⚠️ | Varsayılan `validate`, Flyway V1–V61 açık | Değer `HIBERNATE_DDL_AUTO` ile ortamdan **değiştirilebilir**; production'da `update` yazılırsa engelleyen bir koruma yok | Production profilinde `validate` dışı değeri reddet | Düşük |

## §8 — Girdi doğrulama

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 8.1 | Jakarta Validation + tipli DTO | ✅ | 57 `@RequestBody` parametresinin 56'sında `@Valid` | — | — | — |
| 8.2 | `@Valid` olmayan istisnalar güvenli mi | ✅ | `ChatController.send` doğrulamayı alan sınıfında yapıyor (`ChatMessage`: boş olamaz, 2000 karakter sınırı); `NotificationController.claim` gövde dolu gelirse reddediyor | İkisi de "farklı desende": tutarlılık için `@Valid` ekleme düşünülebilir | İsteğe bağlı | Düşük |
| 8.3 | Uzunluk/aralık/format/null kuralları | ✅ | DTO kısıtları, UUID/enum tipleri; GitHub branch/author için kalıp doğrulaması (`SECURITY.md` GitHub bölümü) | — | — | — |
| 8.4 | Geçersiz girdi iç ayrıntı sızdırmaz | ✅ | Canlı 400/401/403 yanıtları `ProblemDetail`, ayrıntısız | Filtre kaynaklı yanıtlarda karakter seti `ISO-8859-1` (bkz. `not-working-features.md`) | Yanıta `UTF-8` charset yaz | Düşük |

## §9 — CORS

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 9.1 | Açık origin allow-list, `*` yok | ✅ | Tek origin, `FRONTEND_URL`'den; yol/sorgu/kimlik bilgisi içeren değer reddedilir | — | — | — |
| 9.2 | Gereksiz header/method açılmamış | ✅ | Header: yalnız `Content-Type`, `X-XSRF-TOKEN`; metodlar GET/POST/PUT/PATCH/DELETE/OPTIONS | — | — | — |
| 9.3 | Credentials + wildcard birlikte yok | ✅ | `setAllowCredentials(true)` yalnız tek açık origin ile. Canlı: yabancı `Origin` ile preflight CORS başlığı almadı | — | — | — |
| 9.4 | Origin `ALLOWED_ORIGINS` gibi onaylı ayardan gelmeli | ⚠️ | Kod `FRONTEND_URL` kullanıyor | Belge `ALLOWED_ORIGINS` diyor (bkz. 1.6) | Belgeyi veya kodu eşitle | Orta |

## §10 — CSRF

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 10.1 | CSRF tasarlanmış ve test edilmiş | ✅ | `csrf.spa()`, `X-XSRF-TOKEN`; canlı: CSRF'siz POST → 403 | — | — | — |
| 10.2 | Geliştirme kolaylığı için kapatılmamış | ✅ | Kapatma yok | — | — | — |
| 10.3 | Durum değiştiren istekler CSRF'li | ✅ | Tüm POST/PUT/PATCH/DELETE `CsrfFilter`'dan geçiyor; muaf yol listesi yok | — | — | — |
| 10.4 | CORS CSRF'in yerine geçmez | ✅ | İkisi de ayrı ve aktif | — | — | — |

## §11 — API ve Swagger güvenliği

**Swagger / API dokümanı**

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 11.1 | Swagger yalnız bilinçli açılır | ✅ | `API_DOCS_ENABLED` varsayılan `false`; kapalıyken `/swagger-ui.html` ve `/v3/api-docs` deny-all (403) | Bu geliştirme ortamında açık (200) — beklenen | Production `.env`'de `false` kalmalı (🔍 production yok) | Orta |
| 11.2 | Swagger örneklerinde sır yok | ✅ | `@Schema/example` içinde `secret/token/password` geçen örnek yok | — | — | — |
| 11.3 | Actuator minimal | ✅ | Yalnız `GET /actuator/health` public; canlı yanıt ayrıntısız | — | — | — |

**Uç nokta envanteri (modül bazında).** 36 controller dosyası, **182 REST ucu** + 1 WebSocket el sıkışması (`GET /api/v1/ws`). Her ucun matcher karşılığı ve HTTP metodu karşılaştırıldı. Sapma bulunmadı.

| Modül | Controller | Uç sayısı | Kimlik doğrulama | Matcher karşılığı | Sapma |
| --- | --- | --- | --- | --- | --- |
| auth | Registration, Password, OAuth, Session, SessionManagement | 16 | **8'i public** (`csrf`, `register`, `register/invitation`, `login`, `refresh`, `logout`, `password/forgot`, `password/reset`); kalanı oturumlu | Satır 141-160 | Yok |
| admin | AdminUser, AdminSystem | 10 | Yalnız `ADMIN` rolü | Satır 177-178 (`GET`, `POST` `/admin/**`) | Yok |
| user | Profile, Preference, ProfilePhoto | 7 | Oturumlu, yalnız kendi hesabı (`/me`) ve `{id}/profile-photo` okuma | Satır 161-165 | Yok |
| project | Project, Membership, Invitation, MyInvitation, ExternalInvitation, Criterion, Logo, Banner, Repository | 50 | Oturumlu; `external/preview` **public** (hız sınırlı) | Satır 142-148, 179-264 | Yok |
| organization | Organization, OrganizationMedia | 9 | Oturumlu, yalnız aktif sahip | Satır 179-183, 237, 245 | Yok |
| squad / teams | Squad, Team | 18 | Oturumlu + proje yetkisi servisde | Satır 190-194, 239-241, 256-258 | Yok |
| task | Task, Checklist, Comment, Attachment, Worklog, Watcher, Relation, Label, Sprint, MyTasks | 53 | Oturumlu + proje yetkisi servisde | Satır 204-264 | Yok |
| notification | Notification | 5 | Oturumlu, yalnız kendi bildirimleri | Satır 166-167, 174-175 | Yok |
| reminder | Reminder | 5 | Oturumlu + proje yetkisi | Satır 199, 255, 262 | Yok |
| chat | Chat (+ WebSocket) | 9 + 1 | Oturumlu + sohbet katılımı | Satır 170-173, 200-202 | Yok |

Kalan koşullu public uçlar: OAuth başlangıç/callback (yalnız sağlayıcı yapılandırılmışsa), Swagger (yalnız `API_DOCS_ENABLED=true`), `GET /actuator/health`.

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 11.4 | Her uç belgeli ve yetki kuralı tanımlı | ✅ | `SECURITY.md` §11'de modül başına uç listesi var; kodla uyumlu (sapma 0) | Belge çok uzun (≈700 satır) ve güncel tutması zor | Zamanla bu rapordaki gibi kısa bir tabloya indir | Düşük |
| 11.5 | Yeni uç `SecurityBaselineConfiguration` listesine eklenmeli (401 listesi dahil) | ✅ | 401 giriş noktası listesi (satır 111-124) şu an tüm proje/organizasyon/görev/kullanıcı/bildirim/davet/WebSocket yollarını kapsıyor | Listeyi elle güncellemek unutulabilir | Yeni controller eklenince çalışan bir test ekle: "oturumsuz istek 401 döner" | Orta |

## §12 — Hata yönetimi

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 12.1 | Hata gövdesinde stack trace/SQL/yol/sır yok | ✅ | Canlı hata yanıtları kısa `ProblemDetail`; 9 modülde `*ApiErrorHandler`; `server.error.*` ayarı yok (Spring varsayılanı ayrıntı göstermez) | — | — | — |
| 12.2 | Tutarlı `ProblemDetail` modeli | ✅ | Modül hata yöneticileri + filtre yanıtları (`writeProblem`) | Filtre yanıtında `charset=ISO-8859-1` | Bkz. 8.4 | Düşük |
| 12.3 | 401 / 403 ayrımı doğru | ✅ | Canlı: oturumsuz proje/admin/bildirim uçları 401; yetkisiz/bilinmeyen 403 | — | — | — |

## §13 — Güvenlik logu ve denetim

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 13.1 | Güvenlik olayları kaydedilmeli (giriş, hata, çıkış, oturum iptali, parola değişimi, admin işlemi, rol/üyelik değişimi, şüpheli yetki hatası) | 🔍 | Refresh yeniden kullanım olayı loglanıyor; admin açılış logları var | Diğer olayların hepsinin log/denetim kaydı bırakıp bırakmadığı bu denetimde tek tek doğrulanmadı. Ayrı bir "denetim tablosu" görülmedi | Olay listesini koddaki log çağrılarıyla eşleştir; eksikleri tamamla | Orta |
| 13.2 | Parola/JWT/refresh/çerez/API anahtarı loglanmaz | ✅ | Kod taraması + konteyner logu temiz. GitHub token'ı hiçbir log/yanıtta (belgeye göre) | — | — | — |

## §14 — Hız sınırı ve kaba kuvvet

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 14.1 | Giriş, kayıt, yenileme, parola, davet akışları sınırlı | ✅ | `AuthRateLimitFilter` (hassas 5, giriş 30, yenileme 30 / pencere), `ProjectInvitationRateLimitFilter` (URI başına 10, istemci başına 200 / 10 dk) | — | — | — |
| 14.2 | Yönetici uçları sınırlı | ⚠️ | `/api/v1/admin/**` için ayrı bir sınırlayıcı görülmedi (yalnız `ADMIN` rolü şartı var) | Çalınan admin oturumu sınırsız istek atabilir | Admin uçlarına makul bir genel limit ekle | Düşük |
| 14.3 | Sohbet/GitHub/tepki limitleri | ✅ | Sohbet 30/dk, tepki 60/dk, GitHub okuma 60/dk (429 + `Retry-After`) | — | — | — |
| 14.4 | İstemci adresi doğru çıkarılıyor | ⚠️ | `TRUSTED_PROXY_CIDRS` ile (`ClientAddressConfiguration`) | Belirtilmezse proxy arkasında **tüm kullanıcılar tek kova** paylaşır (belgede yazılı) | Production proxy IP aralığını tanımla ve dağıtım belgesine yaz | Yüksek (production) |
| 14.5 | Sınırlayıcılar bellekte (tek örnek) | ⚠️ | Sayaçlar JVM belleğinde | Birden fazla backend kopyası çalıştırılırsa limitler kopya başına olur; yeniden başlatmada sıfırlanır | V1 için kabul; ölçeklenince Redis/DB tabanlı hale getir | Düşük |

## §15 — Güvenlik header'ları

Canlıdan ölçülen frontend header'ları (`localhost:3000`):

| Header | Var mı | Değer / not |
| --- | --- | --- |
| X-Content-Type-Options | ✅ | `nosniff` |
| X-Frame-Options | ✅ | `DENY` |
| Referrer-Policy | ✅ | `strict-origin-when-cross-origin` |
| Permissions-Policy | ✅ | kısıtlayıcı |
| Strict-Transport-Security (HSTS) | ❌ | yok |
| Content-Security-Policy | ❌ | yok (bilinçli, `next.config.ts` yorumu: nonce `proxy.ts`'te yapılmalı) |
| X-Powered-By | ⚠️ | `Next.js` bilgisi açık (`poweredByHeader` kapatılmamış) |

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 15.1 | Spring varsayılan güvenlik header'ları korunmuş | ✅ | Backend yapılandırmasında header kapatma yok | — | — | — |
| 15.2 | HSTS | ❌ | Hiçbir katmanda yok | Production HTTPS'inde ilk ziyaret dahil koruma yok | Proxy'de `Strict-Transport-Security` ekle (önce kısa `max-age`) | Yüksek |
| 15.3 | `nosniff` | ✅ | Frontend ve ek indirmelerde var | — | — | — |
| 15.4 | Çerçeve koruması (`frame-ancestors`) | ⚠️ | `X-Frame-Options: DENY` var | CSP `frame-ancestors` yok (modern tarayıcılar için tercih edilen) | CSP ile birlikte ekle | Orta |
| 15.5 | Content-Security-Policy | ❌ | Belgede "açık iş" olarak yazılı | Betik enjeksiyonuna karşı ikinci savunma hattı yok | `proxy.ts`'te nonce üreterek CSP (önce `Report-Only`) | Yüksek |
| 15.6 | Referrer-Policy | ✅ | Var | — | — | — |
| 15.7 | Header, entegrasyon sorununu saklamak için kapatılmamış | ✅ | Kapatılan header yok | — | — | — |

## §16 — Bağımlılık ve tedarik zinciri

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 16.1 | Bağımlılıklar gözden geçirilir, gereksiz eklenmez | ⚠️ | Shadcn CLI kaldırıldı (kayıtlı). Süreç kuralı, otomatik kontrol yok | Maven tarafında bağımlılık açığı taraması yok | OWASP Dependency-Check veya Dependabot (Maven) ekle | Orta |
| 16.2 | Dependabot uyarıları açık | 🔍 | `.github/dependabot.yml` yok | GitHub ayarı görülemedi | Ayarlardan aç, ayrıca `dependabot.yml` ile güncelleme PR'ları aç | Yüksek |
| 16.3 | Secret scanning açık | 🔍 | Koddan görülemez | — | GitHub ayarından aç | Orta |
| 16.4 | Yüksek/kritik açıklar release öncesi gözden geçirilir | ❌ | `npm audit`: **tam 6 high, production 1 high** (`next` 16.3.6; GHSA-3w37-wq28-93x7, GHSA-4jqv-mc3x-m676, GHSA-39w2-rjm5-chcv, GHSA-f87g-xv8r-7p7x, GHSA-mcj8-r9mp-w47p, GHSA-cjq9-62q9-8jv4 + ESLint/braces zinciri). `SECURITY.md` bunu "açık iş, muafiyet değil" diye zaten işaretlemiş | Düzeltme uygulanmamış | `next`'i 16.3.8 (ya da uyumluluk testiyle 16.4.0) yap; braces zincirini güncelle. **Onay gerektirir** | Yüksek (blocker) |
| 16.5 | Kilit dosyaları commit'li | ✅ | `package-lock.json` takipte | — | — | — |
| 16.6 | Sürümler ajan tarafından sessizce değiştirilmez | ✅ | Bu denetimde paket dosyalarına dokunulmadı | — | — | — |

## §17 — Docker ve konteyner güvenliği

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 17.1 | İmajlara sır gömülmez | ✅ | Dockerfile'larda `ENV/ARG` yalnız `NEXT_PUBLIC_API_URL` (adres) | — | — | — |
| 17.2 | `.env` imaja kopyalanmaz | ✅ | `frontend/.dockerignore`: `.env`, `.env.*`; `backend/.dockerignore` mevcut | Kök dizinde `.dockerignore` yok (compose bağlamı kökse etkilenir) | Backend bağlamının `backend/` olduğunu teyit et | Düşük |
| 17.3 | Dockerfile'da sabit kimlik bilgisi yok | ✅ | Taranan satırlarda yok | — | — | — |
| 17.4 | Production imajı yalnız gerekeni içerir | ⚠️ | Backend: çok aşamalı, `eclipse-temurin:25-jre-alpine`. Frontend runner: `npm ci --omit=dev` + `.next` | **İkisi de root çalışıyor** (`USER` yok). İmajlar etiketle çekiliyor (digest sabitlenmemiş). Dockerfile'larda `HEALTHCHECK` yok | `USER node` / özel kullanıcı ekle; sağlık kontrolü ekle; imaj etiketini sabitle | Yüksek |
| 17.5 | Geliştirme dosyaları `.dockerignore` ile dışarıda | ✅ | `node_modules`, `.next`, `.git`, `.vscode`, `.env*` hariç | — | — | — |
| 17.6 | Konteyner logları sır içermez | ✅ | Son 400 satır temiz | — | — | — |
| 17.7 | Compose'ta servis maruziyeti | ⚠️ | Postgres yalnız `127.0.0.1`'e açık. **Backend `8080` portu tüm arayüzlere** (`"${BACKEND_PORT:-8080}:8080"`) | Geliştirme için normal; production'da proxy arkasında olmalı | Production compose'ta backend portunu `127.0.0.1`'e bağla ya da yayınlama | Orta |

## §18 — Dosya ve yol güvenliği

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 18.1 | Resimler: türü bayttan doğrula, SVG/GIF reddet, piksel sınırı | ✅ | `ImageSniffer`: PNG/JPEG/WebP sihirli baytlar, en çok 6000 px kenar ve 24 milyon piksel, kodlamadan başlıktan okur (decompression bomb koruması) | — | — | — |
| 18.2 | Görev ekleri: uzantı allow-list + içerik doğrulama | ✅ | `AttachmentPolicy`: 13 uzantı, metin dosyaları UTF-8 doğrulamalı, ad temizleme (yol, kontrol karakteri, 200 sınır); 10 MB (`TaskAttachment.MAX_BYTES`), görev başına üst sınır; indirmede `nosniff` + `CSP: sandbox` (belgeye göre); yalnız 4 resim türü satır içi açılır | `zip/docx/xlsx/pptx/pdf` için içerik **zararlı yazılım** taraması yok | Plus: virüs taraması (ClamAV) ya da bu türleri kapat | Orta |
| 18.3 | Dosya adına/yoluna güvenilmez | ✅ | Ad yalnız gösterilir; veriler DB'de (`BYTEA`), diskte değil | — | — | — |
| 18.4 | Organizasyon medyası: sunucu üretimli ad, sınır, yol kaçışı koruması | 🔍 | `FileSystemMediaStorage` var; belgeye göre sunucu üretimli kimlik, içerik kontrolü ve symlink denetimi zorunlu | Bu denetimde satır satır okunmadı | Yol kaçışı ve symlink testlerinin varlığını doğrula | Orta |
| 18.5 | Yükleme boyutu sınırı | ✅ | Multipart 11 MB (`application.properties`), servis sınırları: logo 512 KB, kapak 2 MB, profil 5 MB, ek 10 MB | Kullanıcı/proje başına toplam depolama kotası yok | Plus: toplam kota | Düşük |

## §19 — Kodlama ajanları için güvenli geliştirme kuralları

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 19.1 | Ajan güvenlik politikasını korur, `.env`'e dokunmadan önce sorar, CSRF/CORS kapatmaz, sır yazmaz, push etmez | ✅ | Bu denetim boyunca `.env`, `.env.example`, kod, commit, push yok. `git status` temiz | Geçmiş ajan işlerinin tamamı bu denetimde taranmadı | — | — |
| 19.2 | Yeni ENV/uç/auth değişikliği raporlanır | ➖ | Süreç kuralı; bu denetimde yeni değişiklik yok | — | — | — |
| 19.3 | Politika ile çakışan istekte durulur ve bildirilir | ➖ | Süreç kuralı | — | — | — |

## §20 — Zafiyet bildirimi

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 20.1 | Zafiyet herkese açık issue ile açıklanmaz | ⚠️ | `.github/ISSUE_TEMPLATE/config.yml`: boş issue kapalı, yorumda "SECURITY.md izlenmeli" | Gösterilen `SECURITY.md` kökte yok; yalnız ajan kuralları var | Kökte `SECURITY.md` yaz (nasıl, nereye, kime bildirilir) | Yüksek |
| 20.2 | Onaylı özel bildirim kanalı | 🔍 | GitHub "Private vulnerability reporting" durumu koddan görülemez; `/.well-known/security.txt` yok (404) | — | GitHub'da aç, `security.txt` ekle | Yüksek |
| 20.3 | Raporda gerçek sır olmamalı | ➖ | Süreç kuralı | Kullanıcıya bildirilecek şablon yok | Kök `SECURITY.md`'ye "rapora ne yazılır / ne yazılmaz" ekle | Düşük |

## §21 — Özellik tamamlanmadan önce güvenlik kontrol listesi (17 madde)

| # | Madde | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 21.1 | Sabit sır yok | ✅ | Kalıp taraması 0 eşleşme | — | — | — |
| 21.2 | `.env` takipte değil | ✅ | `.gitignore:11` | — | — | — |
| 21.3 | Yeni ENV değişiklikleri onaylı ve belgeli | 🔍 | Geçmiş onaylar bu denetimde incelenmedi | `NEXT_PUBLIC_SITE_URL` kullanılıyor ama örnekte yok (1.4) | 1.4'ü kapat | Orta |
| 21.4 | `.env.example` onaylı sözleşmeyle uyumlu | ⚠️ | `ALLOWED_ORIGINS` ölü anahtar, `NEXT_PUBLIC_SITE_URL` eksik | İki sapma | 1.4 ve 1.6 | Orta |
| 21.5 | Backend'de girdi doğrulaması var | ✅ | 56/57 `@Valid`, kalan 1'i alan sınıfında doğrulanıyor | — | — | — |
| 21.6 | Kimlik doğrulama gereksinimi açık | ✅ | Matcher listesi, sapma 0 | — | — | — |
| 21.7 | Yetki/RBAC kuralları açık | ✅ | `RolePolicy`, `ProjectAccess`, `SECURITY.md` §11 | Pozisyon-yetki ayrımı satır satır teyit edilmedi (6.7) | 6.7 | Düşük |
| 21.8 | Korunan uç yanlışlıkla public değil | ✅ | `denyAll` + envanter | — | — | — |
| 21.9 | Projeler arası erişim engelli | ✅ | Entegrasyon testleri (kod); canlı deneme yapılmadı | Canlı teyit | 6.8 | Orta |
| 21.10 | SQL/sorgu girdisi parametreli veya allow-list | ✅ | 7.1-7.3 | — | — | — |
| 21.11 | CORS'ta güvensiz joker yok | ✅ | 9.1-9.3 | — | — | — |
| 21.12 | CSRF çerez kimlik doğrulamasına uygun | ✅ | 10.1 (canlı 403) | — | — | — |
| 21.13 | Token tarayıcı depolamasında değil | ✅ | 3.1 | — | — | — |
| 21.14 | Loglarda/hatalarda hassas değer yok | ✅ | 4.7, 12.1 | — | — | — |
| 21.15 | Swagger örneklerinde sır yok | ✅ | 11.2 | — | — | — |
| 21.16 | İlgili güvenlik testleri geçiyor | 🔍 | `SecurityBaselineTest` vb. mevcut. **Bugün çalıştırılmadı.** Tarihsel: 548 backend testi, 0 hata | Güncel ölçüm yok | `pre-push` ya da en az `mvn test` çalıştır | Yüksek |
| 21.17 | `.\pre-push\pre-push.cmd` push öncesi geçiyor | 🔍 | **Bugün çalıştırılmadı** (bilinçli). Tarihsel PASS kaydı var | Güncel ölçüm yok | Push öncesi çalıştır | Yüksek |

## §22 — Temel ilke

| # | Kural | Durum | Kanıt | Eksik olan | Yapılması gereken | Öncelik |
| --- | --- | --- | --- | --- | --- | --- |
| 22.1 | Güvenlik kontrolleri backend'de, varsayılan olarak güvenli şekilde başarısız olur | ✅ | `denyAll`, CSRF, fail-fast başlangıç, 401/403 ayrımı | Eksikler: HSTS, CSP, konteyner kullanıcısı, bağımlılık açıkları (yukarıdaki satırlar) | Yukarıdaki ❌/⚠️ satırlarını kapat | — |
| 22.2 | Kolaylık güvenlik tabanını sessizce zayıflatmaz | ✅ | CSP ve açık bağımlılık borcu **belgede açıkça yazılı** (gizlenmemiş) | — | — | — |
