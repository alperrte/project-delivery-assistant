# Şeffaf logo zemini — 2026-10-28

## Tamamlanan kapsam

Sidebar'daki şeffaf logonun beyaz zeminli görünmesinin nedeni, logo çerçevesinin `bg-primary` sınıfıydı. Koyu temanın primary rengi beyaz olduğundan PNG'nin şeffaf alanlarından bu renk görünüyordu.

Yalnız gerçek görsel gösterilirken `[data-logo-frame]:has(> [data-logo-shape] > img)` arka planı şeffaf yapılır. Aynı bileşeni kullanan sidebar, seçici, kart ve diğer logo çerçeveleri bu kurala uyar. Görselin kendisi ve alfa kanalı değiştirilmez. Görsel yoksa veya yüklenemezse mevcut harf fallback'inin zemini geri gelir; yuvarlak/köşeli şekiller korunur.

## Değişen önemli dosyalar

- `frontend/src/app/globals.css`: yüklenmiş logoya koşullu şeffaf çerçeve kuralı.
- `.agents/frontend-design-rules.md`: kalıcı şeffaf logo gösterim standardı.
- `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`: yalnız ilgili kapsamın kontrol notu.

Önceki kapak kontrastı düzeltmesinin henüz commit edilmemiş dosyaları korundu.

## Çalıştırılan doğrulama komutları

```powershell
node tmp/cover-contrast/check-logo.cjs
git -c core.safecrlf=false diff --check
```

## Test/doğrulama sonuçları

- Gerçek Next.js uygulaması, kurulu Chrome ve sentetik API/şeffaf PNG fixture'ı kullanıldı; gerçek kullanıcı/proje verisi yazılmadı.
- Açık/koyu tema × yuvarlak/köşeli/görselsiz/404 logo: **8 senaryo PASS**, her biri masaüstü 1440 ve mobil 320 px'de doğrulandı.
- Sidebar, proje seçici ve kartta yüklenmiş görselin çerçeve zemini transparent; görselsiz ve 404 kaynakta harf ve mevcut zemin var.
- Şekil kırpması, seçicinin Escape ile kapanması, yatay taşmama ve runtime hata yokluğu doğrulandı.
- Koyu tema şeffaf logo ve harf fallback ekran görüntüleri görsel olarak incelendi.
- Geçici script ilk denemelerde seçici satırının ertelenmiş render/stil güncellemesini beklemiyordu; kontrol görünür satırı ve son stil değerini bekleyecek şekilde düzeltildi. Son koşum exit 0.
- Kanıtlar Git dışındaki `tmp/cover-contrast/logos/` ve `check-logo.cjs` dosyasında. `git diff --check` PASS.

## Açık kalan konular ve doğrulanmayan sınırlar

- Yalnız CSS değişti; TypeScript/uygulama mantığı, API, ENV ve görsel depolama hattı değişmedi.
- Gerçek yüklenen dosyanın piksel verisinde beyaz alan varsa bu kural onu silmez; düzeltme şeffaf görselin arkasındaki UI zeminini kaldırır.
- Tüm tarayıcılar, bütün diller, diğer logo yüzeylerinin tamamı ve tam pre-push ayrıca çalıştırılmadı. Commit/push yapılmadı.

## Kullanıcının manuel kontrol adımları

1. Koyu temada sayfayı yenileyip sidebar'daki Lobby Two Zero logosunu kontrol edin.
2. Proje seçiciyi açıp aynı logonun menüde ve proje kartında da beyaz zemin olmadan göründüğünü kontrol edin.
3. Açık temaya geçip logoyu kontrol edin; yeniden yükleme gerekmez.
