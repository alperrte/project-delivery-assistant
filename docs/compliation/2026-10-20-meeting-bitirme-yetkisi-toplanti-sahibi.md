# Toplantıyı herkes için bitirme yetkisi yalnız toplantı sahibine

Kaynak görev: `.agents/PDA_Meeting_System_Toplanti_Sahibi_Bitirme_Yetkisi_Nihai_Prompt.md`. Commit, push ve production dağıtımı yapılmadı. Yeni veritabanı alanı veya migration yok.

## Kök neden
`POST /api/v1/projects/{p}/meetings/{m}/end` (`MeetingService.end`) yetkiyi `moderate()` ile, yani yalnızca "Project Manager rolü" ile denetliyordu; toplantıyı oluşturanın kayıtlı kimliği (`meetings.organizer_id`) hiç bakılmıyordu. Aynı projedeki her yönetici toplantıyı herkes için bitirebiliyor, sıradan üye olan oluşturan ise bitiremiyordu. Arayüz de aynı kuralı `isManager` ile uyguluyordu (oda alt çubuğu, "Diğer" menüsü, toplantı detayı).

## Backend
- `MeetingService.owner()`: aktif proje üyeliği (mevcut `member()` denetimi) **ve** `actor == meeting.organizerId`; aksi halde `403 MEETING_OWNER_REQUIRED`. `end()` artık yalnız bunu kullanır; sahibin üyeliği kalkmışsa veya hesabı pasifse mevcut erişim kontrolleri nedeniyle yine 403.
- Sahip, sunucudaki kalıcı `organizer_id` alanından okunur (`create` içinde oturumdaki kullanıcı olarak yazılır); istemci kaynaklı hiçbir alana güvenilmez. İlk katılan, LiveKit'i ilk başlatan veya Project Manager olmak sahiplik vermez. `organizer_id` zorunlu (NOT NULL) olduğundan eski toplantılar da doğru sahibi taşır; boş/yanlış değer asla bir yöneticiye atanmaz (`actor.equals(...)` ile reddedilir).
- Değişmeyenler: `mute`, `kick` (`stageKick`), davet, başlat/iptal (`edit`) kuralları ve Project Manager'ın bunlardaki yetkisi. Sistemin kendi sonlandırmaları (zamanlayıcı, boş oda süresi) `finish(m,null)` ile ayrıdır.
- LiveKit: katılımcı token'ları `roomAdmin`/`roomCreate` içermez, `canPublishData=false`; oda silme ve moderasyon yalnız sunucu anahtarıyla backend'den (`MeetingModeration.end` → `MeetingLifecycle.tick`) yapılır. İstemcinin odayı kapatabileceği ikinci bir yol yoktur. Bitişte tüm katılımcılar iptal edilir (`revoked`), yeniden katılım 409 verir.

## Frontend
`meeting-room.tsx` ve `meeting-detail.tsx`: "Toplantıyı herkes için bitir" yalnız `meeting.organizerId === oturumdaki kullanıcı` iken görünür (masaüstü alt çubuk düğmesi, telefondaki "Diğer" menüsü, detay sayfası). Susturma/çıkarma düğmeleri Project Manager'da kaldı. Onay penceresi, "Ayrıl" ve mini bar (yalnız Ayrıl) olduğu gibi. `use-meeting-room.ts` toplantı durumuna `organizerId` tipini ekledi. Misafir odası hiçbir zaman sahip sayılmaz.

Bu görevde ayrıca bulunan bir hata düzeltildi: sohbet taslağı oturumdan okunup bir render geç geldiği için hızlı yazım/emoji eklemede tuş vuruşlarının üzerine yazılabiliyordu (emoji testinde bir kez görüldü). Metin kutusu artık yerel state ile sürülüyor ve her değişiklik oturuma yazılıyor (sayfa dışındayken taslak yine korunur).

## Testler
- Backend: `MeetingServiceTest` 19, `MeetingCoreIntegrationTest` 15 (gerçek PostgreSQL), `MeetingHttpSecurityTest` 6, `ModularityTest` 1 geçti. Yeni: sahip olmayan yönetici/üye/üyeliği kalkmış sahip 403; sahip yönetici değilken bitirebilir; ilk katılan sahip olmaz; mute yönetici için sürer; bittikten sonra katılım 409.
- Frontend (gerçek API + LiveKit): `meeting-session.spec.ts` içindeki iki yeni test — üye tarafından oluşturulan toplantıda yönetici butonu görmez ve doğrudan API'de 403 alır, sahip görür, iptal toplantıyı sürdürür, ayrılmak bitirmez, geri dönünce buton var, telefon menüsü, misafir göremez ve API'ye ulaşamaz, onayla herkesin odası kapanır ve yeniden katılım 409; yönetici tarafından oluşturulan toplantıda ikinci yönetici önce katılsa da sahip olmaz, moderasyonu sürer, mini barda bitirme yok. Toplantı paketi 22/22; emoji ve taslak testleri 4'er tekrarla 8/8. `tsc`, `eslint`, `npm run build` temiz/başarılı.

## Açık kalan konular
- Sahiplik devri yok (istenmedi). Sahibi pasif/üyeliği kalkmış bir toplantıyı yalnız sistem kuralları (süre/boş oda) kapatır; hiçbir yönetici otomatik sahip olmaz.
- Eski toplantılarda doğru sahiplik, `organizer_id` NOT NULL olduğu için şema düzeyinde garantili; üretim verisi üzerinde ayrıca sorgulanmadı.
- Yerel testler test amaçlı yerel Mailpit/limit override'ı ile koşuldu (`tmp/docker-compose.e2e.yml`); iş bitince backend normal yapılandırmaya döndürüldü.
