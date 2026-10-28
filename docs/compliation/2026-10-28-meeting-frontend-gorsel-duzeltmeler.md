# Toplantı frontend görsel düzeltmeleri — 2026-10-28

## Tamamlanan kapsam

Toplantı oluşturma, planlama, başlatma, katılma, davet ve oda birincil aksiyonları diğer çalışma alanı sayfalarıyla aynı default/primary butonlarını kullanır. Seçili toplantı ikonu da primary paletindedir. Toplantı tür/proje seçicileri ve formu listeyle aynı içerik genişliğine hizalandı. Mini kartta geri dönüş düğmesi ayrı tam genişlikte satırdadır; dar ve sürüklenmiş durumda metin kesilmez. Destructive aksiyonlar korunur.

## Değişen önemli dosyalar

`frontend/src/features/meetings/` içindeki `meeting-card`, `meeting-create`, `meeting-detail`, `meeting-form`, `meeting-icons`, `meetings-page`, `room/invite-dialog`, `room/participant-menu`, `room/room-panels` ve `session/meeting-mini-bar` TSX dosyaları. Ortak sürüm ve toplu standart belgeleri ayrı `general-features` commitindedir.

## Çalıştırılan doğrulama komutları

```powershell
node frontend/node_modules/@playwright/test/cli.js test --config=tmp/frontend-fixes/playwright.config.cjs --grep 'meeting actions' --output=tmp/frontend-fixes/meeting-results
node frontend/node_modules/@playwright/test/cli.js test --config=tmp/frontend-fixes/playwright.config.cjs --grep 'mini return'
```

Birleşik yerel değişiklikler üzerinde TypeScript ve diff kontrolü de geçti.

## Test/doğrulama sonuçları

Toplantı buton/ikon/hiza TR/EN/DE 3/3; gerçek yerel LiveKit ile mini navigasyon, geri dönüş ve sürükleme TR/EN/DE 3/3 PASS. Açık/koyu tema ve 320/390/1440 px kontrolleri başarılı. Görüntüler incelendi. PDA REST verileri sentetikti; test için oluşturulan geçici LiveKit container'ı sonrasında kaldırıldı. Production veya gerçek kullanıcı verisi değiştirilmedi.

## Açık kalan konular ve doğrulanmayan sınırlar

Kullanıcı isteğiyle pre-push/backend testleri çalıştırılmadı. Ayrı OS Picture-in-Picture penceresi açılmadı; asıl sayfa geçişindeki mini kart gerçek oturumla doğrulandı. Bu çalışma frontend sürüm grupları 2.9.5, 2.9.6 ve 2.9.8'in toplantı kısmıdır; ortak APP_VERSION ayrı committe 2.9.9 olur. Bu kayıt production yayını anlamına gelmez.

## Kullanıcının manuel kontrol adımları

Toplantılarım → tür/proje seçimi → proje ve bağımsız form → planlanmış toplantıyı başlat → katıl/davet et → başka sayfada mini kart → toplantıya dön akışını iki temada kontrol edin. Commitlerin hedefi `meeting-system-frontend`; push ve main merge kullanıcı tarafından yapılacak.
