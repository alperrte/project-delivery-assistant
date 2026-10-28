# Kart kapaklarında tema kontrastı — 2026-10-28

## Tamamlanan kapsam

Kullanıcının Projeler ekran görüntülerindeki açık tema okunabilirlik sorunu düzeltildi. Ortak `EntityCard`, görsel üzerine `bg-background/50` uyguluyordu: açık temada beyaz örtü görseli soldururken koyu başlık ve gri açıklama hâlâ görselin ayrıntılarıyla çakışıyordu.

Kapaklı kartlar artık her iki temada aynı koyu örtüyü (%65) ve açık başlık/açıklama token'larını kullanır. Durum ve tür etiketlerinin altında opak `bg-card` bulunur. Kart boyutları ve kapaksız kartların mevcut semantik renkleri korunur. Ortak bileşen nedeniyle proje listesi/önizlemeleri ve organizasyon kapakları aynı düzeltmeyi alır.

## Değişen önemli dosyalar

- `frontend/src/app/globals.css`: `--cover-scrim`, `--cover-foreground`, `--cover-muted-foreground` ve Tailwind eşlemeleri.
- `frontend/src/components/common/entity-card.tsx`: kapak örtüsü, koşullu metin renkleri ve etiket zemini.
- `.agents/frontend-design-rules.md`: kalıcı kapak kontrastı standardı.
- `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`: yalnız etkilenen kapsama ait doğrulama notu; global kutular değiştirilmedi.

## Çalıştırılan doğrulama komutları

```powershell
# frontend içinde
node node_modules/eslint/bin/eslint.js src/components/common/entity-card.tsx
node node_modules/typescript/bin/tsc --noEmit --incremental false
# repo kökünde; geçici kontrol dosyası Git dışında
node tmp/cover-contrast/check.cjs
git -c core.safecrlf=false diff --check
```

Eksik yerel bağımlılıklar lockfile üzerinden `npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000` ile kuruldu; package/lockfile değişmedi. Tarayıcı kontrolü kurulu Chrome ile gerçek Next.js sayfalarını kullandı. Projenin önizleme portu çalışma sırasında 3001'den 3000'e geçti; son başarılı koşum `http://localhost:3000` üzerinde tamamlandı. Başka oturumun sunucusu durdurulmadı.

## Test/doğrulama sonuçları

- Hedefli ESLint ve proje TypeScript kontrolü: PASS.
- Proje / organizasyon listeleri × açık / koyu tema × 320 / 390 / 1440 px: **12 PASS**.
- İki temada proje kapağı 404 olduğunda fallback: **2 PASS**.
- Açık/hareketli, koyu ve kapaksız üç kart birlikte incelendi. Kapaksız renkler, eşit header yüksekliği, düzenleme bağlantısına odak ve taşmama kontrolü başarılı; runtime page error yok.
- Tam beyaz görsel ve %65 örtü bileşiminde açıklama kontrastı hesapla **4,77:1**; 4,5:1 eşiğinin üstünde.
- Masaüstü açık/koyu, 320 px açık tema, kapak hata durumu ve organizasyon ekran görüntüleri görsel olarak incelendi.
- Kanıtlar: Git dışındaki `tmp/cover-contrast/` altında `check.cjs`, `results.json` ve PNG ekran görüntüleri.
- İlk geçici kontrollerde tarayıcının Oklab renk çıktısı ve teknoloji ikonlarını da kapsayan img seçicisi düzeltildi; ürün kodunda bu nedenle ilave davranış değişmedi. Son koşum exit 0.

## Açık kalan konular ve doğrulanmayan sınırlar

- REST/WebSocket istekleri sentetik test verileriyle karşılandı; gerçek kullanıcı/proje verisi yazılmadı. Backend, ENV, API/yetki ve veri modeli değişmedi.
- Chromium/Chrome ve Türkçe liste ekranları doğrulandı; tüm tarayıcılar, bütün diller ve create/edit/invitation önizlemelerinin tamamı ayrı ayrı çalıştırılmadı.
- Tam production build, backend testleri ve tam pre-push bu sınırlı görsel düzeltme için çalıştırılmadı. Commit/push yapılmadı.

## Kullanıcının manuel kontrol adımları

1. Projeler sayfasını açık temada yenileyip mevcut üç proje kapağındaki başlık, açıklama ve etiketleri kontrol edin.
2. Koyu temaya geçip aynı kapakları kontrol edin; kapak görseli üstündeki metinler artık iki temada da açık renkli kalır.
3. Kapaksız proje ile Organizasyonlar sayfasındaki kapaklı kartları ve mobil görünümü kontrol edin.
