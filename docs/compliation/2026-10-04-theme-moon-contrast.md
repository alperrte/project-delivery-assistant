# Tema geçişindeki ayın kontrastı — 2026-10-04

## Teslim ve kapsam

Tamamlandı. Açık temadan koyu temaya geçerken görünen ayın rengi, mevcut `sky-100` tonundan PDA'nın mavi paletindeki `#4c8dff` tonuna alındı. Ayın animasyonu, boyutu, süresi, dairesel geçişi, halesi ve güneş değiştirilmedi.

## Değişen dosyalar

- `frontend/src/app/globals.css`: `--theme-moon` token'ı açık ve koyu tema için `#4c8dff` olarak tanımlandı.
- `frontend/src/components/layout/theme-transition.tsx`: ay simgesi `--theme-moon` token'ını kullanıyor.
- `.agents/frontend-design-rules.md`: token kullanımı belgelendi.

Bu ton, mevcut koyu paletin `--primary` mavisiyle aynı. Beyaz zeminle yaklaşık 3,20:1, koyu uygulama zemini `#090a0b` ile yaklaşık 6,19:1 kontrast verir. Eski `sky-100` rengi beyaz zeminle yaklaşık 1,15:1 kontrast veriyordu. Ay, geçiş sırasında her iki zemin üzerinde daha seçilir kalır; cyan/neon bir tona geçilmedi.

## Doğrulama

- `npm.cmd exec -- eslint src/components/layout/theme-transition.tsx` — geçti.
- `git diff --check` — geçti.
- Chromium'da `/tr/login` üzerinden görsel kontrol — açık→koyu geçişinde ay `rgb(76, 141, 255)` olarak çizildi ve net göründü; koyu→açık geçişinde mevcut amber güneş göründü.
- Chromium'da tema geçiş animasyonu kapalıyken — ay katmanı açılmadan koyu tema doğrudan uygulandı.
- Chromium'da `prefers-reduced-motion: reduce` ile — ay katmanı açılmadan koyu tema doğrudan uygulandı.

## Açık konular

Bu renk değişikliği için açık konu yok. Tam uygulama E2E paketi çalıştırılmadı; değişiklik yalnız ayın rengiyle sınırlı olduğundan ilgili tarayıcı senaryoları doğrudan kontrol edildi.

## Kullanıcı kontrolü

Uygulamayı açık temada açıp tema düğmesiyle koyu temaya geçin. Ortadaki ayın mavi ve belirgin, halesinin ve hareketinin önceki gibi olduğunu görün. Ardından açık temaya dönüp güneşi kontrol edin. Ayarlar'dan tema geçiş animasyonunu kapattığınızda tema doğrudan değişmelidir.
