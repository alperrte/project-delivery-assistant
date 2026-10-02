# PDA özel hata ekranları

## Teslim ve durum

2 Ekim 2026 — PDA için 404, 403, 500 ve 503 ekranları tasarlandı; gerçek 404 ve hata sınırları ile temel sayfa yükleme akışlarına bağlandı. Türkçe, İngilizce ve Almanca; açık/koyu tema; mobil ve masaüstü desteklenir. Commit, push veya yayın yapılmadı.

## Yapılanlar

- [ErrorContent](../../frontend/src/features/errors/error-content.tsx): Büyük hata kodu, Phosphor ikonu, kısa açıklama, sonraki adım ve erişilebilir eylemler. 404/403 için ana sayfa ve giriş; 500/503 için yeniden deneme ve ana sayfa. İletişim `mailto:pda-info@gmail.com`. Footer bulunmaz.
- [ErrorFrame](../../frontend/src/features/errors/error-frame.tsx) ve [ErrorScreen](../../frontend/src/features/errors/error-screen.tsx): Tam ekran PDA logo/dil/tema düzeni veya AppShell içinde ikinci header/main eklemeyen içerik düzeni.
- [404](../../frontend/src/app/not-found.tsx), [root hata sınırı](../../frontend/src/app/error.tsx), [uygulama hata sınırı](../../frontend/src/app/(app)/error.tsx) ve [global hata belgesi](../../frontend/src/app/global-error.tsx) eklendi. Global belge kendi CSS, sistem fontu ve ince çeviri kataloglarıyla provider'sız çalışır.
- [PageFailure](../../frontend/src/features/errors/page-failure.tsx) ana sayfa sorgularının API hatalarını eşler: 403→403, 404→404, 500/diğer beklenmeyen hatalar→500; bağlantı hatası/502/503/504→503 görünümü. Bağlantı hatasına 503 görünümü göstermek, HTTP yanıtının 503 olduğu anlamına gelmez.
- Bağlanan akışlar: proje detayı, organizasyon detayı, ProjectGate üzerinden proje kapsamlı görev/sprint/etiket ekranlarının proje/üyelik yüklemesi, görev detayı ve sprint detayı. Form doğrulama ve işlem hataları mevcut yerlerinde kalır; bütün API hataları için global yönlendirme eklenmedi.
- [AppShell](../../frontend/src/components/layout/app-shell.tsx): Süresi dolan oturum hâlâ login'e yönlenir. Oturum servisi geçici olarak ulaşılamıyorsa korunan içerik açılmadan 503 ekranı ve tekrar deneme sunulur. API istemcisinin refresh/CSRF davranışı, backend yetkileri ve proxy koruması değiştirilmedi.
- [Önizleme rotası](../../frontend/src/app/errors/[code]/page.tsx): `/errors/404`, `/errors/403`, `/errors/500`, `/errors/503`. Bunlar HTTP 200 dönen, noindex tasarım önizlemeleridir; bilerek sunucu hatası üretmezler.
- [Kontrollü hata testi](../../frontend/src/app/dev/error-test/page.tsx): `/dev/error-test` yalnız development modunda çalışır. Düğme gerçek render hatası üretir; 500 hata sınırının yeniden deneme davranışı test edilir. Production'da bu rota 404 olur.
- [Taşınabilir 503](../../frontend/public/errors/503.html): Host/proxy için bağımsız, üç dilde bakım belgesi. Dış font, görsel, script veya API isteği yok. [Üretici script](../../frontend/scripts/build-maintenance-page.mjs) renkleri globals.css token'larından, metinleri hata kataloglarından alır.
- Çeviriler `frontend/src/i18n/errors/{tr,en,de}.json`; normal next-intl mesajlarına [request.ts](../../frontend/src/i18n/request.ts) üzerinden eklenir. Klasör/tasarım rehberleri güncellendi.

## Doğrulama

Frontend dizininde çalışan geliştirme sunucusunda:

| Komut/kontrol | Sonuç |
| --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit` | Başarılı |
| `node node_modules/eslint/bin/eslint.js` ile değişen TS/TSX, test, config ve iki MJS scriptinin hedefli kontrolü | Başarılı |
| `node node_modules/next/dist/bin/next build` | Production build ve build içindeki TypeScript başarılı |
| `node node_modules/@playwright/test/cli.js test --config=playwright.public.config.ts` | 28 test başarılı: 18 hata ekranı + 10 önceki footer/bilgi sayfası testi |
| `node scripts/check-global-error.mjs` | Global belgenin app provider'ları olmadan render edilmesi ve ham hata metnini göstermemesi başarılı |
| `node scripts/build-maintenance-page.mjs` | Statik 503 oluşturuldu; tekrar üretim aynı HTML'yi verdi |
| `git diff --check` | Başarılı |

Playwright kapsamı: üç dilde dört ekran; 320/390/768/1440 px genişlikler ve iki tema; en az 44 px eylem hedefleri; yatay taşma; skip link/klavye; gerçek HTTP 404; API 403/404/500/503 eşleme; yeniden sorgulama; oturum servisi 503 sonrası toparlanma; 401 sonrası login; kontrollü render hatası ve kurtarma; bağımsız 503 belgesinde dış kaynak olmaması. API hata testleri sahte yanıtlarla çalışır; backend RBAC uçtan uca testi değildir.

Ek production kontrolü, ayrı 3010 portunda: bilinmeyen adres HTTP 404; dört hata önizlemesi normal tasarım rotası; `/dev/error-test` HTTP 404 ve hata üretme düğmesi yok; statik 503 belgesi erişilebilir. Tarayıcı sayfa hatası görülmedi. Kontrol için açılan production sunucusu teslim sonunda kapatıldı; mevcut geliştirme sunucusuna dokunulmadı.

## Açık konular ve sınırlar

- Next.js tamamen kapalıysa uygulama içindeki `/errors/503` çalışamaz. Hazırlanan `503.html` dosyası host/CDN/reverse proxy tarafından ayrıca servis edilip gerçek 503 yanıtına eşlenmelidir. Hosting henüz belirlenmediği için eşleme/yayın yapılmadı.
- API'nin hata durum kodu korunur; istemcide gösterilen hata ekranı normal sayfa belgesinin HTTP durumunu değiştirmez. Önizlemeler de aynı nedenle gerçek 403/500/503 yanıtı değildir.
- Global root-layout fallback bağımsız render ve production build ile doğrulandı; çalışan kök layout bilerek bozularak tarayıcıda global crash yaratılmadı.
- 403 ekranı backend gerçekten 403 döndüğünde görünür. Backend bir kaydın varlığını gizlemek için 404 döndürüyorsa 404 ekranı gösterilir.
- Next.js'in kararlı error/not-found mekanizmaları kullanıldı. Deneysel `forbidden()`/authInterrupts etkinleştirilmedi. Teknik kaynaklar: [error.js](https://nextjs.org/docs/app/api-reference/file-conventions/error), [not-found.js](https://nextjs.org/docs/app/api-reference/file-conventions/not-found), [forbidden](https://nextjs.org/docs/app/api-reference/functions/forbidden).

## Kullanıcı kontrolü

### 1. Tasarımı hızlıca incele

Frontend dizininde `npm run dev` çalışırken:

| Ekran | Adres | Beklenen |
| --- | --- | --- |
| 404 | `http://localhost:3000/errors/404` | Bu sayfayı bulamadık; ana sayfa/giriş bağlantıları |
| 403 | `http://localhost:3000/errors/403` | Erişim yetkisi açıklaması; ana sayfa/giriş bağlantıları |
| 500 | `http://localhost:3000/errors/500` | Beklenmeyen sorun açıklaması; yeniden deneme |
| 503 | `http://localhost:3000/errors/503` | Geçici hizmet/bağlantı açıklaması; yeniden deneme |
| Bağımsız 503 | `http://localhost:3000/errors/503.html` | Next.js bileşenlerine bağımlı olmayan bakım görünümü |

Her ekranda tema/dil değiştir, mobil genişlikte dene; footer ve yatay taşma olmamalı. Bağımsız belgede tema/dil uygulamanın kaydettiği tercihlerden veya tarayıcıdan okunur; normal tema/dil kontrolü bulunmaz.

### 2. Gerçek 404

`http://localhost:3000/pda-boyle-bir-sayfa-yok` adresini aç. PDA 404 ekranı gelmeli. Geliştirici araçları → Network → document isteğinde HTTP 404 görülmeli. Giriş bağlantısı çalışmalı.

### 3. Gerçek render hatası / 500 ve kurtarma

`http://localhost:3000/dev/error-test` adresini aç ve **Test hatası oluştur** düğmesine bas. 500 ekranı gelmeli. **Yeniden dene** ile test ekranına dönmelisin. Development araçlarının hata rozeti/overlay'i görünebilir; bu kontrollü testte beklenir. Production'da test rotasının bulunmaması beklenir.

### 4. Gerçek backend kesintisi / 503 görünümü

Önce normal giriş yap. Frontend'i açık tutup backend'i çalıştırdığın terminal/IDE'den durdur. `/account` sayfasını yeniden aç: login'e atılmadan 503 görünümü gelmeli. Backend'i tekrar başlat ve **Yeniden dene**: hesap sayfası geri gelmeli. Backend Docker Compose ile çalışıyorsa yalnız backend servisini `docker compose stop backend` / `docker compose start backend` ile durdurup başlatabilirsin.

### 5. 403/500/503 eşleme ve tüm otomatik kontroller

Backend'e veya proje verilerine zarar vermeden, geliştirme sunucusu açıkken frontend dizininde:

```powershell
npx playwright test --config=playwright.public.config.ts error-pages.spec.ts
node scripts/check-global-error.mjs
```

İlk komut 18 hata ekranı testini çalıştırır; 403/404/500/503 yanıtlarını tarayıcıda güvenli şekilde taklit eder. İkinci komut kök hata belgesini normal provider'lar olmadan doğrular.

Önceki footer/bilgi sayfalarıyla birlikte tüm 28 testi çalıştırmak için:

```powershell
npx playwright test --config=playwright.public.config.ts
```

Gerçek yetki kontrolü için, backend'in 403 döndürdüğü bir sayfayı yetkisiz test hesabıyla aç. 403 gelmeli; kullanıcıya ait olmayan kayıt gizlendiği için backend 404 döndürüyorsa 404 beklenir.
