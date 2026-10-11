# README V1 güncellemesi — 2026-10-11

## Tamamlanan kapsam

`README.md` (Türkçe) V1'in tamamlandığını yansıtacak şekilde yeniden yazıldı. "Aktif geliştirme aşamasında" notu ve `development-tr.jpeg` görseli kaldırıldı; durum rozeti V1.0 oldu.

- **Korunanlar:** projeyi ayağa kaldırma adımları, `.env` doldurma rehberi ve kullanılan teknolojiler (ikisi de koda ve `.env.example` dosyasına göre güncellendi).
- **Eklenenler:** ekran turu GIF'i, Light/Dark ekran görüntüleri, mobil görünüm, Mermaid mimari diyagramı, güncel V1 özellik listesi, `.env` değişken tablosu, Gmail SMTP adımları, test komutları.
- **Düzeltilen yanlışlar:** proje rolleri koddaki `ProjectRole` listesine çekildi (`BACKEND_DEVELOPER`, `AI_ML_DEVELOPER`, `ANALYST` vb.); "mail kapalıyken PDA çalışır" ifadesi kaldırıldı (kapalıyken kayıt `503` döner); Brevo, SonarQube, k6 ve CI iddiaları kaldırıldı (depoda karşılığı yok); `CONTRIBUTING.md` ve `SECURITY.md` bağlantıları kaldırıldı (dosyalar yok); migration adları gerçek dosyalarla değiştirildi; yazılım sürümleri (Java 25, Spring Boot 4, Next.js 16, PostgreSQL 18) düzeltildi.
- **Projeyi Geliştirenler:** Hakkımızda sayfasındaki kartların aynısı (fotoğraf, ad, "Full Stack Developer", GitHub, LinkedIn, e-posta, CV); veriler `frontend/src/features/public-info/site-info.ts` dosyasından alındı.

- **Sadeleştirme:** Ayrıntılı V1 özellik listesi release notlarına bırakıldı; README'de yalnızca ana başlıklar kaldı (görev yönetimi ve GitHub repo takibi için Basit / Gelişmiş ayrımı, iletişim, hesap ve SMTP altyapısı, proje ve ekip, arayüz). "Yol Haritası", "API Standardı", "E-posta ve Bildirimler", "Frontend Standartları" ve "Testler" bölümleri ile teknoloji listeleri kaldırıldı; ardından "Migration Yönetimi", "Environment ve Config Yönetimi" ve "Performans ve Gözlemlenebilirlik" de çıkarıldı, "Lisans" en alta taşındı, "Projeyi Geliştirenler" kartları ortalandı, Node.js gereksinimi "Next.js frontend için Node.js 22" olarak netleştirildi (teknoloji yığını görseli ve mimari diyagramı kaldı). Ekran görüntüleri bölümü kısaltıldı, girişe öne çıkan özellikler eklendi (Jira / Plane karşılaştırması yok), listeler büyük harfle başlıyor, microservice ifadeleri çıkarıldı.

## Eklenen dosyalar

- `docs/assets/screenshots/*.png` (21 görüntü: 9 ekran × Light/Dark + 3 mobil)
- `docs/assets/pda-tour.gif` (7 ekranlık tur)
- `docs/assets/team/{alper-temiz,hamza-tasbay}.png` (Hakkımızda fotoğraflarının yuvarlak kırpması)

## Demo veri

Görüntüler `projehesap806@gmail.com` test hesabında API ile oluşturulan örnek veriden alındı: proje "Kampüs Etkinlik Platformu", 5 kriter, 10 görev, "Geliştirme Ekibi" squad'ı. Test hesabının şifresi hiçbir dosyada yok.

## Açık kalan konular

- `README_EN.md` Türkçe README ile aynı içerik ve bölüm sırasıyla İngilizce olarak güncellendi (izin kuralı kalktıktan sonra). İngilizce banner (`hero-banner-eng.png`) korundu; `development-eng.jpeg` görseli kaldırıldı.
- Mimari diyagram SVG olarak üretilemedi (`docs/assets` altına Write aracıyla yazma engelli); bunun yerine README içinde Mermaid kullanıldı.
- Gerçek ürün ekranlarındaki hesap adı "asssistans" (test hesabının takma adı); istenirse hesapta düzeltilip görüntüler yenilenebilir.
- `.playwright-mcp/*.png` dosyaları git'te izleniyor; README ile ilgisi yok, dokunulmadı.

## Manuel kontrol

GitHub'da README'yi açıp GIF'in, ekran görüntülerinin, Mermaid diyagramının ve "Projeyi Geliştirenler" kartlarının doğru göründüğünü, CV bağlantılarının açıldığını kontrol edin.
