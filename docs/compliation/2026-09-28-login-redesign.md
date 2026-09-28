# Login sayfası yeniden tasarımı

## 1. Teslim ve durum

- **Teslim:** Login sayfasının `örnek_tasarım.png` / `ornek_tasarım_dark.png` referanslarına göre sıfırdan tasarımı; auth kabuğunun (register, şifremi unuttum, şifre değiştir) yeni görsel dile taşınması.
- **Tamamlanma:** 2026-09-28
- **Kapsam:** Yalnız frontend. Backend, API sözleşmesi ve kimlik doğrulama akışı değişmedi.

## 2. Yapılanlar

- **Tek sütunlu, ortalanmış kompozisyon:** Üstte logo, altında başlık + alt metin, ortada cam efektli giriş kartı. Dil seçici sol üstte, tema anahtarı sağ üstte. Eski iki sütunlu (hikâye paneli + form) düzen kaldırıldı.
- **Arka plan görselleri:** [auth-shell.tsx](../../frontend/src/components/layout/auth-shell.tsx) açık temada `images/background/bg-light.png`, koyu temada `images/background/bg-dark.png` görselini tam ekran (`object-cover`) gösterir. İki görsel aynı sahnenin ayrı çizimleri; koyu görselde sahne ≈4.5px sağda ve ≈39px yukarıda. Her görsel yarı yolda karşılanacak şekilde kaydırılır ve kenar görünmesin diye %4.4 büyütülür (`bgShift`); tema geçişinde sahne zıplamaz. Görseller %95 kaliteyle sunulur ([next.config.ts](../../frontend/next.config.ts) `images.qualities: [75, 95]`), çünkü varsayılan %75 fırçalanmış metal dokusunu yumuşatıyordu. İki görsel de hemen (`loading="eager"`) yüklenir, böylece ilk tema geçişinde boş kare görünmez. CSS ile çizilen eski sahne (`chrome-scene.tsx`) ve token'ları kaldırıldı.
- **Logo:** [logo.tsx](../../frontend/src/components/common/logo.tsx) açık temada [yazi-light.png](../../frontend/public/images/branding/yazi-light.png), koyu temada [yazi-dark.png](../../frontend/public/images/branding/yazi-dark.png) gösterir (dosyalar olduğu gibi kullanılır). İki dosyanın boyutu ve saydam kenar boşluğu farklı olduğu için her dosyanın görünen çizim alanı (`box`) tanımlıdır: açık logonun alanı ölçüldü, koyu logonunki aynı oranda ve onunla en iyi örtüşen alan olarak seçildi. Logo bu alana kadrajlanır; iki temada aynı yerde ve aynı boyutta durur (1440×900'de ikisi de 351×≈97px). Sayfa 1440×900'de kaydırmasız sığar.
- **Slogan:** "Planlayın. Yönetin. Teslim edin." (EN: "Plan. Manage. Deliver.", DE: "Planen. Steuern. Liefern."). Yazının tamamı tek renk (açık temada siyah, koyu temada okunabilirlik için beyaz). Üzerinde elektrik akımı dolaşır (`.auth-slogan`, 7 sn döngü): "P" harfinden başlayarak her harfin kenarında sırayla bir kıvılcım tur atar (harf başına ≈80 ms arayla, titreyerek), kıvılcımın geçtiği harf kısa bir an camgöbeğine döner. Son harften sonra tüm satır titreyerek camgöbeği renkte parlar, sonra sakinleşir ve döngü baştan başlayana kadar bekler. Her harf ayrı bir `span`dır ([login-hero.tsx](../../frontend/src/features/auth/components/login-hero.tsx)); kıvılcım harfin yalnız kontur kopyasıdır (`::after`), dönen bir konik maske ile kuyruklu bir ışık gibi gösterilir. Harf `span`ları ekran okuyuculardan gizlidir, cümle bir kez tam olarak (`sr-only`) okunur. Hareketi azalt açıkken ve yüksek karşıtlık modunda slogan düz metin olarak kalır. Alt metin: "Görevler, ekipler ve teslim süreçleri için sade, güçlü ve modern bir çalışma alanı."
- **Yazı tipleri:** Uygulamanın genel yazı tipi Inter (gövde ve başlıklar; [layout.tsx](../../frontend/src/app/layout.tsx), `--font-sans` / `--font-heading`). Manrope ve Space Grotesk kaldırıldı. Logonun altındaki slogan Exo 2 ile yazılır; bu yazı tipi yalnız [login-hero.tsx](../../frontend/src/features/auth/components/login-hero.tsx) içinde yüklenir, diğer sayfalar indirmez.
- **Tema gerçekten bağlı:** [theme-toggle.tsx](../../frontend/src/components/layout/theme-toggle.tsx) (güneş/ay, kayan gösterge) next-themes'e bağlı; tercih kalıcı. Auth renkleri [globals.css](../../frontend/src/app/globals.css) içindeki `--auth-*` ve `--glow` token'larında; `.auth-scope` paylaşılan form bileşenlerini kart içinde bu paletle eşler.
- **Dil gerçekten bağlı:** TR/EN/DE için tüm yeni metinler [tr.json](../../frontend/src/i18n/messages/tr.json), [en.json](../../frontend/src/i18n/messages/en.json), [de.json](../../frontend/src/i18n/messages/de.json) içinde (`login.hero`, `login.rememberMe`, `login.metaTitle`, `oauth.or` …). Sekme başlığı dile göre değişir: "Giriş yap · PDA" / "Sign in · PDA" / "Anmelden · PDA". Menü öğelerinin erişilebilir adındaki tekrar ("English English") giderildi.
- **Giriş kartı:** [login-form.tsx](../../frontend/src/features/auth/components/login-form.tsx) — ikonlu e-posta/şifre alanları, "Beni hatırla", "Şifremi unuttum?", ok ikonlu birincil buton, "veya" ayırıcı, Google/GitHub, kayıt bağlantısı.
- **"Beni hatırla" davranışı:** Yalnız e-posta adresi bu cihazda `localStorage` (`pda.rememberedEmail`) içinde saklanır ve sonraki ziyarette alan önceden doldurulur. Token veya oturum bilgisi saklanmaz (SECURITY.md'ye uygun); alan API'ye gönderilmez. Oturum süresi backend'in mevcut kuralıyla aynı kalır.
- **Diğer auth sayfaları:** Register, şifremi unuttum ve şifre değiştir aynı kabuğu ve aynı birincil buton stilini (`authCtaClass`) kullanır. Register'da "veya e-posta ile" ayırıcısı artık OAuth butonları ile form arasında. Şifremi unuttum / şifre değiştir formlarında alanlar ile buton arasındaki boşluğun uygulanmaması hatası düzeltildi.
- **Animasyon paketi:**
  - **İlk açılış:** Sahne hafif yakınlaşarak belirir, logo netleşerek gelir, slogan soldan sağa açılır, ardından alt metin ve kart yükselir, en son dil/tema kontrolleri iner. Yalnız ilk ziyarette oynar ([template.tsx](../../frontend/src/app/(auth)/template.tsx) `data-entrance="initial"`); animasyonlar CSS ile yürür, JS beklemez.
  - **Sayfa geçişleri:** Giriş yap / Kayıt olun / Şifremi unuttum arasında içerik yumuşakça (saydamlık + hafif yükselme + bulanıklıktan netleşme) gelir (`data-entrance="soft"`). Kartın cam efekti (`backdrop-filter`) geçiş sırasında da korunur; bu yüzden animasyon sarmalayıcıya değil kartın kendisine uygulanır.
  - **Tema geçişi:** [theme-transition.tsx](../../frontend/src/components/layout/theme-transition.tsx) — ekranın ortasında mevcut temanın gök cismi (güneş/ay) batar, yenisi dönerek doğar; bu sırada yeni tema ortadan büyüyen bir daire ile açılır (View Transitions API). Destek olmayan tarayıcılarda tema anında değişir.
  - **Dil geçişi:** [locale-switcher.tsx](../../frontend/src/components/layout/locale-switcher.tsx) — bulanık bir perdenin üzerinde mevcut dilin bayrağı kart gibi dönüp seçilen dilin bayrağına dönüşür; dil adı dönüşün ortasında değişir. Perde sayfa yenilenene ve dönüş bitene kadar kalır.
  - **Logo elektronları:** P, D ve A harflerinin kenar çizgileri boyunca, kuyruklu ikişer ışık elektron gibi dolaşır (D ters yönde ve daha hızlı). Önceki nokta nokta yanıp sönen parlama kaldırıldı. Yeni görsel dosyası üretilmedi; harflerin kenar çizgisi çalışma anında bir SVG filtresiyle (`#pda-logo-current`) logodan çıkarılır, ışıklar dönen bir maskeyle (`.logo-current`, `--pda-orbit`) gösterilir.
  - **Arka plan ışıkları:** Arka plandaki neon şeritler üzerinde soldan sağa kayan bir ışık geçer. Yine SVG filtresi (`#pda-scene-neon`) yalnız neon alanları ayıklar; gökyüzü ve metal yüzeyler etkilenmez. Yalnız `transform` animasyonu kullanıldığı için GPU'da çalışır.
  - **Hareket azaltma:** İşletim sisteminde "hareketi azalt" açıksa döngüsel animasyonlar (slogan vurgusu, neon ışığı) durur, logo elektronları gizlenir, giriş animasyonları beklemesiz tamamlanır, tema ve dil geçişlerinde güneş/ay ve bayrak animasyonu oynamaz.
- **Açık temada yarı saydam kart:** Açık temadaki giriş kartı, alanlar ve kontroller koyu temadaki gibi buzlu cam görünümünde; arka plan kartın ardından görünür (`--auth-card`, `--auth-field`, `--auth-control` token'ları).
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
| Kontrast (açık tema) | Opak kartta ölçüldü: yardımcı metin ≈6.6:1, bağlantı ≈5.1:1 (WCAG AA). Kart yarı saydam yapıldıktan sonra yeniden ölçülmedi; ekran görüntülerinde okunaklı |
| Playwright — ilk açılış (400/800/1300/3200 ms kareleri) | Sahne → logo → slogan → alt metin/kart → kontroller sırası doğru; sonunda her şey tam görünür |
| Playwright — koyu temada kare farkı | Değişen pikseller yalnız neon şeritlerde (kayan ışık) ve logoda; gökyüzü ve metal sabit |
| Playwright — logo elektronları (2x çözünürlük, açık + koyu) | Kenar çizgisi iki logoda da temiz çıkıyor; her harfte ışık yayları farklı konumlarda, alt yazı etkilenmiyor |
| Playwright — slogan elektrik akımı (açık, koyu, 390px mobil; animasyon durdurulup 1.85 / 2.5 / 3.2 / 4.67 / 6.87 sn karelerine gidildi) | Kıvılcım P'den başlayıp harf harf ilerliyor, kontur kopyası harfle hizalı; son harften sonra satır parlıyor, sonra mürekkep rengine dönüyor; mobilde iki satır, taşma yok; başlığın erişilebilir adı "Planlayın. Yönetin. Teslim edin." (harf harf değil); hareketi azalt açıkken animasyon yok; konsolda hata yok |
| Playwright — tema geçişi | Güneş batıyor, ay doğuyor, yeni tema daire şeklinde açılıyor; hale kenarı yumuşak |
| Playwright — dil geçişi TR → EN | TR bayrağı dönüp İngiltere bayrağına dönüşüyor, ad değişiyor; başlık "Plan. Manage. Deliver." |
| Playwright — `/login` → `/register` | Yumuşak geçiş oynuyor, kartın `backdrop-filter: blur(24px)` korunuyor; konsolda hata yok |
| Playwright — hareket azaltma | Döngüsel animasyonlar kapalı, logo elektronları gizli, kart hemen görünür, tema geçişinde güneş/ay yok |

Not: Doğrulama önce `next dev -p 3001` ile yapıldı; ardından frontend Docker Compose'dan çıkarıldı ve 3000 portunda `npm run dev` ile çalışıyor. Ekran görüntüsü alınırken hidrasyon anına denk gelen bir `caret-color` uyuşmazlık uyarısı Playwright'ın kendi imleç gizleme stilinden kaynaklanıyor; normal yüklemede konsol temiz.

## 4. API

Yok. Mevcut `POST /api/auth/login`, `GET /api/auth/me` ve OAuth başlatma uçları değişmeden kullanılıyor.

## 5. Açık konular

- **Oturum süresi:** "Beni hatırla" oturumu uzatmaz. Gerçek "uzun oturum" istenirse backend'de refresh token ömrü için ayrı bir karar ve güvenlik onayı gerekir.
- **Kısa ekranlar:** 768px yükseklikte kart alt kısmı hafif kaydırma istiyor; birincil eylem görünür olduğu için bilinçli olarak bırakıldı.
- **Register / şifremi unuttum sayfalarına ait sekme başlıkları** henüz yok (genel "PDA · Project Delivery Assistant" görünüyor).

## 6. Kullanıcı kontrolü

1. `frontend` klasöründe `npm run dev` çalıştırın, `http://localhost:3000/login` açın (frontend artık Docker'da değil). **Beklenen:** sahne, logo, slogan, kart ve kontroller sırayla belirir; sloganda "P" harfinden başlayan bir elektrik kıvılcımı harfleri sırayla dolaşır, sona gelince tüm satır parlar, birkaç saniye bekleyip baştan başlar, logonun harf kenarlarında elektron ışıkları dolaşır, arka plandaki neon şeritlerde ışık kayar. Açık temada kartın arkasından arka plan görünür.
2. Sağ üstteki ay ikonuna tıklayın. **Beklenen:** ortada güneş batar, ay doğar ve koyu tema ortadan daire şeklinde açılır; camgöbeği birincil buton; sayfayı yenileyince koyu kalır.
3. Sol üstteki dil menüsünden English, sonra Deutsch seçin. **Beklenen:** ekranda mevcut dilin bayrağı dönerek seçilen dilin bayrağına dönüşür; ardından tüm metinler ve tarayıcı sekme başlığı değişir.
4. "Beni hatırla" işaretli olarak giriş yapın, çıkış yapıp `/login`'e dönün. **Beklenen:** e-posta alanı dolu, kutucuk işaretli; şifre boş.
5. "Kayıt olun" ve "Şifremi unuttum?" bağlantılarını açın. **Beklenen:** aynı arka plan ve kart stili; içerik bulanıklıktan netleşerek yumuşakça gelir, arka plan ve logo yeniden animasyon oynatmaz.
6. Tarayıcıyı 390px genişliğe daraltın. **Beklenen:** yatay kaydırma yok, tüm öğeler tek sütunda.
7. İşletim sisteminde "hareketi azalt" ayarını açıp sayfayı yenileyin. **Beklenen:** içerik beklemeden görünür, döngüsel ışık animasyonları durur, tema değişince güneş/ay çıkmaz.
