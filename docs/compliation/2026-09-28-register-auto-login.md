# Kayıttan sonra otomatik giriş ve login rate limit'i

## 1. Teslim ve durum

- **Teslim:** Kullanıcı kayıt olduktan sonra giriş sayfasına gönderilmek yerine otomatik olarak oturum açar ve uygulamaya (`/projects`) yönlenir. Ayrıca login rate limit'i IP başına 10 dakikada 5'ten 30 isteğe çıkarıldı.
- **Tamamlanma:** 2026-09-28
- **Kapsam:** Otomatik giriş yalnız frontend. Backend'de yalnız `AuthRateLimitFilter` içindeki login sınırı değişti (kullanıcı onayıyla). API sözleşmesi ve cookie/CSRF ayarları değişmedi.

## 2. Yapılanlar

- **Kayıt formu:** [register-form.tsx](../../frontend/src/features/auth/components/register-form.tsx) kayıt başarılı olunca aynı e-posta ve şifreyle mevcut `POST /api/v1/auth/login` isteğini yapar, ardından `GET /api/v1/auth/me` ile oturumu okuyup React Query önbelleğine yazar (giriş formuyla aynı akış). Kullanıcı `/projects` sayfasına (zorunlu şifre değişimi varsa `/change-password`) gider ve "Hesabınız oluşturuldu, hoş geldiniz!" bildirimi görür.
- **Güvenlik:** Oturum, normal girişteki gibi yalnız backend'in yazdığı `PDA_ACCESS` / `PDA_REFRESH` HttpOnly cookie'lerinde tutulur; tarayıcı depolamasına hiçbir şey yazılmaz. Şifre yalnız form belleğinde kalır, saklanmaz. Register endpoint'i hâlâ cookie üretmez; güvenlik mimarisi değişmedi.
- **Yedek yol:** Hesap oluştuğu hâlde giriş isteği başarısız olursa (ör. login rate limit'i dolmuşsa) eski davranış korunur: "Şimdi giriş yapabilirsiniz" bildirimi ve `/login` yönlendirmesi. Kayıt hatası (ör. kullanılan e-posta) eskisi gibi formda gösterilir ve giriş denenmez.
- **Metinler:** `register.welcome` anahtarı [tr.json](../../frontend/src/i18n/messages/tr.json), [en.json](../../frontend/src/i18n/messages/en.json), [de.json](../../frontend/src/i18n/messages/de.json) dosyalarına eklendi.
- **E2E yardımcıları:** [helpers.ts](../../frontend/e2e/helpers.ts) `registerUser` artık uygulama gezinmesinin görünmesini bekler; `registerAndLogin` ve [global-setup.ts](../../frontend/e2e/global-setup.ts) içindeki gereksiz ikinci giriş kaldırıldı.
- **Login rate limit'i:** [AuthRateLimitFilter.java](../../backend/src/main/java/com/pda/auth/infrastructure/config/AuthRateLimitFilter.java) içinde `POST /api/v1/auth/login` için ayrı `MAX_LOGIN_REQUESTS = 30` sınırı eklendi (IP + yol başına, 10 dakikalık kayan pencere, başarılı istekler de sayılır, aşımda `429` + `Retry-After: 600`). Register, şifre değiştirme, şifremi unuttum ve şifre sıfırlama 5'te; refresh ve OAuth 30'da kaldı. [AuthRegistrationHttpTest.java](../../backend/src/test/java/com/pda/auth/api/AuthRegistrationHttpTest.java) 30 istekten sonra 31.'nin `429` döndüğünü doğrular.
- **Belge:** [.agents/authentication.md](../../.agents/authentication.md) kayıt akışına frontend davranışı ve yeni login sınırı, [.agents/SECURITY.md](../../.agents/SECURITY.md) şifre sıfırlama sınırı cümlesi güncellendi.

## 3. Doğrulama

| Kontrol | Sonuç |
| --- | --- |
| `npx tsc --noEmit -p .` (frontend) | Başarılı (yalnız `@playwright/test` kurulu olmadığı için `e2e/` ve `playwright.config.ts` hataları hariç tutuldu) |
| `npx eslint` (değişen dosyalar) | Başarılı, uyarı yok |
| `./mvnw test -Dtest=AuthRegistrationHttpTest,AuthPasswordHttpTest` | 16 test, 0 hata |
| `./mvnw test` (tüm backend) | Başarılı (çıkış kodu 0, başarısız test yok) |
| Playwright — temiz tarayıcıda yeni hesapla `/register` | Kayıt sonrası `/projects` açıldı, gezinme görünür; bildirim "Hesabınız oluşturuldu, hoş geldiniz!"; `PDA_ACCESS` ve `PDA_REFRESH` HttpOnly, `localStorage`/`sessionStorage` boş; sayfa yenilenince oturum sürüyor; konsolda hata yok |

Çalıştırılamayan: E2E paketi (`npx playwright test`) çalıştırılmadı, çünkü `@playwright/test` henüz kurulu değil (`npm install` gerekli). Yedek yol (giriş isteğinin başarısız olması) rate limit'i doldurmayı gerektirdiği için elle denenmedi.

## 4. API

Endpoint ve gövde değişmedi. Tek davranış farkı: `POST /api/v1/auth/login` artık IP başına 10 dakikada 30 istekten sonra `429` döner (önceden 5).

## 5. Açık konular

- **Rate limit:** Her kayıt artık bir de login isteği yapar; login sınırı (IP başına 10 dakikada 30) register sınırından (5) ayrı sayılır, dolayısıyla kayıt sonrası girişin sınıra takılması pratikte beklenmez. Sınır yalnız IP'ye bağlı ve bellekte tutulur: aynı NAT arkasındaki kullanıcılar sınırı paylaşır, backend yeniden başlayınca sayaç sıfırlanır, birden fazla backend örneğinde paylaşılmaz. Hesap bazlı kilitleme yok.
- **E-posta doğrulaması** yeniden etkinleştirildiğinde (PENDING hesapların girişi kapatılırsa) bu akış yedek yola düşer; o fazda kayıt sonrası doğrulama ekranına yönlendirme düşünülmeli.

## 6. Kullanıcı kontrolü

1. Backend ve `frontend` içinde `npm run dev` çalışırken gizli pencerede `http://localhost:3000/register` açın.
2. Yeni bir e-posta, kullanıcı adı ve şifreyle "Kayıt ol"a basın. **Beklenen:** giriş sayfası açılmadan doğrudan Projeler sayfası gelir, üstte "Hesabınız oluşturuldu, hoş geldiniz!" bildirimi görünür.
3. Sayfayı yenileyin. **Beklenen:** oturum açık kalır.
4. Aynı e-postayla tekrar kayıt olmayı deneyin (önce çıkış yapın). **Beklenen:** formda hata gösterilir, giriş yapılmaz.
5. Backend'i yeniden başlatın (yeni sınır ancak o zaman geçerli olur). `/login`'de yanlış şifreyle art arda deneyin. **Beklenen:** 30 denemeye kadar "hatalı bilgi" hatası, 31.'de çok fazla deneme uyarısı.
6. `frontend` içinde `npm install` sonrası `npx playwright test` çalıştırın. **Beklenen:** kayıt kullanan testler geçer.
