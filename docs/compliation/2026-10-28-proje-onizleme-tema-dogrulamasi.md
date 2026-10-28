# Yeni proje önizlemesi tema doğrulaması — 2026-10-28

## Tamamlanan kapsam

Kullanıcı yeni proje önizlemesinde kapak/metin kontrastı ve logo zemini sorununu bildirdi; görüntünün canlı siteden olduğunu açıkladı. Önceki yerel düzeltmeler henüz commit/push/deployment yapılmadığı için canlı ortamda uygulanmış sayılmaz.

Koddan doğrulanan yol: `ProjectCreatePage` yerel seçilen logo/kapak blob URL'lerini `ProjectPreviewPanel` üzerinden aynı `ProjectCard` / `EntityCard` / `EntityMark` bileşenlerine verir. Önizleme, önceki iki düzeltmeyi ayrı bir implementasyona gerek olmadan alır. İlave ürün kodu değişikliği yapılmadı.

## Değişen önemli dosyalar

- Git dışında `tmp/cover-contrast/check-preview.cjs`: yeni proje formunda gerçek dosya seçimiyle geçici tarayıcı doğrulaması.
- `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`: ilgili önizleme doğrulama notu; global kutular değişmedi.

## Çalıştırılan doğrulama komutları

```powershell
node tmp/cover-contrast/check-preview.cjs
git -c core.safecrlf=false diff --check
```

## Test/doğrulama sonuçları

- Kurulu Chrome, gerçek yerel Next.js yeni proje sayfası ve sentetik REST/WebSocket fixture'ları kullanıldı.
- Formdaki dosya inputlarından şeffaf PNG logo ve açık renkli kapak seçildi; önizlemenin iki blob görseli render ettiği doğrulandı.
- Açık/koyu tema × köşeli/yuvarlak logo × 1440/320 px = **8 PASS**, exit 0.
- Logo çerçevesi `rgba(0,0,0,0)`; kapaklı başlık `rgb(244,245,246)`, açıklama `rgb(220,224,230)`; logo şekli ve yatay taşmama doğrulandı.
- Runtime page error ve proje/medya yazma isteği yok. Ekran görüntüleri Git dışındaki `tmp/cover-contrast/preview/` altında; açık/koyu tema görüntüleri incelendi.

## Açık kalan konular ve doğrulanmayan sınırlar

- Sonuç yerel geliştirme ortamına aittir. Canlı uygulama okunmadı/değiştirilmedi, production doğrulaması veya deployment yapılmadı.
- Tam pre-push, production build, commit/push ve yayın bu takip doğrulamasında yapılmadı. Önceki iki düzeltmenin yayınlanması ayrı adımdır.

## Kullanıcının manuel kontrol adımları

1. Yerel yeni proje sayfasında aynı logo ve kapağı seçerek önizlemeyi kontrol edin; yerel düzeltmeler kayıtlıdır.
2. Yayından önce önceki iki düzeltmeyi içeren değişiklikleri gözden geçirip gerekli tam kalite kapısını çalıştırın.
3. Yetkili production yayını sonrasında canlı yeni proje sayfasını yenileyip açık/koyu tema önizlemelerini tekrar kontrol edin. Yenileme tek başına henüz yayınlanmamış kodu canlıya taşımaz.
