# README yeniden tasarımı (TR/EN) — 2026-10-28

## Tamamlanan kapsam

`README.md` (Türkçe) ve `README_EN.md` (İngilizce) baştan yazıldı; iki dosya birebir aynı yapıdadır. Yeni landing page'in anlatımı README'ye taşındı: "Görev, sohbet, toplantı ve kod. Tek çalışma alanında." konumlandırması, "dağınık araç yığını vs PDA" karşılaştırma tablosu ve PDA'yı ayıran altı özellik bloğu (hesapsız misafir toplantı, proje sohbeti + dosya, basit/gelişmiş görev, GitHub takibi, organizasyon, açık kaynak/self-host).

GitHub README'de JS/CSS çalışmadığı için animasyonlar **kendi ürettiğimiz animasyonlu SVG'lerle** (yalnız CSS `@keyframes`, `<img>` ile gömülü) yapıldı. Her SVG TR ve EN olarak üretildi (8 sahne × 2 dil = 16 dosya): hero (dönen kelime + yüzen etiketler), araç yığınının birleşmesi, toplantı, sohbet, görev modu, depo takibi, organizasyon, terminal kurulumu.

Ek içerik düzeltmeleri:

- Mimari mermaid şemasına `meeting` modülü ve opsiyonel LiveKit SFU düğümü eklendi.
- Güvenlik bölümüne misafir toplantı çerezi maddesi eklendi.
- Yeni "Toplantı Medyası (LiveKit, opsiyonel)" bölümü: `MEETING_MEDIA_ENABLED`, `docker-compose.meeting.yml` (`--profile meeting`), `docker-compose.meeting.prod.yml` ve ilgili ENV değişkenleri.
- Hızlı Başlangıç'a `ORGANIZATION_MEDIA_STORAGE_PATH` satırı eklendi; ENV rehberinin geri kalanı değişmedi.
- Var olmayan dosyalara giden bağlantılar kaldırıldı (`docs/meeting-*.md` notu, Hostinger SMTP devir notu).
- Landing ekran görüntüleri yeni tasarımdan yeniden alındı (`landing-light/dark/mobile.png`).
- Sonradan yapılan düzeltmeler: shields.io rozet satırları kaldırıldı; başlık metni yerine "PDA" yazılı gerçek logo (`pda-logo-512.png`) kullanıldı; en üste canlı site bağlantısı (https://pd-assistant.com/) eklendi; "hepsi tek yerde" sahnesine gerçek logo gömüldü; e-posta kurulumu 4 kısa adıma indirildi; "Projeyi Geliştirenler" bölümü (başlık ve kartlar) ortalandı (`<table align="center">`); sayfa sonundaki genel logo + slogan bloğu kaldırıldı.
- Önizleme sayfaları (özel Artifact) hazırlandı; commit öncesi görsel kontrol içindir, repoya girmez.
- Bilinen açık iş: `docs/assets/pda-tour.gif` ve `docs/assets/screenshots/` altındaki landing dışı ekran görüntüleri eski arayüzden kalma; yenilenmesi ayrıca onay bekliyor.

## Değişen/oluşturulan önemli dosyalar

- `README.md`, `README_EN.md`: tamamen yeniden yazıldı.
- `docs/assets/readme/{hero,stack,meeting,chat,tasks,repo,org,terminal}.{tr,en}.svg`: 16 yeni animasyonlu SVG (7–16 KB).
- `docs/assets/readme/_src/gen-readme-svgs.mjs`: SVG üreticisi (`node gen-readme-svgs.mjs <çıktı-klasörü>`). Metinler içindeki TR/EN sözlüğünden gelir; metin değişirse yeniden üretilmelidir.
- `docs/assets/screenshots/landing-{light,dark,mobile}.png`: yeni landing'den yeniden çekildi.

## Animasyon tasarım kararları

- SVG'lerin temel durumu **son (görünür) durumdur**; animasyon yalnız bu duruma doğru oynar. Animasyon desteklenmeyen veya kapalı ortamda içerik tam okunur.
- `prefers-reduced-motion: reduce` altında tüm animasyonlar kapanır, geçici/yinelenen öğeler gizlenir.
- Harici font/kaynak yok; GitHub'ın görsel proxy'sinde (camo) çalışır. Koyu, opak sahne zemini GitHub açık ve koyu temada aynı okunur.

## Çalıştırılan doğrulama komutları

```powershell
node docs/assets/readme/_src/gen-readme-svgs.mjs docs/assets/readme
# README bağlantı/varlık denetimi (Bash)
grep -oE '(src|href)="[^"#h][^"]*"' README.md README_EN.md  # her yol için dosya varlığı kontrolü
npx next start -p 3100   # landing ekran görüntüleri için geçici sunucu (iş bitince kapatıldı)
```

## Test/doğrulama sonuçları

- 16 SVG'nin tamamı iyi biçimli (`<svg>` ile başlıyor, `</svg>` ile bitiyor); tarayıcıda 8 sahne için TR kareleri tek tek görsel incelendi, bulunan hatalar (hero eyebrow metni, çakışan "Kopyala/Kopyalandı", fazla büyük konuşma halkası, hizasız görev formu, toast'ın ilk satırı kapatması, stack birleşiminde boş kare) düzeltildi.
- Her iki README'deki tüm yerel `src`/`href` yolları ve markdown bağlantıları mevcut dosyalara çözülüyor; eksik dosya yok (`mailto:` bağlantıları dosya değildir).
- Sayfa içi bağlantılar başlıklarla eşleşiyor: `#-hızlı-başlangıç` / `#-quick-start`, `#-pda-neyi-farklı-yapar` / `#-what-makes-pda-different`, `#-katkıda-bulunma` / `#-contributing`, LiveKit bölümü anchor'ları; emoji değişim seçicili başlık için `<a id="ekranlar">` / `<a id="screens">` kullanıldı.
- Yardımcı sunucular (3100 `next start`, 3101 SVG önizleme) kapatıldı; 3000 portundaki sürece dokunulmadı.

## Açık kalan konular ve doğrulanmayan sınırlar

- GitHub üzerindeki gerçek görünüm (özellikle SVG animasyonları ve camo önbelleği) push edilmeden doğrulanamaz. Push sonrası ilk bakışta eski SVG görünürse birkaç dakika sonra yenilenir.
- EN SVG'ler TR ile aynı üreticiden çıktığı için yapı olarak aynıdır, ancak görsel kare incelemesi yalnız TR üzerinde yapıldı; uzun İngilizce metinlerin taşmadığını GitHub'da bir kez gözle kontrol edin.
- `docs/assets/pda-tour.gif` ve landing dışındaki ekran görüntüleri (dashboard, görev panosu vb.) bu işte yeniden çekilmedi; arayüz değiştiyse güncellenmeleri gerekebilir.
- DE (Almanca) README yok; kapsam TR/EN idi.
- Hukuki sayfalar ve erişilebilirlik bildirimi bilinçli olarak ertelendi (README kapsamı dışında).
- Commit/push yapılmadı.

## Kullanıcının manuel kontrol adımları

1. `README.md` ve `README_EN.md` dosyalarını VS Code'da Markdown önizlemesinde açıp SVG'lerin animasyonunu kontrol edin (önizleme GitHub ile birebir aynı olmayabilir).
2. Commit/push sonrası GitHub'da her iki README'yi açın: hero, araç yığını, toplantı, sohbet, görev, depo, organizasyon ve terminal animasyonları oynuyor mu, koyu/açık temada okunuyor mu bakın.
3. Telefon genişliğinde (GitHub mobil) hero ve ekran görüntüleri tablosunun taşmadığını kontrol edin.
4. Dil bağlantılarının (🇹🇷 Türkçe / 🇬🇧 English) birbirine gittiğini tıklayarak doğrulayın.
