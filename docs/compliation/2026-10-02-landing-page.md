# PDA animasyonlu landing page

## Teslim ve durum

- Tarih: 2026-10-02
- Durum: Yerel geliştirme ve doğrulama tamamlandı; tasarım kullanıcı incelemesine hazır.
- Kapsam: Herkese açık `/` karşılama sayfası, animasyon, gerçek ürün vitrini, kayıt/giriş bağlantıları, landing footer ve ana sayfanın keşfedilebilirliği.

## Yapılanlar

- Büyük Inter başlık, mevcut genel mavi renk token'ları, hafif ışık belirmesi ve tek ana “Hesap oluştur” çağrısı.
- Bir kez çalışan giriş/ışık hareketleri ve kaydırmayla düzleşen ürün vitrini. Reduced motion hareketi kaldırır; forced-colors dekoru gizler.
- Proje özeti ve başarı kriterleri arasında tıklama/klavye ile değişen iki ürün görünümü. Light/dark görseller gerçek PDA arayüzünden yalnız örnek API verileriyle yakalandı; dört WebP yaklaşık toplam 215 KB. Ekran içeriği Türkçe, bunu açıklayan caption üç dilde.
- Proje, ekip ve görev/sprint yönetimi açıklamaları; üç adımlı başlangıç bölümü; kayıt çağrısı ve GitHub bağlantısı.
- Mevcut dil ve tema bileşenleri; metinler Türkçe, İngilizce, Almanca. Header kontrol hedefleri en az 44 px; ana kayıt butonu 52 px. Skip link ve görünür klavye odağı.
- Landing footer: bilgi sayfaları, copyright, Alper Temiz/Hamza Taşbay GitHub profilleri, kaynak kod ve `mailto:pda-info@gmail.com`. Auth/default footer varyantları korunur; çalışma ekranlarına footer eklenmedi.
- Oturumsuz `/` HTTP 200 ile landing gösterir. `PDA_SESSION` işareti varsa mevcut `/dashboard` akışına yönlendirir. İşaret yetki veya oturum doğrulaması değildir; mevcut AppShell/API denetimi geçerlidir.
- Üç dilde title/description, ana sayfa canonical ve OpenGraph alanları. Sitemap'e ana sayfa, SSS ve erişilebilirlik eklendi; robots public yolları açarken çalışma alanı/API/dev/hata önizlemelerini dışlar. KVKK/gizlilik sayfalarının mevcut noindex durumu korunur.
- Backend, API istemcisi, cookie/CSRF güvenlik yapısı, `.env`, `.env.example` ve bağımlılıklar değiştirilmedi. Commit, push veya yayın yapılmadı.

### Önemli dosyalar

- [Ana sayfa](../../frontend/src/app/page.tsx)
- [Landing bileşeni](../../frontend/src/features/landing/landing-page.tsx), [sayfaya özel stil](../../frontend/src/features/landing/landing.module.css)
- [Üç dil metinleri](../../frontend/src/i18n/landing/), [mesaj birleştirme](../../frontend/src/i18n/request.ts)
- [Ürün görselleri ve köken notu](../../frontend/public/images/landing/README.md)
- [Ortak footer](../../frontend/src/components/layout/site-footer.tsx)
- [Sitemap](../../frontend/src/app/sitemap.ts), [robots](../../frontend/src/app/robots.ts)
- [Landing testleri](../../frontend/e2e/landing-page.spec.ts), [public test yapılandırması](../../frontend/playwright.public.config.ts)
- [.agents klasör özeti](../../.agents/folder-structure.md), [tasarım kuralları](../../.agents/frontend-design-rules.md), [kalıcı checklist](../../.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md)

## Doğrulama

Komutlar `frontend` klasöründe çalıştırıldı:

```powershell
npx tsc --noEmit
npx eslint src/app/page.tsx src/app/sitemap.ts src/app/robots.ts src/features/landing/landing-page.tsx src/components/layout/site-footer.tsx src/i18n/request.ts e2e/landing-page.spec.ts playwright.public.config.ts
npx playwright test --config=playwright.public.config.ts
npm run build
```

| Kontrol | Sonuç |
| --- | --- |
| TypeScript | Başarılı |
| İlgili dosyalar ESLint | Başarılı |
| Public Playwright | **40 geçti, 53,3 sn**: 12 landing + 10 footer/bilgi + 18 hata ekranı |
| Production build | Başarılı; optimize derleme ve TypeScript kontrolü tamamlandı |
| Production smoke (yerel 3010) | `/` HTTP 200, doğru PDA title ve tek h1/footer, ürün görseli yüklendi, pageerror yok |
| Görsel kontrol | 1440 px masaüstü ve 390 px mobil, açık/koyu tema |
| Kaydırma hareketi | Ürün transform'u kaydırmayla perspektiften düz görünüme geçti |
| Reduced motion / JS kapalı | Hareket kaldırıldı; JS kapalıyken başlık ve kayıt bağlantısı görünür |
| `git diff --check` | Başarılı |

Landing testleri üç dilde içeriği/görselleri, backend isteği olmadan açılmayı, 320/390/768/1440 px iki temada taşmasız görünümü, görünüm seçimini, kayıt/giriş/SSS linklerini, klavye kullanımını, oturum işaretli yönlendirmeyi, metadata ve sitemap/robots davranışını doğrular.

Tasarım ve audit için yerel `frontend-design` ve `web-design-guidelines` skill'leri kullanıldı. [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) ışığında odak, semantik yapı, hareket, görsel boyutları ve mobil düzen kontrol edildi. Bulunan hydration farkı, header link sıkışması ve footer iletişim satırı giderildi.

## Checklist durumu

Görevden etkilenen 9 madde gözden geçirildi: Footer, CTA, Responsive Design, mobil testler, metadata, sitemap, robots, canonical ve klavye kullanımı.

- Tam doğrulanan: **4** — Footer, CTA, sitemap, robots.
- Proje genelindeki kapsamı henüz tamamlanmayan: **5** — Responsive Design, mobil kritik akışlar, metadata, canonical, klavye. Landing kapsamı doğrulandı; genel maddeler açık bırakıldı.
- N/A: **0**.
- Tüm site için production hazırlık denetimi açık; hosting/domain ve yayın sonrası kontroller ayrıca yapılmalıdır.

## Açık konular

- Production adresleri mevcut `NEXT_PUBLIC_SITE_URL` ayarından gelir. Gerçek domain henüz bu teslimde yapılandırılmadı; ortam dosyası değiştirilmedi.
- OpenGraph mevcut PDA marka görselini kullanır. Gerçek sosyal platformlarda production link paylaşımı testi yapılmadı.
- Ürün görselleri canlı demo değildir; örnek verili ekran görüntüleridir. UI değiştikçe yeniden yakalanmalı ve görsel dosya sürümü artırılmalıdır.
- Chromium doğrulandı. Firefox, Safari/iOS, tam screen reader ve Lighthouse denetimi çalıştırılmadı.
- E-posta bağlantısı mailto'dur; posta kutusunun açılması veya teslimat testi bu göreve dahil değildir.

## Kullanıcı kontrolü

1. Yerel önizleme `http://localhost:3000/` adresinde açık bırakıldı. Sunucu kapalıysa `frontend` içinde `npm run dev` çalıştır.
2. **Gizli pencerede aç veya oturumdan çık.** Oturum işareti varsa `/` dashboard'a yönlendirir.
3. İlk ekranı ve aşağıdaki özellik/başlangıç/footer bölümlerini değerlendir. Normal hareket tercihinde aşağı kaydırarak ürün vitrininin düzleşmesini izle.
4. “Proje özeti” ve “Başarı kriterleri” butonlarını değiştir; gösterilen ürün ekranı değişmeli.
5. Açık/koyu temayı ve dil menüsünden TR/EN/DE'yi dene. Tema/dil değişimi mevcut ortak geçişleri kullanır. Görsel içindeki örnek metin Türkçe kalır.
6. “Hesap oluştur” `/register`, “Giriş yap” `/login` açmalı; mevcut giriş/kayıt ekranları çalışmaya devam etmeli.
7. Footer'daki bilgi, GitHub ve mailto adreslerini kontrol et. 320/390 px mobil görünümde yatay taşma olmamalı.
8. Tab ile ilk skip linke ulaşıp Enter'a bas; odak ana içeriğe geçmeli. Ürün seçimi butonları Tab/Enter ile çalışmalı.

Yalnız landing testlerini tekrar çalıştırmak için:

```powershell
npx playwright test --config=playwright.public.config.ts landing-page.spec.ts
```

Tasarım kullanıcı geri bildirimi doğrultusunda düzenlenebilir. Landing kodu ve metinleri ayrı feature/katalog dosyalarında tutulur.
