# Web Sitesi Master Checklist — 258 maddelik yeniden denetim

Tarih: **2026-10-10**. Kaynak: [Web_Sitesi_Master_Checklist.md](../../.agents/faz-md/Web_Sitesi_Master_Checklist.md). İncelenen HEAD: `228abda9b128b2f6e6448b7d2211b774d2978d4b`; değerlendirme committen ibaret değil, mevcut working tree kaynaklarını kapsar.

**258/258 madde**, 1. bölümden 12. bölümün sonuna kadar özgün sırayla yeniden değerlendirildi. Önceki işaretler sonuç kabul edilmedi. Önceden onaylı **94** maddenin **29** tanesi bu denetimde KISMİ veya DOĞRULAMA BEKLİYOR sonucunu aldı. Kod, config ve iki checklist dosyası değiştirilmedi; commit/push/merge/deploy yapılmadı. Yalnız bu rapor ve denetim teslim kaydı oluşturuldu.

**Yayın hazırlığı tamamlanmış sayılmaz.** Kullanım koşulları, nihai hukuki içerik, genel uygulama CSP, işletim/backup/incident hazırlığı gibi somut eksikler var. Canlı ortam ve erişilebilirlik/performans sonuçları da henüz doğrulanmış değil. Bu, doğrulanmış bir saldırı açığı raporu veya hukuki uygunluk belgesi değildir. PWA gibi isteğe bağlı eksikler tek başına yayın engeli olarak yorumlanmamalı.

## Sonuçların anlamı

| Durum | Sayı | Anlam |
|---|---:|---|
| KOD | 101 | Maddede anlatılan uygulama kaynak/config üzerinden doğrulanıyor. Runtime PASS, kusursuzluk veya production uygunluğu garantisi değildir. |
| KISMİ | 108 | Uygulama var; kapsam, güncellik, ortam veya kanıt boşluğu bulunuyor. |
| EKSİK | 17 | Beklenen uygulama/operasyon belgesi kaynakta bulunmadı veya kaynak açıkça tamamlanmamış olduğunu gösteriyor. |
| DOĞRULAMA BEKLİYOR | 17 | Sonuç için production, dış hesap, hukuki işletmeci bilgisi, gerçek cihaz veya manuel test gerekiyor. Yokluğu kanıtlanmış sayılmadı. |
| N/A | 15 | Mevcut hizmette karşılığı yok veya açık kapsam dışı kararı var. Gerekçesi ilgili satırda. |
| **Toplam** | **258** | Her satır tek sonuçla sayıldı; örtüşen konu farklı checklist maddelerinde kendi ölçütüyle ayrıca değerlendirildi. |

## Yöntem, sınırlar ve gerçekten yapılan doğrulamalar

Önce SECURITY, architecture, folder-structure ve kalıcı web checklisti okundu. Görevle ilgili authentication/ADR, frontend workflow, deployment, database, erişilebilirlik/yayın QA kuralları ve teslim kayıt biçimi incelendi. Plan ve eski completion belgeleri uygulanmış özellik kanıtı sayılmadı. EKSİK sonuçları dosya adının yokluğundan ibaret değildir: ilgili route, component, servis, config veya test modeli ile çapraz kontrol edildi. HAMZA gibi sorumluluk başlıkları teknik kontrol maddesi sayılmadı; altlarındaki bütün maddeler dahil edildi.

Güvenlik maddelerinde [security-audit skill](<C:/Users/alper/.agents/skills/security-audit/SKILL.md>) kaynak inceleme yöntemi uygulandı. Skill şu sınırı koyuyor: **“If every control cannot be enforced, do not execute target code”**. Bu oturumda dış ağ kapalı, izole loopback, temiz allowlist environment, salt okunur kaynak/toolchain, scratch-only yazma ve kaynak limitlerini birlikte uygulayan OS sandbox kurulmadı. Bu nedenle hedef uygulama/test/build/browser çalıştırılmadı. Tam security-audit pipeline veya exploit denemesi yapılmadı. Güvenli doğrulama planı rapor sonunda var.

- Güvenilir üst süreç üzerinden `git status --short`, `git rev-parse HEAD`, `git tag --list`, ilgili `git ls-files` kontrolleri ve filtreli `rg --files --hidden` envanteri çalıştırıldı. PowerShell komut başlatma sorunu sonrasında Node REPL filesystem/execFile kullanıldı. Hedef repo scriptleri değerlendirilmedi.
- Frontend source/route/metadata/locale/asset, backend auth/role/object-access/contact/analytics/upload, SQL migration, Docker/build/ortam varsayılanları ve mevcut test tanımları doğrudan okundu. Gerçek `.env` ve secret değerleri okunmadı, ortam dökümü alınmadı.
- Checklist parser: 12 bölüm, **258** madde; bölüm adetleri **22, 27, 39, 37, 19, 22, 14, 21, 15, 13, 12, 17**. Malformed `- []` rol maddesi ve `Eklenmeyecek` maddeleri de dahil.
- Route metadata statik incelemesi: **55** fiziksel page dosyası; **53** içerik sayfasında metadata helper/export, kalan ikisi redirect. Bu sayım render edilmiş title/description benzersizliği testi değildir.
- Literal link kontrolü: **76** href örneği / **23** farklı yerel hedef; **0** çözülemeyen route/asset. Dinamik expression, external URL availability ve browser crawl kapsamı dahil değil.
- TR karşılaştırmalı flattened JSON anahtar kontrolü: DE messages eşit; EN messages **27 eksik ve 3 fazla** anahtar. Eksikler `squads.membersPage.*` eski namespaceinde; aktif kaynak kullanımı bulunmadı, eski members rotası redirect. Landing ve errors EN/DE anahtarları TR ile eşit. Çeviri anlam/doğruluk testi değildir.
- PNG header/dosya kontrolü: OG **1200×630 / 520955 bayt**, manifest ikonları **192×192** ve **512×512**, app icon **256×256**, apple icon **180×180**. Favicon ve iki CV dosyası mevcut.
- Backend **103** `*Test.java`, frontend **113** `*.spec.ts`, Flyway **56** SQL migration dosyası; tekrar eden migration sürümü bulunmadı. Dosya sayısı geçmiş/current PASS veya test yeterliliği değildir.
- `npm audit`, Maven/npm build/test/lint/typecheck, Playwright, Lighthouse, TLS/social crawler, mail teslimi, load/fuzz/pen test çalıştırılmadı. Eski raporlardaki PASS/advisory sayıları güncel sonuç diye aktarılmadı.

## Öncelikli bulgular

| Öncelik | Maddeler | Somut kanıt ve yapılması gereken kontrol |
|---|---|---|
| Yayın öncesi | 1.7, 2.3 | Kullanım koşulları route/metin/footer linki yok (INFO, ROUTING). |
| Yayın öncesi | 2.1–2.15, 9.15 | Hukuki taslak uyarısı COPY satır 2616; veri sorumlusu belirsiz satır 2859; retention/aktarım/resmî başvuru nihai değil. PRIVACY satır 2838 ve FAQ satır 2751 hesap silme yok diyor, DELETE/USER uygulaması var. Hukuki karar işletmeci bilgileriyle verilmelidir. |
| Yayın öncesi | 2.7, 9.14 | Analytics retention/delete job bulunmadı; COPY satır 3086 süre belirlenmediğini söylüyor. Opt-in olması saklama/imha gereğini kendiliğinden çözmez. |
| Yayın öncesi | 8.4 | NEXT satır 6–7 genel sayfa CSPyi follow-up bırakıyor. Kaynakta nonce/CSP pipeline uygulanmamış. |
| Yayın öncesi | 8.1–8.3, 12.10, 12.13–12.14 | Production URL/TLS/header/env çıktıları ve deploy sonrası smoke sonucu yok; localhost fallbacklerin gerçek domainle değiştiği doğrulanmalı. NEXT_PUBLIC_SITE_URL frontend Docker build ARG olarak aktarılmıyor; gerçek build/runtime injection incelenmeli. |
| İşletim | 8.18–8.20, 9.6, 12.11–12.12, 12.15 | Backup/restore tatbikatı, incident runbook, kalıcı audit viewer, CI workflow, alarm ve uygulanmış rollback kanıtı yok. DB ile org media volume aynı tutarlı set olarak kurtarılmalı. |
| Erişilebilirlik | 1.9, 3.32, 3.34 | MOTION satır 13–14/default on; PROVIDERS satır 39 never; CSS satır 666–683 data-motion=on öğelerini OS reduce dışına çıkarıyor. COPY satır 2951 cihaz tercihiyle animasyon azalır diyor. Açık off ayarı mevcut, varsayılan OS davranışı beyanla uyumsuz. |
| Test güvenilirliği | 3.10, 3.39, 12.4–12.7 | A11Y yalnız 10 public rota; contact/cookies/admin/app/yeni auth akışları kapsam dışı. Incomplete contrast satır 31–35 başarısızlığa sayılmıyor. PLAY yalnız Chromium; manuel AT/gerçek cihaz sonuçları yok. |
| Test altyapısı | 1.18, 12.3 | MAILPIT satır 2 eski docker-compose.e2e.yml, satır 5 localhost:8025 varsayıyor; bu compose dosyası güncel repoda yok. Koşum öncesi gerçek mail yerine izole sink ile eşdeğer kurulum gerekir. Published contact mail ve CONFIG varsayılan alıcısı farklı; hedef inbox kararı doğrulanmalı. |
| Teknik kalite | 10.1–10.2, 10.10–10.11 | CWV/Lighthouse/bundle budget sonucu yok. CLIENT fetch finite timeout kullanmıyor; sınırlı auth/CSRF retry genel ağ timeout/retry politikasının karşılığı değil. |
| İçerik güncelliği | 1.15, 2.14, 11.5 | Footer/package/pom sürümleri farklı; cookie inventory yeni ticket/storage anahtarlarını içermiyor. EN legacy anahtar farkı aktif UI bugı olarak sunulmadı. |

## Bölüm bazlı dağılım

| Bölüm | Madde | KOD | KISMİ | EKSİK | BEKLİYOR | N/A |
|---|---:|---:|---:|---:|---:|---:|
| 1. Footer, kurumsal sayfalar ve iletişim | 22 | 9 | 12 | 1 | 0 | 0 |
| 2. Hukuki uyum, KVKK ve çerezler | 27 | 6 | 9 | 5 | 2 | 5 |
| 3. Erişilebilirlik: herkes için kullanılabilir site | 39 | 6 | 21 | 0 | 3 | 9 |
| 4. SEO, GEO, URL ve sosyal paylaşım | 37 | 23 | 12 | 0 | 2 | 0 |
| 5. Formlar, doğrulama ve geri bildirim | 19 | 13 | 5 | 0 | 0 | 1 |
| 6. UI/UX, responsive tasarım ve ekran durumları | 22 | 16 | 6 | 0 | 0 | 0 |
| 7. Üyelik, oturum ve yetkilendirme | 14 | 11 | 3 | 0 | 0 | 0 |
| 8. Güvenlik ve üretim altyapısı | 21 | 4 | 11 | 3 | 3 | 0 |
| 9. Admin paneli, analitik ve izleme | 15 | 5 | 6 | 4 | 0 | 0 |
| 10. Performans ve teknik kalite | 13 | 1 | 7 | 1 | 4 | 0 |
| 11. Çoklu dil, PWA ve platform özellikleri | 12 | 7 | 3 | 2 | 0 | 0 |
| 12. Test, yayın ve yayın sonrası takip | 17 | 0 | 13 | 1 | 3 | 0 |

## Bütün maddelerin sıralı sonuçları

Madde IDsi bölüm içindeki sıralı numaradır; kaynak checklist numaralandırılmadığı için burada eklendi. Önceki sütunu özgün işareti gösterir; checklist değiştirilmedi. Kanıt kodları en sondaki gerçek dosya bağlantılarıyla eşleşir. Her satırdaki sınırlar genel yöntemin kısıtlarına ilavedir.

### 1. Footer, kurumsal sayfalar ve iletişim

| ID | Madde | Önceki | Sonuç | Kanıt / gerekçe ve kalan doğrulama |
|---|---|---|---|---|
| 1.1 | Telif hakkı ve yıl | [X] | **KOD** | Dinamik yıl ve telif metni ortak footer içinde. — **FTR** |
| 1.2 | Site / marka adı | [X] | **KOD** | PDA adı ve marka metni mevcut. — **FTR** |
| 1.3 | Hakkımızda bağlantısı | [X] | **KOD** | Hakkımızda bağlantısı gerçek bilgi sayfasına gidiyor. — **FTR**, **ABOUT** |
| 1.4 | Sıkça Sorulan Sorular (SSS) | [X] | **KOD** | SSS sayfası ve footer bağlantısı mevcut. — **FTR**, **LEGAL** |
| 1.5 | KVKK Aydınlatma Metni | [ ] | **KISMİ** | Bağlantı ve sayfa mevcut; metin açıkça hukuki taslak, veri sorumlusu henüz kesin değil. — **INFO**, **LEGAL**, **COPY** |
| 1.6 | Gizlilik Politikası | [ ] | **KISMİ** | Bağlantı ve sayfa mevcut; taslak ayrıca mevcut hesap silme özelliğini yok sayıyor. — **LEGAL**, **COPY**, **DELETE** |
| 1.7 | Kullanım Koşulları | [ ] | **EKSİK** | Footer listesinde ve rota envanterinde kullanım koşulları sayfası yok. — **INFO**, **ROUTING** |
| 1.8 | Çerez Politikası ve tercih bağlantısı | [ ] | **KISMİ** | Çerez sayfası ve tercih açma düğmesi var; politika/envanter eksik. — **FTR**, **DIALOG-C**, **COPY** |
| 1.9 | Erişilebilirlik Bildirimi | [ ] | **KISMİ** | Bildirim sayfası var; sistem hareket tercihi hakkındaki beyan mevcut davranışla örtüşmüyor, bağımsız WCAG testi yok. — **COPY**, **MOTION** |
| 1.10 | İletişim adresi ve destek bağlantısı | [ ] | **KISMİ** | Contact/mailto ve destek kanalı var; yayımlanan adres ile varsayılan SMTP alıcısı farklı, teslim doğrulanmadı. — **INFO**, **CONFIG**, **CONTACT** |
| 1.11 | Geliştirici / ekip profilleri | [X] | **KOD** | İki ekip profili, GitHub/LinkedIn/CV alanları ve mevcut yerel CV dosyaları var. — **ABOUT**, **INFO** |
| 1.12 | Sosyal medya bağlantıları | [Eklenmeyecek] | **KISMİ** | Site hesabı sosyal bağlantıları eklenmemiş; ekip profillerinde LinkedIn var. “Eklenmeyecek” kararı tüm sosyal linkleri kapsıyorsa çelişiyor. — **ABOUT**, **INFO** |
| 1.13 | Kaynak kod bağlantısı | [X] | **KOD** | GitHub kaynak bağlantısı mevcut; dış adresin canlı erişimi bu statik kontrolde sınanmadı. — **FTR**, **INFO** |
| 1.14 | Açık kaynak lisansı | [X] | **KOD** | LICENSE Apache-2.0 ve lisans sayfasında tam metin mevcut. — **LEGAL** |
| 1.15 | Sürüm bilgisi | [X] | **KISMİ** | Footer 1.0 gösteriyor; frontend 0.1.0, backend 0.0.1-SNAPSHOT. Sürüm kaynağı/release eşleştirmesi doğrulanmıyor. — **INFO** |
| 1.16 | Footer erişilebilirliği | [X] | **KISMİ** | Adlandırılmış nav, odak sınıfları ve yeterli footer hedefleri var; ekran okuyucu/kontrast canlı testi yapılmadı. — **FTR**, **A11Y** |
| 1.17 | İletişim formu | [ ] | **KOD** | İsim, e-posta, mesaj; şema, alan hatası ve gönderim akışı mevcut. — **CONTACT**, **CONTACT-S**, **CONTACT-B** |
| 1.18 | E-posta gönderim altyapısı | [ ] | **KISMİ** | SMTP adaptörü, MAIL_ENABLED kapısı ve sabit recipient/From var. Gerçek teslim ve sağlayıcı SPF/DKIM/DMARC yapılandırması doğrulanmadı. — **CONTACT-B**, **CONFIG**, **EMAIL** |
| 1.19 | Spam ve bot koruması | [ ] | **KISMİ** | Rate limit ve gövde sınırı var; CAPTCHA şartı varsayılmadı. Dağıtık instance/bot etkinliği ve prod limitleri ölçülmedi. — **RATE**, **SECURITY** |
| 1.20 | Gönderim sonucu bildirimi | [ ] | **KOD** | Başarı role=status, hata alert; odak ve alan sonuçları uygulanmış. — **CONTACT** |
| 1.21 | Tekrarlanan gönderim koruması | [ ] | **KISMİ** | İstemcide in-flight, sunucuda 60 saniyelik hash kilidi var; kilit process-local, çok instance ortak garanti yok. — **CONTACT**, **DUP** |
| 1.22 | Veri işleme bilgilendirmesi | [ ] | **KISMİ** | Gizlilik bağlantılı form notu var; nihai veri sorumlusu/retention/aktarım açıklaması taslak. — **CONTACT**, **COPY** |

### 2. Hukuki uyum, KVKK ve çerezler

| ID | Madde | Önceki | Sonuç | Kanıt / gerekçe ve kalan doğrulama |
|---|---|---|---|---|
| 2.1 | KVKK aydınlatma metni | [ ] | **KISMİ** | KVKK metni erişilebilir fakat nihai aydınlatma değil; taslak uyarısı açık. — **LEGAL**, **COPY** |
| 2.2 | Gizlilik politikası | [ ] | **KISMİ** | Gizlilik metni taslak; “otomatik hesap silme yok” ifadesi mevcut servisle çelişiyor. — **COPY**, **DELETE** |
| 2.3 | Kullanım koşulları | [ ] | **EKSİK** | Kullanım koşulları metni/rota/linki bulunmadı. — **INFO**, **ROUTING** |
| 2.4 | Veri sorumlusu bilgisi | [ ] | **EKSİK** | Metin veri sorumlusunun kimlik ve resmî başvuru bilgilerini kesinleştirmiyor. — **COPY** |
| 2.5 | Veri işleme amaçları ve hukuki sebepler | [ ] | **KISMİ** | Veri amaçları anlatılıyor; işleme faaliyetlerine özgü nihai hukuki sebep eşlemesi yapılmamış. — **COPY** |
| 2.6 | Veri minimizasyonu | [ ] | **KISMİ** | Contact DB yalnız teslim durumu, analytics sınırlı DTO tutuyor; tüm kişisel veri/sağlayıcı envanteri için minimizasyon kararı yok. — **CONTACT-B**, **EVENT**, **COPY** |
| 2.7 | Saklama ve imha politikası | [ ] | **EKSİK** | Nihai saklama/imha süreleri ve genel analytics temizleme işi yok; pending auth temizliği genel politika yerine geçmez. — **COPY**, **DB** |
| 2.8 | İlgili kişi başvuruları | [ ] | **KISMİ** | Hesap silme mevcut; erişim/düzeltme/export/resmî başvuru kanalı ve süre takibi tamamlanmış değil. — **DELETE**, **COPY** |
| 2.9 | Açık rıza yönetimi | [ ] | **KISMİ** | Çerez analitiği opt-in; tüm kişisel veri işleme için kayıtlı, amaç bazlı rıza ve hukuki karar tamamlanmamış. — **CONSENT**, **DIALOG-C**, **COPY** |
| 2.10 | Aydınlatma ile açık rızanın ayrılığı | [ ] | **KOD** | İletişim bilgilendirmesi ayrı; analytics tercihi ayrı yönetiliyor, zorunlu önceden işaretli rıza kutusu yok. Nihai metin onayı ayrıca gerekir. — **CONTACT**, **DIALOG-C** |
| 2.11 | Yurt dışına veri aktarımı | [ ] | **EKSİK** | Barındırma/mail/DB ülkeleri ve aktarım mekanizmaları metinde kesin değil. — **COPY** |
| 2.12 | VERBİS değerlendirmesi | [ ] | **DOĞRULAMA BEKLİYOR** | VERBİS yükümlülük/istisna değerlendirmesini kanıtlayan karar yok; işletmeciye ait bilgiler ve uzman değerlendirmesi gerekir. — **COPY** |
| 2.13 | Veri ihlali hazırlığı | [ ] | **EKSİK** | Sorumlu, bildirim süreci, süre ve iletişim zinciri içeren uygulanabilir ihlal müdahale planı bulunmadı. — **COPY**, **SEC-DOC** |
| 2.14 | Çerez envanteri | [ ] | **KISMİ** | Envanter ana auth/locale/consent anahtarlarını içeriyor; yeni MFA/reset/admin ticket cookie ve renderer/teams-view/pendingVerification depoları eksik. — **COPY**, **COOKIES**, **CONSENT-C**, **TEAMS-STORE**, **PENDING**, **RENDER** |
| 2.15 | Çerez politikası | [ ] | **KISMİ** | Politika mevcut; süreler, sağlayıcılar ve güncel anahtarlar kesinleştirilmemiş. — **COPY** |
| 2.16 | Çerez onay katmanı | [ ] | **KOD** | İlk seçim katmanı, reddet/kabul/tercih ve sürümlü kayıt mevcut. — **BANNER**, **CONSENT-C** |
| 2.17 | Ön izin kontrolü | [ ] | **KOD** | Analytics opt-in olmadan başlatılmıyor; gönderim öncesi ve asenkron CSRF sonrasında tekrar izin kontrolü var. — **ANALYTICS**, **CONSENT**, **CLIENT** |
| 2.18 | Seçimi geri alma | [ ] | **KOD** | Footer/diyalog yeniden açılıyor; red analytics kimliklerini temizliyor. Sunucu tarihsel kayıt imhası bu kontrolün kapsamı dışında eksik. — **CONSENT**, **DIALOG-C** |
| 2.19 | Çerez kategorileri | [ ] | **KOD** | Zorunlu ve analytics kategorileri ayrı; zorunlu değiştirilemiyor, analytics varsayılan kapalı. — **DIALOG-C**, **CONSENT-C** |
| 2.20 | Yanıltıcı onay tasarımından kaçınma | [ ] | **KOD** | Banner reddet/tercih/kabul düğmeleri eşit stil ve boyutta; zorlayıcı tek seçenek yok. Canlı görsel QA ayrıca gerekir. — **BANNER** |
| 2.21 | Ticari işletme bilgileri | [Eklenmeyecek] | **N/A** | Mevcut kodda satış/ödeme/ticari ürün akışı yok; site işletmecisi kimliği 2.4 kapsamında yine gerekli. Ticari hizmete dönüşürse yeniden değerlendirilir. — **MANIFEST**, **COPY** |
| 2.22 | ETBİS ve e-ticaret kontrolü | [Eklenmeyecek] | **N/A** | Ödeme/e-ticaret akışı bulunmadığından teknik ETBİS entegrasyonu bu kapsamda yok; yasal istisna kararı verilmedi. — **MANIFEST** |
| 2.23 | Mesafeli satış / ön bilgilendirme | [Eklenmeyecek] | **N/A** | Kodda mesafeli satış/ücretli sipariş sözleşmesi akışı yok. — **MANIFEST** |
| 2.24 | İade, cayma ve iptal | [Eklenmeyecek] | **N/A** | Kodda ücretli sipariş/iade işlemi yok; hizmet kapsamı değişirse uygulanır. — **MANIFEST** |
| 2.25 | Ticari elektronik ileti | [Eklenmeyecek] | **N/A** | Pazarlama/bülten gönderimi bulunmadı; doğrulama ve destek e-postası ayrı amaçlarla kullanılıyor. — **REG**, **CONTACT-B** |
| 2.26 | GDPR ve yurt dışı yükümlülükleri | [ ] | **DOĞRULAMA BEKLİYOR** | TR/EN/DE dil desteği tek başına GDPR kapsamını belirlemez; hedef pazar/işletmeci/aktarım bilgileriyle uzman değerlendirmesi gerekir. — **COPY** |
| 2.27 | Telif ve lisans kullanımı | [X] | **KISMİ** | Repo lisansı ve tam metin mevcut; tüm görsel/font/CV/üçüncü taraf varlıkların hak envanteri ayrıca doğrulanmamış. — **LEGAL**, **ROOT**, **ABOUT** |

### 3. Erişilebilirlik: herkes için kullanılabilir site

| ID | Madde | Önceki | Sonuç | Kanıt / gerekçe ve kalan doğrulama |
|---|---|---|---|---|
| 3.1 | Ekran okuyucu desteği | [ ] | **KISMİ** | Landmark, label, canlı mesaj ve skip altyapısı var; NVDA/VoiceOver ile kritik auth/admin/app akışları doğrulanmadı. — **FIELD**, **SHELL**, **A11Y** |
| 3.2 | Semantik HTML | [ ] | **KISMİ** | Public bilgi sayfaları article/nav/section/başlık kullanıyor; tüm dinamik durumlarda semantik uygunluk canlı doğrulanmadı. — **LEGAL**, **ABOUT**, **SHELL** |
| 3.3 | Alternatif görsel metni (alt text) | [ ] | **KISMİ** | Profil/görsel bileşenlerinde anlamlı alt, dekoratiflerde boş alt örnekleri var; kullanıcı içerikleri ve tüm ekranlar için tam a11y sonucu yok. — **ABOUT**, **A11Y** |
| 3.4 | Erişilebilir buton isimleri | [ ] | **KISMİ** | Ortak kontroller ve icon-only örnekler aria-label taşıyor; tüm uygulama kontrol ağacı canlı taranmadı. — **FIELD**, **BOARD**, **DIALOG** |
| 3.5 | Başlık hiyerarşisi | [ ] | **KISMİ** | Public h1/h2/h3 düzeni mevcut; tüm modal/dinamik sayfa durumlarının heading ağacı doğrulanmadı. — **LEGAL**, **ABOUT**, **A11Y** |
| 3.6 | ARIA ve canlı mesajlar | [ ] | **KISMİ** | Contact durumları, board aria-live ve hata özetleri var; gerçek AT anons sırası ve tüm akışlar doğrulanmadı. — **CONTACT**, **ERROR-F**, **BOARD** |
| 3.7 | Tablo ve grafik açıklamaları | [ ] | **KOD** | Admin grafikleri ve burndown için isim/açıklama ve veri tablosu alternatifleri mevcut. — **CHART**, **BURNDOWN** |
| 3.8 | Form etiketleri | [ ] | **KOD** | Ortak Label htmlFor/id, describedby ve hata bağları var; contact görünür alan etiketleri kullanıyor. — **FIELD**, **CONTACT** |
| 3.9 | Metin yakınlaştırma ve reflow | [ ] | **DOĞRULAMA BEKLİYOR** | Responsive kaynak/test tanımları zoom %200/%400 ve 320 CSS px reflow için güncel sonuç sağlamıyor. — **UI-AUDIT**, **UI-PUBLIC**, **UI-APP** |
| 3.10 | Renk kontrastı | [ ] | **KISMİ** | Tema tokenları ve axe kontrast kontrolü var; incomplete contrast sonuçları başarısızlığa sayılmıyor, tüm tema/ekranlar ölçülmedi. — **CSS**, **A11Y** |
| 3.11 | Bilgi yalnız renkle verilmez | [ ] | **KISMİ** | Form hataları metinli, grafik çizgilerinde alternatif stil ve tablolar var; tüm durumların renk bağımsızlığı doğrulanmadı. — **FIELD**, **CHART**, **BURNDOWN** |
| 3.12 | Video altyazıları | [ ] | **N/A** | Kodda video/track içeriği ya da video oynatıcı bulunmadı; eklendiğinde altyazı gerekir. — **ROOT** |
| 3.13 | Ses kayıtlarının dökümü | [ ] | **N/A** | Ses içeriği/oynatıcı bulunmadı; eklendiğinde döküm gerekir. — **ROOT** |
| 3.14 | Canlı yayın altyazısı | [ ] | **N/A** | Canlı ses/video yayını bulunmadı; uygulama sohbeti metin tabanlı. — **ROOT** |
| 3.15 | Sesli bildirim için görsel karşılık | [ ] | **N/A** | Sesli bildirim bulunmadı; mevcut bildirimler görsel/metinsel. Ses eklenirse eşdeğer görsel bildirim doğrulanmalı. — **SHELL** |
| 3.16 | Erişilebilir medya oynatıcı | [ ] | **N/A** | Ses/video medya oynatıcı bulunmadı. Resim/dosya eki bu koşulu tetiklemez. — **UPLOAD** |
| 3.17 | İşaret dili seçeneği | [ ] | **N/A** | İşaret dili gerektiren ses/video hizmeti mevcut kod kapsamında yok; genel muafiyet iddiası değil. — **ROOT** |
| 3.18 | Tam klavye kullanılabilirliği | [ ] | **KISMİ** | Native kontroller, klavye menü/dialog primitifi ve DnD alternatifi var; tüm kritik akışlar keyboard-only tamamlanmadı. — **DIALOG**, **BOARD**, **UI-AUDIT** |
| 3.19 | Mantıklı sekme sırası | [ ] | **DOĞRULAMA BEKLİYOR** | DOM sırasını destekleyen yapı var; tüm breakpoint ve açık overlay durumlarında tab sırası manuel doğrulanmadı. — **DIALOG**, **UI-AUDIT** |
| 3.20 | Görünür odak (focus) | [ ] | **KISMİ** | Global focus-visible ve component ring sınıfları var; tüm tema/arka planda görünürlük ölçümü yok. — **CSS**, **FIELD** |
| 3.21 | İçeriğe atla bağlantısı | [ ] | **KOD** | Public/auth/app layoutlarında ana içerik hedefli skip bağlantıları mevcut. — **PUBLIC-L**, **LANDING**, **SHELL** |
| 3.22 | Modal / dialog odak yönetimi | [ ] | **KISMİ** | Base UI Dialog odak yönetimi primitifi kullanılıyor; açılış/kapanış/Escape/trigger dönüşü canlı sınanmadı. — **DIALOG** |
| 3.23 | Klavye tuzağını önleme | [ ] | **KISMİ** | Native/Base UI tercihi riski azaltıyor; bütün modal, picker ve nested menülerde trap testi yok. — **DIALOG**, **UI-AUDIT** |
| 3.24 | Sürükle-bırak alternatifi | [ ] | **KOD** | Board kartı hareketini menü üzerinden aynı mutasyona gönderen alternatif mevcut. — **BOARD** |
| 3.25 | Yeterli tıklama hedefi | [ ] | **KISMİ** | Birçok kontrol min-h-11; audit alt sınırı 24 px ve 24–44 arası warning. Tüm hedefler/boşluklar WCAG 2.2 kriteriyle ölçülmedi; 44 px her durumda zorunlu sayılmadı. — **FIELD**, **FTR**, **UI-AUDIT** |
| 3.26 | Hover alternatifi | [ ] | **KISMİ** | Menü ve Tooltip primitive var; dokunma/klavye üzerinden tüm hover bilgisinin erişimi doğrulanmadı. — **DIALOG**, **UI-AUDIT** |
| 3.27 | Zaman sınırı kontrolü | [ ] | **KISMİ** | Oturum bitişi mesajı, OTP tekrar isteme mevcut; süre uyarısı/uzatma ve tüm zamanlı akışların erişilebilirliğine ait test yok. — **SESSION**, **REG**, **SHELL** |
| 3.28 | Tutarlı menü ve etiketler | [ ] | **KISMİ** | Ortak sidebar/footer ve çeviri anahtarları var; tüm dil/breakpoint/rol durumları karşılaştırılmadı. — **FTR**, **SHELL**, **ROUTING** |
| 3.29 | Anlaşılır mikro metin | [ ] | **KISMİ** | Yerelleştirilmiş açıklamalar ve hata metinleri mevcut; hukuki/a11y beyanlarında güncellik sorunu var, anlaşılırlık kullanıcı testi yok. — **COPY**, **FIELD** |
| 3.30 | Düzeltilebilir hata mesajları | [ ] | **KOD** | Alan yanında metin, hata özeti ve sunucu alan hatası eşlemesi mevcut. — **FIELD**, **ERROR-F**, **CONTACT** |
| 3.31 | Form verilerini koruma | [ ] | **KOD** | İncelenen formlar başarısızlıkta reset yapmıyor; contact reset yalnız başarıdan sonra. Navigasyon/sekme kapanışında kalıcı draft garanti edilmiyor. — **CONTACT**, **TASK-S** |
| 3.32 | Hareket azaltma desteği | [ ] | **KISMİ** | Açık off tercihi destekleniyor; varsayılan on ve MotionConfig never, OS reduce tercihini genel olarak devre dışı bırakıyor. — **MOTION**, **PROVIDERS**, **ROOT**, **CSS** |
| 3.33 | Yanıp sönme riskinden kaçınma | [ ] | **KISMİ** | CSS animasyonları mevcut; üçten fazla flaş/saniye ölçümü ve nöbet riski analizi yapılmadı. Bulgu doğrulanmış flaş ihlali değildir. — **CSS** |
| 3.34 | Otomatik hareketi durdurma | [ ] | **KISMİ** | Sonsuz slogan/orbit/neon hareketleri var; app ayarında off seçeneği var fakat signed-out public ekranda genel durdurma kontrolü görünmüyor. — **CSS**, **MOTION** |
| 3.35 | Erişilebilir doğrulama | [ ] | **KISMİ** | Metin OTP/şifre, yapıştırılabilir kod ve alternatif kurtarma kodları var; WCAG 3.3.8 kapsamında tüm auth akışı AT ile doğrulanmadı. — **AUTH-S**, **TOTP** |
| 3.36 | Sesli betimleme | [ ] | **N/A** | Ses/video içerik yok; sesli betimleme gerektiren akış bulunmadı. — **ROOT** |
| 3.37 | Medya alternatifleri | [ ] | **N/A** | Ses/video bulunmadı; grafiklerin metin/tablo alternatifi 3.7 içinde ayrıca kontrol edildi. — **CHART** |
| 3.38 | Otomatik ses kontrolü | [ ] | **N/A** | Otomatik oynayan ses bulunmadı. — **ROOT** |
| 3.39 | Manuel erişilebilirlik testleri | [ ] | **DOĞRULAMA BEKLİYOR** | Güncel bağımsız keyboard-only, ekran okuyucu ve zoom testi yapılmadı; public bildirim de bu doğrulamanın olmadığını belirtiyor. — **COPY**, **A11Y** |

### 4. SEO, GEO, URL ve sosyal paylaşım

| ID | Madde | Önceki | Sonuç | Kanıt / gerekçe ve kalan doğrulama |
|---|---|---|---|---|
| 4.1 | SEO / GEO yaklaşımı | [X] | **KISMİ** | Locale-aware metadata/sitemap/robots/JSON-LD/llms var; production domain ve indekslenme sonuçları yok. — **ROOT**, **SEO**, **SITEMAP**, **JSONLD**, **LLMS** |
| 4.2 | Benzersiz sayfa başlığı | [X] | **KISMİ** | 55 fiziksel page dosyasından 53 içerik sayfasında metadata helper/export var; diğer ikisi yönlendirme. Render edilmiş tüm title benzersizliği sınanmadı. — **SEO**, **ROOT**, **ROUTING** |
| 4.3 | Meta description | [X] | **KISMİ** | Localized description helper ve public açıklamalar var; her dinamik sayfanın render edilmiş description çıktısı karşılaştırılmadı. — **SEO**, **LEGAL**, **ROOT** |
| 4.4 | robots.txt | [X] | **KOD** | Robots üreticisi API ve özel locale rotalarını dışlıyor; gizlilik için ayrıca auth/noindex var. Canlı dosya erişimi ayrı doğrulama. — **ROBOTS** |
| 4.5 | sitemap.xml | [X] | **KOD** | 8 public rota × 3 dil = 24 giriş; hukuki taslaklar ve özel rotalar dahil değil. Production URL env ile doğrulanmalı. — **SITEMAP** |
| 4.6 | Canonical URL | [X] | **KISMİ** | Locale-aware canonical üretimi var; site URL yoksa localhost:3000, gerçek HTTPS domain doğrulanmadı. — **SEO**, **ROOT** |
| 4.7 | noindex / nofollow kararı | [X] | **KOD** | Private/auth ve hukuki taslak sayfalarında indeksleme politikası; pd-admin noindex header var. Robots bir erişim kontrolü olarak kullanılmıyor. — **LEGAL**, **PROXY**, **ROBOTS** |
| 4.8 | hreflang | [X] | **KOD** | TR/EN/DE eşdeğer linkler ve x-default üretimi var. — **SEO**, **ROUTING** |
| 4.9 | Structured data / JSON-LD | [X] | **KOD** | Organization/WebSite/SoftwareApplication ve breadcrumb kaynak kodu var; serialization < kaçışlı. Şema validator çalıştırılmadı. — **JSONLD** |
| 4.10 | FAQ yapılandırılmış verisi | [X] | **KOD** | FAQ görünen çeviri içeriğiyle aynı kaynaktan FAQPage üretiyor. Rich result/Google uygunluğu garanti edilmedi. — **LEGAL**, **JSONLD** |
| 4.11 | Google Search Console | [ ] | **DOĞRULAMA BEKLİYOR** | Search Console property, DNS sahiplik doğrulaması ve sitemap gönderimi erişilebilir kaynaklardan doğrulanamıyor. — **SITEMAP** |
| 4.12 | llms.txt | [X] | **KOD** | llms.txt route üretiliyor; public linkler, repo ve lisans bilgisi var. — **LLMS** |
| 4.13 | İç bağlantı kalitesi | [X] | **KISMİ** | 76 literal href örneğinin 23 farklı hedefi için 0 çözülemeyen yerel rota/asset. Dinamik href, dış URL ve rendered crawl kapsam dışı. — **ROUTING**, **INFO** |
| 4.14 | Özel sayfa gizliliği | [X] | **KOD** | Özel rota noindex + backend auth ve nesne izinleri var; kimlik bilgileri paylaşım metnine eklenmiyor. — **PROXY**, **SECURITY**, **ACCESS** |
| 4.15 | Okunabilir URL | [X] | **KOD** | İsimlendirilmiş locale rota sözlüğü ve anlamlı proje slug yolları var. — **ROUTING** |
| 4.16 | Slug standardı | [X] | **KOD** | Backend slug normalize/uzunluk/sonek, frontend segment encode kuralları mevcut. — **SLUG**, **ROUTING** |
| 4.17 | Slug benzersizliği | [X] | **KOD** | DB düzeyinde org/project slug unique kısıtları mevcut; yalnız UI varsayımı değil. — **SLUG-DB** |
| 4.18 | Türkçe karakter kuralı | [X] | **KOD** | Lowercase ROOT, ı dönüşümü, Unicode normalizasyon ve ASCII slug temizleme var. — **SLUG** |
| 4.19 | Kalıcı yönlendirme (301/308) | [X] | **KOD** | Canonical locale/harf/slash düzeltmesi proxy içinde 308 ve query korunarak yapılıyor. — **PROXY** |
| 4.20 | Geçici yönlendirme (302/307) | [X] | **KOD** | Auth/home ve eski members gibi geçici redirect çağrıları mevcut; status davranışı framework default 307. Runtime yanıt ölçülmedi. — **ROOT**, **ROUTING** |
| 4.21 | Trailing slash ve harf standardı | [X] | **KOD** | Statik rota lowercase ve slash normalize uygulanıyor; dinamik segmentler encode ediliyor. — **ROUTING**, **PROXY** |
| 4.22 | Query parametreleri | [X] | **KOD** | Canonical redirect query koruyor; unsafe next kontrol ediliyor ve özel token bazı akışlarda hash kullanıyor. — **PROXY**, **NEXT-LOGIN** |
| 4.23 | 404 ve 410 kuralları | [X] | **KISMİ** | 404 ekranı ve unknown-route kontrolü var; 410 için route/politika/test kanıtı yok. Her silinen özel nesnede 410 şartı varsayılmadı. — **ROUTING** |
| 4.24 | Yetki kontrollü özel rotalar | [X] | **KOD** | Frontend guard yönlendirme ve server authenticated + object access katmanları mevcut. — **SHELL**, **SECURITY**, **ACCESS** |
| 4.25 | Back / forward davranışı | [X] | **KISMİ** | Workspace geçmişi aynı-origin/izinli alan ve platform yetenek kontrolü kullanıyor; Chromium dışı ve tam uygulama geçmişi canlı sınanmadı. — **HISTORY**, **PLAY** |
| 4.26 | Dil değişiminde eşdeğer rota | [X] | **KOD** | Dil değişimi rota anahtarı/parametrelerle eşdeğer yola taşınıyor; admin girişi özel unprefixed davranış. — **ROUTING** |
| 4.27 | Breadcrumb | [X] | **KOD** | Public ve app breadcrumb bileşeni, public JSON-LD BreadcrumbList mevcut. — **BREAD**, **JSONLD**, **LEGAL** |
| 4.28 | og:title | [X] | **KISMİ** | Localized OG title üretimi var; rendered bütün sayfa çıktı/crawler doğrulaması yok. — **SEO**, **ROOT** |
| 4.29 | og:description | [X] | **KISMİ** | OG description kaynağı mevcut; production HTML kontrol edilmedi. — **SEO**, **ROOT** |
| 4.30 | og:image | [X] | **KOD** | Gerçek 1200×630 PNG dosyası ve metadata image tanımı var. — **SEO**, **ROOT** |
| 4.31 | og:url, og:type, og:site_name | [X] | **KISMİ** | URL/type/siteName alanları mevcut; production origin doğru değilse URL de yanlış olur. — **SEO**, **ROOT** |
| 4.32 | og:locale ve dil varyantları | [X] | **KOD** | tr_TR/en_US/de_DE ve alternateLocale tanımları mevcut. — **SEO** |
| 4.33 | X / Twitter Card metadata | [X] | **KISMİ** | Explicit twitter alanı yok; kurulu Next resolver OG title/description/images üzerinden Twitter metadata ve summary_large_image türetiyor. Render/crawler sonucu sınanmadı. — **ROOT**, **SEO**, **TW-A**, **TW-B** |
| 4.34 | Mutlak HTTPS görsel adresi | [X] | **KISMİ** | metadataBase ile mutlak URL türetilebilir; default HTTP localhost, gerçek HTTPS env/build çıktısı kanıtlanmadı. — **ROOT**, **SEO** |
| 4.35 | Görsel ölçüsü ve biçimi | [X] | **KOD** | frontend/public/images/branding/og-image.png dosya başlığı 1200×630, MIME PNG; dosya 520955 bayt. — **SEO** |
| 4.36 | Canlı paylaşım testi | [X] | **DOĞRULAMA BEKLİYOR** | Canlı production URL ve sosyal crawler/share debugger testi yapılmadı; eski X işareti bunu kanıtlamaz. — **SEO** |
| 4.37 | Özel veriyi paylaşmama | [X] | **KOD** | OG/JSON-LD kaynakları generic public ürün/başlık verisi; özel kullanıcı/task/token alanı eklenmiyor. Backend ayrıca özel erişimi denetliyor. — **SEO**, **JSONLD**, **SECURITY** |

### 5. Formlar, doğrulama ve geri bildirim

| ID | Madde | Önceki | Sonuç | Kanıt / gerekçe ve kalan doğrulama |
|---|---|---|---|---|
| 5.1 | Zorunlu alan kontrolü | [X] | **KOD** | Zod min/required ve backend Jakarta @NotBlank/@NotNull kontrolleri mevcut. — **AUTH-S**, **TASK-S**, **CONTACT-S**, **SECURITY** |
| 5.2 | Boşluk-only içerik kontrolü | [X] | **KOD** | İsim/title/comment gibi zorunlu içeriklerde trim + min; backend blank kontrolü. Parolalar kasıtlı normalize edilmiyor. — **TASK-S**, **CONTACT-S**, **AUTH-S** |
| 5.3 | E-posta / telefon / URL formatı | [X] | **KISMİ** | Email ve kurum URL doğrulaması var; mevcut kapsamda telefon alanı yok. Auth e-posta whitespace normalizasyonu form/sunucu arasında aynı değil; uç değer matrisi sınanmadı. — **AUTH-S**, **CONTACT-S** |
| 5.4 | Minimum ve maksimum uzunluk | [X] | **KOD** | Contact, görev, proje ve parola şemalarında uzunluk sınırları; sunucu request DTO/gövde sınırları var. — **CONTACT-S**, **TASK-S**, **AUTH-S**, **SECURITY** |
| 5.5 | Veri tipi ve mantık kontrolü | [X] | **KOD** | Enum/UUID, tarih sırası, dakika/puan ve ilişki kontrolleri istemci ve service katmanlarında mevcut. — **TASK-S**, **ACCESS** |
| 5.6 | Alan yanındaki hata | [X] | **KOD** | Alan altında hata ve aria-describedby bağlantısı mevcut. — **FIELD**, **CONTACT** |
| 5.7 | Erişilebilir hata anonsu | [X] | **KOD** | role=alert hata özeti, alan hatası ve canlı sonuç alanı mevcut. — **ERROR-F**, **FIELD**, **CONTACT** |
| 5.8 | Hatanın yalnız renkle ifade edilmemesi | [X] | **KOD** | Hata metni/ikon ve aria-invalid kullanılıyor; yalnız kırmızı renge dayanmıyor. — **FIELD**, **ERROR-F** |
| 5.9 | İlk hataya yönlendirme | [X] | **KOD** | Hata özeti ilk geçersiz alanı bulup odaklıyor; reduced-motion için otomatik scroll seçimi var. — **ERROR-F** |
| 5.10 | Form verisini koruma | [X] | **KOD** | Başarısız submit formu sıfırlamıyor; reset başarı sonrası. Reload sonrası draft korunması şartı bu maddeden çıkarılmadı. — **CONTACT** |
| 5.11 | Frontend ve backend doğrulaması | [X] | **KISMİ** | Zod ve backend validation birlikte var; tamamının eşdeğerlik/uç değer matrisi yeni çalıştırılmadı. Auth login email için client max sınırı backendle birebir değil. — **AUTH-S**, **CONTACT-S**, **TASK-S** |
| 5.12 | Loading state | [X] | **KOD** | isSubmitting/isPending, spinner ve disabled fieldset/button mevcut. — **CONTACT**, **FIELD** |
| 5.13 | Çift gönderim önleme | [X] | **KISMİ** | Contact in-flight ref + server duplicate kilidi; formlarda disabled/pending koruması var. Her mutasyon için server idempotency garanti edilmiyor. — **CONTACT**, **DUP** |
| 5.14 | Success state | [X] | **KOD** | Başarı mesajı ve temizleme/yönlendirme implementasyonları mevcut. — **CONTACT**, **NEXT-LOGIN** |
| 5.15 | Error state | [X] | **KOD** | ApiError alan/genel mesaj ve form alert implementasyonları mevcut. — **CONTACT**, **CLIENT**, **ERROR-F** |
| 5.16 | Bağlantı kesintisi davranışı | [X] | **KISMİ** | Network hata durumu ve veri koruma mevcut; ortak finite timeout ve tüm pending/offline yarış testleri yok. — **CLIENT**, **OFFLINE**, **CONTACT** |
| 5.17 | Silme / kritik eylem onayı | [X] | **KOD** | Delete/admin status gibi yıkıcı işlemlerde confirmation dialog akışları mevcut. — **DIALOG**, **ADMIN-U**, **DELETE** |
| 5.18 | Undo / geri alma | [Eklenmeyecek] | **N/A** | Kullanıcı checklistinde açıkça Eklenmeyecek. Bazı optimistic rollback işlemleri server hatasını düzeltir; kullanıcı Undo özelliği sayılmadı. — **TASK-S** |
| 5.19 | Hata ve sonuç testleri | [X] | **KISMİ** | Başarı/hata/validation E2E ve backend test kaynakları var; bu çalışmada taze runtime sonucu üretilmedi. — **PLAY**, **PREPUSH** |

### 6. UI/UX, responsive tasarım ve ekran durumları

| ID | Madde | Önceki | Sonuç | Kanıt / gerekçe ve kalan doğrulama |
|---|---|---|---|---|
| 6.1 | Responsive düzen | [X] | **KISMİ** | Responsive CSS/grid/drawer ve mobil viewport test kaynakları mevcut; gerçek cihaz/tüm kırılma noktaları şimdi doğrulanmadı. — **CSS**, **SHELL**, **UI-PUBLIC**, **UI-APP** |
| 6.2 | Taşma ve kırılma kontrolü | [X] | **KISMİ** | min-w-0/overflow ve audit taraması mevcut; tüm ekran/uzun içerik için güncel taşma sonucu yok. — **UI-AUDIT**, **UI-PUBLIC**, **UI-APP** |
| 6.3 | Tutarlı tasarım sistemi | [X] | **KOD** | Global semantic CSS tokenları, ortak component sistemi ve tema sağlayıcıları mevcut. — **CSS**, **PROVIDERS**, **FIELD** |
| 6.4 | Light / Dark tema | [X] | **KOD** | Light/dark token setleri ve tema düğmesi mevcut. — **CSS**, **PROVIDERS** |
| 6.5 | Tema tercihi | [X] | **KOD** | Tema storage/system tercihi, hydration kurulumu ve hesap tercihleri var. — **PROVIDERS**, **ROOT** |
| 6.6 | Favicon ve uygulama ikonları | [X] | **KOD** | favicon.ico, icon.png, apple-icon.png ve manifest 192/512 ikonları gerçekten mevcut; PNG boyutları doğrulandı. — **ROOT**, **MANIFEST** |
| 6.7 | Dokunmatik kullanılabilirlik | [X] | **KISMİ** | Responsive menü/picker ve hedef stilleri var; audit 24 px tabanını kullanıyor, touch gerçek cihaz sonucu yok. — **UI-AUDIT**, **PLAY** |
| 6.8 | Ana CTA | [X] | **KOD** | Landing kayıt/giriş CTA ve route hedefleri mevcut. — **LANDING**, **ROUTING** |
| 6.9 | Aktif menü durumu | [X] | **KOD** | Sidebar aktif path mantığı ve aria-current örnekleri mevcut. — **SHELL** |
| 6.10 | Logo ile ana sayfaya dönüş | [X] | **KOD** | Marka/logo ana sayfa linkleri ve locale-aware navigation mevcut. — **LANDING**, **ROUTING** |
| 6.11 | Breadcrumb ve site hiyerarşisi | [X] | **KOD** | Ortak app/public breadcrumb ve route hiyerarşisi mevcut. — **BREAD**, **ROUTING** |
| 6.12 | Geçişlerde başlık ve odak güncellemesi | [X] | **KISMİ** | Sayfa metadata title mevcut; ortak route-change odak yönetimi bütün sayfalarda kanıtlanmadı. Next varsayılan davranışının bozuk olduğu iddia edilmiyor. — **SHELL**, **ROOT**, **SEO** |
| 6.13 | Loading / Skeleton | [X] | **KOD** | Sorgu loading/skeleton ve AppShell oturum yükleme dalları var. — **SHELL** |
| 6.14 | Empty State | [X] | **KOD** | Görev, bildirim, admin ve liste ekranlarında metin/CTA boş durumları mevcut. — **BOARD**, **ADMIN-U** |
| 6.15 | Success State | [X] | **KOD** | Contact form ve mutasyon sonuçlarında success bildirimi mevcut. — **CONTACT** |
| 6.16 | Error State | [X] | **KOD** | Sorgu hata/yeniden dene ve error boundary sayfaları mevcut. — **SHELL**, **CLIENT** |
| 6.17 | Disabled State | [X] | **KOD** | Form pending ve erişim/işlem durumlarına bağlı disabled kontroller mevcut. — **FIELD**, **CONTACT**, **ADMIN-U** |
| 6.18 | Hover / Focus / Active State | [X] | **KOD** | Ortak button/field tokenları hover/focus/active stilleri içeriyor. — **FIELD**, **CSS** |
| 6.19 | Toast ve uyarılar | [X] | **KOD** | Toast altyapısı ve bağlantı/oturum/durum uyarıları mevcut. — **PROVIDERS**, **OFFLINE**, **SHELL** |
| 6.20 | Confirmation Dialog | [X] | **KOD** | Base UI tabanlı dialog ve kritik işlem onayları mevcut. — **DIALOG**, **ADMIN-U** |
| 6.21 | Offline ve yeniden deneme | [X] | **KISMİ** | Offline uyarısı, ağ hata ekranı, manuel/refetch reconnect mevcut; offline veri kullanımı/queue ve pending timeout garanti edilmiyor. — **OFFLINE**, **CLIENT**, **PROVIDERS** |
| 6.22 | HTTP hata ekranları | [X] | **KISMİ** | 403/404/500/503 görsel ekranları ve error mapping var; /errors/[code] yalnız preview rotası, ilgili HTTP status üretimini kanıtlamaz. Gerçek hata/production response testi yapılmadı. — **ERRORS**, **TYPES**, **CLIENT** |

### 7. Üyelik, oturum ve yetkilendirme

| ID | Madde | Önceki | Sonuç | Kanıt / gerekçe ve kalan doğrulama |
|---|---|---|---|---|
| 7.1 | Güvenli kayıt ve giriş | [X] | **KOD** | Normal kayıt pending-verification, doğrulanmış giriş ve ayrı admin MFA akışı mevcut; canlı auth sonucu iddia edilmedi. — **REG**, **LOGIN**, **ADMIN-AUTH** |
| 7.2 | Parola hashleme | [X] | **KOD** | BCrypt encode/matches kullanılıyor; raw parolanın kalıcı depolama alanı yok. — **USER** |
| 7.3 | Parola sıfırlama | [X] | **KOD** | Hashlenmiş süreli/deneme sınırlı kod, ticket tüketimi ve tüm oturumları iptal eden reset var. Mail teslimi ayrı bekleyen kontrol. — **RESET**, **SESSION** |
| 7.4 | E-posta doğrulama | [X] | **KOD** | Normal kayıt mail kodu ile aktifleşiyor; davet kaydı önceden e-posta token sahibini doğruluyor. — **REG** |
| 7.5 | Oturum süresi ve çıkış | [X] | **KOD** | JWT expiry, DB session active, refresh rotation/replay revoke, logout ve revokeAll mevcut. — **LOGIN**, **SESSION**, **COOKIES** |
| 7.6 | Güvenli cookie ayarları | [X] | **KISMİ** | Auth cookie HttpOnly/SameSite=Lax/path/lifetime; Secure APP_ENV=prod/production veya secure request ile. Gerçek production flag/proxy/cookie çıktısı doğrulanmadı. — **COOKIES**, **CONFIG** |
| 7.7 | Giriş hızı sınırı | [ ] | **KOD** | Login/refresh/admin/MFA hassas route limitleri ve 429 handling kaynakta mevcut. — **RATE** |
| 7.8 | MFA / 2FA | [X] | **KOD** | TOTP, encrypted secret, tek kullanımlık code/recovery, lockout ve admin zorunlu ikinci adım mevcut. Key/SMTP deployment ayrı kontrol. — **TOTP**, **ADMIN-AUTH** |
| 7.9 | Rol tabanlı yetkilendirme | [] | **KOD** | Rol politikası PM/CONTRIBUTOR/TESTER/union ve backend ROLE_ADMIN kontrolleri mevcut; checklistte malformed [] olsa da incelendi. — **ROLE**, **SECURITY** |
| 7.10 | Sunucu tarafı nesne yetkilendirmesi | [ ] | **KOD** | Service katmanında aktif project/member, action permission ve project-scoped nesne lookup uygulanmış; UI-only değil. Her endpoint için dinamik negatif test yeniden çalışmadı. — **ACCESS**, **ROLE** |
| 7.11 | Hesap silme ve veri talepleri | [X] | **KISMİ** | Doğrulanmış hesap silme/anonimleştirme var; tüm veri erişim/export/ilgili kişi talepleri ve retention prosedürü tamamlanmış değil. — **DELETE**, **USER**, **COPY** |
| 7.12 | Kritik değişiklikte yeniden doğrulama | [ ] | **KISMİ** | Parola/2FA/hesap silmede yeniden kanıt var; proje/team delete ve admin kullanıcı durumunda genel recent-auth/step-up kuralı görünmüyor. — **USER**, **TOTP**, **DELETE**, **ADMIN-U** |
| 7.13 | Oturum zaman aşımı mesajı | [ ] | **KOD** | Refresh sonrası 401 session-expired olayı, login reason mesajı ve admin ayrı uyarısı mevcut. — **CLIENT**, **SHELL** |
| 7.14 | Open redirect ve yetki yükseltme koruması | [ ] | **KOD** | Giriş next aynı-origin/rota allowlist ile; backend role ve admin_verified session kontrolü token role güvenine bırakılmıyor. — **NEXT-LOGIN**, **ROLE**, **SECURITY**, **ADMIN-AUTH** |

### 8. Güvenlik ve üretim altyapısı

| ID | Madde | Önceki | Sonuç | Kanıt / gerekçe ve kalan doğrulama |
|---|---|---|---|---|
| 8.1 | HTTPS ve yönlendirme | [ ] | **DOĞRULAMA BEKLİYOR** | Repo dev HTTP adresleri içeriyor; production HTTPS endpoint/reverse proxy ve HTTP→HTTPS yanıtı incelenemedi. — **CONFIG**, **DEPLOY** |
| 8.2 | Geçerli TLS ve HSTS | [ ] | **DOĞRULAMA BEKLİYOR** | Gerçek sertifika zinciri/süre/domain ve HTTPS üzerinde HSTS yanıtı doğrulanmadı. Spring varsayılan HSTS koşullu olabilir; yokluğu kesinleştirilmedi. — **SECURITY**, **DEPLOY** |
| 8.3 | Mixed Content kontrolü | [ ] | **DOĞRULAMA BEKLİYOR** | Production URL verilmedi. API/site defaults HTTP localhost; gerçek HTTPS kaynak karışıklığı render/network testi gerektiriyor. — **CLIENT**, **ROOT** |
| 8.4 | Content Security Policy (CSP) | [ ] | **EKSİK** | Uygulama sayfalarında CSP yok; next.config bunu takip işi olarak açıkça bırakıyor. Attachment sandbox CSP genel sayfa CSP yerine geçmez. — **NEXT** |
| 8.5 | Güvenlik başlıkları | [ ] | **KISMİ** | nosniff, DENY, referrer ve permissions policy frontend configde; backend Security baseline var. Prod header/HSTS/CSP birleşimi eksik doğrulama. — **NEXT**, **SECURITY** |
| 8.6 | CORS allowlist | [ ] | **KOD** | Frontend origin tekil doğrulanmış allowlist; credentials true ama wildcard yok, yöntem/header sınırlı. Prod origin ayrıca doğrulanmalı. — **SECURITY** |
| 8.7 | CSRF koruması | [ ] | **KOD** | Spring SPA CSRF, bootstrap token header ve istemci unsafe request kontrolü var; global disable yok. — **SECURITY**, **CLIENT** |
| 8.8 | XSS ve injection koruması | [ ] | **KISMİ** | React metin escaping, JSON-LD < kaçışı, allowlist DTO/JPA/parametreli sorgular var; bu bir kapsamlı exploit testi veya her sink için XSS/SQLi yokluk kanıtı değil. — **JSONLD**, **EVENT**, **SECURITY** |
| 8.9 | SSRF ve URL doğrulaması | [ ] | **KOD** | GitHub fetch sabit api.github.com/parse edilmiş repository path; kurum website http/https validate, serbest URL sunucu fetchi bulunmadı. — **GITHUB** |
| 8.10 | API rate limiting | [ ] | **KISMİ** | Auth/contact/analytics/invitation/chat seçili limitler var; genel tüm endpoint limiti yok, process-local dağıtık limit ve production değerleri doğrulanmadı. — **RATE**, **SECURITY** |
| 8.11 | Güvenli dosya yükleme | [ ] | **KISMİ** | Magic byte/MIME/boyut/piksel sınırı, UUID ve path/symlink denetimi var. EXIF strip/re-encode ve per-user kota/rate mevcut standartta ertelenmiş; saldırı fixture testi yapılmadı. — **UPLOAD**, **STORAGE**, **SEC-DOC** |
| 8.12 | Sunucu tarafı veri doğrulama | [ ] | **KOD** | Jakarta DTO doğrulama, service business constraints ve body boyut kontrolleri mevcut. — **REG**, **ACCESS**, **EVENT**, **SECURITY** |
| 8.13 | Secret ve environment yönetimi | [ ] | **KISMİ** | Git gerçek .env izlemiyor, .env.example izli; env placeholders/ignore mevcut. Gerçek secret dosyaları okunmadı; secret-store/rotation/production erişimleri doğrulanmadı. — **CONFIG**, **SEC-DOC** |
| 8.14 | Bağımlılık taraması | [ ] | **KISMİ** | Lockfile/BOM/override ve takip dokümanı var; güncel npm/Maven/secret taraması çalıştırılmadı, local gate otomatik dependency scanner içermiyor. Eski advisory sayıları güncel sonuç sayılmadı. — **PREPUSH**, **SEC-DOC** |
| 8.15 | Güvenlik güncellemeleri | [ ] | **KISMİ** | Dependency sürüm sabitleme/override mevcut; düzenli patch/SLA/owner ve fresh advisory karşılaştırma kanıtı yok. — **SEC-DOC**, **PREPUSH** |
| 8.16 | Hata izleme ve loglama | [ ] | **KISMİ** | Server log ve health endpoint var; merkezi error capture, metrik retention ve alarm kurulumu kanıtlanmadı. — **ADMIN-S**, **CONFIG** |
| 8.17 | Hassas veriyi loglamama | [ ] | **KISMİ** | İncelenen auth logları kimlik/sonuç, generic ProblemDetail kullanıyor; secret/raw token loglamıyor. Tüm prod log/collector/redaction erişimleri incelenmedi. — **LOGIN**, **SESSION**, **SEC-DOC** |
| 8.18 | Yedekleme ve geri yükleme | [ ] | **EKSİK** | PostgreSQL + org media volume için uygulanmış backup/restore job ve test kaydı yok. Dokümandaki tutarlı backup gereksinimi uygulanmış sayılmadı. — **DB**, **DEPLOY** |
| 8.19 | Olay müdahale prosedürü | [ ] | **EKSİK** | Operasyonel incident runbook, sorumlu/escalation/containment/recovery tatbikatı bulunmadı. — **SEC-DOC**, **DEPLOY** |
| 8.20 | Audit log | [ ] | **KISMİ** | Bazı kritik işlemler SLF4J kimlik/sonuç logluyor; kalıcı sorgulanabilir audit event store, retention ve admin viewer yok. — **ADMIN-AUTH**, **SESSION** |
| 8.21 | Production gizlilik kontrolleri | [ ] | **KISMİ** | API docs varsayılan kapalı, ddl-auto validate ve Flyway true. Env override ile değişebiliyor; production enforcing guard, gerçek debug/port/backup/secret davranışı doğrulanmadı. — **CONFIG**, **DEPLOY**, **NEXT** |

### 9. Admin paneli, analitik ve izleme

| ID | Madde | Önceki | Sonuç | Kanıt / gerekçe ve kalan doğrulama |
|---|---|---|---|---|
| 9.1 | Kullanıcı yönetimi | [ ] | **KOD** | Admin kullanıcı listesi, arama/sayfalama, aktif/pasif işlemleri ve backend yetki mevcut. — **ADMIN-U**, **SECURITY** |
| 9.2 | Rol ve izin yönetimi | [ ] | **KISMİ** | Proje rol/izin yönetimi mevcut; admin global rol atama/düzenleme ekranı ve endpointi mevcut panelde görünmüyor. İsteniyorsa kapsam kararı gerekir. — **ROLE**, **ADMIN-U** |
| 9.3 | Sistem ayarları | [ ] | **KISMİ** | Sistem durumu okunabiliyor; kalıcı sistem ayarı değiştirme ekranı/API bulunmadı. — **ADMIN-S** |
| 9.4 | Destek talepleri | [ ] | **KISMİ** | Contact SMTP destek kanalı var; admin ticket listesi/atanma/durum/cevap workflow yok. — **CONTACT-B**, **ADMIN-M** |
| 9.5 | Operasyon metrikleri | [ ] | **KISMİ** | Kullanıcı/contact/analytics özetleri var; infra kaynak/latency/error/saturation monitoring tam değil. — **ADMIN-M**, **ADMIN-S** |
| 9.6 | Audit log inceleme | [ ] | **EKSİK** | Audit log arama/filtre/detay admin ekranı ve kalıcı audit deposu bulunmadı. — **ADMIN-U**, **ADMIN-M** |
| 9.7 | Admin güvenliği | [ ] | **KOD** | Ayrı admin login, zorunlu TOTP, single-use ticket, DB admin_verified session, role/rate/CSRF mevcut. Prod key/deployment doğrulanmadı. — **ADMIN-AUTH**, **SECURITY**, **RATE** |
| 9.8 | Kritik işlem onayı | [ ] | **KOD** | Kullanıcı aktif/pasif değişikliği confirmation dialog ile; server auth/rol kontrolü var. Step-up eksikliği 7.12de ayrıca. — **ADMIN-U** |
| 9.9 | Admin indeksleme politikası | [ ] | **KOD** | /pd-admin header noindex ve özel admin metadata/indexing politikası var; backend API ayrıca korumalı. — **PROXY**, **SECURITY** |
| 9.10 | Sayfa görüntülenmeleri | [ ] | **KOD** | Opt-in PAGE_VIEW + session/visitor kimliği ve admin günlük/sayfa dökümü mevcut. — **ANALYTICS**, **EVENT**, **ADMIN-M** |
| 9.11 | Kullanıcı akışları | [ ] | **KISMİ** | Entry/source/page view verisi var; çok adımlı flow/funnel/session journey raporu yok. — **EVENT**, **ADMIN-M** |
| 9.12 | CTA ve dönüşüm ölçümü | [ ] | **EKSİK** | Event modeli PAGE_VIEW/ENGAGEMENT ile sınırlı; CTA click, goal/conversion/funnel event ve rapor yok. — **EVENT**, **ADMIN-M** |
| 9.13 | Hata oranları | [ ] | **EKSİK** | Başarı/başarısız API ve frontend hata oranı metriği/analiz paneli bulunmadı; health veya contact count bunun karşılığı değil. — **ADMIN-M**, **ADMIN-S** |
| 9.14 | Gizlilik odaklı ölçümleme | [ ] | **KISMİ** | Opt-in, route template, no IP/user/email kolonları ve geri alma var. UUIDlar pseudonymous; analytics retention/delete tamamlanmamış, tam anonimlik iddiası yapılmadı. — **EVENT**, **CONSENT**, **DB** |
| 9.15 | Analitik için hukuki değerlendirme | [ ] | **EKSİK** | Analytics sağlayıcı/işleme sebebi/süre/aktarım kararları hukuki taslak; nihai değerlendirme yok. — **COPY**, **DB** |

### 10. Performans ve teknik kalite

| ID | Madde | Önceki | Sonuç | Kanıt / gerekçe ve kalan doğrulama |
|---|---|---|---|---|
| 10.1 | Core Web Vitals | [ ] | **DOĞRULAMA BEKLİYOR** | LCP/INP/CLS için yeni lab/field ölçümü veya RUM sonucu alınmadı. — **UI-PUBLIC** |
| 10.2 | Lighthouse analizi | [ ] | **DOĞRULAMA BEKLİYOR** | Lighthouse raporu/puanı ve production build üzerinde yeni ölçüm yok. — **PREPUSH** |
| 10.3 | Görsel sıkıştırma ve format | [ ] | **KISMİ** | next/image static optimization ve PNG/JPEG/WebP yükleme kabulü var; upload yeniden sıkıştırma/EXIF silme yok. OG PNG ~509 KiB; genel image budget ölçülmedi. — **NEXT**, **UPLOAD** |
| 10.4 | Lazy loading | [ ] | **KISMİ** | next/image ve raw avatar lazy örnekleri var; tüm görseller ve ağır feature/modül yüklemesi ölçülmedi. — **ABOUT**, **NEXT** |
| 10.5 | Font optimizasyonu | [ ] | **KOD** | next/font Inter/Exo2/JetBrains Mono, display swap ve subset/font variable yapılandırması var; network font performansı ölçülmedi. — **ROOT** |
| 10.6 | Gereksiz kodun azaltılması | [ ] | **DOĞRULAMA BEKLİYOR** | Tree-shaking/bundle çıktısı ve dead code analizi çalıştırılmadı; gereksiz kodun azaltılmış olduğu sayı ile kanıtlanmıyor. — **PROVIDERS** |
| 10.7 | Code splitting | [ ] | **KISMİ** | App Router route splitting kullanılıyor; explicit next/dynamic/React.lazy bulunmadı, global provider yükü ve ağır ekran chunk analizi yok. — **PROVIDERS**, **ROOT** |
| 10.8 | Cache stratejisi | [ ] | **KISMİ** | React Query staleTime/invalidation ve static asset framework cache var; hassas medya auth/cache politikaları mevcut. CDN/HTTP/production caching ölçülmedi. — **PROVIDERS**, **STORAGE** |
| 10.9 | Yavaş ağ testleri | [ ] | **DOĞRULAMA BEKLİYOR** | Slow 3G/latency/loss ve offline-midflight runtime testleri yeni çalıştırılmadı. — **PLAY**, **CLIENT** |
| 10.10 | Bundle boyutu takibi | [ ] | **EKSİK** | Bundle boyutu budget/CI takibi veya düzenli bundle analyzer çıktısı bulunmadı. — **PREPUSH** |
| 10.11 | API timeout / retry | [ ] | **KISMİ** | 401 refresh/CSRF 403 için bir defalık retry ve GitHub backend timeout var. Ortak frontend fetch finite timeout yok, Query retry=false. — **CLIENT**, **PROVIDERS**, **GITHUB** |
| 10.12 | Responsive görseller | [ ] | **KISMİ** | next/image profil/static responsive boyutları var; raw avatar/medya görsellerinde tümü için srcset/sizes yok, viewport çıktısı ölçülmedi. — **ABOUT**, **NEXT** |
| 10.13 | Kaynak haritası ve debug yönetimi | [ ] | **KISMİ** | productionBrowserSourceMaps etkinleştirilmemiş, debug error route dev-gated. Gerçek production bundle/log/artifact sızıntısı denetlenmedi. — **NEXT**, **CONFIG** |

### 11. Çoklu dil, PWA ve platform özellikleri

| ID | Madde | Önceki | Sonuç | Kanıt / gerekçe ve kalan doğrulama |
|---|---|---|---|---|
| 11.1 | Dil bazlı routing | [ ] | **KOD** | TR/EN/DE named routing/proxy rewrite ve locale switch mevcut. — **ROUTING**, **PROXY** |
| 11.2 | Doğru html lang | [ ] | **KOD** | Root layout resolve edilen locale ile html lang ayarlıyor. — **ROOT**, **I18N** |
| 11.3 | Hreflang ve dil eşdeğerliği | [ ] | **KOD** | Locale alternates/x-default ve eşdeğer rota üretimi mevcut. — **SEO**, **ROUTING** |
| 11.4 | Yerel tarih / sayı biçimi | [ ] | **KOD** | Tarih picker/admin/görev/chat formatlarında locale-aware Intl ve sayı/unit formatı var. — **CHART**, **ADMIN-M** |
| 11.5 | Eksik çeviri fallback | [ ] | **KISMİ** | Locale seçimi defaulta düşüyor; eksik mesaj anahtarı için TR fallback merge/getMessageFallback yok. EN messages 27 kullanılmayan eski squads.membersPage anahtarını eksik taşıyor; aktif UI kırığı kanıtlanmadı. — **I18N**, **ROUTING** |
| 11.6 | Form ve hata çevirileri | [ ] | **KISMİ** | Validation/api hata çevirileri ve landing/errors üç dilde anahtar eşitliği var. EN genel mesaj dosyasında legacy namespace sapması; aktif kullanım bulunmadı. — **AUTH-S**, **I18N** |
| 11.7 | Dil bazlı metadata / OG | [ ] | **KOD** | Locale-aware title/description/OG locale ve alternate locale mevcut. — **SEO**, **LEGAL** |
| 11.8 | Web App Manifest | [ ] | **KOD** | standalone start_url/name/theme/background/icons manifest üretimi var. Installability/offline tüm şartları bu maddeyle tamamlanmış sayılmadı. — **MANIFEST** |
| 11.9 | Uygulama ikonları | [ ] | **KOD** | 192/512 PNG gerçek boyutları doğrulandı; apple-icon/icon/favicon da var. Maskable/pwa kurulum testi yok. — **MANIFEST**, **ROOT** |
| 11.10 | Service Worker | [ ] | **EKSİK** | Service worker dosyası/registration/workbox kullanımı yok. PWA isteğe bağlı; bu eksik tek başına yayın engeli değildir. — **MANIFEST** |
| 11.11 | Offline senaryosu | [ ] | **KISMİ** | Ağ offline mesajı var; cached offline shell/data ve offline submission kuyruğu yok. PWA offline davranışı uygulanmamış. — **OFFLINE**, **MANIFEST** |
| 11.12 | Cache sürümü güncelleme | [ ] | **EKSİK** | Service worker cache version/activate temizleme stratejisi yok. İsteğe bağlı PWA tamamlandı denemez. — **MANIFEST** |

### 12. Test, yayın ve yayın sonrası takip

| ID | Madde | Önceki | Sonuç | Kanıt / gerekçe ve kalan doğrulama |
|---|---|---|---|---|
| 12.1 | Unit test | [ ] | **KISMİ** | Backend unit test kaynakları mevcut; current working tree için yeniden çalıştırılmış PASS yok. Backend toplam 103 *Test.java, hepsi unit sayılmadı. — **ROLE**, **PREPUSH** |
| 12.2 | Integration test | [ ] | **KISMİ** | PostgreSQL/Testcontainers HTTP/service/migration integration test kaynakları mevcut; yeni test sonucu yok. — **PREPUSH**, **DB** |
| 12.3 | E2E test | [ ] | **KISMİ** | 113 frontend *.spec.ts ve Playwright setup var; taze E2E sonucu yok. Bazı mail senaryoları eski Mailpit sinkine bağımlı. — **PLAY**, **MAILPIT** |
| 12.4 | Tarayıcı uyumluluğu | [ ] | **KISMİ** | Playwright yalnız Chromium projesi. Firefox/WebKit/Edge/Safari güncel karşılaştırmalı sonuç yok. — **PLAY** |
| 12.5 | Gerçek mobil test | [ ] | **DOĞRULAMA BEKLİYOR** | Emulated viewport testleri gerçek iOS Safari/Android cihaz kanıtı sağlamıyor; gerçek cihaz testi yapılmadı. — **PLAY**, **UI-PUBLIC**, **UI-APP** |
| 12.6 | Klavye ve ekran okuyucu testi | [ ] | **KISMİ** | Keyboard sweep/focus yardımcısı var; NVDA/VoiceOver ve bütün kritik akış keyboard-only sonucu yok. — **UI-AUDIT**, **A11Y** |
| 12.7 | Otomatik erişilebilirlik analizi | [ ] | **KISMİ** | Axe 10 public rota × 3 locale × 2 tema × 2 viewport tanımlı. Contact/cookies/private/admin/yeni auth kapsamı eksik; incomplete contrast fail değil; yeni koşum yok. — **A11Y** |
| 12.8 | Kırık bağlantı kontrolü | [ ] | **KISMİ** | Bu audit 76 literal href/23 hedef için 0 unresolved yerel hedef buldu; rendered/dynamic/external crawl yapılmadı. — **ROUTING**, **INFO** |
| 12.9 | SEO / paylaşım testi | [ ] | **KISMİ** | SEO/route/JSON-LD test kaynakları ve metadata statik kontrolü var; production HTML/share crawler/Search Console sonuçları yok. — **SEO**, **PLAY** |
| 12.10 | Production ortam değişkenleri | [ ] | **KISMİ** | Env örnekleri ve guards var; gerçek env okunmadı. Site URL, APP_ENV, FRONTEND_URL, docs/DDL/Flyway, mail/TOTP prod değerleri ve image build aktarımı doğrulanmadı. — **CONFIG**, **ROOT**, **DEPLOY** |
| 12.11 | CI/CD pipeline | [ ] | **EKSİK** | .github/workflows altında CI/CD workflow yok; pre-push.ps1 yerel test gatei, otomatik pipeline değil. — **PREPUSH** |
| 12.12 | Monitoring ve alarm | [ ] | **KISMİ** | Health/system state kaynağı var; uptime/error/performance alarm hedefi ve bildirim kurulumu yok. — **ADMIN-S**, **CONFIG** |
| 12.13 | Sertifika ve domain yenileme | [ ] | **DOĞRULAMA BEKLİYOR** | Canlı sertifika/domain hesabı ve yenileme job/uyarı kanıtı yok. — **DEPLOY** |
| 12.14 | Deployment sonrası smoke test | [ ] | **DOĞRULAMA BEKLİYOR** | Production deploy yapılmadı/URL verilmedi; canlı login/contact/metadata/health smoke testi sonucu yok. — **DEPLOY** |
| 12.15 | Rollback stratejisi | [ ] | **KISMİ** | Dokümanda rollback uyarıları var, ancak image version pin/uygulanmış restore/DB uyum tatbikatı yok. SIMPLE görevlerde eski backend davranışı güvenli değil. — **DB**, **DEPLOY** |
| 12.16 | Veritabanı migration planı | [ ] | **KISMİ** | 56 tekil Flyway SQL migration (duplicate version yok), ddl validate varsayılanı ve migration testleri var. Prod migration uygulama/backup/upgrade sonucu yeni doğrulanmadı. — **CONFIG**, **DB** |
| 12.17 | Bakım ve güncelleme planı | [ ] | **KISMİ** | Repo güncelleme/güvenlik/pre-push yönergeleri var; sahibi, periyodu, alarm/SLA ve işletim takvimi içeren uygulanmış bakım planı kanıtlanmadı. — **SEC-DOC**, **DEPLOY**, **PREPUSH** |

## Kanıt dosyaları

Satır numaraları bu çalışma ağacına aittir; kaynak daha sonra değişirse kayabilir. Bir dosya bağlantısı testin çalıştırıldığını göstermez. Yokluk sonuçları ilgili source/config envanter taramasıyla birlikte verildi.

| Kod | Kaynak | İlgili başlangıç satırı / kanıt |
|---|---|---|
| **FTR** | [frontend/src/components/layout/site-footer.tsx](<../../frontend/src/components/layout/site-footer.tsx#L19>) | 19: Ortak footer |
| **INFO** | [frontend/src/features/public-info/site-info.ts](<../../frontend/src/features/public-info/site-info.ts#L3>) | 3: Footer bağlantıları, ekip ve sürüm sabitleri |
| **ABOUT** | [frontend/src/features/public-info/about-page.tsx](<../../frontend/src/features/public-info/about-page.tsx#L17>) | 17: Ekip profilleri |
| **LEGAL** | [frontend/src/features/public-info/info-page.tsx](<../../frontend/src/features/public-info/info-page.tsx#L1>) | 1: Bilgi sayfaları ve hukuki taslak gösterimi |
| **COPY** | [frontend/src/i18n/messages/tr.json](<../../frontend/src/i18n/messages/tr.json#L2606>) | 2606: Hukuki ve kurumsal metinler |
| **CONTACT** | [frontend/src/features/contact/contact-form.tsx](<../../frontend/src/features/contact/contact-form.tsx#L28>) | 28: İletişim formu |
| **CONTACT-S** | [frontend/src/features/contact/schemas.ts](<../../frontend/src/features/contact/schemas.ts#L6>) | 6: İletişim şeması |
| **CONTACT-B** | [backend/src/main/java/com/pda/contact/application/service/ContactService.java](<../../backend/src/main/java/com/pda/contact/application/service/ContactService.java#L18>) | 18: İletişim hizmeti |
| **DUP** | [backend/src/main/java/com/pda/contact/application/service/ContactDuplicateGuard.java](<../../backend/src/main/java/com/pda/contact/application/service/ContactDuplicateGuard.java#L21>) | 21: Tekrarlı iletişim gönderimi kilidi |
| **CONSENT** | [frontend/src/features/consent/consent-store.ts](<../../frontend/src/features/consent/consent-store.ts#L1>) | 1: Çerez tercih deposu |
| **BANNER** | [frontend/src/features/consent/cookie-banner.tsx](<../../frontend/src/features/consent/cookie-banner.tsx#L13>) | 13: Eşit çerez seçimleri |
| **DIALOG-C** | [frontend/src/features/consent/consent-dialog.tsx](<../../frontend/src/features/consent/consent-dialog.tsx#L96>) | 96: Çerez kategorileri ve geri alma |
| **CONSENT-C** | [frontend/src/features/consent/contract.ts](<../../frontend/src/features/consent/contract.ts#L7>) | 7: Çerez ve analitik anahtarları |
| **ANALYTICS** | [frontend/src/features/analytics/tracker.tsx](<../../frontend/src/features/analytics/tracker.tsx#L86>) | 86: Sayfa ve etkileşim takibi |
| **EVENT** | [backend/src/main/java/com/pda/analytics/api/dto/request/AnalyticsEventRequest.java](<../../backend/src/main/java/com/pda/analytics/api/dto/request/AnalyticsEventRequest.java#L20>) | 20: Sınırlı analitik verisi |
| **FIELD** | [frontend/src/components/common/form-field.tsx](<../../frontend/src/components/common/form-field.tsx#L22>) | 22: Alan etiketleri ve hata bağlantıları |
| **ERROR-F** | [frontend/src/components/common/form-error-summary.tsx](<../../frontend/src/components/common/form-error-summary.tsx#L23>) | 23: Hata özeti ve ilk hataya odak |
| **DIALOG** | [frontend/src/components/ui/dialog.tsx](<../../frontend/src/components/ui/dialog.tsx#L4>) | 4: Dialog odak ve klavye primitifi |
| **CHART** | [frontend/src/features/admin/components/charts.tsx](<../../frontend/src/features/admin/components/charts.tsx#L6>) | 6: Grafik ve erişilebilir veri tablosu |
| **BURNDOWN** | [frontend/src/features/sprints/components/burndown-chart.tsx](<../../frontend/src/features/sprints/components/burndown-chart.tsx#L9>) | 9: Sprint grafik alternatifi |
| **BOARD** | [frontend/src/features/tasks/components/board-card.tsx](<../../frontend/src/features/tasks/components/board-card.tsx#L54>) | 54: Sürüklemeye alternatif menü |
| **MOTION** | [frontend/src/lib/preferences/motion.ts](<../../frontend/src/lib/preferences/motion.ts#L13>) | 13: Varsayılan hareket tercihi |
| **CSS** | [frontend/src/app/globals.css](<../../frontend/src/app/globals.css#L292>) | 292: Global token, odak ve animasyon kuralları |
| **PROVIDERS** | [frontend/src/components/providers.tsx](<../../frontend/src/components/providers.tsx#L5>) | 5: Tema, hareket, sorgu ve global sağlayıcılar |
| **A11Y** | [frontend/e2e/a11y-public.spec.ts](<../../frontend/e2e/a11y-public.spec.ts#L4>) | 4: Otomatik a11y kapsamı |
| **UI-AUDIT** | [frontend/e2e/ui-audit.ts](<../../frontend/e2e/ui-audit.ts#L10>) | 10: Taşma, hedef ve odak tarama yardımcısı |
| **UI-PUBLIC** | [frontend/e2e/ui-ux-public.spec.ts](<../../frontend/e2e/ui-ux-public.spec.ts#L32>) | 32: Public responsive test tanımları |
| **UI-APP** | [frontend/e2e/ui-ux-app.spec.ts](<../../frontend/e2e/ui-ux-app.spec.ts#L56>) | 56: Uygulama responsive test tanımları |
| **ROOT** | [frontend/src/app/layout.tsx](<../../frontend/src/app/layout.tsx#L38>) | 38: Metadata, dil, font ve hareket varsayılanı |
| **SEO** | [frontend/src/lib/seo/alternates.ts](<../../frontend/src/lib/seo/alternates.ts#L5>) | 5: Canonical, hreflang ve OG üretimi |
| **ROBOTS** | [frontend/src/app/robots.ts](<../../frontend/src/app/robots.ts#L6>) | 6: Robots kuralları |
| **SITEMAP** | [frontend/src/app/sitemap.ts](<../../frontend/src/app/sitemap.ts#L6>) | 6: Public sitemap |
| **LLMS** | [frontend/src/app/llms.txt/route.ts](<../../frontend/src/app/llms.txt/route.ts#L18>) | 18: LLM keşif metni |
| **JSONLD** | [frontend/src/lib/seo/json-ld.tsx](<../../frontend/src/lib/seo/json-ld.tsx#L15>) | 15: JSON-LD |
| **PROXY** | [frontend/src/proxy.ts](<../../frontend/src/proxy.ts#L48>) | 48: Locale rewrite, yönlendirme ve noindex |
| **ROUTING** | [frontend/src/i18n/routing.ts](<../../frontend/src/i18n/routing.ts#L4>) | 4: Yerelleştirilmiş rota sözlüğü |
| **SLUG** | [backend/src/main/java/com/pda/project/application/service/SlugGenerator.java](<../../backend/src/main/java/com/pda/project/application/service/SlugGenerator.java#L7>) | 7: Slug üretimi |
| **SLUG-DB** | [backend/src/main/resources/db/migration/V21__project_organization_initial.sql](<../../backend/src/main/resources/db/migration/V21__project_organization_initial.sql#L11>) | 11: Proje ve kurum slug benzersizliği |
| **HISTORY** | [frontend/src/components/layout/workspace-history.ts](<../../frontend/src/components/layout/workspace-history.ts#L3>) | 3: Kapsamlı geçmiş gezinmesi |
| **BREAD** | [frontend/src/components/layout/app-breadcrumb.tsx](<../../frontend/src/components/layout/app-breadcrumb.tsx#L16>) | 16: Uygulama breadcrumb |
| **AUTH-S** | [frontend/src/features/auth/schemas.ts](<../../frontend/src/features/auth/schemas.ts#L26>) | 26: Kimlik form şemaları |
| **TASK-S** | [frontend/src/features/tasks/schemas.ts](<../../frontend/src/features/tasks/schemas.ts#L21>) | 21: Görev formu ve mantık sınırları |
| **OFFLINE** | [frontend/src/components/layout/offline-notice.tsx](<../../frontend/src/components/layout/offline-notice.tsx#L8>) | 8: Çevrimdışı uyarısı |
| **CLIENT** | [frontend/src/lib/api/client.ts](<../../frontend/src/lib/api/client.ts#L1>) | 1: CSRF, refresh, ağ hatası ve istek denetimi |
| **SHELL** | [frontend/src/components/layout/app-shell.tsx](<../../frontend/src/components/layout/app-shell.tsx#L47>) | 47: Oturum, odak hedefi ve uygulama durumları |
| **NEXT** | [frontend/next.config.ts](<../../frontend/next.config.ts#L8>) | 8: Tarayıcı güvenlik başlıkları |
| **SECURITY** | [backend/src/main/java/com/pda/auth/infrastructure/config/SecurityBaselineConfiguration.java](<../../backend/src/main/java/com/pda/auth/infrastructure/config/SecurityBaselineConfiguration.java#L35>) | 35: Spring Security, CORS, CSRF ve endpoint politikası |
| **COOKIES** | [backend/src/main/java/com/pda/auth/infrastructure/config/AuthCookies.java](<../../backend/src/main/java/com/pda/auth/infrastructure/config/AuthCookies.java#L17>) | 17: Cookie üretimi |
| **RATE** | [backend/src/main/java/com/pda/auth/infrastructure/config/AuthRateLimitFilter.java](<../../backend/src/main/java/com/pda/auth/infrastructure/config/AuthRateLimitFilter.java#L1>) | 1: Giriş ve hassas endpoint rate limit |
| **LOGIN** | [backend/src/main/java/com/pda/auth/application/service/LocalLoginService.java](<../../backend/src/main/java/com/pda/auth/application/service/LocalLoginService.java#L13>) | 13: Giriş, refresh ve çıkış |
| **RESET** | [backend/src/main/java/com/pda/auth/application/service/PasswordResetService.java](<../../backend/src/main/java/com/pda/auth/application/service/PasswordResetService.java#L25>) | 25: Parola sıfırlama |
| **REG** | [backend/src/main/java/com/pda/auth/application/service/RegistrationWorkflow.java](<../../backend/src/main/java/com/pda/auth/application/service/RegistrationWorkflow.java#L19>) | 19: Kayıt ve e-posta doğrulama |
| **USER** | [backend/src/main/java/com/pda/user/application/service/UserAccountService.java](<../../backend/src/main/java/com/pda/user/application/service/UserAccountService.java#L31>) | 31: BCrypt ve hesap anonimleştirme |
| **SESSION** | [backend/src/main/java/com/pda/user/application/service/UserSessionService.java](<../../backend/src/main/java/com/pda/user/application/service/UserSessionService.java#L16>) | 16: Oturum iptali ve refresh tekrar kullanımı |
| **TOTP** | [backend/src/main/java/com/pda/auth/application/service/TotpService.java](<../../backend/src/main/java/com/pda/auth/application/service/TotpService.java#L24>) | 24: 2FA ve tek kullanımlık kurtarma |
| **ADMIN-AUTH** | [backend/src/main/java/com/pda/auth/application/service/AdminAuthService.java](<../../backend/src/main/java/com/pda/auth/application/service/AdminAuthService.java#L29>) | 29: Zorunlu admin MFA |
| **DELETE** | [backend/src/main/java/com/pda/auth/application/service/AccountDeletionService.java](<../../backend/src/main/java/com/pda/auth/application/service/AccountDeletionService.java#L33>) | 33: Hesap silme doğrulaması |
| **ROLE** | [backend/src/main/java/com/pda/user/RolePolicy.java](<../../backend/src/main/java/com/pda/user/RolePolicy.java#L14>) | 14: Proje rol politikası |
| **ACCESS** | [backend/src/main/java/com/pda/project/application/service/ProjectAccessService.java](<../../backend/src/main/java/com/pda/project/application/service/ProjectAccessService.java#L32>) | 32: Sunucu proje/nesne erişimi |
| **NEXT-LOGIN** | [frontend/src/features/auth/components/use-complete-login.ts](<../../frontend/src/features/auth/components/use-complete-login.ts#L21>) | 21: Güvenli giriş dönüş adresi |
| **UPLOAD** | [backend/src/main/java/com/pda/shared/ImageSniffer.java](<../../backend/src/main/java/com/pda/shared/ImageSniffer.java#L12>) | 12: Resim içerik ve boyut doğrulaması |
| **STORAGE** | [backend/src/main/java/com/pda/shared/FileSystemMediaStorage.java](<../../backend/src/main/java/com/pda/shared/FileSystemMediaStorage.java#L10>) | 10: UUID tabanlı güvenli media yolu |
| **GITHUB** | [backend/src/main/java/com/pda/project/infrastructure/github/GitHubRestRepositoryClient.java](<../../backend/src/main/java/com/pda/project/infrastructure/github/GitHubRestRepositoryClient.java#L31>) | 31: Sabit GitHub host ve timeout |
| **ADMIN-U** | [frontend/src/features/admin/components/users-page.tsx](<../../frontend/src/features/admin/components/users-page.tsx#L38>) | 38: Admin kullanıcı yönetimi |
| **ADMIN-M** | [frontend/src/features/admin/components/analytics-page.tsx](<../../frontend/src/features/admin/components/analytics-page.tsx#L42>) | 42: Admin analitik ve operasyon özetleri |
| **ADMIN-S** | [backend/src/main/java/com/pda/admin/application/service/SystemStatusService.java](<../../backend/src/main/java/com/pda/admin/application/service/SystemStatusService.java#L9>) | 9: Sadece okunabilir sistem durumu |
| **MANIFEST** | [frontend/src/app/manifest.ts](<../../frontend/src/app/manifest.ts#L4>) | 4: Manifest |
| **I18N** | [frontend/src/i18n/request.ts](<../../frontend/src/i18n/request.ts#L20>) | 20: Locale ve mesaj yüklemesi |
| **PLAY** | [frontend/playwright.config.ts](<../../frontend/playwright.config.ts#L21>) | 21: Chromium test konfigürasyonu |
| **MAILPIT** | [frontend/e2e/mailpit.ts](<../../frontend/e2e/mailpit.ts#L5>) | 5: Mailpit test bağımlılığı |
| **CONFIG** | [backend/src/main/resources/application.properties](<../../backend/src/main/resources/application.properties#L4>) | 4: Backend ortam, mail, Flyway ve docs varsayılanları |
| **PREPUSH** | [pre-push/pre-push.ps1](<../../pre-push/pre-push.ps1#L1>) | 1: Yerel gate, CI yerine geçmez |
| **DEPLOY** | [.agents/deployment.md](<../../.agents/deployment.md#L1>) | 1: Dağıtım kararı ve eksikler |
| **DB** | [.agents/database.md](<../../.agents/database.md#L73>) | 73: Migration/rollback standardı |
| **SEC-DOC** | [.agents/SECURITY.md](<../../.agents/SECURITY.md#L1>) | 1: Repo güvenlik standardı ve ertelenen kontroller |
| **PUBLIC-L** | [frontend/src/app/(public)/layout.tsx](<../../frontend/src/app/(public)/layout.tsx#L20>) | 20: Public skip link ve main |
| **LANDING** | [frontend/src/features/landing/landing-page.tsx](<../../frontend/src/features/landing/landing-page.tsx#L19>) | 19: Landing CTA, skip ve footer |
| **ERRORS** | [frontend/src/app/errors/[code]/page.tsx](<../../frontend/src/app/errors/[code]/page.tsx#L18>) | 18: Görsel hata önizleme rotaları |
| **TYPES** | [frontend/src/features/errors/types.ts](<../../frontend/src/features/errors/types.ts#L3>) | 3: Desteklenen HTTP hata görselleri |
| **EMAIL** | [backend/src/main/java/com/pda/contact/infrastructure/mail/SmtpContactMailAdapter.java](<../../backend/src/main/java/com/pda/contact/infrastructure/mail/SmtpContactMailAdapter.java#L29>) | 29: Sabit SMTP alıcı/From ve ReplyTo |
| **TEAMS-STORE** | [frontend/src/features/squads/components/teams-page.tsx](<../../frontend/src/features/squads/components/teams-page.tsx#L29>) | 29: Yeni kullanıcıya özgü team view key |
| **PENDING** | [frontend/src/features/auth/components/pending-verification.ts](<../../frontend/src/features/auth/components/pending-verification.ts#L6>) | 6: Geçici verification e-postası deposu |
| **RENDER** | [frontend/src/lib/rendering.ts](<../../frontend/src/lib/rendering.ts#L11>) | 11: Renderer tercihi |
| **TW-A** | [frontend/node_modules/next/dist/lib/metadata/resolve-metadata.js](<../../frontend/node_modules/next/dist/lib/metadata/resolve-metadata.js#L619>) | 619: Kurulu Next: OG üzerinden Twitter türetimi (Git kaynağı değil, yerel dependency) |
| **TW-B** | [frontend/node_modules/next/dist/lib/metadata/resolvers/resolve-opengraph.js](<../../frontend/node_modules/next/dist/lib/metadata/resolvers/resolve-opengraph.js#L175>) | 175: Kurulu Next: image varsa summary_large_image (yerel dependency) |

## Sonraki doğrulama ve manuel kontrol planı

1. İşletmeci kimliği, hedef pazar, mail/hosting/DB sağlayıcıları ve veri ülkeleriyle nihai KVKK/privacy/terms/retention/aktarım/başvuru kararlarını alın. Raporda yasal zorunluluk veya istisna hükmü verilmedi. Hukuki taslak ve gerçek davranış arasındaki silme/hareket/envanter farklarını inceleyin.
2. Dış ağ kapalı, izole loopback, temiz allowlist env, dummy kullanıcı/secret, salt okunur kaynak/toolchain ve scratch-only yazma/resource limitleri olan ayrı ortam kurun. Mailpit veya eşdeğer SMTP sinki yalnız bu izole ortamda backend mail portuna bağlayın. Gerçek SMTP/production hesaplarıyla test çalıştırmayın.
3. Bu ortamda mevcut backend test/integration/migration, frontend lint/typecheck/build ve Playwright gateini güncel source ref için çalıştırıp sonuç alın. Önce gatein mail sink/runtime beklentilerini doğrulayın; bu rapor mevcut gatein başarılı olduğu iddiasını taşımaz. Chromium yanında desteklenen Firefox/WebKit/Edge ve gerçek iOS/Android kritik akışları değerlendirin.
4. Public **ve authenticated/admin** login/register/verification/reset/2FA/delete/contact/cookie tercih/task board akışlarında klavye, focus return, NVDA/VoiceOver, %200/%400 zoom, dar ekran ve bütün temalarda kontrast kontrol edin. OS reduce ve uygulama off tercihlerini ayrı deneyin; hareketi durdurmanın signed-out kullanımını gözden geçirin.
5. Production domainle canonical/hreflang/robots/sitemap/JSON-LD/OG/Twitter çıktısını, gerçek status code ve sosyal önizlemeyi doğrulayın. /errors/503 görseli görmek gerçek HTTP 503 alındığı anlamına gelmez. TLS/HTTP redirect/HSTS/CSP/CORS/cookie Secure ve API docs/DDL/Flyway/env değerlerini gerçek deploymentta kontrol edin. Search Console işlemi hesap sahipliği gerektirir.
6. CWV/Lighthouse, cold/warm cache, yavaş ağ/midflight offline, timeout/retry ve bundle/image bütçesini production build üzerinde ölçün. İsteğe bağlı PWA için service worker/offline/cache sürümünü ürün kapsamına alıp almayacağınızı belirleyin.
7. Backup+media restore, rollback+schema uyumu, monitoring alarmı ve incident tatbikatını uygulayın; kanıtlarını yeni teslim/operasyon kaydına ekleyin. Bir belge önerisi uygulamayı tamamlanmış yapmaz.

## Değişiklik sınırı

Denetim başlangıcında mevcut kullanıcı değişiklikleri: `.claude/settings.json` değiştirilmiş, `.gitleaksignore` untracked. Bunlara dokunulmadı. Bu görev yalnız `docs/reports/2026-10-10-web-sitesi-master-checklist-denetimi.md` ve `docs/compliation/2026-10-10-web-checklist-denetimi.md` dokümantasyonunu ekler. Kaynak/config/checklist hash ve git çalışma ağacı kontrolü teslim kaydında belirtilir.


Teslim öncesi bütünlük kontrolü: İncelemede okunan **1408 metin dosyası** SHA-256 karşılaştırmasında değişmemiştir. İstenen checklist hashı aynıdır. Rapor **258 tekil madde IDsini** özgün sıra ile içerir; eksik/tekrarlı ID veya çözülemeyen kanıt dosyası yoktur. Bu kontrol runtime test değildir.
