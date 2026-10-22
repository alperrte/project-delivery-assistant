# NS-02 — Kalıcı toplantı e-posta hatırlatmaları

## Tamamlanan kapsam ve kök neden

Mevcut MeetingScheduler toplantı odalarının yaşam döngüsünü, MeetingNotificationStore ise uygulama içi olay bildirimlerini yönetiyordu; güvenilir, kişi başına kalıcı ve retry edilebilir bir saatlik mail kuyruğu yoktu. Meeting modülüne sınırlı bir teslim ledger'ı ve mevcut `SmtpMailSettings` kullanan mail adaptörü eklendi. Notification event fanout'u, mevcut toplantı yaşam döngüsü ve merkezî sohbet değiştirilmedi.

## İşleyiş

- 15 saniyelik discovery gelecekteki SCHEDULED toplantılar için organizatör ve explicit `attendeeIds` birleşiminden kalıcı işler oluşturur (batch başına en fazla 500 yeni iş). `reminder_at=startsAt-60dk`; bir saatten yakın toplantı ilk uygun turda gönderilebilir. Gerçek zamanlama `Instant` üzerinden, maildeki yerel saat IANA `zoneId` üzerinden hesaplanır.
- Gönderim öncesi güncel planlama sürümü, gelecekteki SCHEDULED durum, davetli kümesi, arşivsiz proje üyeliği, meeting participant revocation ve User public contract'ından ACTIVE + VERIFIED adres kontrol edilir. Her proje üyesi alıcı kabul edilmez; konuk adresi tahmin edilmez.
- `UserAccounts.findVerifiedMailRecipient` yalnız izin verilen iç sözleşme üzerinden adres/isim/kayıtlı locale sağlar; başka modülün internal repository'sine girilmez. Mail TR/EN/DE kaydedilmiş tercihi kullanır; güvenilir tercih yoksa açık varsayılan TR'dir. Mevcut tema/UI veya kişisel tercih değiştirilmez.
- Başlangıç veya attendee seti değişince ayrı `reminderRevision` ilerler. Eski PENDING/RETRY işleri iptal edilir, yeni sürüm yeniden hesaplanır. Başlık gibi salt içerik düzenlemeleri gereksiz tekrar mail oluşturmaz. İptal/başlangıç/OPEN/ENDED durumları ve erişim kaybı gönderimi durdurur.
- `(meeting_id,recipient_user_id,reminder_revision)` UNIQUE, PostgreSQL `FOR UPDATE SKIP LOCKED`, 120 saniye lease ve claim UUID fencing olağan çift gönderimi engeller. Restart sonrası PENDING işler ve süresi dolmuş SENDING lease'leri aynı DB'den devam eder.
- SMTP geçici hatasında 30/60/120/240/480/900/900 sn exponential backoff, toplam en fazla 8 deneme vardır. Auth/parse hatası doğrudan FAILED; deneme tükenmesi ATTEMPTS_EXHAUSTED olarak izlenir. Toplantı başladıktan sonra retry yapılmaz; mail kapalıyken deneme tüketilmez.
- Mail tek ayrı worker'da çalışır, aynı instance'ta üst üste tur birikmez ve turda en fazla 100 claim işlenir. Ortak scheduler, toplantı odası açma/cleanup ve kullanıcı API'leri SMTP beklemez. Dış SMTP sırasında DB transaction/lock açık tutulmaz.
- Teslim modeli **at-least-once**: SMTP kabulü ardından DB sent commit'i kaybolursa lease recovery tekrar mail gönderebilir. Mutlak exactly-once garantisi yoktur. Gönderim öncesi kontrol sonrası SMTP'ye teslim edilmiş/in-flight mail, eşzamanlı saat/katılımcı/iptal değişiminde geri çekilemez; kalan eski işler gönderilmez.

## Mail, API ve güvenlik

Mevcut MAIL_ENABLED/MAIL_PROVIDER/SMTP_*/gönderen/FRONTEND_URL ayarları kullanılır; yeni ENV, secret, bağımlılık veya bağımsız SMTP sistemi yoktur. HTML ve plain-text alternatifleri, header CR/LF/Unicode satır ayracı temizliği, HTML escaping, mobilde daralan sade şablon ve token'sız yerelleştirilmiş toplantı detay bağlantısı vardır. Bağlantı yalnız yapılandırılmış güvenilir HTTP(S) origin'den kurulur; kullanıcı URL'sinden üretilmez. Ledger'da adres, mail içeriği veya auth/davet token'ı saklanmaz. Uygulama loglarında yalnız delivery UUID/deneme/outcome ve aggregate sayı bulunur.

Yeni HTTP endpoint yoktur. Mevcut `POST /api/v1/projects/{projectId}/meetings`, `PUT /{meetingId}` ve `POST /{meetingId}/cancel` cookie oturumu + CSRF ve mevcut proje/organizatör/yönetici yetkilerini korur; mail bu transaction'larda gönderilmez. Kesin endpoint/DTO/hata/yetki ve Swagger kontrol yolu `.agents/SECURITY.md` §11 ile `docs/meeting-backend-handoff.md` içindedir. Development'ta mevcut API_DOCS_ENABLED=true yapılandırmasıyla `/swagger-ui/index.html` ve `/v3/api-docs` üzerinden mevcut meeting create/update/cancel işlemleri kontrol edilir; docs güvenliği veya production ayarı değiştirilmedi. Var olan security metnindeki end-for-everyone açıklaması mevcut kod/testteki organizer-only kuralıyla düzeltildi; yetki kodu bu görevde değiştirilmedi.

## Değişen önemli dosyalar

- `meeting/internal/Meeting.java`, `MeetingService.java`: yalnız start/attendee değişiminde ilerleyen mail planlama sürümü.
- `MeetingReminderStore.java`: discovery, claim, güncel erişim kontrolü, lease/token ve teslim state'i.
- `MeetingReminderDispatcher.java`, `MeetingReminderScheduler.java`, `MeetingReminderMail.java`: kısa scheduler tetiklemesi, ayrı tek worker, sınırlı retry/SMTP sınırı.
- `SmtpMeetingReminderMail.java`: mevcut SMTP ayarlarıyla güvenli multipart/yerelleştirilmiş içerik.
- `user/UserAccounts.java`, `user/application/service/UserAccountService.java`: verified alıcı + kaydedilmiş dil için public facade metodu.
- `db/migration/V54__meeting_email_reminders.sql`: revision kolonu, teslim tablosu, constraint ve index'ler.
- `MeetingReminderIntegrationTest`, `MeetingReminderMailTest`, `MeetingReminderSchedulerTest`, `MeetingReminderMigrationTest`: yeni testler.
- `.agents/SECURITY.md`, `architecture.md`, `database.md`, `folder-structure.md`, `deployment.md`, `operations.md`: gerçek uygulama/işletim özeti.

## Migration ve recovery

Son mevcut migration V53 olarak doğrulandı; yalnız yeni **V54** eklendi. Eski meeting içerik/durum/zamanları korunur ve revision=0 olur; eski gelecekteki kayıtları discovery bulur. Upgrade testi V53 üzerinde gerçek eski toplantı oluşturup V54'ün tek adım/idempotent uygulanmasını, unique/state/deneme/error constraint'lerini ve meeting silinince ledger cascade'ini doğrular.

Migration ileri/additive'dir; rollback sırasında kolon/tablo veya Flyway history silinmez, repair/baseline/validation bypass kullanılmaz. V54'ü tanıyan uyumlu önceki kod build'i ya da yedeğin ayrı ortama restore'u kullanılır. DB restore, SMTP teslimini geri alamaz ve belirsiz kabul durumları mükerrer teslim riski taşır. Ayrıntılı tanılama/retry/rollback yolu `.agents/operations.md` yeni V54 bölümündedir. Normal kullanıcı development DB'sine bu görev kapsamında V54 uygulanmadı; migration testleri izole PostgreSQL/Testcontainers ve ayrı QA volume'ündedir.

## Doğrulama komutları ve sonuçlar

Backend branch'inde JDK 25, MAIL_ENABLED=false ile:

```powershell
.\mvnw.cmd '-Dtest=MeetingReminderIntegrationTest,MeetingReminderMailTest,MeetingReminderSchedulerTest,MeetingReminderMigrationTest,MeetingServiceTest,MeetingCoreIntegrationTest,MeetingNotificationIntegrationTest,MeetingHttpSecurityTest,MeetingPublicationRecoveryTest,ModularityTest' verify
```

**Son sonuç: 89 test, 0 failure, 0 error, 0 skip; BUILD SUCCESS.** 30 yeni reminder entegrasyon, 9 template/timezone, 2 scheduler izolasyonu, 1 migration ve 47 mevcut servis/meeting/security/notification/modularity testi. Gerçek PostgreSQL 18 Testcontainers kullanıldı. Zaman testleri enjekte edilen değiştirilebilir Clock ile 24 saat, tam 60 dk, 30 dk, geçmiş başlangıç, iptal, ileri/erken planlama, eklenen/çıkarılan katılımcı, organizatör tekilleştirme, çok toplantı, tekrar/iki scheduler, SMTP retry/kurtarma, restart/expired lease/token, disabled/unverified hesap, arşiv/üyelik/meeting revocation ve Europe/Istanbul + Berlin DST geçişlerini kapsar. SMTP başarı sonrası DB commit kaybındaki olası tekrar gönderim sınırı ayrıca test edildi.

İlk hazırlık koşularında mock Clock başlangıçta null döndüğü için context kurulamadı; hazır bir test Clock bean'iyle düzeltildi. Spring proxy üstündeki test spy'ı delegating mock'a çevrildi. Arşiv test verisi gerçek domain'in `archived_at` kuralına düzeltildi. Bunlar son 89-test başarılı koşusunun öncesindeki test hazırlığı düzeltmeleridir.

**Gerçek Mailpit SMTP doğrulaması:** Testcontainers Mailpit'e normal adaptörle iki multipart mail teslim edildi; doğru iki alıcı, diğer proje üyesinin hariç tutulması, konu/içerik, yerel saat/zone ve doğru detail link kontrol edildi. Tekrar dispatch ikinci mail oluşturmadı.

**Gerçek süreç restart doğrulaması:** ayrı `pda-ns-qa` Compose projesinde normal geliştirme DB/servislerine dokunulmadan bir PENDING ve bir expired SENDING işi PostgreSQL'e yazıldı. Backend yeniden başlatıldığında ikisi SENT oldu; expired iş attempts=2 ile kurtarıldı. Son worker koduyla imaj/backend yeniden başlatıldıktan sonra en az bir scheduler aralığı daha beklenip Mailpit'te hâlâ tam **2 mail**, doğru iki alıcı ve aynı 2 kalıcı teslim kaydı doğrulandı. Kod yolu mevcut CLI property `--pda.meeting.enabled=true` ile yalnız QA'da açıldı; bütün SMTP trafiği Mailpit'e kapalı test ağı içinde gitti. Normal/prod SMTP ayarı değiştirilmedi. Kanıt `tmp/ns-runtime-restart-result.json` içinde (Git dışı).

Kullanıcı ayrıca gerçek adresine bir örnek mail gönderilmesini açıkça istedi. Aynı adaptör/şablonla **tek test maili** mevcut TLS SMTP üzerinden gönderildi; sunucu 2026-10-22 20:24:01 UTC'de kabul etti. Normal otomatik alıcı politikası veya kullanıcı tercihleri değiştirilmedi. SDSD'de bu örnek bağlantısı için bir açıkça TEST işaretli toplantı kaydı oluşturuldu. SMTP acceptance, Gmail gelen kutusuna düşme/spam yerleşimi garantisi değildir; kullanıcı kutusundan kontrol eder. Adres veya SMTP credential bu kayda eklenmedi.

Frontend ayrı NS-01 commit'inde: 18 benzersiz Chromium testi, 12 scoped axe taramasında 0 ihlal, lint/tsc/production build/bundle PASS. `git diff --check`: PASS. Kanıtlar/ilk test hatası frontend completion kaydındadır.

## Açık sınırlar ve manuel kontrol

Production dağıtımı, gerçek production teslim/DMARC/DNS/kapasite veya her mail istemcisinde görsel uyum doğrulanmadı. SMTP + DB arasında exactly-once garantisi yoktur. Konfigürasyondaki meeting/mail kapalıysa gönderim beklenmemelidir; mevcut ayarlar kullanılır. Bu bir full pre-push veya tüm proje regresyon koşusu değildir.

1. Yeni backend build'ini çalıştırıp normal Flyway V54 geçişini kontrol et; otomatik gönderim için mevcut meeting/mail ayarlarını kullan. Önce test SMTP/Mailpit tercih et.
2. 30 dk sonrasına yalnız seçili katılımcılarla bir test toplantısı planla; ilk uygun scheduler turunda organizatör ve davetliler için maili kontrol et. Diğer proje üyesine gitmemeli.
3. 24 saat sonrasına planlanan toplantının hemen gönderilmediğini; başlangıç/katılımcı değişimi ve iptal sonrası eski işlerin gönderilmediğini kontrol et.
4. E-postadaki TR/EN/DE tercih, yerel saat/zone, metin/HTML ve giriş gerektiren token'sız detail bağlantısını kontrol et. İstenen gerçek test mailinin gelen kutusu/spam durumunu incele.
5. Geçici SMTP arızasında ledger RETRY/next-attempt/attempts; restart sonrasında pending/expired lease recovery ve FAILED hata kodlarını kontrol et. Belirsiz SMTP kabulü olan işi kör biçimde yeniden başlatma.

## Git ve teslim

İki mevcut branch `origin/main` başlangıç SHA `02d34464` üzerine fast-forward edildi. Frontend commit'i `d0e8e6b768f1223867279bb220adc01ef42caba3` (`notification-service`). Backend yalnız bu kapsamı içerir (`meeting-system-backend`); frontend commit'inin üstüne eklenmez. Backend commit kimliği bu kaydı içeren commit'tir: `git log -1 --format=%H meeting-system-backend`; kesin SHA final raporda verilir. Backend seçici stash `dbd9e199d471cfa75d1ce889a2a667a9eb54cb1c` ile taşındı, apply kullanıldı; başarılı commit/diff doğrulaması sonrasında temizlenir.

**Tam pre-push final aşamaya ertelendi. Push, remote merge, PR merge veya production deployment yapılmadı.**
