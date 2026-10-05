# Landing deneyimi ve animasyon tercihleri

## Teslim ve durum

2026-10-05 — İstenen landing, login dönüşü ve animasyon ayarı düzenlemeleri tamamlandı. Kullanıcı, son tema geçişi düzeltmesinin çalıştığını teyit etti. Geliştirme ortamındaki CSS preload uyarısı açık takip konusu olarak aşağıda kayıtlıdır.

Bu kayıt, aynı günün [landing footer GitHub kaydından](2026-10-05-landing-footer-github.md) sonraki toplu düzenlemeleri kapsar. Güncel landing, ayrı `LandingFooter` yerine login ile aynı `SiteFooter` component'ini kullanır.

## Yapılanlar

### Landing içerik ve görünüm

- Başlık “Fikrinle başla. Ekibini topla. Birlikte tamamla.” olarak güncellendi. Alt metin “Projeni planla, görevleri paylaş ve ekibinle birlikte sonuca ulaş.” oldu.
- Kaydırma bağlantısı “Nasıl çalıştığını keşfet” olarak değiştirildi.
- Kurulum gösteriminin altındaki açıklama/gereksinim notları kaldırıldı; erişilebilir komut dökümü korundu.
- Son bölümün açıklaması “Fikrini ekibinle hayata geçir.” olarak kısaltıldı. Bu bölüme en az bir ekran yüksekliği verilerek açık kaynak bölümüyle ayrımı güçlendirildi.
- Navbar'daki “Deneyimi keşfet” ve “Açık kaynak” bağlantıları kaldırıldı. Logo, dil seçimi, ortak tema kontrolü ve “Giriş yap” kaldı.
- Navbar giriş bağlantısı yuvarlak köşeli, belirgin bir butona dönüştürüldü. “Giriş yap” ve “Serüvene katıl”, login formundaki ortak `auth-cta` renk/gölge stilini kullanıyor.
- Landing footer'ı `SiteFooter tone="auth"` ile login'in yapısına eşitlendi. Alper/Hamza profilleri ve kaynak kod bağlantısı ortak footer'dan geliyor; ayrı `landing-footer.tsx` kaldırıldı.
- İlgili metinler Türkçe, İngilizce ve Almanca için güncellendi.

### Kaydırma ve ölçüm düzeltmeleri

- Ürün demosu ve terminal animasyonunun ilerlemesi mevcut sayfa yüklemesi boyunca yalnız ileri gider; yukarı kaydırmada tamamlanmış gösterimler geri sarılmaz.
- Tamamlanan sahnenin ilk yukarı dönüşünde uzun sticky kaydırma alanı kaldırılır. Bölüm küçülürken sonraki içeriğin ekran konumu telafi edilir.
- Tamamlanan ürün bölümündeki adım bağlantıları panelleri doğrudan değiştirir. İlerleme tam yenilemede sıfırlanan modül belleğinde tutulur; tarayıcı depolamasına yazılmaz.
- Gizli/sıfır boyutlu demo panellerinde ölçüm atlanır; yalnız sonlu ve pozitif yükseklik/ölçek uygulanır. `height: Infinity` üreten sıfıra bölme yolu düzeltildi.

### Login'den landing'e dönüş

- Ortak auth logosu landing'e yönlendirildi. Login formunun altına “Ana sayfaya dön” bağlantısı eklendi; yerelleştirilmiş rota mevcut dili korur.
- İki bağlantı ortak `HomeLink` kullanır. Normal gezinmeden sonra landing 300 ms içinde hafifçe belirir ve 6 px yukarı yerleşir. Eski ekran görüntüsünü rota yüklenene kadar sabit tutan geçiş kaldırıldı.
- Ctrl/Cmd ile yeni sekme açma gibi normal bağlantı davranışları korunur. Animasyon kapalıyken giriş efekti oynatılmaz; doğrudan landing ziyaretinde bu dönüş efekti uygulanmaz.
- Auth header'ın boş alanının logoya tıklamayı engellemesi giderildi; dil ve tema kontrolleri tıklanabilir kaldı.

### Animasyon tercihleri ve yeni hesap varsayılanı

- Arayüz animasyonları varsayılan **Açık**; seçenekler yalnız **Açık / Kapalı**. “Cihazı izle” kaldırıldı.
- Eski `system` kayıtları açık olarak yorumlanır. Açık tercih, cihazın hareket azaltma ayarından bağımsız uygulanır; kayıtlı `off` tercihi korunur.
- Genel MotionConfig, landing sahneleri ve dönüş animasyonu aynı açık/kapalı tercihini kullanır. İlgili CSS ve üç dildeki açıklamalar uyarlandı.
- API, ayar kaydetmemiş hesaplarda `null` döndürüyor. Bu değerleri frontend sınırında normalleştiren kod eklendi: arayüz animasyonları `on`, tema geçişi `true`; seçilmemiş dil/tema alanları boş bırakılır.
- `themeTransition: null` değerinin yanlışlıkla yerel “Kapalı” tercihi oluşturması düzeltildi. Animasyon tercihleri mevcut oturumlarda da hesap verisiyle eşitlenir; hata nedeniyle oluşmuş yerel kapalı değer hesap varsayılanıyla düzelir.
- Hesapta açıkça kaydedilmiş `themeTransition: false` korunur. Tema geçişi, arayüz animasyonları kapalıyken ayrıca oynatılmaz.
- Backend endpoint, veritabanı şeması veya güvenlik davranışı değiştirilmedi.

### Ön yükleme

- Landing logosundaki öncelikli yükleme kaldırıldı. Sayfa altındaki AppShell demoları logo preload üretmez; gerçek uygulama kabuğunun logo önceliği korunur.
- Inter, Exo 2 ve JetBrains Mono için otomatik preload kapatıldı. Fontlar kullanımda yüklenir; `display: swap` korunur. Yerel sunucu yanıtında font preload ipuçlarının kaldırıldığı doğrulandı.

## Önemli dosyalar

- [Landing sayfası](../../frontend/src/features/landing/landing-page.tsx), [stiller](../../frontend/src/features/landing/landing.module.css), [TR/EN/DE metinleri](../../frontend/src/i18n/landing/).
- [Animasyon ilerleme belleği](../../frontend/src/features/landing/animation-progress.ts), [ürün hikâyesi](../../frontend/src/features/landing/product-story.tsx), [açık kaynak sahnesi](../../frontend/src/features/landing/open-source-scene.tsx), [demo ölçümü](../../frontend/src/features/landing/product-demo.tsx).
- [HomeLink](../../frontend/src/components/common/home-link.tsx), [auth kabuğu](../../frontend/src/components/layout/auth-shell.tsx), [login formu](../../frontend/src/features/auth/components/login-form.tsx), [uygulama kabuğu](../../frontend/src/components/layout/app-shell.tsx).
- [Animasyon tercihleri](../../frontend/src/lib/preferences/motion.ts), [provider](../../frontend/src/components/providers.tsx), [ayar API normalleştirmesi](../../frontend/src/features/settings/api.ts), [oturum tercihleri](../../frontend/src/features/settings/session-preferences.ts), [animasyon ayar bölümü](../../frontend/src/features/settings/components/motion-section.tsx).
- [Kök layout](../../frontend/src/app/layout.tsx), [global CSS](../../frontend/src/app/globals.css), [ortak çeviriler](../../frontend/src/i18n/messages/).
- [Dönüş regresyon testleri](../../frontend/e2e/home-return.spec.ts), [animasyon tercihi regresyon testleri](../../frontend/e2e/motion-preferences.spec.ts). Mevcut landing, settings ve tema geçişi testlerinin beklentileri de güncellendi.

## Doğrulama

Aşağıdaki kontroller geliştirme sırasında yapıldı. Bu kayıt hazırlanırken geçen testler tekrar çalıştırılmadı. Komutların çalışma dizini `frontend`.

### ESLint

Küçük landing düzenlemelerinde değişen dosyalar hedeflenerek ESLint çalıştırıldı. Demo ölçümü, sahne ilerlemesi, navbar/footer ve dönüş bağlantısı kontrolleri geçti. Animasyon tercihleri için çalıştırılan kapsamlı dosya kontrolü:

```powershell
npx.cmd eslint src/lib/preferences/motion.ts src/components/providers.tsx src/features/settings/api.ts src/features/settings/components/motion-section.tsx src/features/landing/product-story.tsx src/features/landing/open-source-scene.tsx src/app/layout.tsx e2e/home-return.spec.ts e2e/motion-preferences.spec.ts e2e/05-settings-page.spec.ts e2e/12-theme-transition.spec.ts e2e/landing-page.spec.ts
```

Son `null` düzeltmesinden sonraki kontrol de geçti:

```powershell
npx.cmd eslint src/features/settings/api.ts src/features/settings/session-preferences.ts e2e/motion-preferences.spec.ts
```

### Playwright / Chromium

Global hesap oluşturma adımı bu hedefli testlerde atlandı:

```powershell
$env:E2E_REUSE_AUTH = '1'
npx.cmd playwright test e2e/home-return.spec.ts --project=chromium
npx.cmd playwright test e2e/motion-preferences.spec.ts e2e/home-return.spec.ts --project=chromium
npx.cmd playwright test e2e/motion-preferences.spec.ts --project=chromium
```

- İlk dönüş düzeltmesi: **6/6 geçti**. Desktop logo, alt bağlantı, mobil, light/dark ve animasyon kapalı davranışı kontrol edildi; gerçek ara karelerin opaklık değişimi ölçüldü.
- Açık/kapalı varsayılanı düzenlemesinden sonra birleşik paket: **11/11 geçti**. Cihaz hareket azaltması açıkken de varsayılan animasyonun oynadığı doğrulandı.
- Son tema varsayılanı düzeltmesi: önce gerçek API biçimindeki `null` fixture'ıyla hata yeniden üretildi; düzeltmeden sonra tercih paketi **6/6 geçti**. Eksik/null veride tema seçiminin açık olması, gerçek tema geçişinin oynatılması, eski bozuk yerel tercih, kayıtlı kapalı seçimin korunması ve kaydet/yenile davranışı kontrol edildi.
- Ayar ekranı testleri izole API fixture'larıyla çalışır; gerçek kullanıcı hesabını veya veritabanını değiştirmez.
- Tam E2E paketi, production build ve backend testleri bu turda çalıştırılmadı. Mevcut `05-settings-page` ve `12-theme-transition` dosyaları güncellendi ve lint edildi; bu gerçek hesap testleri ayrıca çalıştırılmadı.

## Açık konular

- Chrome geliştirme ortamında Next.js'in global CSS chunk'ı için “preloaded but not used” uyarısı tekrar görüldü. Dosyanın stylesheet olarak bağlı olduğu ve `as="style"` değerinin doğru olduğu doğrulandı; uyarı tamamen giderilmiş sayılmıyor. Production sürümünde ayrıca kontrol edilmeli.
- HMR/Fast Refresh bağlantı ve yeniden derleme satırları hata değildir. Animasyon ayarı dışında yapılan değişikliklerde genel web/a11y/SEO audit'i çalıştırılmadı.
- Kaydırma sahnelerinin yukarı dönüş ve bölüm ayrımı için bu turda tam tarayıcı regresyon paketi çalıştırılmadı; aşağıdaki manuel kontrol kapsamında tutuluyor.

## Kullanıcı kontrolü

1. Landing'i aşağı kaydırıp en alta ulaşın; yukarı dönerken tamamlanan gösterimler geri sarılmamalı veya uzun animasyon alanında tekrar bekletmemeli. Tam yenilemeden sonra sahneler yeniden başlayabilmeli.
2. Üçüncü bölüm ve footer'a geldiğinizde ikinci bölümle görünüm ayrımını; mobilde navbar ve footer taşmasını kontrol edin.
3. Landing'in giriş/kayıt butonlarını açık ve koyu temada login butonuyla karşılaştırın. Footer'daki profil ve kaynak kod bağlantılarını açın.
4. Login logosuna ve “Ana sayfaya dön” bağlantısına ayrı ayrı basın; mevcut dil korunarak landing açılmalı ve kısa belirme efekti görünmeli.
5. Ayar kaydetmemiş bir hesapla giriş yapın: arayüz animasyonları ve tema geçişi açık seçilmeli; tema değiştirince geçiş oynamalı. Animasyonları kapatıp kaydedin; yenilemeden sonra kapalı tercih korunmalı.
6. Yayın öncesinde production sürümünde konsolu kontrol edin; özellikle açık kalan CSS preload uyarısını tekrar değerlendirin.

## Önerilen commit mesajı

```text
fix(frontend): landing deneyimini ve animasyon tercihlerini düzelt

- landing metinlerini, navbar butonlarını ve ortak footer yapısını düzenle
- tamamlanan kaydırma animasyonlarının geri sarılmasını ve geçersiz demo ölçümünü düzelt
- login'den ana sayfaya ortak bağlantı ve yumuşak dönüş animasyonu ekle
- animasyonları varsayılan açık yap ve cihazı izle seçeneğini kaldır
- yeni hesapların null tema geçişi tercihini açık olarak normalleştir
- gereksiz logo/font preloadlarını kaldır ve Playwright regresyon kapsamı ekle
```
