# Çalışmayan / Hatalı Çalışan Şeyler

> Tarih: 2026-10-08 · Dal: `task-service-frontend`
> Bu dosya sadece **var ama bozuk / yanlış çalışan** şeyleri listeler. Hiç yapılmamış şeyler (ör. CSP, HSTS, Kullanım Koşulları) burada değil; onlar `security-checklist.md` ve `web-site-master-checklist.md` içinde.
> Sadece gözlenen ya da koddan kesin gösterilebilen sorunlar yazıldı. Emin olamadıklarım en alttaki "Şüpheli" tablosunda.

## Ne denedim?

| Kontrol | Sonuç |
| --- | --- |
| Frontend `npm run build` ve `npm run lint` | Hatasız (uyarı yok) |
| Frontend production modunda açılıp gezildi (TR/EN/DE public sayfalar, giriş, kayıt, SSS, erişilebilirlik, 404) | Sayfalar açıldı, ham çeviri anahtarı ekranda görünmedi |
| `playwright.public.config.ts` (backend gerektirmeyen paket) | 56 geçti, 1 atlandı, 0 kırmızı. Atlanan testin nedeni bu denetimde incelenmedi |
| İç linkler (78 adet) | 0 kırık |
| Backend konteyner logunun son 400 satırı | Hata/exception yok (yalnız WebSocket istatistikleri) |
| Oturumsuz API istekleri (401/403 ayrımı, CSRF'siz POST, yabancı Origin) | Beklenen şekilde çalışıyor |
| Giriş yapılmış ekranlar (dashboard, görevler, takvim…) | **Gezilmedi** — belgeli test kullanıcısı olmadığı için |

## Bulunan sorunlar

| # | Ne çalışmıyor | Nerede | Nasıl fark ettim | Sebebi (teknik) | Etkisi | Nasıl düzelir (kısa) | Önem |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NW-1 | Canonical, sitemap, robots ve sosyal paylaşım adresleri hep `http://localhost:3000` yazıyor | Frontend: `/sitemap.xml`, `/robots.txt`, `<link rel="canonical">` | `curl http://localhost:3000/sitemap.xml` → 15 adresin hepsi `localhost:3000`; `/tr` sayfasında `canonical = http://localhost:3000/tr` | `NEXT_PUBLIC_SITE_URL` tanımsız; kod boşsa `localhost` kullanıyor. Bu değişken build sırasında koda gömülür. `.env.example` içinde yok ve `frontend/Dockerfile` içinde `ARG` yok, yani Docker imajı değeri hiç alamaz | Production'a bu hâliyle çıkılırsa arama motorları yanlış (localhost) adresleri görür; sitemap ve canonical işe yaramaz | `.env.example`'a değişkeni ekle (onaylı), Dockerfile'a `ARG NEXT_PUBLIC_SITE_URL` + `ENV` ekle, build'i gerçek adresle yap | Yüksek (production) |
| NW-2 | Backend'in 401/403 hata yanıtlarında karakter seti `ISO-8859-1` | Backend: güvenlik filtre/giriş noktası yanıtları (`SecurityBaselineConfiguration` içindeki `writeProblem`) | `curl -i http://localhost:8080/api/v1/projects` → `Content-Type: application/problem+json;charset=ISO-8859-1` | `writeProblem` (satır 315-322) `setContentType("application/problem+json")` diyor ama charset vermiyor; `getWriter()` servlet varsayılanı olan ISO-8859-1'e düşüyor. Normal controller hata yanıtlarına bu denetimde bakılmadı | Şu an gövde sadece ASCII olduğu için bir bozulma yok. İleride Türkçe karakterli bir mesaj eklenirse `ş, ğ, ı` bozulur | Yanıtı `UTF-8` ile yaz (`setCharacterEncoding("UTF-8")` ya da `APPLICATION_PROBLEM_JSON_UTF8`) | Düşük |
| NW-3 | `ALLOWED_ORIGINS` ayarı hiçbir işe yaramıyor | `.env.example` ve `.agents/SECURITY.md` §9 | `ALLOWED_ORIGINS` adı backend kodunda hiç geçmiyor; CORS kaynağı `FRONTEND_URL`'den okunuyor (`SecurityBaselineConfiguration`) | Belge ve örnek dosya eski tasarıma göre kalmış; kod sonradan tek `FRONTEND_URL`'e geçmiş | Biri production'da `ALLOWED_ORIGINS`'i değiştirirse hiçbir şey olmaz; sanıp güvende hisseder ya da CORS'u yanlış ayarlar | Ya `ALLOWED_ORIGINS`'i sil ya da kodu ona bağla; `SECURITY.md`'yi eşitle (onaylı) | Orta |
| NW-4 | GitHub issue şablonu var olmayan `SECURITY.md` dosyasına yönlendiriyor | `.github/ISSUE_TEMPLATE/config.yml` | Dosyada "SECURITY.md izlenmeli" yazıyor; kök dizinde `SECURITY.md` yok (yalnız `.agents/SECURITY.md`, o da ajan kuralları) | Dosya hiç oluşturulmamış | Zafiyet bulan biri nereye yazacağını bulamaz, yanlışlıkla herkese açık issue açabilir | Kök `SECURITY.md` yaz; GitHub'da private vulnerability reporting aç | Orta |
| NW-5 | Diller arasında çeviri anahtar sayıları eşit değil | `frontend/src/i18n/messages/{tr,en,de}.json` | Üç dosya anahtar bazında karşılaştırıldı: EN'de 27, TR/DE'de 3 anahtar eksik | Anahtarlar eklenmiş ama bazı dillere eklenmemiş. Kodda bu anahtarlar **kullanılmıyor**, yani ekranda ham metin çıkmıyor | Şu an kullanıcıya yansımıyor. Biri o anahtarı kullanmaya başlarsa o dilde ham `key.adı` görünür | Ölü anahtarları sil ya da eksik dillere ekle; CI'a "anahtar sayısı eşit mi" testi koy | Düşük |
| NW-6 | Süresi dolmuş oturumda konsola 401 hatası düşüyor | Tarayıcı konsolu, ana sayfa → uygulama kabuğu geçişi | Playwright MCP tarayıcısında eski `PDA_SESSION` çerezi kalmıştı; sayfa açılınca 2 adet `401` konsol hatası görüldü | `PDA_SESSION` yalnız "oturum var" ipucu. Access çerezi bitince ipucu çerezi duruyor; arayüz önce doğrulama isteği atıyor, backend 401 dönüyor, sonra giriş sayfasına yönlendiriyor | Kullanıcı bir şey görmüyor (yönlendirme çalışıyor), sadece konsol gürültüsü ve gereksiz bir istek | Doğrulama 401 verince ipucu çerezini silip sessizce yönlendir | Düşük |
| NW-7 | `X-Powered-By: Next.js` başlığı açık | Frontend yanıtları | `curl -I http://localhost:3000/tr` → `X-Powered-By: Next.js` | `next.config.ts` içinde `poweredByHeader: false` yok (dosyada aranıp bulunamadı) | Saldırgana kullanılan teknolojiyi gösterir (küçük bilgi sızıntısı); fonksiyon bozulmaz | `poweredByHeader: false` ekle | Düşük |

## Şüpheli — elle kontrol et

| # | Şüphe | Neden emin olamadım | Nasıl kontrol edilir |
| --- | --- | --- | --- |
| S-1 | Gerçek 403 (yetkisiz) ekranı doğru gösteriliyor mu | Test kullanıcısı olmadığı için yetkisiz proje akışı canlıda denenemedi. Playwright testleri sahte yanıtla 403 ekranını doğruluyor (geçti) | Üye olmayan bir hesapla başka projenin adresini aç |
| S-2 | 503 ekranı gerçek kesintide sunuluyor mu | `public/errors/503.html` dosyası var ve test geçiyor; ama bunu sunan proxy/sunucu kuralı yok (production yok) | Production proxy'sinde backend'i durdurup dene |
| S-3 | İletişim `mailto:` bağlantısı bir e-posta istemcisi açıyor mu | Tarayıcı ortamında mail istemcisi yok; hedef adres kişisel Gmail | Gerçek cihazda tıkla; gerçek destek adresine geçmeyi düşün |
| S-4 | Başka projenin görevine kimlik bilgisiyle erişim engelli mi (canlı) | Kod ve entegrasyon testlerinde var; canlı hesap yok | İki hesap ve iki proje açıp ID ile dene |
| S-5 | Production'da çerezlerde `Secure` bayrağı | Kod `production || request.isSecure()` diyor; HTTPS yok | Production'da `Set-Cookie` başlıklarına bak |
| S-6 | Organizasyon medya dosyalarında yol kaçışı / symlink koruması | `FileSystemMediaStorage` bu denetimde satır satır okunmadı | Sınıfı ve testlerini oku |
| S-7 | Giriş sonrası ekranlarda konsol/ağ hataları | Giriş yapılamadığı için gezilemedi | Test kullanıcısıyla tüm ana ekranları gez, konsola bak |
| S-8 | Ana sayfa performansı (LCP/CLS) | Lighthouse çalıştırılmadı | Production build'de Lighthouse veya PageSpeed çalıştır |
