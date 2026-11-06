# Renk ve animasyonlu arka planın birlikte kullanımı — Frontend

## 1. Tamamlanan kapsam

Tema ayarlarında renk ve arka plan seçimleri ayrıldı. Üstte yalnız Tek renk / Gradyan radio grubu ve ilgili renk/açı alanları vardır. Bağımsız **Animasyonlu arka plan** checkbox'ı her iki renk moduyla da kullanılabilir. Açıldığında dört tema kartı ve mevcut ses/hareket/seviye alanları görünür. Önceki sadeleştirme, önizlemenin kaldırılması, yan yana kontroller ve küçük/zeminsiz sağ üst ikonlar korunur.

Backend'in dört kayıt durumu aynı sözleşmeyle eşlenir:

- SOLID: tek renk, arka plan kapalı.
- GRADIENT: gradyan, arka plan kapalı.
- ANIMATED: tek renk + animasyonlu arka plan; eski hesaplar aynı anlamla açılır.
- ANIMATED_GRADIENT: gradyan + animasyonlu arka plan.

Normalize/eşitlik/palet/draft akışı yeni birleşik türü destekler. Renk modu değişirken arka plan, iki moda ait renkler ve animasyon/ses tercihleri korunur. Kaydet'e kadar yalnız taslak değişir; Vazgeç geri alır. Renk değişikliği çalan ses için yeni AudioContext oluşturmaz. Arka plan kapatılınca vurgu rengi kalır, sahne ve ses kaynakları kapanır; son preset/seviye korunur. Reset mevcut API ile her iki tercihi varsayılana döndürür.

Root DOM durumu ayrıldı: `data-user-theme=solid|gradient` paleti, `data-user-background=animated` sahneyi taşır. Gradient SVG paint tanımı ve Canvas birlikte üretilebilir; paint tanımı akış dışında tutulur. Çıkış/hesap sınırında iki DOM durumu temizlenir. Reduced-motion, global motion, gizli sekme ve gesture ile ses başlatma kuralları değişmez. Reload/sekmeye dönüş ses başlatmaz. Yeni browser storage, uygulama ENV veya bağımlılık yoktur.

## 2. Değişen önemli dosyalar

- `frontend/src/features/settings/theme-colors.ts`: dört tür, bağımsız seçim helper'ları, ortak palet ve DOM uygulama/temizleme.
- `frontend/src/features/settings/components/theme-colors-section.tsx`: iki renk modu + bağımsız arka plan checkbox'ı.
- `frontend/src/features/settings/effects/theme-effects.tsx`: aynı anda SVG gradient paint, Canvas ve ses sahibi.
- `frontend/src/styles/theme-colors.css`: arka plan durumuna göre katman ve paint tanımı ayrımı.
- `frontend/src/i18n/messages/{tr,en,de}.json`: bağımsız seçim ve açıklamalar.
- `frontend/e2e/theme-animation.spec.ts`, `theme-colors-logic.spec.ts`, `theme-colors-real.spec.ts`.
- Mimari/klasör/tasarım rehberleri ve master checklist'in ilgili kapsam notu.

Backend kaynak kodu değiştirilmedi. Kullanılan sözleşme mevcut GET/PUT `/api/v1/users/me/preferences` ve DELETE `/api/v1/users/me/preferences/theme`; cookie/CSRF, principal sahipliği, no-store ve doğrulama kuralları aynıdır. Ayrıntı ve Swagger kontrol yolu: [birleşik tema backend kaydı](2026-11-06-combined-theme-backend.md), `.agents/SECURITY.md` §11.

## 3. Çalıştırılan doğrulama komutları

Frontend dizininde:

```powershell
npx.cmd tsc --noEmit
npm.cmd run lint
# QA için yalnız komut sürecinde mevcut API adresi geçici olarak değiştirildi:
$env:NEXT_PUBLIC_API_URL='http://localhost:18080/api/v1'
npm.cmd run build
npm.cmd run start -- --hostname 127.0.0.1 --port 13000
$env:E2E_BASE_URL='http://localhost:13000'
$env:THEME_REAL_API='1'
npx.cmd playwright test --config playwright.theme.config.ts --output ../.local/theme-combined-frontend/final-production --max-failures=1
```

Ayrı, normal geliştirme ayarlı süreçte:

```powershell
$env:E2E_REUSE_AUTH='1'
npx.cmd playwright test e2e/motion-preferences.spec.ts --grep 'settings show only' --output ../.local/theme-combined-frontend/motion-results
npm.cmd run build
npm.cmd run check:bundle
```

Son normal build, QA API adresini içeren geçici build'in yerini aldı; `.env` dosyaları değiştirilmedi. Repo kökünde `git diff --check`, çalışma ağacı/servis sağlık kontrolleri ve ek Playwright görsel incelemesi yapıldı.

Gerçek kabul, ignored `.local/theme-combined-frontend/serve-api.ps1` ile ayrı backend (18080), frontend (13000) ve görev etiketi doğrulanan disposable PostgreSQL 18 üzerinde çalıştı. Mevcut dev uygulaması bu QA için kapatılmadı. Test kullanıcıları yalnız bu veritabanında üretildi; gerçek API testleri cookie login/CSRF ve PostgreSQL kullanır, REST/socket yanıtı mock'lanmaz. Sonunda QA frontend'i, doğrulanan backend süreç ağacı ve `--rm` test container'ı kapatıldı/kaldırıldı.

## 4. Test/doğrulama sonuçları

- **37/37 tema testi PASS, 0 skip**: 5 saf sözleşme/kontrast ve eşleme, 30 API-fixture'lı tarayıcı, 2 gerçek cookie/API/PostgreSQL testi. Son üretim kabulü, SVG paint'in akış dışında tutulması düzeltmesi dahil güncel kaynak üzerinde geçti.
- **4/4 mevcut hareket tercihi regresyonu PASS**. Toplam hedefli frontend kabulü **41/41**.
- Birlikte Solid/Gradient + arka plan, Kaydet/Vazgeç, renklerin/preset'in korunması, arka plan kapatıldığında yalnız ses/sahnenin kapanması, reload'da geri gelmesi ve autoplay olmaması geçti. Renk modu değişirken çalan ses aynı context ile sürdü. Gradient paint tanımı ve sahne aynı anda tekil kaldı.
- Gerçek DB satırında ANIMATED ve ardından 17 karakterli ANIMATED_GRADIENT, iki renk ve ses/hareket tercihleri doğrulandı. Yeni browser context'inde aynı hesap aynı birleşimi aldı; başka hesap varsayılanını korudu. Gerçek çıkışta context ve arka plan temizlendi, reset çalıştı. Önceki Solid/Gradient gerçek API regresyonu da geçti.
- TR/EN/DE × light/dark için altı yeni kaydedilmiş birleşik görünüm Axe kontrolü; 320/390/768/1440 px taşmama/alan görünürlüğü kontrolleri PASS. Önceki erişilebilirlik, klavye, motion ve ses yaşam döngüsü testleri de geçti. Mobil açık/koyu ve masaüstü koyu görüntüler `.local/theme-combined-frontend/` altında incelendi.
- Lint, TypeScript, QA ve normal production build, diff PASS. Tüm rota bundle bütçeleri içinde; Settings **491.0 / 505 KB gzip**. Bütçe gevşetilmedi.

### Normal yerel ortamın güncellenmesi

Çalışan 8080 backend'inin eski üç türü sunduğu görüldü. Yeni UI'nin mevcut geliştirme ortamında da kaydedebilmesi için `ops/env.ps1 status` ile dev profil doğrulandı; `ops/backup.ps1 -OutDir .local/theme-combined-frontend/pre-v62-backup` ile DB ve medya yedeği alındı. Dump ve medya dosyaları boş değildir, Git dışındadır; geri yükleme testi yapılmadı.

Ardından `docker compose -f docker-compose.yml -f docker-compose.meeting.yml --profile meeting up -d --build backend` ile yalnız yerel backend ve bağımlılıkları güncellendi. Açılış logu V61→V62'nin başarıyla uygulandığını doğruladı. Backend health UP; Swagger dört türü sunuyor; mevcut PostgreSQL ve LiveKit sağlıklı, frontend `http://localhost:3000/tr/ana-sayfa` HTTP 200. Uygulama kullanıcı tercihlerine test verisi yazılmadı. Bu yerel dev güncellemesidir; production dağıtımı değildir.

## 5. Açık kalan konular ve doğrulanmayan sınırlar

Otomatik tarayıcı kabulü Chromium üzerindedir; fiziksel iOS/Android, Safari/Firefox, ekran okuyucu ve işitsel kalite kabulü manuel kalır. Fixture ve gerçek API senaryoları yukarıda ayrı raporlandı. Tüm uygulama E2E, backend test paketi ve gerçek SFU medya smoke bu frontend tesliminde yeniden çalıştırılmadı; backend testi için önceki teslim kaydı geçerlidir.

Standart yerel V62 öncesi yedekler `.local/theme-combined-frontend/pre-v62-backup/` altında tutulur. Git'e eklenmemelidir. Yeni birleşik türü anlamayan eski binary/istemciye kör dönüş yapılmamalıdır; backend migration README'deki uyumlu geri dönüş sınırları geçerlidir. ENV, secret, bağımlılık, güvenlik mimarisi, branch ve remote ayarı değiştirilmedi. Commit/push/pre-push yapılmadı.

## 6. Kullanıcının manuel kontrol adımları

1. `http://localhost:3000` sayfasını yenileyip Ayarlar'ın en altındaki Tema ayarları bölümünü açın. Tek renk veya Gradyan seçin; renk alanları her zaman görünmelidir.
2. Animasyonlu arka plan checkbox'ını açın, bir preset seçip kaydedin. Renk vurgusu ve arka plan birlikte çalışmalıdır. Gradyanda iki renkli vurgu/scrollbar ile sahne aynı anda görünmelidir.
3. Arka plan açıkken renk modunu değiştirin; preset ve ses/seviye tercihleri korunmalıdır. Kaydet öncesi global görünüm değişmemeli, Vazgeç taslağı geri almalıdır.
4. Ses tercihini açıp kaydettikten sonra sağ üst ikona basın. Renk modu değişirken ses sürmeli; arka planı kapatıp kaydedince ses durmalı, renk vurgusu kalmalıdır. Reload veya sekmeden dönüş sesi kendiliğinden başlatmamalıdır.
5. Aynı hesapta başka oturum, başka hesap, reduced motion/global off ve tema reset'ini deneyin. Önceki küçük/zeminsiz sağ üst ikonlar, yan yana checkbox'lar ve yüzde kontrolü korunmalıdır.
