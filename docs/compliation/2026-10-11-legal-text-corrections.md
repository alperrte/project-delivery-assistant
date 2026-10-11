# Yasal metin düzeltmeleri — 2026-10-11

Kapsam: TR/EN/DE yasal sayfalarda (`publicPages` altında KVKK, Gizlilik, Kullanım Koşulları; Çerez ve Erişilebilirlik metinleri bu turda değişmedi) kullanıcı kararlarına göre yalnız metin düzeltmesi. Backend, docker, rota ve tasarım değişmedi. Kullanıcı kararı tarihi: 2026-10-11.

## Corrections 2026-10-11

1. **VERBİS kesin ifade oldu.** "Değerlendiriliyor" kalktı. Veri sorumluları (Hamza Taşbay, Alper Temiz) çalışan ve şirket/ticari gelir sahibi olmadığı için Kurul'un eşiklerinin (50'den az çalışan ve Kurul'un belirlediği tutarın altında bilanço) altındadır; şu anda VERBİS kayıt yükümlülüğü yoktur, yükümlülük doğarsa yasal süre içinde yerine getirilecektir. Belirli bir TL tutarı veya Kurul karar numarası yazılmadı. Bölüm başlığı "VERBİS kayıt yükümlülüğü" / "VERBİS registration" / "VERBİS-Registrierung" oldu. VERBİS yalnız KVKK metninde geçiyordu; gizlilik ve SSS metninde geçmiyor.
2. **Çocuk/yaş.** Uydurma "16 yaş" eşiği ve "hesabı sileriz" iddiası kaldırıldı. Nötr ifade: PDA çocuklara yönelik değildir; reşit olmayanlar yasal temsilcilerinin bilgisi dahilinde kullanmalıdır. Sayı ve silme iddiası yok (Gizlilik ve Kullanım Koşulları; KVKK ve SSS'de ilgili ifade yoktu).
3. **Posta kutusu kopyaları.** İletişim mesajlarının PDA gelen kutusundaki (Gmail, `pdassistant.info@gmail.com`) e-posta kopyaları veri sorumluları tarafından en az yılda bir elle temizlenir; 12 aydan eski mesajlar en geç yıllık temizlikte, talep üzerine (form kategorisi veya e-posta) hemen silinir. Eski "otomatik silmeye dahil değildir" ifadesi KVKK ve Gizlilik saklama tablosunda ve iletişim formu bildiriminde (`contact` notice) bu ifadeyle değiştirildi (TR/EN/DE).
4. **Yurt dışına aktarım (KVKK m.9, GDPR Bölüm V).** "Sağlayıcıların kendi aktarım mekanizmalarına dayanır" iddiası kaldırıldı. Yerine: alıcılar ve ülke (Google LLC / Gmail SMTP ve isteğe bağlı Google girişi — ABD; GitHub, Inc. / GitHub API ve isteğe bağlı GitHub girişi — ABD), hangi verinin nereye gittiği, isteğe bağlı girişlerin ve depo özelliğinin kullanılmayarak kaçınılabileceği, veri sorumlularının m.9 uyumunu (standart sözleşmeler, Kurula bildirim) takip ettiği ve güvenceler sağlandıkça metni güncelleyecekleri yazıldı. Hiçbir güvencenin veya sözleşmenin tamamlandığı iddia edilmiyor. GDPR bölümü yapısı korunarak aynı dürüst durumu yansıtır. Barındırma sağlayıcısı hâlâ seçilmedi (metin aynı).
5. **GDPR m.27** olduğu gibi bırakıldı ("değerlendirilmektedir, temsilci atanmadı"); testle sabitlendi.

"Son güncelleme" tarihleri zaten 11 Ekim 2026 idi; değiştirilmedi.

## Değişen dosyalar

- `frontend/src/i18n/messages/{tr,en,de}.json` (yalnız `publicPages` içi ve `contact` bildirimi)
- `frontend/e2e/legal-pages.spec.ts` (yasak yer tutucu taraması korundu; yaş iddiası yok, VERBİS kesin cümlesi, yıllık temizlik cümlesi, m.9 dürüstlük cümlesi, m.27 değişmedi, eski ifadelerin yokluğu testleri eklendi)

## Açık kalan hukuki konular

- **m.9 güvenceleri henüz yok:** standart sözleşmeler ve Kurula bildirim uygulanmadı; yalnız takip edildiği yazıldı. Tamamlandıkça KVKK ve Gizlilik (TR/EN/DE) güncellenmeli.
- **GDPR m.27 temsilci kararı** verilmedi (değerlendirme açık).
- **Barındırma sağlayıcısı** seçilmedi; seçilince alıcı listesine ad, veri konumu ve aktarım bilgisi eklenecek.
- **Yedekleme ve barındırma düzeni** (yedek süreleri, yedeklerden silme) belirlenmedi; saklama bölümünde "belirlendiğinde eklenecek" notu duruyor.
- Gelen kutusundaki yıllık elle temizlik operasyonel bir yükümlülüktür; takvimde bir hatırlatıcı tutulmalı.

## Doğrulama

- `npx playwright test e2e/legal-pages.spec.ts e2e/footer-public-pages.spec.ts e2e/a11y-public.spec.ts e2e/localized-routing.spec.ts e2e/contact-form.spec.ts e2e/privacy-regression.spec.ts --output=test-results-legal` (public paket, backend hesabı gerekmez), `npm run lint`, `npx tsc --noEmit`. Sonuçlar son raporda.
- Manuel kontrol: `/kvkk`, `/privacy`, `/terms` sayfalarını üç dilde açıp VERBİS, çocuklar, aktarım ve saklama tablosu metinlerini gözden geçirin.
