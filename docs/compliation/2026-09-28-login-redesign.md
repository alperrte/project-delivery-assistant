# Login sayfası yeniden tasarımı

## 1. Teslim ve durum

- **Teslim:** Login sayfasının `örnek_tasarım.png` / `ornek_tasarım_dark.png` referanslarına göre sıfırdan tasarımı; auth kabuğunun (register, şifremi unuttum, şifre değiştir) yeni görsel dile taşınması.
- **Tamamlanma:** 2026-09-28
- **Kapsam:** Yalnız frontend. Backend, API sözleşmesi ve kimlik doğrulama akışı değişmedi.

## 2. Yapılanlar

- **Tek sütunlu, ortalanmış kompozisyon:** Üstte logo, altında başlık + alt metin, ortada cam efektli giriş kartı. Dil seçici sol üstte, tema anahtarı sağ üstte. Eski iki sütunlu (hikâye paneli + form) düzen kaldırıldı.
- **Arka plan görselleri:** [auth-shell.tsx](../../frontend/src/components/layout/auth-shell.tsx) açık temada `images/background/bg-light.png`, koyu temada `images/background/bg-dark.png` görselini tam ekran (`object-cover`) gösterir. İki görsel aynı sahnenin ayrı çizimleri; koyu görselde sahne ≈4.5px sağda ve ≈39px yukarıda. Her görsel yarı yolda karşılanacak şekilde kaydırılır ve kenar görünmesin diye %4.4 büyütülür (`bgShift`); tema geçişinde sahne zıplamaz. Görseller %95 kaliteyle sunulur ([next.config.ts](../../frontend/next.config.ts) `images.qualities: [75, 95]`), çünkü varsayılan %75 fırçalanmış metal dokusunu yumuşatıyordu. İki görsel de hemen (`loading="eager"`) yüklenir, böylece ilk tema geçişinde boş kare görünmez. CSS ile çizilen eski sahne (`chrome-scene.tsx`) ve token'ları kaldırıldı.
- **Logo:** [logo.tsx](../../frontend/src/components/common/logo.tsx) açık temada [yazi-light.png](../../frontend/public/images/branding/yazi-light.png), koyu temada [yazi-dark.png](../../frontend/public/images/branding/yazi-dark.png) gösterir (dosyalar olduğu gibi kullanılır). İki dosyanın boyutu ve saydam kenar boşluğu farklı olduğu için her dosyanın görünen çizim alanı (`box`) tanımlıdır: açık logonun alanı ölçüldü, koyu logonunki aynı oranda ve onunla en iyi örtüşen alan olarak seçildi. Logo bu alana kadrajlanır; iki temada aynı yerde ve aynı boyutta durur (1440×900'de ikisi de 351×≈97px). Sayfa 1440×900'de kaydırmasız sığar.
- **Slogan:** "Planlayın. Yönetin. **Teslim edin.**" (EN: "Plan. Manage. Deliver.", DE: "Planen. Steuern. Liefern."); vurgu rengi son sözcükte. Alt metin: "Görevler, ekipler ve teslim süreçleri için sade, güçlü ve modern bir çalışma alanı."
- **Tema gerçekten bağlı:** [theme-toggle.tsx](../../frontend/src/components/layout/theme-toggle.tsx) (güneş/ay, kayan gösterge) next-themes'e bağlı; tercih kalıcı. Auth renkleri [globals.css](../../frontend/src/app/globals.css) içindeki `--auth-*` ve `--glow` token'larında; `.auth-scope` paylaşılan form bileşenlerini kart içinde bu paletle eşler.
- **Dil gerçekten bağlı:** TR/EN/DE için tüm yeni metinler [tr.json](../../frontend/src/i18n/messages/tr.json), [en.json](../../frontend/src/i18n/messages/en.json), [de.json](../../frontend/src/i18n/messages/de.json) içinde (`login.hero`, `login.rememberMe`, `login.metaTitle`, `oauth.or` …). Sekme başlığı dile göre değişir: "Giriş yap · PDA" / "Sign in · PDA" / "Anmelden · PDA". Menü öğelerinin erişilebilir adındaki tekrar ("English English") giderildi.
- **Giriş kartı:** [login-form.tsx](../../frontend/src/features/auth/components/login-form.tsx) — ikonlu e-posta/şifre alanları, "Beni hatırla", "Şifremi unuttum?", ok ikonlu birincil buton, "veya" ayırıcı, Google/GitHub, kayıt bağlantısı.
- **"Beni hatırla" davranışı:** Yalnız e-posta adresi bu cihazda `localStorage` (`pda.rememberedEmail`) içinde saklanır ve sonraki ziyarette alan önceden doldurulur. Token veya oturum bilgisi saklanmaz (SECURITY.md'ye uygun); alan API'ye gönderilmez. Oturum süresi backend'in mevcut kuralıyla aynı kalır.
- **Diğer auth sayfaları:** Register, şifremi unuttum ve şifre değiştir aynı kabuğu ve aynı birincil buton stilini (`authCtaClass`) kullanır. Register'da "veya e-posta ile" ayırıcısı artık OAuth butonları ile form arasında. Şifremi unuttum / şifre değiştir formlarında alanlar ile buton arasındaki boşluğun uygulanmaması hatası düzeltildi.
- **Silinenler:** Eski tasarıma ait, artık kullanılmayan `brand-story-panel.tsx`, `animated-logo.tsx`, `hero-landing-panel.tsx`, `animated-task-flow.tsx`, `product-preview.tsx`, `value-pillars.tsx`.

## 3. Doğrulama

| Kontrol | Sonuç |
| --- | --- |
| `npx tsc --noEmit -p .` (frontend) | Başarılı, hata yok |
| `npx eslint src` (frontend) | Başarılı, uyarı yok |
| Playwright — `/login` 1440×900, açık + koyu | Tüm içerik kaydırmasız sığıyor; referanslarla uyumlu |
| Playwright — tema anahtarına tıklama | Açık ↔ koyu anında değişiyor, yenilemede korunuyor |
| Playwright — dil menüsü TR → EN → DE | Tüm metinler ve sekme başlığı değişiyor |
| Playwright — 390×844 mobil | Yatay taşma yok, tek sütun |
| Playwright — 1366×768 | Giriş butonu ekranda; kayıt bağlantısı için kısa kaydırma gerekiyor |
| Playwright — "Beni hatırla" | Kayıtlı e-posta yenilemede alana ve kutucuğa geri geliyor |
| Playwright — `/register`, `/forgot-password` | Yeni kabukta düzgün; konsolda hata yok |
| Kontrast (açık tema) | Yardımcı metin ≈6.6:1, bağlantı ≈5.1:1 (WCAG AA) |

Not: Doğrulama önce `next dev -p 3001` ile yapıldı; ardından frontend Docker Compose'dan çıkarıldı ve 3000 portunda `npm run dev` ile çalışıyor. Ekran görüntüsü alınırken hidrasyon anına denk gelen bir `caret-color` uyuşmazlık uyarısı Playwright'ın kendi imleç gizleme stilinden kaynaklanıyor; normal yüklemede konsol temiz.

## 4. API

Yok. Mevcut `POST /api/auth/login`, `GET /api/auth/me` ve OAuth başlatma uçları değişmeden kullanılıyor.

## 5. Açık konular

- **Oturum süresi:** "Beni hatırla" oturumu uzatmaz. Gerçek "uzun oturum" istenirse backend'de refresh token ömrü için ayrı bir karar ve güvenlik onayı gerekir.
- **Kısa ekranlar:** 768px yükseklikte kart alt kısmı hafif kaydırma istiyor; birincil eylem görünür olduğu için bilinçli olarak bırakıldı.
- **Register / şifremi unuttum sayfalarına ait sekme başlıkları** henüz yok (genel "PDA · Project Delivery Assistant" görünüyor).

## 6. Kullanıcı kontrolü

1. `frontend` klasöründe `npm run dev` çalıştırın, `http://localhost:3000/login` açın (frontend artık Docker'da değil). **Beklenen:** logo, "Planlayın. Yönetin. Teslim edin." başlığı ve ortada giriş kartı, arka planda tema görseli.
2. Sağ üstteki ay ikonuna tıklayın. **Beklenen:** koyu tema, camgöbeği birincil buton; sayfayı yenileyince koyu kalır.
3. Sol üstteki dil menüsünden English, sonra Deutsch seçin. **Beklenen:** tüm metinler ve tarayıcı sekme başlığı değişir.
4. "Beni hatırla" işaretli olarak giriş yapın, çıkış yapıp `/login`'e dönün. **Beklenen:** e-posta alanı dolu, kutucuk işaretli; şifre boş.
5. "Kayıt olun" ve "Şifremi unuttum?" bağlantılarını açın. **Beklenen:** aynı arka plan ve kart stili; kart sağdan kayarak girer.
6. Tarayıcıyı 390px genişliğe daraltın. **Beklenen:** yatay kaydırma yok, tüm öğeler tek sütunda.
