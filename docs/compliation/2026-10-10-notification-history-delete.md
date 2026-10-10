# notification-service — Bildirim geçmişini tekli silme ve "Tümünü sil"

## 1. Teslim ve durum

- Branch: `notification-service` — Phase 5 / `PDA_UI_WORKFLOW_STATE_NOTIFICATION_REFINEMENTS_PLAN.md`
- Kapsam: Talep 12.
- Durum: Tamamlandı ve doğrulandı. Pre-push sonucu §3'te. Commit/push kullanıcıya aittir.

## 2. Yapılanlar

- **Backend:**
  - [NotificationRepository](../../backend/src/main/java/com/pda/notification/infrastructure/NotificationRepository.java): `deleteReadOwn`, `deleteAllReadOwn`. Parametreli JPQL; yalnız principal'ın `read = true` kayıtları silinir.
  - [NotificationService](../../backend/src/main/java/com/pda/notification/application/NotificationService.java): silme işlemleri; tekli silmede etkilenen satır yoksa 404.
  - [NotificationController](../../backend/src/main/java/com/pda/notification/api/NotificationController.java): iki DELETE yolu.
  - `SecurityBaselineConfiguration`: tek DELETE matcher satırı (onaylı).
  - Fiziksel silme: `notifications` tablosuna FK yok, migration gerekmedi.
- **Frontend:**
  - [notification-center.tsx](../../frontend/src/features/notifications/components/notification-center.tsx): Geçmiş satırlarında çöp kutusu ve satır içi iki adımlı onay. Geçmiş başlığında "Tümünü sil" ve onay penceresi. Yeni sekmesinde silme eylemi yok.
  - [use-notification-read.ts](../../frontend/src/features/notifications/hooks/use-notification-read.ts): silmeler okundu işlemleriyle aynı tek uçuş, aktör ve iptal korumasını kullanıyor. Sunucu onayından sonra uzlaştırma yapılıyor; son sayfa boşalınca önceki sayfaya geçiliyor. Başka sekmede silinmiş kayıt için gelen 404 de listeyi uzlaştırıyor.
  - Dosyadan çıkınca odak sırasıyla sonraki satıra, önceki satıra ya da boş bölüme gidiyor.
- **Dokümanlar:** [SECURITY.md](../../.agents/SECURITY.md) (iki DELETE satırı ve FK/recovery notu), [architecture.md](../../.agents/architecture.md), [folder-structure.md](../../.agents/folder-structure.md), [frontend-design-rules.md](../../.agents/frontend-design-rules.md).

## 3. Doğrulama

- Backend tam `mvnw clean verify`: 664 test, 0 failure, 0 error, 0 skip. Yeni `NotificationDeletionIntegrationTest` 5 test içeriyor:
  - T11 ve T12 senaryoları.
  - Okunmamış kayıt silinemiyor, yabancı kayıt kimliği 404 dönüyor.
  - 401, 403 ve 400 durumları.
  - Ekip silme pop-up hakkı etkilenmiyor.
- Playwright (gerçek backend/PostgreSQL): `notification-history-delete` 9/9. Mevcut `notification-history*`, `notification-cache`, `notification-repository-read`, `team-deletion-notifications`, `my-task-cards`, `team-invitation-response-badge` ve `invitation-notification-context` ile birlikte 34/34.
- Backend container yalnız E2E override'ıyla yeniden build edildi.
- Kanonik `.\pre-push\pre-push.cmd`: **FAILED — 776/778**.
  - Backend 664/0/0/0; ESLint, `tsc` ve build temiz.
  - Playwright 776 geçti, 1 skip (beklenen), 1 başarısız.
  - Başarısız olan tek test bilinen aralıklı `team-member-preview` oturum 401'i (Phase 1 kaydında takipte). Bu fazın testlerinin hepsi geçti.
  - **Kullanıcı kararı (2026-10-10):** PASSED şartı bu teslim için bilinçli olarak atlandı; push kullanıcı onayıyla yapıldı.

## 4. API

| Yöntem/yol | Yetki | Girdi | Başarı | Hatalar |
| --- | --- | --- | --- | --- |
| `DELETE /api/v1/notifications/{notificationId}` | Oturum sahibi, kendi okunmuş kaydı, CSRF zorunlu | UUID path, gövde yok | `204`, `Cache-Control: private, no-store` | `400` bozuk UUID; `401`; `403` CSRF; `404` bilinmeyen, başkasının ya da kendi okunmamış kaydı (birbirinden ayırt edilemez) |
| `DELETE /api/v1/notifications?read=true` | Oturum sahibi, CSRF zorunlu | `read` zorunlu ve `true` olmalı | `200 {"count": n}`; yalnız okunmuş kayıtlar silinir | `400` eksik, `false` ya da geçersiz `read`; `401`; `403` CSRF |

- Swagger: `/swagger-ui/index.html`. Önce `GET /api/v1/auth/csrf`, ardından giriş yapılır.
- Yeni ENV, rol veya migration yok.

## 5. Açık konular

- Silme geri alınamaz: fiziksel silme ürün kararı. Bu yüzden "geri al" yok; iki adımlı onay var.
- Bilinen aralıklı test takibi (`team-member-preview` oturum 401'i ve `next start` ERR_CONNECTION_REFUSED) Phase 1 kaydında.

## 6. Kullanıcının kontrol adımları

1. Bildirim zili → Geçmiş: bir satırdaki çöp kutusuna bas, "Evet, sil" de. Satır sayfa yenilemeden kaybolmalı.
2. "Tümünü sil" → onay penceresi: önce "Vazgeç" ile kayıtların kaldığını gör, sonra onayla. Geçmiş boşalmalı. Yeni sekmesi ve zil sayısı aynı kalmalı.
3. Yeni sekmesinde çöp kutusu olmamalı.
