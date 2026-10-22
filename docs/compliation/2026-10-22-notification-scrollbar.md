# NS-01 — Bildirim paneli scrollbar

## Tamamlanan kapsam ve kök neden

Bildirim merkezi popup'ı `overflow-y-auto` kullandığı halde ortak `data-workspace-scroll` seçicisine bağlı değildi. Aynı popup ortak tema renklerini, thin scrollbar/hover davranışını ve forced-colors fallback'ını kullanacak şekilde bağlandı. `overscroll-y-contain` dış sayfaya kaydırma aktarımını sınırlar; maksimum yükseklik `min(70dvh,32rem,var(--available-height))` ile kısa ekranın kullanılabilir alanını da kapsar. Popup sahibi, mevcut Base UI odağı, bildirim verisi ve mutation akışları korundu. Global CSS veya UI bağımlılığı değişmedi; mevcut ui-styling rehberi/token yaklaşımı kullanıldı.

## Değişen dosyalar

- `frontend/src/features/notifications/components/notification-center.tsx`: mevcut popup'ın scrollbar seçicisi, overscroll ve yükseklik sınırı.
- `frontend/e2e/notification-scrollbar.spec.ts`: gerçek bildirimler ile boş/tek/çok kayıt, tema/dil/boyut/scroll/a11y testleri.
- `.agents/frontend-design-rules.md`, `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`: yalnız etkilenen yüzeyin kısa standardı ve kanıtı.

## Doğrulama komutları ve sonuçlar

- `npm.cmd run lint`, `npx.cmd tsc --noEmit`: PASS.
- `npm.cmd run build`, `npm.cmd run check:bundle`: PASS. Production kopyası `tmp/ns-frontend-qa` altında çalıştırıldı; node_modules junction'ı için yalnız QA kopyasında Turbopack root repo kökü olarak belirtildi. Takip edilen build config'i değişmedi.
- İlk hedefli Chromium koşusu: `notification-scrollbar.spec.ts notification-history.spec.ts notification-history-delete.spec.ts notification-history-context.spec.ts notification-repository-read.spec.ts`: 17 PASS, 1 test beklentisi hatası. React `data-workspace-scroll` boolean değerini `"true"` olarak üretirken test boş string bekliyordu; uygulama kodu değiştirilmeden beklenti düzeltildi.
- Son `npx.cmd playwright test notification-scrollbar.spec.ts --project=chromium`: 2/2 PASS. Toplam **18 benzersiz başarılı frontend testi**: önceki koşudan 16 mevcut regresyon + son koşudan 2 yeni test. Kesintisiz tek bir 18-test PASS koşusu iddia edilmez.
- Gerçek izole QA API/PostgreSQL/Mailpit: 8081/5437/8026; frontend production 3001. Kullanıcının 3000 portundaki uygulaması ve normal DB'si durdurulmadı.
- 0 ve 1 kayıtta gereksiz dikey scrollbar yok; 45 görev ve uzun durum bildirimiyle çok kayıt/sayfalama test edildi. Wheel, scrollbar rengi/thin stili, dış sayfa scroll konumu, CDP touch gesture, popup sınırları ve yatay taşma kontrol edildi.
- TR/EN/DE × light/dark × 320/375/768/1024/1440 px; 375 px senaryosu 400 px ekran yüksekliğini de içerir. 320 ve 1440 px light/dark × üç dilde scoped axe: **12 tarama, 0 ihlal**.
- Yeni/Geçmiş, bireysel/toplu okuma, bireysel/toplu silme/onay/başarısızlık, son sayfanın kapanması, badge, repository bağlantısı, polling, hesap/sekme sınırları, klavye ve Escape/odak dönüşü hedefli regresyonlarda geçti.
- Görseller `.local/ns-scrollbar/` altında; 320 px TR light ve 1440 px DE dark ekran görüntüleri ayrıca gözle incelendi. `git diff --check`: PASS.

## API / migration / güvenlik

NS-01 yeni endpoint, migration, ENV, cookie/CSRF/CORS veya yetki değişikliği içermez. Mevcut `/api/v1/notifications` okunmuş/okunmamış sayfalama, read/read-all ve sahip kapsamlı silme sözleşmeleri korunur. NS-02 backend kodu ve V54 ayrı `meeting-system-backend` commit'indedir.

## Açık sınırlar ve kullanıcı kontrolü

Fiziksel cihaz, gerçek ekran okuyucu ve Chromium dışı tarayıcılar doğrulanmadı; scoped axe sonucu global WCAG uygunluğu değildir. Global checklist kutuları bu dar kapsamla tamamlandı sayılmadı.

1. Bildirim zilini aç; Yeni/Geçmiş'te çok kayıtla panelin içini kaydır.
2. Light/dark temada ortak mavi scrollbar rengini ve kısa ekranda panel sınırını kontrol et.
3. Tab/Enter ile zili aç, sekmeler ve eylemleri kullan; Escape sonrası odağın zile döndüğünü doğrula.
4. Okuma, silme, sayfa değiştirme ve bildirim bağlantısını kontrol et.

## Git

Branch `notification-service`, başlangıç `origin/main` SHA `02d34464` üzerine fast-forward edildi. Commit kimliği bu kaydı içeren frontend commit'idir: `git log -1 --format=%H notification-service`; kesin SHA kullanıcıya final raporda verilir (dosyanın kendi commit hash'ini içermesi mümkün değildir).

**Tam pre-push final aşamaya ertelendi. Push, remote merge, PR merge veya deployment yapılmadı.**
