# Footer ve bilgi sayfaları — teknik teslim

**Tarih:** 2 Ekim 2026  
**Durum:** Footer, herkese açık sayfalar ve üç dilde içeriklerin teknik teslimi tamamlandı ve doğrulandı. KVKK ve gizlilik metinleri dolu yayın öncesi taslaklardır; hukuki sonlandırma tamamlandı olarak kaydedilmez.

## Kapsam ve yapılanlar

- Ortak responsive footer giriş/kayıt/şifre ekranlarına, oturum içi uygulama kabuğuna ve bilgi sayfalarına eklendi. Eski giriş footer'ı kaldırılarak çift footer önlendi.
- Footer: PDA adı ve kısa ürün açıklaması, SSS/KVKK/Gizlilik/Erişilebilirlik bağlantıları, geliştiriciler, iletişim, güncel yıl ile copyright ve Apache 2.0 kaynak kod bağlantısı.
- Geliştiriciler README bilgilerine göre Alper Temiz → https://github.com/alperrte ve Hamza Taşbay → https://github.com/HmzT270. GitHub simgesi ve isim aynı profil bağlantısının içinde.
- İletişim bağlantısı yalnız `mailto:pda-info@gmail.com`. E-posta gönderimi veya Gmail hesabı oluşturulması yapılmadı.
- Mobil tek, sm üzerinde iki, xl üzerinde dört kolon; akış içindeki footer sabitlenmez. Tema token'ları, 44 px bağlantı hedefleri, görünür klavye odağı ve anlamlı gezinme etiketleri kullanıldı.
- Oturumsuz erişilebilen `/faq`, `/kvkk`, `/privacy`, `/accessibility` sayfaları eklendi. Her sayfada başlık, dolu içerik, içindekiler, güncelleme tarihi ve iletişim yolu var.
- SSS: 4 grupta 16 soru ve yanıt. Hesap, OAuth, projeler, ekip üyeliği, davet, gizlilik, başarı kriterleri/görevler, GitHub, şifre, beni hatırla, veri talepleri, dil ve destek.
- KVKK ve Gizlilik: mevcut hesap/proje/görev verileri, amaçlar, alıcılar, çerez/tarayıcı saklama, saklama/silme ve başvuru bilgilerinin dolu taslakları. Bilinmeyen işletmeci, hosting veya saklama süreleri uydurulmadı; sayfalarda inceleme notu ve `noindex, follow` metadata var.
- Erişilebilirlik: mevcut klavye, tema, dil, hareket azaltma özellikleri ve bildirim yolu. WCAG sertifikası veya tam uygunluk iddiası yok.
- Footer ve dört sayfanın tüm metinleri Türkçe, İngilizce ve Almanca.
- Yeni sayfalara özel title/description eklendi. Ana sayfa, robots/sitemap ve canonical çalışması bu teslimde genişletilmedi.
- Backend API, yetkilendirme, oturum güvenliği, veritabanı, bağımlılıklar ve ortam sözleşmesi değiştirilmedi. Commit veya push yapılmadı.

## Önemli dosyalar

- [Ortak footer](../../frontend/src/components/layout/site-footer.tsx)
- [İletişim ve GitHub bilgileri](../../frontend/src/features/public-info/site-info.ts)
- [Bilgi sayfası ve metadata](../../frontend/src/features/public-info/info-page.tsx)
- [Public layout](../../frontend/src/app/(public)/layout.tsx), [SSS](../../frontend/src/app/(public)/faq/page.tsx), [KVKK](../../frontend/src/app/(public)/kvkk/page.tsx), [Gizlilik](../../frontend/src/app/(public)/privacy/page.tsx), [Erişilebilirlik](../../frontend/src/app/(public)/accessibility/page.tsx)
- [AuthShell](../../frontend/src/components/layout/auth-shell.tsx), [AppShell](../../frontend/src/components/layout/app-shell.tsx), [giriş sayfası](../../frontend/src/app/(auth)/login/page.tsx)
- [Türkçe](../../frontend/src/i18n/messages/tr.json), [İngilizce](../../frontend/src/i18n/messages/en.json), [Almanca](../../frontend/src/i18n/messages/de.json) — mevcut metinler korunarak iki namespace eklendi.
- [Tarayıcı testleri](../../frontend/e2e/footer-public-pages.spec.ts), [bağımsız test config'i](../../frontend/playwright.public.config.ts)
- [.agents/folder-structure.md](../../.agents/folder-structure.md) ve [frontend-design-rules.md](../../.agents/frontend-design-rules.md) yeni yüzeyler için güncellendi; CSS token'ı değişmedi.

## Doğrulama

Frontend klasöründe kurulu CLI girişleri doğrudan Node ile çalıştırıldı:

| Komut | Sonuç |
| --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit` | Başarılı, exit 0 |
| `node node_modules/eslint/bin/eslint.js src/components/layout/site-footer.tsx src/components/layout/auth-shell.tsx src/components/layout/app-shell.tsx "src/app/(auth)/login/page.tsx" "src/app/(public)" src/features/public-info e2e/footer-public-pages.spec.ts playwright.public.config.ts` | Başarılı, exit 0 |
| `node node_modules/next/dist/bin/next build` | Başarılı, exit 0; dört yeni rota derlendi |
| `node node_modules/@playwright/test/cli.js test --config playwright.public.config.ts` | **10 test geçti**, son production build üzerinde |
| `git diff --check` | Başarılı |

Tarayıcı testleri:
- Her bilgi sayfası üç dilde oturumsuz HTTP 200 ile açılıyor; boş içerik ve runtime hatası yok.
- 320, 390, 768, 1440 px genişliklerde açık/koyu tema; giriş, kayıt, şifre sıfırlama ve dört bilgi sayfasında yatay taşma yok.
- Footer'daki sayfa linkleri, geliştirici profil hedefleri ve mailto doğrulandı. Harici sitelere gidilmedi, e-posta gönderilmedi.
- SSS Enter ile açılıyor, Space ile kapanıyor; içeriğe geç linki ana içeriğe odaklanıyor.
- Uygulama kabuğunda footer kontrolü yalnız frontend testi olarak sahte oturum/API yanıtlarıyla yapıldı; gerçek backend auth testi değildir.
- Masaüstü bilgi sayfası, mobil auth footer ve mobil koyu tema footer ekran görüntüleri görsel olarak incelendi.

## Açık konular

1. KVKK metni için gerçek/tüzel veri sorumlusu kimliği, resmi başvuru kanalları, hosting/veritabanı/e-posta sağlayıcıları, veri konumları, saklama ve silme/yedekleme takvimi kesinleştirilmeli. Kullanıcıya bu bilgiler soruldu; bu teslim sırasında cevap gelmedi. Metinlerde bu belirsizlik görünür, boş placeholder yok. Yayına hazır hukuki onay iddiası yok.
2. pda-info@gmail.com hesabının kullanıcı tarafından açılıp kontrol edilmesi gerekiyor.
3. Çerez onay paneli, genel SEO, açık ana sayfa ve kapsamlı uygulama erişilebilirlik denetimi sonraki aşamalardır.

Metin hazırlanırken mevcut kodla birlikte [KVKK aydınlatma yükümlülüğü](https://www.kvkk.gov.tr/Icerik/2033/Aydinlatma-Yukumlulugu-), [aydınlatma duyurusu](https://www.kvkk.gov.tr/Icerik/6765/AYDINLATMA-YUKUMLULUGUNUN-YERINE-GETIRILMESI-HAKKINDA-KAMUOYU-DUYURUSU) ve [çerez rehberi](https://www.kvkk.gov.tr/Icerik/7353/Cerez-Uygulamalari-Hakkinda-Rehber) kontrol edildi. Uygulamadaki hukuk sayfalarında resmî kaynak bağlantıları da bulunuyor.

## Kullanıcı kontrolü

1. `frontend` klasöründe `npm run dev` çalıştır; http://localhost:3000/login sayfasında footer'ı incele. Kayıt ve şifre sıfırlama ekranlarında da tek footer bulunmalı.
2. Footer'dan dört bilgi sayfasını aç; gizli pencerede de giriş istememeli. SSS'de 16 soru bulunmalı ve cevaplar açılıp kapanmalı.
3. Mobil 390 px ile masaüstünü, açık/koyu temayı ve üç dili kontrol et. GitHub simgeleri doğru kişisel profillere, kaynak kod bağlantısı proje deposuna gitmeli.
4. Mail bağlantısı e-posta uygulamasında alıcı olarak pda-info@gmail.com adresini açmalı. Bu işlem otomatik mesaj göndermez.
5. Klavyede Tab ile footer bağlantılarına ulaş; görünür odak halkası olmalı. SSS'yi Enter/Space ile ve içeriğe geç linkini kontrol et.
6. Giriş yaptıktan sonra hesap/proje ekranının altından bilgi sayfasına geçişi dene.
7. Otomatik footer testlerini tekrar çalıştırmak için frontend açıkken `npx playwright test --config playwright.public.config.ts` kullan. Bu config backend hesabı kurmaz.
8. Hukuki metinlerin yayın öncesi inceleme notunu okuyup yukarıdaki işletmeci/hosting bilgilerini netleştir.
