# Landing page — scroll ile ürün hikâyesi

Product Story içindeki UI ve navbar logosu için sonraki düzeltme: [2026-10-04 — gerçek PDA UI ve logo](2026-10-04-landing-real-ui-logo.md).

## Teslim ve durum

- Tarih: 2026-10-03.
- Durum: tamamlandı; geliştirme ve yerel production çıktısı doğrulandı.
- Kapsam: public "/" landing page tasarımının tümüyle değiştirilmesi. Welcome → Product Story → Windows CMD / açık kaynak → teknoloji açılışı → final CTA → kompakt footer.
- Değişiklikler working tree'dedir. Git add/commit/push/merge/rebase, release veya uzak repository işlemi yapılmadı.

## Yapılan tasarım ve davranış değişiklikleri

- İlk viewport: mevcut PDA wordmark asseti, Inter tipografi, geniş boşluk, kısa marka mesajı ve scroll bağlantısı. Dekoratif blob, grid, neon veya screenshot yok.
- ProductStory: gerçek HTML/React demo; proje adı ve açıklaması doldurulur, proje oluşturma sonucu görünür, Alper/Deniz/Ece örnek ekibi sırayla açılır, PDA-01 görevi Alper'e atanır.
- Görev akışı gerçek domainle uyumludur: TODO → IN_PROGRESS → IN_REVIEW → TESTING → DONE. Enum sırası, durum renkleri ve badge sınıfları mevcut Task modülünden alınır. TESTING atlanmaz.
- Demo backend veya auth API'sine istek göndermez; görünür demo etiketi kaydedilmeyen örnek çalışma alanı olduğunu belirtir. Örnek isimler dışında kişisel veri veya gerçek kullanıcı verisi yoktur.
- Final CTA: “Serüvene katıl” → /register; “Giriş yap” → /login. Mevcut route'lar ve session-hint/dashboard yönlendirmesi korunur.
- LandingFooter: marka, açıklama, dokümantasyon/GitHub, mevcut dört bilgi rotası, mailto iletişim, Apache License 2.0 ve © 2026 PDA. Repository'de olmayan CONTRIBUTING.md ve kök SECURITY.md için bağlantı üretilmez.
- TR/EN/DE katalogları yeni hikâyeye göre değiştirildi. Eski feature/preview metinleri kaldırıldı.

## Animation mimarisi

- Yeni tek dependency: gsap ^3.15.0. ScrollTrigger bunun içinde gelir; ayrı smooth-scroll, Lenis veya başka animasyon dependency'si eklenmedi. Motion dependency'si diğer uygulama ekranlarının mevcut kullanımı için korunur; yeni landing bunu import etmez.
- GSAP/ScrollTrigger dinamik import ile yüklenir. Native scroll korunur, wheel/touch interception veya scroll lock yoktur.
- Genişlik ≥1024 px ve yükseklik ≥800 px olduğunda CSS sticky viewport kullanılır. Ürün bölümünde 330svh, açık kaynak bölümünde 270svh alan timeline'a ayrılır.
- Scroll progress bir GSAP nesnesi üzerinden DOM metinlerini ve görünür aşamayı günceller. Scroll başına React setState yoktur. Karakter sayısı ancak değişince DOM'a yazılır. Görsel hareketler transform/opacity ağırlıklıdır.
- Hikâye ileri/geri scroll'da deterministiktir. Klavye ile erişilen bölüm bağlantıları ilgili scroll konumuna gider. Etkin adım aria-current ile belirtilir.
- matchMedia cleanup route değişimi, viewport değişimi ve reduced-motion geçişinde timeline/inline stilleri kaldırır; metinler ve tam içerik geri gelir.
- Mobil/tablet, kısa laptop ekranı, reduced-motion veya JS yokluğunda tüm hikâye normal dikey akışta görünür. Cihaz hareket azaltma tercihi landing'de açıkça dikkate alınır; uzun scrub ve cursor blink kaldırılır.
- Animasyon chunk'ı yüklenemezse tam statik içerik kullanılabilir kalır.

## Semantic theme/token yaklaşımı

- frontend/src/app/globals.css DEĞİŞMEDİ. Git diff boş; mevcut light/dark renk değerlerine dokunulmadı. Root layout da değiştirilmedi.
- Landing CSS sadece mevcut background, foreground, card, primary, muted-foreground, border, input, ring, success ve ilgili diğer semantic token'ları tüketir.
- Landing scope'undaki source/cmd alias'ları yalnız global foreground/background üzerinden color-mix() ile türetilir. Paralel hardcoded renk paleti yoktur.
- Teknoloji ikonları mevcut local SVG'lerin currentColor maskeleridir; Next.js SVG'sinde harflerin seçilmesi için luminance maskesi kullanılır. Dış CDN yoktur.
- Global background/foreground/primary değerlerinin tarayıcıda değiştirilmesiyle landing zemini ve ana CTA'nın değiştiği otomatik testle doğrulandı.
- Landing feature içinde hex/rgb/hsl/sabit Tailwind palet sınıfı taraması eşleşme vermedi. Test fixture'larındaki renk değerleri bu görsel kod taramasına dahil değildir.

## Windows CMD / kurulum hikâyesi

- Windows title bar, Command Prompt başlığı, sağda minimize/maximize/close ikonları; trafik ışığı butonları yoktur. Pencere kontrolleri gösterimdir, etkileşimli düğme olarak sunulmaz.
- Consolas / Cascadia Mono / mevcut mono fallback; C:\Users\alper prompt'u, DOM üzerinde karakter karakter command yazımı ve block cursor.
- Transcript örnek kurulum olarak etiketlidir. Bu sayfa hiçbir komutu çalıştırmaz ve .env içeriği okumaz/değiştirmez.
- Gerçek repository URL'si klonlanıyor gibi gösterilir; ardından cd, Windows copy .env.example .env, notepad .env, docker compose up --build -d, cd frontend, npm ci, npm run dev.
- Environment dosyasındaki gerekli değerlerin önce doldurulması açıkça belirtilir; secret veya örnek gerçek credential gösterilmez.
- docker-compose.yml doğrulandı: yalnız backend + postgres. Terminal Docker çıktısında frontend container yoktur.
- frontend/package-lock.json ve package.json doğrulandı: npm ci ve dev scripti next dev. Frontend Docker dışında ayrı Node.js işlemiyle http://localhost:3000 üzerinde gösterilir.
- Son komut çıktısından sonra CMD scale 0.74 olur ve sola kayar. Sağda PDA, Open Source/Apache 2.0 ve Spring Boot/Next.js/PostgreSQL/Docker rolleri sırayla görünür.
- Scroll geri alındığında komut/çıktı ve pencere yerleşimi geri alınır. Daha önceki komutlar gösterim penceresinden çıkarken tam transcript ekran okuyucu için statik olarak bulunur.

## Kaldırılan eski landing yapıları

- Eski hero/atmosphere, screenshot preview ve overview/criteria picker, feature listesi, üç adımlı başlangıç bölümü ve closing layout tamamen değiştirildi.
- Eski motion/useScroll/useTransform kullanımı ve CSS animasyonları kaldırıldı. landing.module.css yeni sahnelere göre yeniden yazıldı.
- Kullanım araması sonrasında public/images/landing içindeki dört light/dark WebP screenshot ve bunların README dosyası silindi.
- Yalnız landing tarafından kullanılan SiteFooter tone="landing" varyantı kaldırıldı. Auth/default footer davranışı korunur ve public regression paketiyle doğrulanmıştır.
- Eski delivery kayıtları tarihsel kayıt oldukları için korunmuştur; güncel folder/design rehberleri yeni yapıyı anlatır.

## Değişen önemli dosyalar

- frontend/src/features/landing/landing-page.tsx
- frontend/src/features/landing/landing.module.css
- Yeni: frontend/src/features/landing/product-story.tsx, product-demo.tsx, open-source-scene.tsx, command-sequence.ts, landing-footer.tsx
- frontend/src/i18n/landing/{tr,en,de}.json
- frontend/src/components/layout/site-footer.tsx
- frontend/package.json, frontend/package-lock.json
- frontend/e2e/landing-page.spec.ts
- Silinen: frontend/public/images/landing/{README.md, dört screenshot WebP}
- .agents/folder-structure.md, .agents/frontend-design-rules.md, .agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md

## Doğrulama

Frontend dizininden:

| Komut / kontrol | Sonuç |
| --- | --- |
| npm.cmd run lint | PASS; hata veya warning yok |
| node node_modules/typescript/bin/tsc --noEmit | PASS; package.json'da ayrı type-check scripti bulunmadığından mevcut TypeScript CLI kullanıldı |
| npm.cmd run build | PASS; son kaynaklarla production compile/typecheck/static generation tamamlandı |
| node node_modules/@playwright/test/cli.js test --config=playwright.public.config.ts | 46 PASS (18 landing + 28 footer/public/error regression) |
| node node_modules/@playwright/test/cli.js test --config=playwright.public.config.ts landing-page.spec.ts --grep "desktop scroll|short laptop|semantic palette" | Son görsel düzeltmeden sonra etkilenen 4 test PASS |
| next start -p 3002 + yerel production-qa.cjs | İki tema, dört ürün aşaması, CMD/tech açılışı ve mobil bölüm screenshot'ları PASS |
| git diff --check | PASS; Windows LF/CRLF bilgilendirmeleri dışında diff hatası yok |
| git diff -- frontend/src/app/globals.css | Boş; global renk paleti aynı |
| Landing hardcoded renk / eski asset reference araması | Eşleşme yok |

İlk sandbox build denemesi mevcut Google fontlarına ağ erişimi olmadığı için başarısızdı; font veya layout değiştirilmeden ağ izniyle son gerçek production build başarıyla çalıştırıldı. Son lint temizdir.

### Playwright görsel QA

- Viewport genişlikleri: 320, 390, 768, 1280, 1440, 1920 px; light ve dark. Ana animasyon screenshot'ları 1440×900; ayrıca 1280×720 kısa laptop fallback.
- Welcome, proje typing/form/oluşturma sonucu, ekip, görev typing/atama, TODO/IN_PROGRESS/IN_REVIEW/TESTING/DONE, CMD başlangıcı/typing/Docker/Ready, sola küçülme/tech reveal, final CTA ve footer.
- İleri/geri scrub, sticky release, klavye skip link/bölüm seçimi, canlı reduced-motion ve viewport değişimi, JS'siz SSR içerik.
- Horizontal overflow yok. Production demoda form/üye/görev/final içeriklerinin scene dışına taşmadığı ve küçülen CMD'nin facts ile örtüşmediği ölçüldü.
- Runtime console/page error veya hydration warning yok; görünür logo assetleri yükleniyor. Ürün demo alanında screenshot/video/canvas yok.
- Kayıt, login ve bilgi route'ları gerçek navigation ile kontrol edildi. Footer external hedefleri mevcut README/GitHub/LICENSE ile sınırlı; GitHub'ın public dosya listesi read-only doğrulandı.
- Screenshot'lar tmp/landing-qa içinde; proje/done/CMD/tech/final/mobile görüntüleri görsel olarak incelendi.
- Görsel incelemede bulunan erken tech görünürlüğü düzeltildi: tüm facts önce GSAP autoAlpha ile gizlenir, terminal geçişinden sonra stagger ile açılır. Next.js maskesinin düz daire görünümü de düzeltildi.

## Açık konular / sınırlar

- Bilinen açık landing implementation hatası yoktur.
- Browser QA Chromium ile yapıldı; Firefox/WebKit ve gerçek iOS/Android cihaz deneyimi bu teslimde doğrulanmadı.
- Demo otomatik ürün anlatımıdır; gerçek kayıt/proje oluşturma sayfalarına yönelik yeni backend davranışı eklenmedi.
- Production hosting/domain/TLS ve genel web checklist'in açık maddeleri bu landing işiyle tamamlanmış sayılmadı. İlgili notlar güncellendi, proje genelindeki responsive/keyboard maddeleri kısmi kapsam nedeniyle açık kaldı.
- Gerçek ekran okuyucu cihazıyla manuel test veya Lighthouse performans skoru bu teslimin test sonucu olarak iddia edilmez.

## Kullanıcı kontrolü

1. Mevcut dev server ile oturumsuz/gizli pencerede http://localhost:3000/ aç. Session hint varsa /dashboard yönlendirmesi beklenir.
2. İlk viewport'ta yeni sakin welcome tasarımını ve mevcut PDA logosunu kontrol et; light/dark ve TR/EN/DE arasında geçiş yap.
3. 1440×900 gibi geniş/yeterince yüksek bir ekranla aşağı kaydır: form doldurulması → proje oluşturulması → ekip → görev/Alper → TESTING dahil DONE. Geri kaydırınca süreç geri gitmelidir. Bölüm bağlantılarını klavyeyle dene.
4. CMD bölümünde frontend'in Docker çıktısında bulunmadığını, ayrı npm ci / npm run dev ile açıldığını ve Ready sonrası terminalin sola küçüldüğünü kontrol et.
5. Final CTA'daki “Serüvene katıl” kayıt sayfasını, “Giriş yap” login sayfasını açmalıdır; footer bilgi/dokümantasyon/lisans bağlantılarını kontrol et.
6. 390 px mobilde ve reduced-motion açıkken hikâye sabit viewport veya scroll lock olmadan normal dikey akışta okunmalıdır.
7. İstenirse tmp/landing-qa screenshot'larını incele. Kalıcı checklist'te yalnız bu landing'e ilişkin notlar güncellenmiştir.
