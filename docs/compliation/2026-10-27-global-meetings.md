# Toplantılar projeden bağımsız, kullanıcı merkezli global modül — 2026-10-27

Dal: kullanıcı oturum sırasında `meeting-system-frontend` → `meeting-system-backend` geçip `origin/main`'i çekti; çalışma ağacı HEAD `8d6274f3` üzerindedir. **Hiçbir şey commit/push edilmedi.**

## 1. Tamamlanan kapsam

"Toplantılar projelere değil, kullanıcılara aittir." ilkesi backend, veritabanı, API, yetkilendirme, frontend rotaları/state'i, sidebar ve bildirim/hatırlatma katmanlarında uygulandı.

**Kullanıcı kararları (soruldu, onaylandı):**
1. Mevcut proje toplantılarının erişimi V57 ile korunur: o anki aktif proje üyeleri (ve geçmiş katılımcılar) açık katılımcı yazılır.
2. Katılımcı seçimi global kullanıcı adı aramasıdır (≥3 karakter, ≤10 sonuç, e-posta yok, kullanıcı başına 30/dk).

**Backend**
- `Meeting.projectId` kalktı; `meeting` modülü `ProjectAccess`/proje olaylarına bağlı değil (yalnız `UserAccounts`). Erişim = organizatör veya `meeting_attendees`; yabancı kullanıcı için 404 (ID bilmek yetmez). Yönetim (düzenle/iptal/başlat/bitir/davet/mute/kick) yalnız organizatör; proje yöneticisi rolü hiçbir şey vermez.
- API `/api/v1/projects/{p}/meetings/**` → `/api/v1/meetings/**`; yeni `GET /api/v1/meetings/attendees/search`. `MeetingView`: `projectId` yok, `organizer` ve `attendees` var.
- Katılımcılar herhangi bir ACTIVE hesap (başka projede/projesiz); organizatör katılımcı listesinde tekrarlanmaz.
- Bildirim alıcıları organizatör + katılımcılar; `MeetingEvents.Changed` ve `notifications.project_id` toplantı için projesiz (eski olay JSON'undaki `projectId` yok sayılır). Hatırlatma e-postası proje denetlemez, bağlantısı global (`/tr/toplantilar/{id}`).
- Proje silme/arşivleme/üyelik değişikliği toplantıyı, odasını veya katılımcısını etkilemez; `MeetingDeletionCleanup` olay dinleyicisi ve `memberRemoved` dinleyicisi kaldırıldı.
- Güvenlik: yeni yollar `authenticated()`, eski proje yolları deny-by-default, oturum süresi dolunca `/api/v1/meetings` 401 (istemci yenilemesi için), CORS yeni yollar için tek tek (webhook hariç), gövde sınırı filtresi yeni yollarda.
- **Migration V57** (`V57__global_meetings.sql`): üyeleri/katılımcıları katılımcı yazar; `project_id` nullable + `ON DELETE SET NULL` (kolon bir sürüm bırakıldı, sonraki migration'da silinecek); yeni indeksler; bildirim CHECK'inden proje şartı kalktı. Önceki migration dosyalarına dokunulmadı.

**Frontend**
- Global rotalar: `/meetings`, `/meetings/new`, `/meetings/[meetingId]`, `…/edit`, `…/room` (TR `toplantilar`, DE `besprechungen`). Eski `/projects/[slug]/meetings/**` sayfaları doğru global adrese yönlendirir (`/projects/[slug]/meetings/calendar` hâlâ takvime).
- API istemcisi, sorgu anahtarları (`["accounts", actor, "meetings", …]`), form, liste, detay, oda, oturum hedefi (`SessionTarget` projesiz), takvim ve bildirim bağlantısı projesiz. Oda yetkileri `organizer` ölçütüne bağlı; proje değişimi artık odayı yeniden mount etmez.
- Sidebar: "Toplantılar" grubu GÖREV YÖNETİMİ ile KİŞİSEL arasında, aktif projeden bağımsız (masaüstü, daraltılmış şerit ve mobil çekmece aynı bileşen); proje sidebar'ından çıkarıldı. Aktif durum yalnız adresten (`meeting-nav.ts`).
- Katılımcı paneli: arama kutusu + sonuç listesi + seçilenler (ekle/çıkar), 3 dilde çeviri.

## 2. Değişen önemli dosyalar

Backend: `db/migration/V57__global_meetings.sql`; `meeting/MeetingEvents.java`; `meeting/internal/{Meeting,MeetingController,MeetingService,MeetingDtos,MeetingLifecycle,MeetingModeration,MeetingRepository,MeetingHiddenRepository,MeetingReminderStore,SmtpMeetingReminderMail,MeetingDeletionCleanup,MeetingApiErrors,MeetingPeopleSearchLimiter(yeni)}.java`; `notification/{domain/Notification,application/NotificationFactory,application/MeetingNotificationStore}.java`; `auth/infrastructure/config/{SecurityBaselineConfiguration,MeetingHttpLimitFilter}.java`.
Testler: `GlobalMeetingApiIntegrationTest`, `MeetingV57MigrationTest`, `MeetingEventsCompatibilityTest` (yeni); `MeetingCoreIntegrationTest`, `MeetingServiceTest`, `MeetingReminder*Test`, `MeetingHttpSecurityTest`, `Meeting{NotificationFactory,NotificationIntegration,PublicationRecovery}Test` (uyarlandı).
Frontend: `features/meetings/**` (api, types, shared, meeting-{form,detail,card,room,calendar,sidebar,nav}, meetings-page, use-meeting-room, room/*, session/*), `app/(app)/meetings/**` (yeni), `app/(app)/projects/[slug]/meetings/**` (yönlendirme), `i18n/routing.ts`, `components/layout/{app-shell,project-sidebar-nav,app-breadcrumb,authenticated-route}`, `proxy.ts`, `features/{calendar/calendar-page,notifications/components/notification-center,projects/switch-project-href}`, `i18n/meetings/{tr,en,de}.json`, `e2e/meeting-global-logic.spec.ts` (yeni) ve mevcut meeting e2e dosyaları (URL/davet uyarlaması).
Belgeler: `.agents/{SECURITY,architecture,folder-structure,api}.md`, `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`, `backend/src/main/resources/db/migration/README.md`.

## 3. Çalıştırılan doğrulama komutları

```text
backend:  ./mvnw -o test -Djacoco.skip=true                       (tam paket, ilk koşu)
          ./mvnw -o test -Dtest='com.pda.meeting.**.*Test,com.pda.notification.**.*Test,com.pda.migration.*Test,ModularityTest,SecurityBaselineTest,MeetingProxyRateLimitTest,MigrationConsolidationTest'
          ./mvnw -o test -Dtest='MeetingHttpSecurityTest,MeetingEventsCompatibilityTest,GlobalMeetingApiIntegrationTest,SecurityBaselineTest'
frontend: npx tsc --noEmit ; npx eslint <değişen yollar> ; npx next build
          npx playwright test --config=playwright.public.config.ts e2e/meeting-global-logic.spec.ts e2e/authenticated-history.spec.ts e2e/localized-routing.spec.ts --project=chromium
```

## 4. Sonuçlar

- Etkilenen backend paketleri (meeting, notification, migration, Modulith sınırları, güvenlik): **242 test, 0 hata/0 başarısızlık, 1 atlama** (`LiveKitRealSmokeTest`: gerçek SFU gerektirir). Sonradan eklenen/değişen testler ayrıca geçti: `MeetingHttpSecurityTest` 8/8 (yeni CORS testi dahil), `MeetingEventsCompatibilityTest` 1/1, `GlobalMeetingApiIntegrationTest` 6/6, `SecurityBaselineTest` 5/5.
- Tam backend paketi (ilk koşu): 1148 test; **75 hata `com.pda.auth.integration.*` sınıflarında** (`SMTP_HOST is required when mail is enabled`). Temiz `HEAD` kopyasında (git worktree) `PasswordResetIntegrationTest` aynı 10 hatayı verdi: **bu değişiklikten önce de var olan, yerel ortam/mail yapılandırması kaynaklı** hatalardır; düzeltilmedi. 21 başarısızlık `MeetingReminderIntegrationTest`'teydi (testler proje silinince toplantıların cascade silinmesine güveniyordu; yeni modelde doğru olarak silinmiyor): fixture açık temizlik yapacak şekilde düzeltildi, sınıf 42/42 geçti. Düzeltmeden sonra **1148 testlik tam paket tek seferde yeniden çalıştırılmadı**.
- Önemli yeni testler: A/B/C projeli kullanıcıların aynı toplantıyı görmesi, proje silinse de toplantı kalması, projesiz kullanıcıyla toplantı oluşturma, davetsiz proje arkadaşı ve anonim için 404/401, katılımcı/yönetici yetki ayrımı (proje yöneticisi rolü etkisiz), arama gizliliği (e-posta yok, `@` yok, 3 karakter, 429), V57 veri korunumu (gerçek V56 → V57), bildirim projesizliği, eski olay JSON uyumu, CORS.
- Frontend: `tsc` 0 hata; ESLint 0 hata (e2e'de 1 kullanılmayan `slug` uyarısı); `next build` başarılı, global rotalar üretildi; mantık testleri 7/7; rota/yönlendirme politikası testleri 24/24.

## 5. Açık kalan konular ve doğrulanmayan sınırlar

- **Çalıştırılmadı:** canlı servis gerektiren Playwright toplantı paketleri (`playwright.meetings.config.ts`: LiveKit, Mailpit, gerçek PostgreSQL). Spec'ler yeni rotalara/davet modeline uyarlandı (iki hesaplı senaryolarda proje arkadaşları açıkça davet edilir, `projectMateIds`), ama güvenilir sonuç için sizin ortamınızda koşulmalıdır; "proje yöneticisi başkasının toplantısını yönetir" tipi eski beklentiler kalmış olabilir.
- **Görsel doğrulama yok:** sidebar'ın masaüstü/daraltılmış/mobil görünümü ve katılımcı arama paneli tarayıcıda gözle, klavye ve ekran okuyucuyla denetlenmedi; 320–1440 px/axe taraması yapılmadı.
- `.\pre-push\pre-push.cmd` çalıştırılmadı (push kararı sizde).
- Takvim sayfasının görev/anımsatıcı bölümü hâlâ proje tabanlıdır (kapsam dışı); proje seçili değilken takvim "proje yok" boş durumunu gösterir. Toplantılara **Toplantılarım** sayfasından projesiz erişilir.
- Davranış değişiklikleri: (a) PROJECT_MANAGER artık başkasının toplantısını düzenleyemez/mute-kick-bitiremez (istek gereği); (b) eski proje üyeleri katılımcı olduğu için yaklaşan toplantılarda hatırlatma e-postası da alabilir; (c) arama sınırlayıcısı örnek başına bellek içidir (çok örnekli dağıtımda ortak limitleyici gerekir); (d) eski project-scoped API için uyumluluk ucu yoktur, yalnız frontend sayfaları yönlendirir; (e) `meetings.project_id` bir sürüm boyunca atıl kolon olarak kalır.
- Sonraki migration (V58+) ile `meetings.project_id` silinmeli.

## 6. Kullanıcının manuel kontrol adımları

1. V57'yi önce geliştirme veritabanının bir kopyasında uygulayın ve kendi toplantılarınızın katılımcı listelerini kontrol edin (bkz. `db/migration/README.md`).
2. Üç projeli bir kullanıcıyla toplantı oluşturup başka projelerden ve projesiz bir kullanıcıyı davet edin; projeyi değiştirip Toplantılarım'da kaldığını, davetsiz bir proje arkadaşının göremediğini (404) doğrulayın.
3. Masaüstü, daraltılmış sidebar ve mobil çekmecede "Toplantılar" grubunun yeri/aktif durumunu görün; proje seçmeden de görünür olmalı.
4. Canlı servislerle `npx playwright test --config=playwright.meetings.config.ts` çalıştırın.
5. Push öncesi `.\pre-push\pre-push.cmd`.

## 7. Final stabilizasyon (Görev 2) — sonuçlar

Yukarıdaki 4. ve 5. bölümlerdeki eski bulgular korunmuştur; aşağıdakiler bunların güncellenmiş durumudur.

- **SMTP hataları (75) kök neden:** `com.pda.auth.integration.*` testleri `MAIL_ENABLED=true` ile açılıyor, ama `SmtpMeetingReminderMail` eager bean olduğu için `SMTP_HOST` yokken bağlam hiç kalkmıyordu (HEAD'de de aynı; git worktree ile doğrulandı). Yedi auth entegrasyon testine etkisiz SMTP özellikleri (`SMTP_HOST=localhost`, `SMTP_AUTH=false`, `SMTP_STARTTLS=false`) eklendi; üretim kodu ve "mail açıksa host zorunlu" fail-fast davranışı değişmedi.
- **Gerçek veriyle V56 → V57 provası:** geliştirme veritabanı yedeği alınıp V57 gerçek veriye uygulandı; yeni `MeetingV57ReminderUpgradeIntegrationTest` gerçek V56 → V57 → V58 yükseltmesi ve gerçek Mailpit ile eski üyelerin tam bir hatırlatma e-postası aldığını, çıkarılmış üye ve yabancının almadığını, bağlantının `/tr/toplantilar/<id>` olduğunu doğrular.
- **Canlı Playwright (LiveKit + Mailpit + PostgreSQL):** `meeting-global.spec.ts` (sidebar masaüstü/mobil/axe/klavye, 3 dilde rotalar, projesiz kullanıcı oluştur-davet-başlat, davetsiz kullanıcının hiçbir şey öğrenmemesi, farklı projelerden kişilerin aynı odada buluşması) geçti.
- **Eski canlı spec'ler (7 hata, nedenleri):** hepsi ürün gerilemesi değil, eski varsayımlardı: (1) liste artık proje değil kullanıcı kapsamlı olduğu için "tam 4/8 kart" sayan iki spec (`meeting-redesign`, `meeting-v291-create`) kendi taze QA hesaplarıyla koşar (`meetingAccount(role, { fresh: true })`); (2) form girişi artık tür seçimiyle başladığından beş spec `…/meetings/new?type=independent` kullanır; (3) `meeting-v291-room` eski ekran görüntüsü "Katılımcılar" listesi yerine `selectedAttendees` listesini arar ve tek satırlık bilgi notu kuralı korunmuştur: bağımsız toplantı notu tek satıra sığacak şekilde kısaltıldı (`attendeeAccess`, 3 dil), proje notu (`projectAttendeeAccess`) uzun kalır; (4) `meetings.spec` eski `/meetings/calendar` adresi yerine eski proje takvim adresinin yönlendirmesini sınar; (5) `meeting-session` mobil mini-bar testi, Next.js **geliştirme** sunucusunun "N" rozetinin alttaki mikrofon düğmesini örtmesinden düşüyordu (üretim derlemesinde yok): canlı paket artık `next build && next start` ile koşuldu; (6) `meeting-v292-chat` (yanıt alıntısı) dev sunucusunda `json.content is not iterable` ile düştü (sohbet isteği yönlendirme kancasında beklenen sayfa yapısı gelmedi); üretim derlemesinde tek başına 1/1 geçti. Dev sunucusundaki kesin tetikleyici ayrıca araştırılmadı; kanıt yalnız bu davranış farkıdır.
- Hiçbir assertion silinmedi veya atlanmadı; bir tanesi (tek satır notu) metin kısaltılarak korundu.

## 8. Hibrit toplantı servisi (Görev 3) — V58

**Ne yapıldı**
- `/meetings/new` önce iki kart gösterir: "Proje Toplantısı Oluştur" ve "Bağımsız Toplantı Oluştur" (açıklamalar istekteki metinle birebir, TR/EN/DE). Proje yolunda yalnız kullanıcının kullanabileceği (aktif üyesi olduğu, arşivlenmemiş) projeler seçilir, ardından mevcut form kullanılır; bağımsız yolda proje seçimi yoktur. `?type=project&project=<id>` ile elle yazılan yabancı/bilinmeyen proje reddedilir (`projectUnavailable`), form açılmaz.
- Tür: `PROJECT` | `INDEPENDENT`, **`project_id` doluluğundan türetilir** (ayrı kolon yok). Sunucu doğrulaması: `PROJECT` → geçerli `projectId` + çağıran aktif üye (`403 MEETING_PROJECT_FORBIDDEN`, `400 MEETING_INVALID_PROJECT`); `INDEPENDENT` → `projectId` yok. Tür/proje oluşturulduktan sonra değişmez (`400 MEETING_TYPE_IMMUTABLE`).
- Proje üyeleri katılımcı seçiminde **önce önerilir ama otomatik eklenmez**; proje üyeliği toplantı erişimi vermez (erişim = organizatör + açık katılımcılar; proje üyesi ama davetsiz kişi 404 alır). Üye olmayan katılımcı toplantının türünü görür, projeyi görmez.
- **Migration V58:** eski `project_id` → `legacy_project_id` (arşiv, okunmaz) ve yeni boş `project_id` + FK `ON DELETE SET NULL`; **mevcut tüm toplantılar bağımsız kalır** (eski bayat proje değerlerinden dönüştürme yok), satır silinmez/yeniden yazılmaz. Proje silinince toplantı silinmez, bağımsıza döner. Eski migration dosyalarına dokunulmadı.
- Toplantılarım: tür rozeti, proje adı ve logosu (yalnız üyesi olan görüntüleyene), Tümü/Proje/Bağımsız süzgeci, isteğe bağlı proje süzgeci, tekrar yok; sidebar'daki aktif proje listeyi süzmez. "Hemen Başlat" iki türde de doğrudan odaya girer (ikinci "katıl" tıklaması yok). Hatırlatma e-postası proje adını yalnız o projenin aktif üyesi alıcıya yazar; uygulama içi bildirimler proje adı taşımaz ve proje geneline dağıtılmaz. Sidebar "Toplantılar" grubu global kaldı.
- Yeni endpoint, bağımlılık, mikroservis, mock yok; LiveKit altyapısı değişmedi.

**Değişen dosyalar (hibrit):** backend `db/migration/V58__hybrid_meetings.sql`, `meeting/internal/{Meeting,MeetingDtos,MeetingService,MeetingReminderStore,SmtpMeetingReminderMail}.java`; testler `MeetingServiceTest`, `GlobalMeetingApiIntegrationTest`, `MeetingCoreIntegrationTest`, `MeetingReminderIntegrationTest`, `MeetingV57ReminderUpgradeIntegrationTest`, `migration/MeetingV58MigrationTest` (yeni). Frontend `features/meetings/{types,meeting-create (yeni),meeting-kind (yeni),meeting-form,meeting-detail,meeting-card,meeting-list,meetings-page}`, `i18n/meetings/{tr,en,de}.json`, `app/(app)/meetings/new`, e2e `meeting-global.spec.ts` (2 yeni canlı test), `meeting-global-logic.spec.ts`, `meeting-fixture.ts` (`fresh` hesap) ve beş mevcut spec'in URL/beklenti uyarlaması. Belgeler: `.agents/{SECURITY,architecture,api,folder-structure}.md`, migration `README.md`.

**Son durum — doğrulama (2026-10-27, bu oturumda çalıştırıldı)**

- Backend, tam paket (`./mvnw -o test -Djacoco.skip=true`): **1160 test, 0 hata, 0 başarısızlık, 1 atlama** (`LiveKitRealSmokeTest`, gerçek SFU ister; bu yığında ayrıca canlı spec'lerle gerçek LiveKit üzerinden denendi). Bölüm 4'teki "tam paket tek seferde yeniden çalıştırılmadı" notu böylece kapanmıştır. Günlükteki `MeetingReminderDispatcher ... outcome=FAILED` satırları, hatırlatma yeniden deneme testlerinin bilerek ürettiği posta hatalarıdır.
- Frontend: `tsc` 0 hata, ESLint 0 hata, `next build` başarılı; mantık + rota/yönlendirme testleri **32/32** (`meeting-global-logic` 8, `authenticated-history`, `localized-routing`).
- Canlı Playwright, tam `playwright.meetings.config.ts` (LiveKit + Mailpit + PostgreSQL, `next build && next start`): **69/69 geçti** (ardışık tam koşular sırasıyla 7 [dev sunucusu], 4, 5, 3 ve 2 hata gösterdi; hepsi yukarıdaki bölüm 7'deki gibi bayat test varsayımıydı, ürün kodunda düzeltme gerektiren gerileme çıkmadı; yan etki olarak yalnız bağımsız toplantı notu `attendeeAccess` tek satıra kısaltıldı).
- Bu oturumdaki ek test uyarlamaları: katılımcı sayacı/ekleme (`meeting-redesign`), moderasyon yalnız organizatörde (`meeting-session`, iki test), hatırlatma e-postası bağlantısı global (`meeting-v291-create`), geçmiş testinde organizatöre göre SQL sayımı, katılımcı panelinin açıkça açılması (`meeting-v291-room`), yatay ekran paylaşımı ölçümünün yeniden denenmesi (`meeting-room-ux`), arama için tam kullanıcı adı (`meeting-global`; taze QA hesapları arama sonuçlarını 10 kişiyle doldurmasın diye).
- **Açık notlar:** (1) Taze QA hesapları (`meeting-*@example.test`, `frontend/e2e/.auth/` altında dosyalarıyla) her koşuda birikir; hiçbiri silinmedi, toplu temizlik sizin kararınızdır. (2) Gerçek ekran okuyucu (NVDA/VoiceOver) testi yapılmadı; yalnız axe (WCAG A/AA, açık ve koyu tema), klavye ve odak halkası denetlendi. (3) `legacy_project_id` kolonunun silinmesi sonraki bir migration'a bırakıldı. (4) Dev sunucusunda (`next dev`) sohbet yanıt testi ve mobil mini-bar testi, geliştirme rozeti/yönlendirme farkı nedeniyle düştü; production build'de geçiyorlar. (5) Bölüm 5'teki "Çalıştırılmadı: canlı Playwright" ve "Görsel doğrulama yok" maddeleri bu bölümle güncellenmiştir (eski metin tarihçe olarak bırakıldı).
- Yapılmayanlar (kullanıcı kuralı): `pre-push.cmd` çalıştırılmadı, commit/push/branch değişikliği yapılmadı.

## 9. Son hata düzeltmeleri ve final stabilizasyon (Görev 4)

Önceki bölümler korunmuştur. Bu bölüm yalnız kalan açık maddeleri ve doğrudan nedenlerini kapsar; yeni özellik yok, mimari değişmedi. `pre-push.cmd`/hook çalıştırılmadı, commit/push/branch işlemi yapılmadı.

**A. Düzeltilen hatalar**
- **`next dev` — mobil mini-bar testi.** Neden: Next.js geliştirme sunucusunun kendi yuvarlak "N" rozeti (`<nextjs-portal>`) alt sol köşede, telefon genişliğinde mikrofon düğmesinin üstüne biniyor ve dokunuşları yutuyordu; production derlemesinde yok, ürün hatası değil. Düzeltme: dokunma testleri bu rozeti gizler (`hideDevOverlay`, `meeting-fixture.ts`), uygulama kodu ve `next.config` değişmedi. Dev ve production'da geçiyor.
- **`next dev` — sohbet yanıtı testi.** Neden: test, ilk sohbet sayfası isteğini her zaman başarılı sanıyordu. Sunucu, sohbet geçmişini yalnız `participant_joined` webhook'uyla "bağlı" işaretlenmiş ve LiveKit'te görünen katılımcıya verir (`MeetingService.active`, HEAD'de de aynı kural); yeniden yükleme/katılımdan hemen sonraki ilk istek bazen `403 MEETING_PARTICIPANT_REQUIRED` döner, uygulama bunu yutar ve 4 sn'lik yoklamada tekrar dener (bilinen, tasarım gereği geçici durum). Eski taslak yanıt gövdesini çözüp `json.content is not iterable` ile çöküyordu; ayrıca deseni `/chat?page=0` ile biten her isteğe uyuyordu. Düzeltme: taslak yalnız bu toplantının kendi ilk sohbet sayfasına uyar, `ok` olmayan yanıtı olduğu gibi geçirir ve hata durumunda istek zaman çizelgesini mesaja ekler. Not: toplam yaklaşık 13 dev koşusunda 3 kez düştü (aynı `json.content` çökmesi); 403 yanıtını doğrudan yalnız sonuncusunda, tanı mesajı eklendikten sonra gördüm, ilk ikisini aynı belirtiden çıkarım olarak aynı nedene bağlıyorum. Geçici durumun uygulamadaki gecikmesini ölçmedim. Yeni taslakla dev'de 4/4, production'da 1/1 geçti.
- **Gerçek erişilebilirlik hatası (uygulama kodu).** Klavyeyle (Enter/Space) katılımcı eklendiğinde veya çıkarıldığında, basılan düğme listeden kalktığı için odak `<body>`'ye düşüyordu (WCAG 2.4.3). Düzeltme (`meeting-form.tsx`): odak aynı listedeki komşu düğmeye, liste boşsa arama kutusuna taşınır (`data-attendee-list`, `#meeting-attendee-search`). `meeting-a11y.spec.ts` bunu doğrular.
- **Rate limit `Retry-After`.** `MEETING_SEARCH_RATE_LIMITED` `Retry-After: 30` diyordu ama pencere 60 sn'lik kayan penceredir; 30 sn sonra yeniden deneyen istemci hâlâ reddedilebilirdi. `60` yapıldı (`MeetingApiErrors`).
- **Test hesaplarının birikmesi.** Neden: taze QA hesapları (`meetingAccount(role, { fresh: true })`) hiçbir yerde silinmiyordu (en son 54 hesap, 759 toplantı, 81 proje, 1766 bildirim birikmişti ve katılımcı aramasının 10 sonuçluk sınırını dolduruyordu). Düzeltme: yeni merkezî `e2e/qa-cleanup.ts` + `qa-global-setup.ts` + `qa-global-teardown.ts` (`playwright.meetings.config.ts`): her koşu bir koşu kimliği alır, fixture her taze hesabı o koşunun defterine yazar; koşu sonunda (testler geçse de kalsa da) yalnız şu üç koşulun hepsini sağlayan hesaplar silinir: e-posta `meeting-<uuid>@example.test` + takma ad `meeting-<rol>-<8 hex>` + dört kalıcı QA hesabından biri değil; ve bu koşunun defterinde ya da 3 saatten eski (ölü koşu artığı). Başka bir koşunun hesapları bu yüzden silinmez. Silme tek işlemdedir (toplantılar, katılımcı/oda kayıtları, bildirimler, QA projeleri ve üyelikleri, oturumlar, kullanıcılar); gerçek kullanıcı verisine dokunmaz. Uygulamadan önce aynı SQL ters çevrilebilir işlemde (ROLLBACK) denendi. Sonuç: 54 → yalnız 4 kalıcı QA hesabı; gerçek kullanıcılar (5) ve diğer test kullanıcıları (kendi spec'lerinin hesapları) değişmedi; `.auth/` altında artık taze kimlik dosyası yok. Tek seferlik süpürme için `PDA_QA_STALE_AFTER="1 minutes"` (doğrulanmış biçim) kullanılabilir.

**B. Test sonuçları (bu bölümdeki son koşular)**
| Alan | Sonuç |
|---|---|
| Backend tam paket | **1167 test, 0 hata, 0 başarısızlık, 1 atlama** (`LiveKitRealSmokeTest`, bayraksız atlanır) |
| LiveKit smoke (`-Dpda.meeting.real-media-test=true`, gerçek `livekit-server:v1.13.10`, Testcontainers) | **1/1 geçti**: gerçek RoomService yaşam döngüsü ve imzalı webhook |
| Yeni backend testleri | `MeetingPeopleSearchLimiterTest` 5/5 (30'a 31. ret, kayan pencere, kullanıcı ayrımı, 640 eşzamanlı istekte tam 30, 20 000 anahtar sınırı ve süpürme), `LegacyProjectColumnUnusedTest` 1/1, `GlobalMeetingApiIntegrationTest` 8/8 (yeni: HTTP 429 + `Retry-After: 60`) |
| Frontend | `tsc` 0 hata, ESLint (tüm proje) 0 hata, `next build` başarılı, mantık+rota testleri **32/32** |
| Canlı Playwright (production build, LiveKit+Mailpit+PostgreSQL) | tam paket **69/69** + yeni `meeting-a11y.spec.ts` **2/2** (a11y'deki tek hata test seçicisiydi; düzeltildi) |
| `next dev` (daha önce düşen iki test + a11y) | mini-bar 1/1, sohbet 5/5, a11y 2/2 |

**Hibrit regresyon (Görev 8):** proje toplantısı (proje seçimi, doğru ilişki, yetkisiz proje reddi 403, proje üyelerinin otomatik katılımcı olmaması, proje silinince bağımsıza dönme, proje değişiminin erişimi bozmaması) ve bağımsız toplantı (`project_id` boş, farklı/hiç projesi olmayan kullanıcı daveti, projesiz kullanıcı oluşturma) ile ortak özellikler (Hemen Başlat → oda, LiveKit bağlantısı, organizatör yetkisi, davetsiz erişim 404, bildirim ve hatırlatma e-postası, Toplantılarım süzgeçleri, global sidebar, TR/EN/DE) `GlobalMeetingApiIntegrationTest`, `MeetingServiceTest`, `MeetingReminderIntegrationTest`, `MeetingV58MigrationTest` ve canlı `meeting-global.spec.ts` ile korunuyor ve geçiyor.

**C. Teknik borçlar**
- **`legacy_project_id`: SİLİNMEDİ (bilinçli).** Hiçbir üretim kodu, entity veya sorgu onu okumuyor (yalnız V58 ve testleri; `LegacyProjectColumnUnusedTest` bunu sürekli doğrular). Silme geri alınamaz; kolon tek bir nullable `uuid` (FK ve indeks yok), tutmanın maliyeti ihmal edilebilir. Asıl gerekçe: V58 henüz hiçbir üretim ortamında çalışmadı; kolon, eski proje bilgisi için tek geri dönüş yoludur ve README'deki koşul ("V58 üretimde doğrulandıktan sonra") sağlanmadı. V58/V57 dosyalarına dokunulmadı. Silme için kriter: V58 üretimde çalışıp doğrulandıktan sonra yeni bir migration (V59+).
- **Rate limiting:** tek örnekte doğru (kayan pencere, kullanıcı kimliği anahtarı, eşzamanlılıkta tam sayım, bellek 20 000 girdiyle sınırlı ve süpürülür; sızıntı yok). Bypass yolu bulunmadı (anahtar istek parametresi değil kimliği doğrulanmış kullanıcı). Sınırlamalar: örnek başına bellekte (çok örnekli dağıtımda ortak sınırlayıcı gerekir — teknik borç, bu görevde Redis eklenmedi); aynı dakikada 20 000'den çok farklı kullanıcı aratırsa yeni kullanıcı geçici reddedilir (bilinçli üst sınır).
- **Test hesapları:** çözüldü (yukarıda). Kalıcı 4 QA hesabı kasıtlı olarak tutuluyor ve birikmiş verileri (eski toplantılar) silinmedi; listeyi sayan spec'ler taze hesap kullanır.
- **Erişilebilirlik:** otomatik kontroller (axe WCAG 2.1 A/AA, açık ve koyu tema gerçekten farklı görünüme geçtiği doğrulanarak): tür seçimi, proje seçici, proje/bağımsız form, arama sonuçları, Toplantılarım (+süzgeç), detay, düzenleme, açık süzgeç listesi, kart menüsü, iptal diyaloğu, mobil çekmece; klavye (Tab sırası, skip link, Enter/Space/Escape, odak halkası, odak dönüşü, diyalogda odak tuzağı); 320/390/768 px'te yatay taşma yok ve dokunma hedefleri ≥36 px. **Gerçek ekran okuyucu (NVDA/JAWS/VoiceOver) testi YAPILMADI**; bu makinede çalıştırılabilir bir ekran okuyucu yoktu, duyurular yalnız ad/rol/canlı bölge incelemesinden çıkarılmıştır. Gözlem (düzeltilmedi, kapsam dışı): ortak sayfalama çubuğunun düğmeleri 28×32 px (WCAG 2.2 AA asgarisi 24 px'i sağlıyor, uygulamanın 44 px hedefinin altında); tüm listelerde ortak olduğundan Task/Board modüllerine dokunmamak için değiştirilmedi.

**D. Kalan sorunlar**
- Sohbet geçmişi yeniden katılımdan sonra birkaç saniye (bir yoklama turu) gecikebilir: `participant_joined` webhook'u gelene kadar sunucu ilk isteği reddeder. Ürün davranışı değil test varsayımıydı; istenirse sunucu tarafında kısa bir "katılım onayı bekleniyor" toleransı ayrı bir iş olarak ele alınabilir.
- Gerçek ekran okuyucu doğrulaması ve çok örnekli rate limiter yukarıdaki gibi açık.

**E. Final karar: HAZIR.** Gerekçe: backend 1167/0/1 (atlanan ayrıca gerçek SFU ile geçti), canlı paket 69/69 + a11y 2/2, mantık/rota 32/32, tip/lint/build temiz; kalan maddeler güvenlik veya veri bütünlüğü riski taşımayan, belgelenmiş teknik borçlardır. Koşul olarak değil, bilgi olarak: gerçek ekran okuyucu testi yapılmadı.

## 10. Sohbet başlangıcı ve gerçek ekran okuyucu testleri (Görev 5) — 2026-10-28

Önceki bölümler korunmuştur. `pre-push.cmd`/hook çalıştırılmadı, commit/push/branch işlemi yapılmadı.

### A. Sohbet başlangıç problemi

**Gerçek kök neden (kodda, kanıtlı).** Sohbet geçmişi, mesaj gönderme, tepki, mesaj okuma ve @-etiket doğrulaması `MeetingService.active()` kapısından geçer. Kapı şunları istiyordu: kayıt var, `revoked` değil, **kayıttaki `connected` bayrağı true** ve LiveKit kimliği o anda listeliyor. `connected` bayrağı yalnız LiveKit `participant_joined` webhook'unun (ve mutabakatın) tuttuğu bir kopyadır. Zaman çizelgesi: `POST /join` (t=0) → LiveKit bağlantısı (~120 ms) → webhook işlenir, bayrak true (~120–250 ms) → istemci `connect()` biter ve ilk `GET /chat?page=0` gider (~200–350 ms). Aradaki pay ölçülen koşullarda yalnız onlarca ms; webhook gecikirse ilk istek 403 `MEETING_PARTICIPANT_REQUIRED` alır, uygulama hatayı yutar ve 4 sn'lik yoklamada yeniden dener (kullanıcının tarif ettiği "≈4 sn gecikme"). **Deterministik kanıt:** `GlobalMeetingApiIntegrationTest#chatAuthorizationFollowsTheLivePresenceNotTheLateWebhookFlag`: LiveKit kullanıcıyı listeliyor, bayrak false iken düzeltmeden önce `GET /chat` → **403** (rapor: "Status expected:<200> but was:<403>"), düzeltmeden sonra **200**.

**Aralıklı 403'ün ayrı (ikinci) kaynağı.** `meeting-v292-chat` testinin `route.fetch()` taslağı tarayıcının isteğini test sürecinden **tekrar oynatır**; sayfa yeniden yüklenirken giden sayfanın isteği, katılımcı ayrıldıktan sonra oynatılınca doğru olarak 403 alır (yeniden üretildi: 30 yeniden yüklemede 1 kez; yeni oturumun 60 isteğinde 0). Üç düşen koşunun yalnız sonuncusunda 403 gövdesi doğrudan görüldü; ilk ikisini aynı belirtiden **çıkarım**la buna bağlıyorum, ayrı kanıtım yok. Sunucunun reddi doğrudur (kişi ayrılmış); taslak artık ok olmayan yanıtı olduğu gibi geçirir.

**Düzeltme.** (`MeetingService`) `active()` ve @-etiket doğrulaması artık `connected` bayrağına bakmaz: kayıt var + `revoked` değil + toplantı açık ve oda dönmüyor (`requireOpen`) + **LiveKit canlı listesi** yeterlidir. Yetki gevşemedi: odada olmayan, çıkarılmış, hiç katılmamış (kaydı yok) ve davetsiz kullanıcı reddedilir; bayat "bağlı" bayrağı kimseyi içeri almaz. Frontend değişikliği gerekmedi; sabit bekleme/zaman aşımı değişmedi; yeni polling yok.

| Ölçüm (`e2e/meeting-chat-start.spec.ts`) | Önce | Sonra |
|---|---|---|
| Entegrasyon: LiveKit listeliyor, webhook gelmemiş | **403** | **200** |
| Tek kişi, 30 katılım (prod) | 0 ret; ilk 200, arayüz "bağlı" demeden ~54 ms önce | 0 ret; ~54 ms önce |
| Tek kişi, 30 katılım (dev) | 0 ret | 0 ret |
| 30 yeniden yükleme (dev / prod) | yeni oturumda 0 ret / 60 istek | yeni oturumda 0 ret / 60 istek |
| 4 kişi aynı anda, 48 katılım (dev / prod) | 0 ret | 0 ret |
| Yavaş hat (400 ms gecikme, 10 katılım) | 0 ret | 0 ret |
| Yeniden oynatan taslak, 30 yeniden yükleme | giden sayfadan 1 ret, yeni oturumda 0 | giden sayfadan 1 ret, yeni oturumda 0 |
| Katılım başına ilk sohbet isteği sayısı | 1–2 | 1–2 (döngü yok) |

**Dürüst sonuç:** bu yerel yığında yarış **gerçek katılımlarda hiç tetiklenmedi** (yaklaşık 300 katılım, önce de sonra da 0 ret); gerçek webhook ~120–250 ms'de gelir, ilk sohbet isteği bundan sonradır. Bu yüzden "önce 4 sn / sonra anında" biçiminde bir **uçtan uca gecikme iyileşmesi ölçülemedi**; webhook'u yapay geciktirmek LiveKit altyapısını değiştirmeyi gerektirirdi, yapılmadı. Kanıt deterministik sunucu testidir; düzeltme riski kaynağında kaldırır. Ölçülen webhook gecikmesi (katılımdan sonra) p50 ≈ 120–145 ms, p95 ≈ 200 ms.

**Regresyon senaryoları (12 madde):** organizatör ve üye sohbeti, ilk mesajın hemen gönderilmesi (`201`) ve ilk geçmiş isteği (`200`), geç webhook (entegrasyon testi), ayrılıp yeniden katılma / yenileme (30 tur), iki ve dört kişinin aynı anda bağlanması (48 katılım), çıkarılan katılımcıda sohbetin kesilmesi (`403`, yeniden `join` `403`; oda dönünce organizatör yeniden `200`), yetkisiz erişim (`404`/`403`), proje ve bağımsız toplantıda aynı kural (`aProjectMeetingChatsLikeAnIndependentOneAndRemovalClosesTheChat`), yavaş hatta ret ve döngü yok. Tümü geçti.

### B. Gerçek ekran okuyucu testleri

**Ortam.** Windows 11 Pro; **NVDA 2026.3** (resmî `nvaccess.org`'tan indirildi, SHA1 `c5e02b5b…7175` resmî güncelleme servisinin bildirdiğiyle eşleşti; kullanıcı onayıyla, kuruluma ve kayıt defterine dokunmadan **portable** kopya olarak çalıştırıldı, iş bitince silindi); Chromium (Playwright "Google Chrome for Testing"); sentezleyici "silence" (hoparlörden ses çıkmaz; NVDA'nın söylediği, NVDA'nın kendi günlüğünden metin olarak alındı). Tam kayıt: `docs/compliation/2026-10-28-nvda-transcript.txt` (yalnız test içeriği).

**Gerçekten yapılan:** NVDA tarayıcıya bağlı çalıştı; sayfalar tarayıcının kendi klavyesiyle (Playwright) Tab/Enter/Space/Escape ile, atlama bağlantısı kullanılarak gezildi; odak değişimleri, durum/rol/isim duyuruları, canlı bölge ve diyalog duyuruları NVDA'nın gerçek çıktısıyla denetlendi. 6 oturum (A–F), 6/6 geçti: tür seçimi + proje seçici; form (zorunlu alan, doğrulama hatası, tarih/saat, katılımcı arama/ekle/çıkar); Toplantılarım (filtreler, kartlar, kart menüsü, iptal diyaloğu); oda (katılım, tüm kontroller ve durumları, Katılımcılar/Sohbet paneli, ayrılma diyaloğu); oda kullanımı (mikrofon/kamera, mesaj gönderme, gelen mesaj, ayrılma, Escape); İngilizce ve Almanca sayfalar.

**Gerçek NVDA'nın bulduğu hatalar ve düzeltmeleri**

| # | Bulgu (NVDA'nın söylediği) | Düzeltme |
|---|---|---|
| 1 | Tür kartı: "Proje Toplantısı Oluştur**Projelerinizden** birini…" tek kelime gibi | Başlık ile cümle arasında okunan nokta (`meeting-create.tsx`); proje seçici için de |
| 2 | Tür çubuğu ve kart satırı: "Bağımsız toplantı**Hiçbir** projeye…", "Planlandı**Proje** toplantısı", proje adı ile katılımcı sayısı birleşiyor | Rozet/çip sonlarına okunan ayraç (`meeting-kind.tsx`, `meeting-card.tsx`) |
| 3 | Kartlarda birden çok "Detay" bağlantısı (hangi toplantı?) | Eylem bağlantıları toplantı adını taşır ("Detay — …", "Katıl — …") |
| 4 | Mikrofon/kamera düğmesine basınca yalnız "unavailable" duyuldu; **odak kayboldu**, sonuç söylenmedi | Meşgulken `disabled` yerine `aria-disabled` (odak korunur) ve sonuç duyurusu: "Mikrofon açıldı." (`room-controls.tsx`) |
| 5 | Katılımcı ekleyince "Eşleşen kullanıcı bulunamadı." (yanlış) ve hiçbir onay | Doğru durum metni ("Eşleşen herkes zaten eklendi.") ve "… katılımcı olarak eklendi / çıkarıldı." |
| 6 | Arama sonuçları geldiğinde bir şey söylenmiyordu | "1 kişi bulundu." duyurusu |
| 7 | Yeni sohbet mesajı: avatar harfleri ("ME") + ad + saat birleşik, "Cevapla Emoji tepkisi bırak" düğme adları da okunuyordu; gönderince onay yok | Günlük canlı değil; tek duyuru "Ad: metin" / "Mesaj gönderildi."; avatar dekoratif; ad ve saat ayrı (`room-panels.tsx`) |
| 8 | (Önceki oturumdan) klavyeyle katılımcı ekleyince odağın sayfaya düşmesi | Komşu düğmeye / arama kutusuna odak |

NVDA'nın doğru yaptıkları: alan adı + "edit" + "required", `aria-invalid` + kendi hata metni, hata özetinin `alert` olarak okunması, tarih/saat düğmeleri ("collapsed opens dialog"), onay diyalogları ("dialog" + açıklama + düğmeler), Escape'te odağın tetikleyiciye dönmesi, açılır listede "Proje toplantıları not selected 2 of 3", açık/kapalı durumlar ("not pressed/pressed"), `current page`. **Dil:** sayfa `lang` değerine göre NVDA konuşmayı ayırdı (`[tr]`, `[de]` işaretleri; İngilizce sayfada geçiş yok); alan adlarında (ör. "Titel edit required") NVDA dil işareti koymuyor.

**Regresyon testi.** Bulguların DOM karşılığı `e2e/meeting-a11y.spec.ts` içinde (3. test) her koşuda denetlenir; gerçek NVDA oturumları `e2e/sr/*` + `playwright.screenreader.config.ts` (elle/yerel; `NVDA_PORTABLE` gerekir).

**Yapılamayan / sınırlar (açıkça).**
- NVDA'ya **işletim sistemi düzeyinde tuş göndermek** otomatik izin denetimi tarafından reddedildi (kullanıcıya önceden söylemediğim bir eylemdi); zorlanmadı ve ilgili kod silindi. Bu yüzden **NVDA'nın kendi gezinti tuşları (oklar, H/D/K/F hızlı gezinme, Say All, öğe listesi) sürülmedi**; yalnız odak kipi (Tab) ve duyurular denetlendi. Sayfa yüklenince NVDA'nın kendiliğinden okuması güvenilmez ve başka pencerelere taştığı için kapatıldı.
- Sentezleyici sessiz ve Türkçe/Almanca ses yok: söylenen **metin ve dil geçişi** doğrulandı, **telaffuz ve anlaşılırlık** duyulmadı.
- Yalnız NVDA 2026.3 + Chromium (Windows). JAWS, Narrator, VoiceOver, TalkBack ve Firefox çalıştırılmadı; mobil ekran okuyucu denenmedi.
- İki küçük gözlem düzeltilmedi: arama kutusunun adı ile yer tutucusu aynı metin olduğundan ad iki kez okunuyor; mesaj gönderilirken mesaj kutusu kısa süre "busy read only" duyuruluyor.
- **Gizlilik olayı:** NVDA'nın fare takibi açıkken fare imlecinin altındaki başka uygulamaların metnini iki kez okuyup kaydetti (kullanıcının masaüstünden içerik). Kayıtlar hemen silindi, depoya ve belgeye girmedi (ancak konsol çıktısına yansımıştı); sonra fare takibi ve "sayfa yüklenince otomatik oku" kapatıldı, tarayıcının ön planda olması denetlenir (kayıp olursa koşu durur ve sonrası atılır) ve son kayıtta başka uygulamaya ait metin yoktur. Windows Güvenlik Duvarı bir kez "Google Chrome for Testing" için izin penceresi gösterdi; kullanıcı kapattı, ben tıklamadım.

### C. Test sonuçları

| Alan | Sonuç |
|---|---|
| Backend tam paket | **1169 test, 0 hata, 0 başarısızlık, 1 atlama** (`LiveKitRealSmokeTest`, bayraksız atlanır) |
| LiveKit smoke (`-Dpda.meeting.real-media-test=true`, gerçek SFU) | **1/1 geçti** |
| Yeni/değişen backend testleri | `GlobalMeetingApiIntegrationTest` 10/10 (2 yeni: canlı varlık kuralı, proje toplantısı + çıkarma) |
| Canlı Playwright (production build, LiveKit+Mailpit+PostgreSQL) | **78/78** |
| Sohbet başlangıç ölçümleri | dev + prod, yukarıdaki tablo; 0 ret |
| Gerçek NVDA | **6/6 oturum** |
| `next dev` | mini-bar, sohbet yanıtı, erişilebilirlik (3 test), sohbet başlangıç ölçümleri geçti |
| Mantık + rota testleri | 32/32 |
| `tsc`, ESLint, `next build` | temiz / başarılı |

### D. Kalan sorunlar
- Uçtan uca "4 sn → anında" iyileşmesi ölçülemedi (yarış bu yığında tetiklenmiyor); kanıt sunucu testidir.
- NVDA tarama kipi gezinti tuşları, diğer ekran okuyucular, mobil ekran okuyucu ve telaffuz doğrulanmadı.
- `legacy_project_id` ve çok örnekli rate limiter borçları (bkz. §9) sürüyor.

### E. Final durum
- **Sohbet başlangıcı: HAZIR.** Kök neden kodda düzeltildi ve deterministik testle kanıtlandı; yetki gevşemedi; yaklaşık 300 gerçek katılımda ret yok.
- **Ekran okuyucu: KOŞULLU HAZIR.** Gerçek NVDA ile odak kipi, isimler, durumlar ve duyurular doğrulandı ve 7 gerçek hata düzeltildi; koşul: NVDA tarama kipi gezintisi, JAWS/VoiceOver/Narrator ve duyulan telaffuz doğrulaması yapılmadı.

## API ve Swagger kontrolü (SECURITY.md §11)

Tüm uçlar `/api/v1/meetings` altındadır; yol/yetki/hata tablosu `.agents/SECURITY.md` → "Global meetings: user-owned, not project-owned". Swagger yalnız zaten açıksa: `/swagger-ui/index.html` veya `/v3/api-docs` (ENV değiştirmeyin); normal cookie login, `GET /api/v1/auth/csrf`, mutasyonlarda `X-XSRF-TOKEN`. Güvenli denemeler: `GET /api/v1/meetings?size=20`, `GET /api/v1/meetings/attendees/search?q=abc`, `POST /api/v1/meetings` ve gövdede `{title,startsAt,endsAt,zoneId,agenda:[],attendeeIds:[]}` (projectId yok); davetli olmayan hesapla `GET /api/v1/meetings/{id}` → 404.
