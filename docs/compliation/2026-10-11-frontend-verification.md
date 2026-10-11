# Birleşmiş general-features frontend doğrulaması

Sonraki düzeltme: bu kayıttaki 18 başarısız ve seri grupta çalışmayan 6 senaryo düzeltildi; navbar regresyonları dahil 39 hedefli senaryo son halleriyle başarılı doğrulandı. Ayrıntı: `2026-10-11-frontend-failed-tests-fixes.md`. Aşağıdaki 945 senaryoluk başarısız koşum tarihsel kanıttır; tam paket yeniden çalıştırılmadı.

## Teslim ve durum

11 Ekim 2026: kullanıcının isteğiyle yalnız frontend kalite kontrolleri çalıştırıldı. Lint, TypeScript ve production build başarılı; tam E2E koşumu başarısızdır. Bu kayıt frontend'in tamamının geçtiği veya pre-push'ın başarılı olduğu anlamına gelmez. Backend paketi ve tam pre-push yeniden çalıştırılmadı. Commit/push yapılmadı.

## Çalıştırılan kontroller

`frontend` içinde:

- `npm.cmd run lint`: 0 hata; `e2e/ui-ux-app.spec.ts:154` için `hint`, `e2e/ui-ux-public.spec.ts:245` için `root` kullanılmayan değişken uyarıları.
- `npx.cmd tsc --noEmit`: başarılı.
- `npm.cmd run build`: başarılı; 44 sayfa üretildi.
- Yeni build, `next start --hostname localhost --port 3000` ile servis edildi; yerel backend health HTTP 200 doğrulandı. `E2E_REUSE_USERS=1`, gerçek yeniden giriş ve global setup ile `npm.cmd run test:e2e` çalıştırıldı: **945 senaryoluk paket, 18 başarısız test, seri admin grubundaki hata nedeniyle çalışmayan 6 test**. Bazı testlerin production/opt-in skip koşulları vardır; kesin başarılı/skip toplamı ayrıca iddia edilmemiştir.
- Nihai kanıt `frontend/test-results/.last-run.json` (`status: failed`, 24 kimlik) ve 18 `error-context.md` dosyasıdır. Test kimlikleri `node node_modules/playwright/cli.js test --list --reporter=json` ile yalnız listelenerek eşleştirildi; testler yeniden çalıştırılmadı. 24 kimliğin 18'i hata raporlarıyla, diğer 6'sı başarısız admin testinden sonraki seri senaryolarla eşleşir.
- PowerShell'in native stderr uyarısını terminating error sayması nedeniyle metin raporu tam yazılamadı (`NO_COLOR` / `FORCE_COLOR` uyarısı). E2E'nin kendi nihai kaydı ve hata dosyaları oluşmuştur; başarısızlık yalnız wrapper uyarısı değildir. Başarılı test sayısı tahmin edilmedi.
- Geçici production test sunucusu sonunda kapatıldı. `.env` yalnız test sürecine okundu; dosyada veya uygulama kodunda değişiklik yapılmadı.

## Başarısız testler

### Mevcut davranışla çelişen veya eski değerleri bekleyen testler

- `e2e/12-theme-transition.spec.ts:82`: cihaz reduced-motion açıkken `theme-close-in` bekleniyor, animasyon yok. Mevcut `useReducedMotionPreference`, cihaz tercihini her zaman dikkate alır.
- `e2e/home-return.spec.ts:54`: cihaz reduced-motion açıkken ana sayfaya dönüş animasyonu bekleniyor; animasyon görülmedi.
- `e2e/about-page.spec.ts:8` (TR/EN/DE, 3 test): eski Hamza LinkedIn URL'si aranıyor; contributor verisinde `/in/hamza-tasbay` vardır.
- `e2e/contact-delivery.spec.ts:30`: eski konu bekleniyor; gerçek mail konusu kategori etiketini içerir (`[Genel]`).
- `e2e/contact-delivery.spec.ts:56` ve `e2e/privacy-regression.spec.ts:90`: eski `pdassistant@gmail.com` alıcısı bekleniyor; gerçek alıcı `pdassistant.info@gmail.com`.
- `e2e/workspace-history.spec.ts:22`: navbar ölçeği 1 bekleniyor, gizlenen navbar ölçeği 0.95. Navbar'ın scroll ile kendiliğinden açılmasını kaldıran yeni davranışla testin reveal/focus hazırlığı ayrıca incelenmelidir; uygulama hatası olarak kesinleştirilmedi.

### Ayrıca incelenmesi gereken testler

- `e2e/localized-routing.spec.ts:172`: `/tr/iletisim` sayfasında beklenen iki öğeli görünür breadcrumb yok. Bu sayfa main'den gelen iletişim düzeniyle birleşmiştir; gereksinim ve testin uyumu ayrıca değerlendirilmelidir.
- `e2e/admin-login.spec.ts:449`: admin oturumu sonlandırıldığında `/pd-admin`'e dönüş senaryosu 120 saniye timeout. Aynı seri grubun sonraki klavye testi ve 320/390/768/1024/1440 px testleri (toplam 6) çalışmadı.
- `e2e/invitation-remediation.spec.ts:8`: aynı belge içinde hesap değiştirme/davet izolasyonu 60 saniye timeout.
- `e2e/team-deletion-notifications.spec.ts:80`: ikinci bağlamda `#main-content` görünmedi.
- `e2e/team-deletion-notifications.spec.ts:97`: hesap değiştirme/bildirim izolasyonu 60 saniye timeout.
- `e2e/team-invitation-response-badge.spec.ts:46`: yanıt rozeti senaryosu 240 saniye timeout.
- `e2e/team-member-preview.spec.ts:8`: API'de 200 beklenirken 401 alındı. Oturum/test hazırlığı ayrıca incelenmelidir.
- `e2e/workspace-history-context.spec.ts:8`: native gezinti ve iptal senaryosu 60 saniye timeout.
- `e2e/workspace-history.spec.ts:52`: PDA/browser gezinti ve fullscreen kapanması 60 saniye timeout.

## Açık konular ve kullanıcı kontrolü

E2E kapısı yeşil değildir. Eski test beklentilerini mevcut kabul edilmiş davranışa göre düzeltmek, diğer başarısızlıkları hedefli koşum/trace ile incelemek gerekir. Yalnız başarısız test kapsamları yeniden çalıştırılabilir; bu kayıt bütün paketin yeniden çalıştırıldığını veya sorunların düzeltildiğini söylemez. Kullanıcı hata listesini ve `frontend/test-results/**/error-context.md`/`trace.zip` dosyalarını incelemelidir.
