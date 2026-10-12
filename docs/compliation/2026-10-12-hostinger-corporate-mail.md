# Hostinger kurumsal e-posta geçişi — 2026-10-12

**Güncel durum — dev etkinleştirmesi ve gerçek teslim kontrolü:** `.env.dev` ve etkin `.env` için `MAIL_ENABLED=true`; backend yeniden oluşturuldu ve health `UP`. Hostinger SMTP AUTH doğrulanmış TLS üzerinde başarılı. Kullanıcının yerel iletişim formundan gönderdiği mesaj 12 Ekim 2026 03:16'da Hostinger tarafından kabul edildi ve posta kutusunun `INBOX.Junk` (Spam/Junk) klasöründe bulundu. Aşağıdaki ilk teslimdeki boş şifre/kapalı mail ve henüz doğrulanmamış teslim ifadeleri o aşamanın tarihsel durumudur. Production profili bu etkinleştirmede açılmadı.

## Tamamlanan yerel kapsam

Kurumsal iletişim ve varsayılan gönderen adresi `info@pd-assistant.com` oldu. Kaynaklarda fiilen kullanılan eski adres `pdassistant.info@gmail.com` idi; talimat belgesindeki `pd-assistant.info@gmail.com` yazımı da tarandı. Talimat belgesi, geçmiş browser çıktıları ve diğer worktree/yedekler değiştirilmedi. Kullanıcı hesaplarına, veritabanına, kişisel katkıcı adreslerine veya OAuth yapılandırmasına dokunulmadı.

Üç mevcut domain mail portu/adaptörü korundu. Tekrarlanan JavaMail transport ayarları `shared.SmtpMailSettings` içinde birleştirildi; yeni dependency veya mail sistemi eklenmedi. From görünen adı `PDA — Project Delivery Assistant`. `SMTP_FROM_ADDRESS` varsa kullanılır; boş değer hata verir. Anahtar yoksa eski `MAIL_FROM`, o da yoksa yeni kurumsal adres kullanılır. SMTP login From'dan bağımsızdır. Auth ve davet Reply-To gönderen adresidir; iletişim formu Reply-To'su doğrulanmış ziyaretçi adresi olarak korunur.

Repo incelemesinde ayrı Brevo HTTP API adaptörü bulunmadı. `MAIL_PROVIDER=smtp` ve `brevo` artık mevcut Spring Mail SMTP yolunu kullanır; Brevo için hesap panelindeki SMTP röle host/login/SMTP anahtarı girilmelidir. Bu seçim ayrı Brevo API entegrasyonu değildir; otomatik SMTP→Brevo fallback yoktur. Bilinmeyen provider reddedilir. `MAIL_ENABLED=false` kimlik bilgisi gerektirmez; mevcut unavailable/best-effort davranışları korunur.

465 implicit TLS ve 587 STARTTLS ENV ile seçilir; ikisinin birlikte açılması reddedilir. STARTTLS seçildiğinde zorunludur; TLS sertifikası sunucu kimliği kontrol edilir. Bağlantı/okuma/yazma zaman aşımı 5 saniyedir. `APP_ENV=prod` ve mail açıkken eksik host, adres, port, gerekli kullanıcı/şifre veya TLS yapılandırması başlangıçta, ağ bağlantısı kurmadan hata verir. Hata mesajları değer veya secret yerine anahtar adlarını taşır.

## Değişen dosyalar

- `backend/src/main/java/com/pda/shared/SmtpMailSettings.java`: ortak transport, From ve provider/TLS doğrulaması.
- `backend/src/main/java/com/pda/shared/ProductionMailConfigurationValidator.java`: lazy adaptörlerden bağımsız production başlangıç kontrolü.
- `backend/src/main/java/com/pda/auth/infrastructure/mail/SmtpVerificationMailAdapter.java`: ortak transport, görünen ad, kurumsal Reply-To; mevcut şablonlar korunur.
- `backend/src/main/java/com/pda/contact/infrastructure/mail/SmtpContactMailAdapter.java`: ortak transport ve görünen ad; sabit To, ziyaretçi Reply-To ve başlık korumaları korunur.
- `backend/src/main/java/com/pda/project/infrastructure/mail/SmtpProjectInvitationMailAdapter.java`: ortak transport, görünen ad ve kurumsal Reply-To; best-effort davranışı korunur.
- `backend/src/main/resources/application.properties`: varsayılan iletişim alıcısı.
- `backend/src/test/java/com/pda/shared/SmtpMailSettingsTest.java`: provider/TLS/config/disabled/fail-fast kontrolleri ve GreenMail üzerinden SMTP AUTH ile tüm altı mail akışının iki provider seçimiyle teslimi.
- `backend/src/test/java/com/pda/contact/infrastructure/mail/SmtpContactMailAdapterTest.java`: yeni kurumsal alıcı beklentisi.
- `backend/src/test/java/com/pda/contact/integration/ContactApiIntegrationTest.java`: yeni varsayılan alıcıyla gerçek PostgreSQL/SMTP API kontrolü.
- `frontend/src/features/public-info/site-info.ts`: ortak iletişim/mailto adresi.
- `frontend/src/i18n/messages/tr.json`, `en.json`, `de.json`: adresler; Gmail posta hizmeti/inbox açıklamaları Hostinger Email olarak güncellendi. Google/GitHub OAuth ifadeleri korundu. Hostinger veri işleme ülkesi veya sözleşme güvencesi uydurulmadı; sağlayıcı aktarım koşullarının ayrıca değerlendirilmesi belirtilir.
- `frontend/e2e/contact-form.spec.ts`: yeni mailto beklentisi; test CORS origin'i yapılandırılan test adresinden alınır.
- `frontend/e2e/footer-public-pages.spec.ts`: yeni adres ve yapılandırılabilir test CORS origin'i.
- `frontend/e2e/legal-pages.spec.ts`: adres ve Hostinger içerik beklentisi.
- `frontend/e2e/contact-delivery.spec.ts`, `privacy-regression.spec.ts`: yeni kurumsal alıcı beklentisi; bu iki paket bu görevde ayrıca çalıştırılmadı.
- `.env.example`: Hostinger güvenli örneği, `SMTP_FROM_ADDRESS`, `SMTP_SSL` ve TLS açıklamaları.
- Git dışındaki `.env.dev`, `.env.prod`, `.env`: Hostinger host/login/From/To/TLS değerleri. Eski Gmail SMTP şifresi kaldırıldı; yeni şifre boş, mail kapalı. Etkin dev kopyası profil ile eşit. Diğer secret alanları korunur.
- `README.md`, `README_EN.md`: Hostinger kurulum, provider/From uyumu ve güvenlik bildirim adresi.
- `.agents/SECURITY.md`: adres, provider, ENV/TLS ve başlangıç doğrulaması güvenlik sözleşmesi.
- `.agents/deployment.md`: iki profil, Hostinger SMTP ve etkinleştirme adımları.
- `.agents/operations.md`: destek/olay adresi, Hostinger şifre yenileme ve bakım notları.
- `.agents/architecture.md`, `.agents/folder-structure.md`: ortak teknik ayar sınıfları ve test yolları.
- `.agents/frontend-design-rules.md`: mevcut kurumsal adres standardı.
- `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`: ilgili adresler ve bu teslimin sınırlı kapsam notu; global kutular topluca tamamlanmış sayılmadı.

`docker-compose.yml` ve `docker-compose.prod.yml` zaten backend `env_file` üzerinden anahtarları aktarıyor; YAML değişikliği gerekmedi. Yeni ENV anahtarları da aynı yoldan aktarılır. Yeni endpoint, migration, auth/cookie/CSRF/CORS veya rol değişikliği yoktur.

## ENV yapılandırması

Mevcut yerel dosyalarda güvenli bekleme durumu:

```dotenv
MAIL_ENABLED=false
MAIL_PROVIDER=smtp
SMTP_FROM_ADDRESS=info@pd-assistant.com
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USERNAME=info@pd-assistant.com
SMTP_PASSWORD=
SMTP_AUTH=true
SMTP_SSL=true
SMTP_STARTTLS=false
CONTACT_RECIPIENT=info@pd-assistant.com
```

Şifre girildikten sonra `MAIL_ENABLED=true` yapılır. Port 587 alternatifi: `SMTP_PORT=587`, `SMTP_SSL=false`, `SMTP_STARTTLS=true`. From/login farklı sağlayıcılarda farklı olabilir. Gerçek şifre hiçbir rapora, kaynak koda veya sohbete yazılmadı. Üç gerçek ENV dosyası Git tarafından ignore edilir ve tracked değildir.

## DNS ve harici kontrol

12 Ekim 2026 tarihli salt okunur DNS sorgusunda mevcut kayıtlar:

- MX: `mx1.hostinger.com` öncelik 5; `mx2.hostinger.com` öncelik 10.
- SPF TXT: `v=spf1 include:_spf.mail.hostinger.com ~all`.
- DKIM CNAME: `hostingermail-a._domainkey` → `hostingermail-a.dkim.mail.hostinger.com`; aynı b/c isimleri kendi b/c hedeflerine yönlenir.
- DMARC TXT `_dmarc`: `v=DMARC1; p=none`. Bu politika gözlem modundadır; rapor alıcısı tanımlı değildir.

Bunlar [Hostinger'ın yayımladığı varsayılan kayıtlarla](https://www.hostinger.com/support/8671319-set-up-a-domain-for-hostinger-email-manually/) uyumludur. DNS değiştirilmedi. MX e-posta alımını yönlendirir; tek başına SMTP AUTH, gönderim veya mesajdaki domain alignment sonucunu kanıtlamaz. SPF/DKIM/DMARC başarısı ancak alınan gerçek mesajın Authentication-Results başlığıyla doğrulanabilir. DMARC politika/rapor alıcısı değişikliği bu görevde yapılmadı; mevcut adres olmayan bir `rua` değeri uydurulmadı.

[Hostinger SMTP belgesi](https://www.hostinger.com/support/1575756-how-to-get-email-account-configuration-details-for-hostinger-email/) 465 SSL ayarını doğrular. `smtp.hostinger.com:465` bağlantısı Python standart TLS doğrulamasıyla kontrol edildi: sertifika/hostname başarılı, TLS 1.3, SMTP `220` yanıtı. AUTH veya MAIL/RCPT/DATA komutu gönderilmedi; bu kontrol e-posta teslimi değildir.

Brevo'ya daha sonra geçilecekse doğrulanmış domain/sender ile [Brevo SMTP hesap bilgileri](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP) kullanılmalı; [domain doğrulama kayıtları](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC) o hesaptan alınmalıdır. Hostinger DNS kayıtları Brevo gönderimini otomatik doğrulamaz.

## Çalıştırılan doğrulamalar

- Backend: `./mvnw.cmd -Dtest=SmtpMailSettingsTest,SmtpContactMailAdapterTest,SmtpProjectInvitationMailHeaderTest,VerificationMailTemplateTest,ContactApiIntegrationTest,ModularityTest test` — **36 test; 0 failure/error/skip; BUILD SUCCESS**. GreenMail gerçek yerel SMTP/AUTH; Testcontainers PostgreSQL; modül sınırı testi dahil. Gerçek Hostinger şifresi kullanılmadı.
- Backend: `./mvnw.cmd -DskipTests package` — **BUILD SUCCESS**, çalıştırılabilir JAR üretildi. Önceki JaCoCo verilerindeki ilgisiz TaskController sınıfları için mismatch uyarısı vardı; coverage yüzdesi iddia edilmez.
- Frontend: `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build` — **exit 0**.
- Production frontend `http://localhost:3100`: `E2E_BASE_URL=http://localhost:3100 npx.cmd playwright test -c playwright.public.config.ts footer-public-pages.spec.ts legal-pages.spec.ts contact-form.spec.ts` — son birleşik koşum **52 passed**. TR/EN/DE, iki tema, 320–1440 px, mailto, içerik, klavye/odak, footer ve form durumları doğrulandı.
- İlk browser denemelerinde sabit 3000 CORS fixture origin'i ve eski Gmail içerik beklentisi hata verdi; beklenti/origin düzeltildi. İki hedefli tekrar ve son 52-test birleşik koşum başarılı. Uygulama CORS politikası değiştirilmedi.
- `docker compose --env-file .env config --quiet` ve `docker compose -f docker-compose.prod.yml --env-file .env.prod config --quiet` — **exit 0**, secret çıktı yok.
- `git diff --check` — **exit 0**. Gerçek profillerin mail kontratı ve aktif dev kopyası içerik eşitliği kontrol edildi.
- Aktif kaynak/doküman/testlerde eski kurumsal adres temizlendi. Kullanıcının özgün talimatı, tarihsel browser çıktıları ve diğer worktree/yedekler kapsam dışında tutuldu.

Tam backend suite, tam frontend E2E ve pre-push kapısı çalıştırılmadı; bu kapsam için yukarıdaki hedefli kontroller kullanıldı. Production deploy veya dış gönderim yapılmadı.

## Açık kalanlar ve kullanıcı kontrolü

**Yerel kod/config teslimi tamamlandı; gerçek Hostinger mail teslimi henüz doğrulanmadı.** Yeni SMTP şifresi sağlanmadığından yerel profillerde gönderim kapalıdır. Mail gerektiren kayıt/şifre/iletişim işlemleri etkinleştirilene kadar mevcut unavailable yanıtını verir.

1. `.env.dev` ve gerektiğinde `.env.prod` içindeki `SMTP_PASSWORD` alanına doğru Hostinger posta kutusu şifresini yerelde girin; aynı dosyalarda `MAIL_ENABLED=true` yapın. Şifreyi sohbete göndermeyin.
2. Dev için `ops/env.ps1 use dev` ile etkin `.env` kopyasını eşitleyin. Backend container'ın yeni ENV'i alması için yeniden oluşturun. Production yeniden başlatma/deploy ayrı yetkili operasyondur; bu görevde yapılmadı.
3. Hostinger panelinde mailbox/domain/sender ve DNS durumunu doğrulayın. SPF/DKIM/DMARC kayıtları mevcut; e-posta teslim/alignment kontrolü yine gereklidir.
4. Kendi test hesabınızla kayıt doğrulama ve şifre sıfırlama, proje daveti ve iletişim formunu deneyin. From adresi/adı, kurumsal Reply-To ve iletişim formundaki ziyaretçi Reply-To davranışını kontrol edin.
5. Gmail/Outlook gibi bir test alıcısına gelen gerçek mesajın From, Return-Path, DKIM `d=` ve Authentication-Results başlıklarında SPF/DKIM/DMARC sonuçlarını ve From-domain alignment'ı inceleyin; spam klasörünü de kontrol edin. Gerçek mailbox parolasıyla AUTH/teslim bu teslim kaydının kanıtına dahil değildir.
6. TR/EN/DE iletişim, footer, KVKK/Gizlilik ve erişilebilirlik sayfalarındaki adresi kontrol edin. Hostinger sözleşmesindeki veri işleme lokasyonları/aktarım koşulları proje sahiplerince ayrıca değerlendirilmelidir.

API sözleşmesi değişmedi. Mevcut Swagger kontrolü (`API_DOCS_ENABLED=true`): `/swagger-ui/index.html` veya `/v3/api-docs`; önce `GET /api/v1/auth/csrf`, ardından cookie + `X-XSRF-TOKEN` ile POST. `POST /api/v1/contact` public+CSRF, sabit alıcı; başarılı teslim `200`, validation `400`, CSRF `403`, duplicate `409`, rate limit `429`, kapalı mail veya delivery failure `503`. Auth mail yollarının mevcut §11 kuralları geçerlidir. Request örneklerinde gerçek şifre, doğrulama kodu veya kişisel mesaj paylaşmayın.

Repo yönergesindeki `docs/compliation/README.md` bu checkout'ta bulunmadığından kayıt, yönergede istenen kapsam/dosyalar/komutlar/sonuçlar/açık işler/manuel kontrol başlıklarıyla oluşturuldu.

## Kullanıcı şifresi sonrası dev etkinleştirmesi

Kullanıcı Hostinger şifresini yerel dosyalara ekledi ve dev mail etkinleştirme/backend yeniden oluşturma işlemini açıkça istedi. Şifre okunup hiçbir çıktıya yazılmadan yapılandırılmış olduğu doğrulandı.

- `.env.dev` içinde yalnız `MAIL_ENABLED=true` yapıldı; `.env.prod` için bu işlem yapılmadı.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\ops\env.ps1 use dev -Force` — başarılı. Kullanıcının elle düzenlediği eski etkin `.env`, `.env.bak` dosyasında korunarak dev kopyası eşitlendi. Execution policy değişikliği yalnız bu PowerShell işlemine aittir.
- `docker compose --env-file .env up -d --build --force-recreate backend` — başarılı; Docker içindeki backend paketlemesi BUILD SUCCESS. PostgreSQL ve medya volume'leri korundu; Mailpit orphan container silinmedi.
- Çalışan backend ENV kontrolü: `MAIL_ENABLED=true`, host `smtp.hostinger.com`, port `465`, SSL açık, STARTTLS kapalı; From ve contact recipient `info@pd-assistant.com`. Mailpit transport artık kullanılmıyor.
- `GET http://localhost:8080/actuator/health` — `200`, `status=UP`.
- Python `SMTP_SSL` + standart sertifika/hostname doğrulaması üzerinden yerel dosyadaki şifreyle Hostinger SMTP AUTH — başarılı. E-posta gönderilmedi; MAIL/RCPT/DATA komutları kullanılmadı.
- `.env`, `.env.dev`, `.env.prod`, `.env.bak` Git ignore kontrolü başarılı; `git diff --check` başarılı.

Kullanıcı şimdi iletişim formunu yeniden göndermeli ve Hostinger Webmail'de `info@pd-assistant.com` gelen kutusu/spam klasörünü kontrol etmelidir. Gerçek mesaj teslimi ve Authentication-Results alignment sonucu henüz kanıtlanmış sayılmaz. Gmail adresi alıcı değildir. Production deploy/yeniden başlatma bu göreve dahil edilmedi.

## Gerçek iletişim mesajının teslim yeri

Kullanıcı `http://localhost:3000/tr/iletisim` üzerinde başarılı gönderim görmesine rağmen mesajı bulamadığını bildirdi. Çalışan backend Hostinger ayarlarıyla doğrulandı; SMTP hata/bot-trap kaydı yok. İçerik veya kişisel adres sorgulanmadan `contact_requests` son kayıt zaman/durum kontrolü yapıldı: 12 Ekim 2026 03:16 İstanbul, `SENT`.

Kullanıcının kurumsal Hostinger posta kutusu IMAP/TLS üzerinden salt okunur açıldı; yalnız bugün kurumsal gönderenden gelen PDA iletişim mesajı başlıkları tarandı. Mesaj `INBOX` yerine **`INBOX.Junk`** klasöründe bulundu; Date başlığı `Mon, 12 Oct 2026 00:16:21 +0000 (UTC)` (İstanbul 03:16:21). Mesaj içeriği okunmadı veya loglanmadı, okunmuş işaretlenmedi ve klasör değiştirilmedi. Bu kanıt gerçek SMTP kabulü ve mailbox teslimini doğrular; inbox placement başarılı sayılmaz. Kullanıcı Hostinger Webmail'de Spam/Junk klasöründen mesajı görebilir. Docker'ı tekrar kapatıp açmak bu sonucu değiştirmez.

Aynı mesajın Authentication-Results başlığında SPF, DKIM ve DMARC **pass**. Kullanılabilir sayısal spam puanı bulunmadı; nedenin kesin sınıflandırması yapılmadı. DNS kimlik doğrulaması başarılı olsa bile spam klasörüne yerleşme mümkündür; mailbox kuralı veya filtre nedeni ayrıca Hostinger tarafında incelenebilir.
