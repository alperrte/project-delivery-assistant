# Artı Öneriler (Checklist Dışı)

> Tarih: 2026-10-08
> Bu öneriler `SECURITY.md` ve `WEB_SITE_MASTER_CHECKLIST_TR.md` içinde **yazmıyor**. Yapılırsa site daha güvenli, daha düzenli ve daha profesyonel olur.
> Checklist'teki eksikler (CSP, HSTS, Kullanım Koşulları vb.) için ilgili rapor dosyalarına bak; burada tekrar etmedim.
> Efor tahmini: **S** = bir iki saat · **M** = yarım ila bir gün · **L** = birkaç gün.

## Güvenlik

| Öncelik | Alan | Öneri | Neden | Tahmini efor |
| --- | --- | --- | --- | --- |
| Yüksek | CI | `.github/workflows/` altına build + test + lint + `npm audit` çalıştıran bir iş akışı ekle | `pre-push` kuralı şu an sadece insan disipliniyle çalışıyor; kimse unutursa hiçbir şey durdurmuyor | M |
| Yüksek | Bağımlılık | `.github/dependabot.yml` ekle (npm, Maven, Docker, GitHub Actions) | Next.js açıkları gibi sorunlar otomatik PR olarak gelir | S |
| Yüksek | Konteyner | Backend ve frontend imajlarında root olmayan kullanıcı (`USER`) kullan | Konteynerden çıkan açık doğrudan root yetkisi vermez | S |
| Yüksek | Zafiyet bildirimi | Kök dizine `SECURITY.md` ve `public/.well-known/security.txt` ekle | Araştırmacılar nereye yazacağını bilir; issue şablonundaki kırık referans kapanır | S |
| Orta | Gizli değer taraması | Pre-push kapısına `gitleaks` benzeri bir tarama ekle | Yanlışlıkla commit edilen anahtarı push'tan önce yakalar | S |
| Orta | Konteyner | Docker imaj taraması (Trivy) ve imaj etiketlerini digest ile sabitle | Alt imajdaki açıkları ve sessiz imaj değişimini yakalar | M |
| Orta | Maven bağımlılıkları | OWASP Dependency-Check veya benzeri tarama | Şu an yalnız npm tarafı taranıyor, Java tarafı hiç taranmıyor | M |
| Orta | Hesap güvenliği | İki adımlı doğrulama (TOTP) | Çalınan parola tek başına hesabı açmasın | L |
| Orta | Hesap güvenliği | Başarısız girişte hesap bazlı geçici kilit ve yeni cihazdan girişte e-posta bildirimi | IP bazlı limit dağıtık saldırıyı durdurmaz | M |
| Orta | Denetim kaydı | Giriş, çıkış, rol değişimi, üye çıkarma, admin işlemleri için ayrı bir "denetim tablosu" | Olay olunca "kim ne zaman ne yaptı" sorusuna cevap verilir | M |
| Orta | Dosya yükleme | Görev eklerinde (zip, docx, xlsx, pptx, pdf) virüs taraması (ClamAV) veya bu türleri kapat | İçerik doğrulaması zararlı yazılımı yakalamaz | M |
| Orta | Dosya yükleme | Kullanıcı/proje başına toplam depolama kotası | Tek kullanıcı veritabanını şişiremesin | S |
| Orta | Rate limit | Yönetici uçlarına ayrı limit; çok kopyalı çalışma için limit sayaçlarını ortak depoya (Redis) taşı | Bellekteki sayaç kopyalar arasında paylaşılmıyor ve yeniden başlatmada sıfırlanıyor | M |
| Orta | Veritabanı | Migration ve uygulama için ayrı DB kullanıcıları; production'da `HIBERNATE_DDL_AUTO` `validate` dışına çıkarsa başlatmayı reddet | Uygulama hesabı şema değiştiremesin | S |
| Orta | Header | `Cross-Origin-Opener-Policy` ve `Cross-Origin-Resource-Policy` header'ları | Sayfalar arası bilgi sızıntısı saldırılarına ek katman | S |
| Orta | Header | `x-middleware-rewrite` gibi iç başlıkların dışarı sızmasını ve `X-Powered-By`'ı kapat | Gereksiz teknik ipucu vermez | S |
| Düşük | Çerez | `XSRF-TOKEN` çerezine açık `SameSite` ve (production'da) `Secure` ekle | Çerez bayrakları her çerezde tutarlı olur | S |
| Düşük | Hesap | Parolayı "sızdırılmış parolalar listesi" (HIBP k-anonymity) ile karşılaştır | Zayıf/sızmış parolalar baştan reddedilir | M |
| Düşük | Giriş | "E-postamı hatırla" için paylaşılan bilgisayar uyarısı veya `localStorage` yerine kısa ömürlü seçenek | E-posta adresi kişisel veridir | S |

## Dağıtım ve izleme

| Öncelik | Alan | Öneri | Neden | Tahmini efor |
| --- | --- | --- | --- | --- |
| Yüksek | Sağlık kontrolü | `docker-compose.yml` ve Dockerfile'lara `HEALTHCHECK` ekle (backend `/actuator/health`) | Şu an backend "ayakta" görünür ama hazır olmayabilir; frontend başka servise bağlı değil | S |
| Yüksek | Yedekleme | PostgreSQL için otomatik yedek + geri yükleme provası | Veri kaybında tek çare; şu an dokümanda karar yok | M |
| Orta | İzleme | Çalışma süresi izleme (uptime) ve hata takibi (ör. Sentry) | Kesintiyi kullanıcıdan önce sen öğrenirsin | M |
| Orta | Log | JSON formatlı log + merkezi toplama + saklama süresi | Olay incelemesi hızlanır | M |
| Orta | Ortam ayrımı | Production için ayrı compose/ayar dosyası (backend portu yalnız `127.0.0.1`, swagger kapalı kanıtı) | Geliştirme ayarlarının production'a kayması engellenir | S |
| Düşük | Sürümleme | Etiketli sürümler ve değişiklik günlüğü (`CHANGELOG.md`) | Hangi sürümde ne değişti bellidir | S |

## Web, SEO ve kullanıcı deneyimi

| Öncelik | Alan | Öneri | Neden | Tahmini efor |
| --- | --- | --- | --- | --- |
| Yüksek | İletişim | Kişisel Gmail yerine alan adına bağlı destek adresi ve basit bir iletişim formu | Kurumsal güven ve spam koruması | M |
| Orta | SEO | JSON-LD (Organization, WebSite, SoftwareApplication) ve sosyal paylaşım görseli (OG) | Arama sonuçlarında zengin görünüm, paylaşım kartı | S |
| Orta | PWA | `manifest.webmanifest` ve uygulama simgeleri | Mobilde "ana ekrana ekle" ve tutarlı marka | S |
| Orta | Performans | Production build'de Lighthouse/PageSpeed çalıştırıp skoru kayda geçir; CI'a performans bütçesi ekle | Yavaşlama fark edilmeden gelmez | M |
| Orta | Erişilebilirlik | `axe-core` testini Playwright'a ekle; ekran okuyucu ile elle deneme | Otomatik yakalanabilen sorunlar her push'ta çıkar | M |
| Orta | Yükleme durumu | Sadece `projects/loading.tsx` var; diğer ana ekranlara `loading.tsx` / iskelet ekran | Yavaş ağda boş ekran görünmez | M |
| Düşük | Dil | Çeviri anahtarı eşitliği için CI testi (EN'de 27, TR/DE'de 3 fark var) | Diller arası kayma erken yakalanır | S |
| Düşük | Yapay zekâ botları | `llms.txt` ve bot politikası (robots'ta kasıtlı karar) | Botlar siteyi doğru tanır | S |
| Düşük | Sürüm bilgisi | Alt bilgide sürüm / son güncelleme tarihi | Destek talebinde hangi sürüm olduğu bellidir | S |

## Süreç ve kalite

| Öncelik | Alan | Öneri | Neden | Tahmini efor |
| --- | --- | --- | --- | --- |
| Orta | Test | "Her `@RestController` ucu oturumsuz 401 döner" şeklinde otomatik bir test | Yeni uç matcher'a eklenmeyi unutursa test kırılır; elle liste tutmaya gerek kalmaz | M |
| Orta | Belge | `SECURITY.md` §11 uç listesini (≈700 satır) koddan üretilen kısa tabloya çevir | Elle tutulan uzun liste kodla ayrışır | M |
| Orta | Pull request | PR şablonu: "ENV değişti mi? Yeni uç var mı? Güvenlik testi var mı?" | Checklist'i herkes görür | S |
| Düşük | Üretim hazırlığı | `.agents/deployment.md` içindeki TBD alanlarını doldur (alan adı, HTTPS, proxy, DB, yedek) | Production kararları yazılı olmadan HSTS/çerez/CORS maddeleri doğrulanamıyor | M |
