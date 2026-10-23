# Toplantı sistemi V2.9.1 (backend)

Dal: `meeting-system-backend`. Frontend ayrı dalda: bkz. `2026-10-23-meeting-system-frontend-v291.md`. Commit SHA'ları teslim raporunda ve `git log` çıktısında verilir (bu dosya kendi commit'ini gösteremez).

## Durum

Backend kapsamı tamamlandı; hedefli testler geçti. E-posta tasarımı (MSF-10) kullanıcı tarafından 3 dilde, masaüstü/mobil/koyu görünümleriyle incelenip **onaylandı**; renkler, logo, bilgi kartı ve buton yerleşimi korunur, ek görsel değişiklik yoktur. Tam `pre-push` çalıştırılmadı (kullanıcı talimatı); push, merge ve dağıtım yapılmadı.

## Kapsam ve kök nedenler

- **MSF-06 simge:** `meetings.icon` (NOT NULL, varsayılan `video`) + allowlist CHECK; servis `MEETING_INVALID_ICON` ile allowlist dışını reddeder; güncellemede alan gönderilmezse mevcut simge korunur.
- **MSF-07 "Hemen başlat" 400:** Kök neden, istemcinin cihaz saatiyle gönderdiği `startsAt` değerinin sunucu saatiyle sapma yüzünden geçmişte/ileride kalıp `MEETING_INVALID_SCHEDULE` vermesiydi. Çözüm: `Command.startNow=true` ise sunucu `startsAt`'i kendi saatinden atar (yönetici ve üye için doğrulandı; −45 s…+45 s sapma).
- **MSF-08 geçmiş:** `meeting_user_hidden` tablosu; liste `hidden=EXCLUDE|INCLUDE|ONLY` (varsayılan EXCLUDE, takvim her şeyi görür); `GET /history` sayı, `POST /history/clear|restore` yalnız çağıranın ENDED/CANCELLED toplantılarını gizler/geri getirir (idempotent). Başkalarının görünümü ve toplantı kaydı değişmez.
- **MSF-09 hatırlatma:** Organizatör + tüm davetliler için tek mail, 3 kullanıcılı gerçek Mailpit testiyle doğrulandı. Üretimde "bazı kişilere gitmedi" şikâyetinin kodda tek bir kusurdan kaynaklandığı **bulunamadı**; olası nedenler doğrulanmış adres yokluğu, proje üyesi olmama, projenin erişilemez olması veya toplantıdan çıkarılmaydı ve bunlar daha önce izlenemiyordu. Artık her atlama `Meeting reminder delivery=… skipped reason=…` günlüğüne ve `error_code` sütununa `RECIPIENT_UNAVAILABLE`/`NOT_A_PROJECT_MEMBER`/`PROJECT_UNAVAILABLE`/`REMOVED_FROM_MEETING` olarak yazılır (adres/içerik yok).
- **MSF-10 e-posta:** PDA markalı şablon (600 px tablo düzeni, satır içi CSS, koyu mod bloğu, `cid:pda-logo` gerçek logo, kurşun geçirmez mavi CTA, yedek bağlantı, kişiselleştirilmiş selamlama, TR/EN/DE, HTML + düz metin). Gerçek şablondan yerel web önizlemesi: `backend/target/email-preview/index.html` (`MeetingReminderMailPreviewTest` üretir); Playwright görüntüleri `mail-*` (tr/en/de, 375/680 px, açık/koyu). Gerçek kişilere test e-postası **gönderilmedi**; yalnız yerel Mailpit.
- **Güvenlik yolu:** Backend açık yol allowlist'i kullanır; yeni geçmiş uçları `SecurityBaselineConfiguration` içine eklendi (ilk gerçek-yığın koşusu bu uçlarda 403 verdi, eklenince geçti).

## Migration

`V55__meeting_icon_history_reminder_reasons.sql` (uygulanmış migration değiştirilmedi): `meetings.icon` + `meetings_icon_allowlist`; `meeting_user_hidden(meeting_id,user_id,hidden_at)` PK(meeting_id,user_id), meeting FK CASCADE, kullanıcı indeksi; `meeting_reminder_deliveries_error_code_check` yeni dört neden koduyla genişletildi. Mevcut satırlar geçerli varsayılan alır, veri doldurma yoktur. Sonraki migration V56. Belgeler: `.agents/database.md`, `.agents/api.md`, `db/migration/README.md`.

## Değişen önemli dosyalar

Yeni: `V55…sql`, `MeetingHidden.java`, `MeetingHiddenRepository.java`, `MeetingReminderMailPreviewTest.java`. Değişen: `Meeting.java`, `MeetingDtos.java`, `MeetingService.java`, `MeetingController.java`, `MeetingReminderStore.java`, `SmtpMeetingReminderMail.java`, `SecurityBaselineConfiguration.java`, `MeetingServiceTest`, `MeetingCoreIntegrationTest`, `MeetingReminderIntegrationTest`, `MeetingReminderMailTest`.

## API sözleşmesi

Kimlik: oturum çerezi + CSRF (POST), proje üyeliği zorunlu; hata gövdesi mevcut sözleşmedir.

| Uç | Davranış |
|---|---|
| `POST /api/v1/projects/{p}/meetings` | gövdede `icon?`, `startNow?`; geçersiz simge 400 `MEETING_INVALID_ICON`; `startNow` ise `startsAt` sunucu saati |
| `PUT …/meetings/{id}` | `icon?` (verilmezse korunur) |
| `GET …/meetings?hidden=EXCLUDE\|INCLUDE\|ONLY` | varsayılan EXCLUDE; `View` alanları `icon`, `hidden` |
| `GET …/meetings/history` | `{count}` — çağıranın gizli toplantı sayısı |
| `POST …/meetings/history/clear` | çağıranın ENDED/CANCELLED toplantılarını gizler, `{count}` |
| `POST …/meetings/history/restore` | gizlenenleri geri getirir, `{count}` |

Swagger yalnız geliştirme/test ayarı açıkken kullanılabilir (`.agents/SECURITY.md` bölüm 11).

## Doğrulama

| Komut | Sonuç |
|---|---|
| `mvnw test -Dtest=MeetingServiceTest,MeetingCoreIntegrationTest,MeetingReminderIntegrationTest,MeetingReminderMailTest,MeetingReminderMailPreviewTest` (Testcontainers PostgreSQL 18 + gerçek Mailpit) | **81 test, 0 hata** (21 + 17 + 32 + 10 + 1) |
| `mvnw test -Dtest=com.pda.migration.*Test` (yeni `MeetingV55MigrationTest`: gerçek V54 veritabanında eski toplantı + V54 hatırlatma kuyruğu satırları, ardından V55) | **9 test, 0 hata**; eski toplantı korunur (`icon='video'`, `reminder_revision` aynı), V54 kuyruk satırları ve `NO_LONGER_ELIGIBLE` kodu değişmez, V54 kuralları (benzersizlik, deneme sınırı, adres reddi) sürer, yeni nedenler kabul edilir, geçersiz simge reddedilir, toplantı silinince gizleme/kuyruk kayıtları birlikte silinir, yeniden başlatma idempotent |
| Frontend gerçek yığın e2e (Docker'da yeniden derlenmiş backend, V55 uygulanmış, self-hosted LiveKit, Mailpit) | geçmiş, 3 alıcılı e-posta, atlanan alıcı nedeni, `startNow` sapmaları geçti (frontend kaydına bakın) |
| `git diff --check` | temiz |

Gerçek LiveKit: yerel self-hosted sunucu; gerçek SMTP: yerel Mailpit (gerçek SMTP protokolü, dış teslimat yok).

## Güvenlik değerlendirmesi

Geçmiş gizleme yalnız çağıranın kaydını yazar ve okur; başka kullanıcıya veya toplantıya etki etmez, IDOR yüzeyi yoktur (toplantı `project` + üyelik kontrolüyle çözülür). Simge allowlist'i hem servis hem DB CHECK ile zorlanır. `startNow` yalnız zamanı sunucuya bağlar, yetki gevşemez. E-posta: HTML içindeki değişkenler kaçışlanır, logo yalnız classpath'ten satır içi eklenir, adres/içerik/token günlüğe veya tabloya yazılmaz. Yeni dış bağımlılık, ENV veya SMTP servisi yoktur.

## Sınırlar

- Tam `pre-push` ve tüm backend test paketi çalıştırılmadı (yalnız hedefli testler).
- E-posta istemcileri (Gmail/Outlook/Apple Mail) gerçek cihazlarda denenmedi; yalnız yerel önizleme ve Mailpit. Gömülü logo dosyası 312 KB'tır (küçültmek istenirse ayrı bir iş); örnek e-postada saat satırı `14:00 +03:00` biçimindedir ve saat dilimi ayrı satırda da gösterilir.
- Şablon kalıcı kaynaktadır: `SmtpMeetingReminderMail.java`, logo `src/main/resources/branding/pda-logo.png`, önizleme üreticisi `MeetingReminderMailPreviewTest.java` (hepsi git'te); `backend/target/` yalnız test çıktısıdır ve git dışıdır.
- Hatırlatma SMTP'si at-least-once sınırı değişmedi (`.agents/operations.md`).
- `/history` uçları için ayrı bir birim güvenlik testi yok; gerçek yığın e2e testi kapsıyor.

## Kullanıcının manuel kontrol adımları

1. Yerel DB'nin V55'e göç ettiğini doğrula (`flyway_schema_history`).
2. Mailpit'te (`http://localhost:8025`) üç hesaplı hatırlatma e-postasını incele.
3. `backend/target/email-preview/index.html` dosyasında tasarımı gör ve onayını/değişiklik isteğini ilet.
