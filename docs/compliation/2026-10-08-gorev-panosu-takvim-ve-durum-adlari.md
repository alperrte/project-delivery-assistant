# Görev panosu, takvim bağlantısı ve durum adları

## Teslim ve durum

**Tamamlandı: 2026-10-08.** Branch `task-service-backend`. Kapsam yalnız frontend; backend, veritabanı, `.env` ve güvenlik kuralları değişmedi. Commit/push yapılmadı.

Beş istek karşılandı:

1. Proje Yöneticisi olmayan kullanıcı (ör. görevi havuzdan üstlenen üye) görev detayında "Atananları değiştir" düğmesini ve öncelik açılır listesini görmez; öncelik değeri metin olarak görünmeye devam eder.
2. Pano yatay kaydırma yerine sarılan sütun ızgarasına geçti.
3. "Backlog" Türkçede çevrildi.
4. "Yapılacak" / "Devam ediyor" ayrıştırıldı.
5. Takvim, kullanıcıya atanan görevlerle bağlandı.

Kullanıcı kararları: durum adları Backlog → **Bekleyen işler**, Yapılacak → **Sırada**, Devam ediyor → **Yapılıyor** (yalnız TR etiketi; enum, iş akışı ve veritabanı aynı); pano **sarılan ızgara**; takvim **bana atanan görevler, başlangıç ve son tarih günlerinde**.

## Yapılanlar

- **Salt okunur alanlar:** [properties-panel.tsx](../../frontend/src/features/tasks/components/detail/properties-panel.tsx). Yönetici olmayan için "Atananları değiştir" hiç çizilmez; Öncelik, Puan ve Sprint düz metin olur. Yönetici için gelişmiş alan proje modu yüzünden kapalıysa Puan/Sprint Select'i eskisi gibi devre dışı kalır. "Üstlen", "Havuza bırak" ve "Havuzu temizle" aynen kalır. Sunucu zaten `TASK_MANAGE` ile korur (yetkisiz `PATCH` 403).
- **Pano:** [board-page.tsx](../../frontend/src/features/tasks/components/board-page.tsx). `grid gap-3 sm:grid-cols-2 xl:grid-cols-3`; sütunda `min-w-0`; kart listesi `max-h-[32rem] overflow-y-auto`; iskelet aynı ızgarada. Sürükle-bırak, "Şuna taşı" menüsü ve onay diyaloğu değişmedi.
- **Durum adları:** [tr.json](../../frontend/src/i18n/messages/tr.json). `tasks.common.status` ve sprint bağlamındaki "backlog" metinleri. en/de aynı (To do / In progress; Offen / In Arbeit; "Backlog" yerleşik terim).
- **Takvim ↔ görevler:**
  - [use-calendar-tasks.ts](../../frontend/src/features/calendar/hooks/use-calendar-tasks.ts): seçili projede `assigneeId` ile tek sorgu (100'lük sayfalar), `startDate` ve `deadlineAt` (yerel gün) günlerine göre `byDate`; aynı gün ise tek "son tarih" girişi. Görev anahtarı `tasksKey(projectId)` önekinde olduğundan her görev değişikliği takvimi tazeler.
  - [month-grid.tsx](../../frontend/src/features/calendar/components/month-grid.tsx): günde `data-calendar-tasks` işareti (son tarih `warning`, gecikmiş `destructive`, yalnız başlangıç `muted`; ana sayfada tek nokta) ve günün `aria-label`'ında görev bilgisi.
  - [task-agenda.tsx](../../frontend/src/features/calendar/components/task-agenda.tsx) + [day-agenda.tsx](../../frontend/src/features/calendar/components/day-agenda.tsx): seçili günün görev satırları (`data-calendar-task`, `data-kind`), görev detayına bağlantı, durum ve öncelik rozeti, son tarihte saat.
  - [calendar-page.tsx](../../frontend/src/features/calendar/calendar-page.tsx) ve [dashboard.tsx](../../frontend/src/features/dashboard/dashboard.tsx) (mini takvim): hook bağlandı; görev yükleme hatası uyarı şeridi + "Tekrar dene".
  - Metinler tr/en/de: `calendarPage.tasks.*`, `noItemsForDay` (eski `noRemindersForDay` yerine), `calendarPage.description`, `workspace.calendarScope`.
- **Belge:** [frontend-design-rules.md](../../.agents/frontend-design-rules.md) (pano düzeni, salt okunur alan kalıbı, durum adları, takvimde görev).

## Önemli dosyalar

Frontend: properties-panel.tsx, board-page.tsx, calendar-page.tsx, month-grid.tsx, day-agenda.tsx, task-agenda.tsx (yeni), use-calendar-tasks.ts (yeni), dashboard.tsx, `i18n/messages/{tr,en,de}.json`. E2E: `e2e/task-board-calendar.spec.ts` (yeni), `e2e/09-tasks.spec.ts`, `e2e/my-task-cards.spec.ts` (durum adları güncellendi).

## Doğrulama

| Komut / kontrol | Sonuç |
| --- | --- |
| `npx.cmd tsc --noEmit` | Hata yok |
| `npm run lint` | Hata ve uyarı yok |
| `playwright test e2e/task-board-calendar.spec.ts` | 9/9 geçti |
| `09-tasks`, `my-task-cards`, `task-planning-assignment`, `21-task-models`, `16-task-avatars`, `06-calendar-page`, `07-reminders`, `workspace-scrollbars` + yeni spec | Son koşu 60/60 geçti (ilk koşuda `21-task-models`ta Puan alanı hatası çıkmıştı, düzeltildi) |
| Canlı bakış | Pano 1440/768/390, takvim açık/koyu ve ana sayfa mini takvimi ekran görüntüsüyle incelendi; yatay taşma yok |

Notlar: geliştirme veritabanı sıfırlandığı için test kullanıcıları yeniden kaydedildi (`E2E_REUSE_USERS` olmadan). Yeni spec şunları doğrular: üyede "Atananları değiştir" ve öncelik açılır listesi yok, öncelik metni var, yetkisiz `PATCH` 403, yöneticide ikisi de var; pano 1440/768/390 px'te taşmaz ve satırlar beklenen sayıda sütunla dizilir; menüyle taşıma onayla çalışır; TR/EN durum adları; takvim işaretleri, gün paneli, görev bağlantısı, başkasının görevinin görünmemesi, ana sayfa mini takvimi, 390 px ve koyu tema.

## API

**Yeni endpoint yok.** Takvim mevcut ucu kullanır:

- `GET /api/v1/projects/{projectId}/tasks?assigneeId={userId}&sort=deadlineAt&direction=asc&page=&size=100`
- Kimlik: oturum çerezi; proje üyesi. Başarı: `200`, sayfalı görev listesi (`startDate`, `deadlineAt`, `status`, `priority`, `taskKey`, `overdue`). Hata: `401` oturum yok, `403`/`404` proje üyesi değil.
- Swagger kontrol yolu: `http://localhost:8080/swagger-ui.html` → task-service → `GET /api/v1/projects/{projectId}/tasks`.

Öncelik ve atama değişiklikleri mevcut `PATCH /projects/{id}/tasks/{taskId}` ve `PUT .../assignees` uçlarındadır; sunucuda `TASK_MANAGE` gerektirir, yetkisiz istek `403`.

## Açık konular

- Takvim, kullanıcının projedeki tüm atanmış görevlerini tek seferde çeker; çok yüksek sayılarda sunucuya tarih aralığı filtresi gerekebilir (kapsam dışı).
- Son tarih yerel saat dilimine göre güne çevrilir; gece yarısına yakın bir son tarih başka saat diliminde komşu güne düşebilir (liste davranışıyla aynı).
- Yalnız seçili projenin görevleri gösterilir; tüm projeler birleşik görünümü yok.

## Kullanıcı kontrolü

1. Yönetici olmayan bir üyeyle havuzdan bir görevi üstlen → görev detayında "Atananları değiştir" düğmesi yok, Öncelik açılır liste değil düz metin (ör. "Orta"); Yönetici hesabında ikisi de var.
2. `Pano` sayfasını 1440, 768 ve 390 px'te aç → yatay kaydırma yok; 3×2, 2 ve tek sütun; çok kartlı sütun kendi içinde dikey kayar.
3. Türkçede panoda "Bekleyen işler / Sırada / Yapılıyor", İngilizcede "Backlog / To do / In progress".
4. Sana atanmış, başlangıç ve son tarihi bu aya düşen bir görev oluştur → `Takvim` ve ana sayfa mini takviminde iki günde işaret; güne tıkla → "Görev başlangıcı" / "Görev son tarihi" satırı, bağlantı görevi açar; başkasına atanan görev görünmez.

Commit mesajı:

```
feat(tasks): wrap board, read-only fields for non-managers, calendar shows assigned tasks

- hide assignee change and priority/points/sprint selects from non-managers, show values as text
- board columns wrap into a responsive grid instead of scrolling sideways
- Turkish status names: Bekleyen işler / Sırada / Yapılıyor
- calendar and home mini calendar mark tasks assigned to me on start and deadline days
```
