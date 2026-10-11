# Çerez Politikası yeniden yazımı — 2026-10-11

## Tamamlanan kapsam

`/cookies` (TR/EN/DE) teknik envanter tablolarından çıkarılıp gerçek bir çerez politikası metnine dönüştürüldü (örnek: IKEA TR çerez politikası yapısı). Tablo yok; dahili çerez/depolama adları (`PDA_*`, `XSRF-TOKEN`, `pda:*` vb.) metinde geçmiyor. Kayıtlar işleviyle anlatılıyor, süreler cümle içinde veriliyor.

Yeni bölüm sırası: Çerez nedir → Neden kullanıyoruz → Çerez türleri (oturum/kalıcı, birinci taraf, zorunlu/tercih/analitik) → Zorunlu çerezler → Tercih çerezleri → Analitik çerezler → Tercihi değiştirme ve geri çekme → Üçüncü taraflar → Hukuki dayanak ve iletişim.

Hukuki içerik değişmedi: analitik varsayılan kapalı, 12 ay saklama, 12 ayda bir ziyaretçi kimliği yenileme, KVKK 5/1 – 5/2(c)(f), GDPR/TDDDG § 25 dayanakları, veri sorumluları. Sayfadaki "Çerez tercihlerini yönet" düğmesi ve resmî kaynaklar bloğu aynı.

## Değişen dosyalar

- `frontend/src/i18n/messages/{tr,en,de}.json` (yalnız `publicPages.cookies.sections`)
- `frontend/e2e/cookie-consent.spec.ts` (envanter adı kontrolü yerine: tablo yok, dahili ad yok, bölüm kimlikleri var)
- `frontend/e2e/legal-pages.spec.ts` ("her anahtar listelenmeli" testi, işlevsel kapsam + süre cümleleri testiyle değiştirildi)

## Doğrulama

- `npx tsc --noEmit`, `npx eslint e2e/legal-pages.spec.ts e2e/cookie-consent.spec.ts`: temiz.
- `npx playwright test -c playwright.public.config.ts e2e/legal-pages.spec.ts e2e/cookie-consent.spec.ts e2e/a11y-public.spec.ts e2e/localized-routing.spec.ts`: 245 geçti.

## Açık kalan konular

- Çerez adlarının kodla senkron olduğunu doğrulayan test kalktı; yeni bir çerez/depolama türü eklenirse ilgili bölümün elle güncellenmesi gerekir.
- Hukuki metinler ve Erişilebilirlik Bildirimi için bekleyen kararlar (önceki kayıtlara bakın) aynen duruyor.

## Manuel kontrol

`/cookies`, `/en/cookies`, `/de/cookie-richtlinie` sayfalarını açıp metni, süreleri ve "Çerez tercihlerini yönet" düğmesini gözden geçirin.
