# auth-service-frontend — Yönetim operasyon ekranları (kullanıcı detayı, sistem, denetim kaydı, destek talepleri, davranış raporları)

## 1. Özet

- Branch: `auth-service-frontend` — `PDA_HAMZA_CHECKLIST_LEGAL_CONTACT_ADMIN_PLAN.md` Task 8 (8.1–8.6). Backend (Phase 1: `7a9b66a`, PR #142) değişmedi; bu görevde `backend/` ve docker'a dokunulmadı.
- Durum: Task 8 frontend/E2E kapsamı tamamlandı; hedefli kontroller bölüm 5'te. Tam suite, canonical pre-push ve checklist `[x]` güncellemesi plan gereği Phase 3'tedir. Commit/push/stage ajan tarafından yapılmadı.
- Sonuç: yönetici panelinde artık beş sekme vardır (Kullanıcılar, Destek talepleri, Analitik, Denetim kaydı, Sistem); kullanıcı detay sayfasından oturumlar tek tek veya toplu kapatılabilir, destek talepleri okunup durumu değiştirilebilir, analitikte sayfa/akış/CTA/dönüşüm/hata raporları görünür.
- **Kullanıcı kararı uygulandı:** tek yönetici politikası. Rol yönetimi yoktur; roller ve izinler salt okunur gösterilir, kısa açıklayıcı not: "Bu kurulumda tek yönetici vardır: ortam değişkenleriyle oluşturulan hesap. Roller değiştirilemez." (TR/EN/DE).

## 2. Rotalar

| Rota | TR | DE |
| --- | --- | --- |
| `/admin/users/[userId]` | `/tr/yonetim/kullanicilar/<id>` | `/de/verwaltung/benutzer/<id>` |
| `/admin/system` | `/tr/yonetim/sistem` | `/de/verwaltung/system` |
| `/admin/audit` | `/tr/yonetim/denetim-kaydi` | `/de/verwaltung/audit-protokoll` |
| `/admin/support` | `/tr/yonetim/destek-talepleri` | `/de/verwaltung/support-anfragen` |
| `/admin/support/[requestId]` | `/tr/yonetim/destek-talepleri/<id>` | `/de/verwaltung/support-anfragen/<id>` |

`PAGE_ROUTES`, segment tabloları ve `AUTHENTICATED_ROUTES` birlikte güncellendi; `authenticated-history.spec.ts` (her `(app)` sayfası listede) ve `localized-routing.spec.ts` (oturumsuz ziyaretçi aynı dilin girişine gider) yeni adresleri de kapsar.

## 3. Arayüz kararları

- **Detaylar tam sayfadır** (diyalog/çekmece değil): karmaşık içerik (profil + izinler + oturum tablosu; mesaj + durum) için tasarım kuralı gereği. Liste → nickname/ad bağlantısı → detay; üstte `Breadcrumb`.
- **8.1 Kullanıcı detayı:** profil (kullanıcı adı, e-posta, durum, doğrulama, kayıt tarihi, şifre değişikliği gerekli, bağlı sağlayıcılar), rol rozeti, salt okunur platform izinleri (düz metin), tek yönetici notu, açık oturum tablosu (cihaz özeti, başladı, son kullanım göreli, bitiş; mobilde liste). Tek oturum ve "Tüm oturumları kapat" `ConfirmDialog` (yıkıcı) ile; etki açık yazılır; başarı toast'ı, hata hem toast hem diyalogda; oturum zaten yoksa (404) liste yenilenir. Kendi hesabında uyarı metni değişir. Backend kendi oturumunu kapatmaya kısıtlama koymadığı için ek kısıt yoktur ("backend ne dönüyorsa").
- **8.2 Sistem:** 7 sağlık kartı (hizmet, veritabanı, e-posta, Google, GitHub, API belgeleri, TOTP anahtarı), açık oturum + 24 saatlik 4xx/5xx (süreç belleği notuyla), zamanlanmış işler (yerelleştirilmiş ad, göreli son çalışma, sonuç rozeti, etkilenen kayıt), kullanıcı/proje sayıları, sayfalı proje listesi, "Yenile". Her bölüm bağımsız yükleme/hata/boş durumu.
- **8.3 Denetim kaydı:** işlem seçimi, ortak `DatePicker` ile tarih aralığı, `zone` = tarayıcı saat dilimi; tablo (zaman, yapan, işlem, hedef, sonuç) + mobil liste; yapan/hedef detay sayfasına bağlı; boş/filtreli boş/yükleniyor/hata+yeniden dene; ters aralık gönderilmez.
- **8.4 Destek:** durum + kategori filtresi, liste (tarih, kategori, ad, e-posta, önizleme, durum, bildirim e-postası), detay (mesaj düz metin + satır sonları, `mailto:` yanıtı, durum değiştirme; "Talebi kapat" onaylı). Sekmede yeni talep sayısı rozeti (opsiyonel madde yapıldı; `status=NEW&size=1` toplamı, 60 sn).
- **8.5 Analitik:** `behavior-sections.tsx` — en çok görüntülenen/giriş/çıkış sayfaları, akışlar, 404, CTA (yerelleştirilmiş adlar), dönüşüm (toplam, kaynak, kampanya; oran), istemci hataları (tür, sayfa). Hepsi erişilebilir tablo; grafik eklenmedi.
- **8.6** TR/EN/DE (Almanca "Sie"), yükleme/boş/hata durumları, 320/390/768/1024/1440 + açık/koyu, klavye ve dokunma hedefleri, sekme çubuğu dar ekranda kayar.
- Ayrıntı: `.agents/frontend-design-rules.md` "Yönetim sekmeleri…", `.agents/folder-structure.md`.

## 4. Değişen önemli dosyalar

- Yeni: `frontend/src/app/(app)/admin/{users/[userId],system,audit,support,support/[requestId]}/page.tsx`; `frontend/src/features/admin/components/{admin-ui,user-detail-page,system-page,audit-page,support-page,support-detail-page,behavior-sections}.tsx`; `features/admin/lib/{user-agent,browser-time}.ts`; `e2e/{admin-fixtures.ts,admin-operations.spec.ts,admin-behavior.spec.ts}`.
- Değişen: `features/admin/{api.ts,query-keys.ts}`, `components/{admin-guard,users-page,analytics-page}.tsx`, `i18n/routing.ts`, `components/layout/authenticated-route.ts`, `lib/seo/page-title.ts`, `lib/api/error-message.ts` (`SUPPORT_REQUEST_NOT_FOUND`), `i18n/messages/{tr,en,de}.json` (yalnız `admin` ad alanı, `pageTitles.admin*`, bir `errors` kodu), `e2e/localized-routing.spec.ts`.
- Dokümanlar: `.agents/frontend-design-rules.md`, `.agents/folder-structure.md`, `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md` (scoped not).

## 5. Doğrulama

Komutlar (`frontend/` içinden, gerçek backend + Mailpit; docker yeniden kurulmadı):

- `npx tsc --noEmit` — temiz.
- `npm run lint` — temiz.
- `E2E_REUSE_AUTH=1 npx playwright test e2e/admin-*.spec.ts e2e/authenticated-history.spec.ts e2e/localized-routing.spec.ts --output=test-results-p2b` — **91 geçti, 0 başarısız** (11,4 dk). Yeni: `admin-operations.spec.ts` 16 test (rota yerelleştirme birim testi, kullanıcı detayı + tek/toplu oturum kapatma ve gerçek 401, başarısız eylem durumları, sistem gerçek değerler + yükleme/hata/boş, denetim olayları + eylem/tarih filtresi + sayfalama/hata, destek talebi uçtan uca + durum değişimi + sayaç + denetim satırı, destek durumları, yetkisiz/doğrulanmamış erişim, 5 genişlik × 2 tema); `admin-behavior.spec.ts` 10 test (gerçek `/analytics/events` ile üretilen veriyle davranış raporları, TR/EN/DE sunum, `behavior` olmadan çizim, 5 genişlik). Mevcut `admin-users`, `admin-analytics`, `admin-login`, `authenticated-history`, `localized-routing` testleri değişmeden/yalnız yeni adres eklemeyle yeşil.
- Ekran görüntüleri incelendi (scratchpad `admin-*.png`): `admin-{user-detail,system,audit,support,support-detail,analytics-behaviour}-{1440-light,390-dark}.png`.
- `git diff --check` temiz; dosyalar LF; `test-results-p2b` silindi.

## 6. API (kullanılan uçlar)

Hepsi `/api/v1/admin/**`, admin-doğrulanmış oturum, POST'ta CSRF, `Cache-Control: no-store`. Swagger: `/swagger-ui/index.html` (API_DOCS_ENABLED=true iken), "Admin" etiketleri.

- `GET /admin/users/{id}` (detay + `platformPermissions`), `GET /admin/users/{id}/sessions`, `POST /admin/users/{id}/sessions/revoke-all` → `{revoked}`, `POST /admin/users/{id}/sessions/{sessionId}/revoke`.
- `GET /admin/system/status`, `GET /admin/overview`, `GET /admin/projects?page&size`.
- `GET /admin/audit-events?page&size&action&from&to&zone`.
- `GET /admin/support-requests?page&size&status&category`, `GET /admin/support-requests/{id}`, `POST /admin/support-requests/{id}/status {status}`.
- `GET /admin/analytics` (`behavior` bloğu).

## 7. Açık konular ve backend gözlemleri (backend değiştirilmedi)

1. `POST /admin/users/{id}/sessions/{sessionId}/revoke` oturum bulunamadığında `404` ile `USER_NOT_FOUND` kodunu döndürür (mesaj "kullanıcı bulunamadı"); oturum için ayrı kod yoktur. Arayüz bu 404'ü oturum bağlamında "Bu oturum artık açık değil" diye gösterir.
2. `support_requests.status_changed_at` oluşturma anında `created_at`'a eşit yazılır; arayüz "Durum değişikliği"ni yalnız farklıysa gösterir.
3. `SessionView` içinde "bu oturum benim" bayrağı yoktur; yönetici kendi oturumunu kapatabilir (arayüz uyarır, engellemez).
4. 4xx/5xx sayaçları ve zamanlanmış iş listesi süreç belleğindedir (backend belgesinde de yazar); yeniden başlatmada sıfırlanır — ekran bunu not eder.
5. CTA ve istemci hata olayları bu fazda doğrudan uca gönderilen olaylarla test edildi; istemci tarafı izleme (Task 9) paralel çalışmanın kapsamındadır.
6. `e2e` yığınında projeler/hesaplar çok birikmiş olabilir (testler listeleri API ile karşılaştırır, sabit sayıya dayanmaz).

## 8. Kullanıcının manuel kontrol adımları

1. `/pd-admin` ile admin olarak girin; üst sekmelerde Destek talepleri, Denetim kaydı ve Sistem'in açıldığını, dar pencerede sekme çubuğunun kaydığını görün.
2. Kullanıcılar → bir kullanıcı adına tıklayın: profil, "Rol ve izinler" kartındaki tek yönetici notu ve açık oturumlar; başka tarayıcıdan o kullanıcıyla giriş yapıp "Oturumu kapat"ı deneyin: o tarayıcı oturumdan çıkmalı.
3. İletişim formundan mesaj gönderin: Destek talepleri'nde görünmeli, sekmede sayı artmalı; detayda satır sonları korunmalı; "İşleme al" / "Talebi kapat" (onaylı) sonrası Denetim kaydı'nda satır görünmeli.
4. Sistem sekmesinde sağlık kartları ve işlerin "Henüz çalışmadı" / "Başarılı" durumları ortamınızla uyuşmalı.
5. Analitik'te (çerez izni verilmiş ziyaretlerden sonra) Sayfalar, Akışlar, CTA, Dönüşüm ve İstemci hataları bölümleri dolmalı.
