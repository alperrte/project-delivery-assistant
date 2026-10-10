# squad-service-backend — Ekipler Kart/Tablo/Şema, Üye Davet Et sayfası, davet yanıt rozeti

## 1. Teslim ve durum

- Branch: `squad-service-backend` — Phase 4 / `PDA_UI_WORKFLOW_STATE_NOTIFICATION_REFINEMENTS_PLAN.md`
- Kapsam: Talep 7, 10 ve 11.
- Durum: Tamamlandı ve doğrulandı. Pre-push sonucu §3'te. Commit/push kullanıcıya aittir.

## 2. Yapılanlar

- **Talep 7 — Ekipler görünümü:**
  - [teams-page.tsx](../../frontend/src/features/squads/components/teams-page.tsx): Kart | Tablo | Şema seçici. Üçü de aynı `["projects", id, "squads", "all"]` sorgusunu kullanır; görünüm değiştirirken ağ isteği yok ve sayfa korunur. Tercih kullanıcıya özel `pda:teams-view:v1:<userId>` anahtarında ve `?view=` parametresinde tutulur; eski `?view=list` kart görünümünü açar.
  - [team-table.tsx](../../frontend/src/features/squads/components/team-table.tsx): `md` ve üstünde semantik tablo, altında yığılmış liste.
- **Talep 10 — Üye Davet Et sayfası:**
  - `/projects/{slug}/team-invitations/new` → TR `/tr/projeler/{slug}/ekip-davetleri/yeni` → [invite-member-page.tsx](../../frontend/src/features/squads/components/invite-member-page.tsx).
  - `?team=` ile ekip kilitli gelir ve başarıda ekip detayına dönülür; parametre yoksa Ekip Davetleri'ne dönülür.
  - Aday arama, "Ekibe ekle", e-posta daveti, rol ve mesaj davranışları korundu. Çok bölümlü form özeti var.
  - Dialog kaldırıldı.
- **Talep 11 — davet yanıt rozeti:**
  - Backend: [NotificationController](../../backend/src/main/java/com/pda/notification/api/NotificationController.java), `NotificationService` ve `NotificationRepository` mevcut liste ve unread-count uçlarına opsiyonel `projectId` + çoklu `type` filtresi kazandı.
  - Sidebar: "Ekip Davetleri" yanında, bekleyen davet sayısından ayrı "+N" rozeti ([invitation-response-badge.tsx](../../frontend/src/features/invitations/components/invitation-response-badge.tsx)).
  - Ekip Davetleri sayfası: okunmamış yanıt şeridi; tekli ve "Tümünü okundu işaretle" eylemleri listelenen kimliklerle yapılır, read-all kullanılmaz ([invitation-response-strip.tsx](../../frontend/src/features/invitations/components/invitation-response-strip.tsx)).
  - Sayfayı açmak okundu saymaz.
  - Rozet yalnız daveti gönderen yöneticide görünür (mevcut alıcı kuralı).
- **Temizlik:** Phase 3'te yanlışlıkla commit'lenen kökteki `test-results/.last-run.json` kaldırıldı; kök `.gitignore`'a `/test-results/` eklendi.
- **Dokümanlar:** [SECURITY.md](../../.agents/SECURITY.md) (bildirim filtresi), [architecture.md](../../.agents/architecture.md), [folder-structure.md](../../.agents/folder-structure.md), [frontend-design-rules.md](../../.agents/frontend-design-rules.md).

## 3. Doğrulama

- Backend tam `mvnw clean verify`: 659 test, 0 failure, 0 error, 0 skip. Yeni testler:
  - `NotificationIntegrationTest.invitationResponseCountIsScopedByProjectTypeAndRecipient`: gerçek davet kabul/red akışları.
  - `NotificationReadStateIntegrationTest.projectAndTypeFiltersRestrictOwnUnreadCountAndListWithoutChangingDefaults`.
- Playwright (gerçek backend/PostgreSQL):

  | Spec | Sonuç |
  | --- | --- |
  | `teams-view-toggle` | 7/7 |
  | `invite-member-page` | 7/7 |
  | `team-invitation-response-badge` | Çok kullanıcılı; kabul → +1, red → +2, proje izolasyonu, şerit, tekli/toplu okundu, eş yönetici rozet görmez, hesap değişiminde sızıntı yok |
  | Team/davet/bildirim/rota regresyon batch'leri | 19/19, 53/53, 47/47 |

- Backend container yalnız `docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --build backend` ile yeniden build edildi; E2E ortam değişkenleri doğrulandı.
- Kanonik `.\pre-push\pre-push.cmd`: **FAILED — 765/769**.
  - Backend 659/0/0/0, ESLint, `tsc` ve build temiz; Playwright 765 geçti, 1 skip, 2 başarısız, 1 koşmadı.
  - `teams-view-toggle` 320/390 dark (bu fazın yeni spec'i): tema hidrasyondan sonra uygulandığı için tek seferlik sınıf okuması yarışıyordu. Spec `emulateMedia` + otomatik bekleyen `toHaveClass` ile ölçümden önce temayı bekleyecek şekilde düzeltildi; production build'de `--repeat-each=3` ile 21/21.
  - `team-member-preview`: bilinen aralıklı oturum 401'i (Phase 1 kaydında takipte).
  - **Kullanıcı kararı (2026-10-10):** aralıklı `team-member-preview` hatası nedeniyle PASSED şartı bu teslim için bilinçli olarak atlandı; push kullanıcı onayıyla yapıldı.

## 4. API

| Yöntem/yol | Yetki | Yeni girdi | Başarı | Hatalar |
| --- | --- | --- | --- | --- |
| `GET /api/v1/notifications/unread-count` (genişledi) | Oturum sahibi, kendi kayıtları | Opsiyonel `projectId` (UUID), tekrarlanabilir `type` (NotificationType) | `200 {"count": n}`; parametresiz istek eskisiyle aynı | `400` geçersiz type veya projectId, `401` |
| `GET /api/v1/notifications` (genişledi) | Aynı | Aynı filtreler; tek `type` hâlâ çalışır | Sayfalı liste, sıralama aynı | `400`, `401` |

- Yeni matcher, rol, CSRF, ENV veya migration yok.
- Swagger: `/swagger-ui/index.html`, ardından normal giriş.
- Güvenli örnek: `GET /api/v1/notifications/unread-count?projectId=<uuid>&type=PROJECT_INVITATION_ACCEPTED&type=PROJECT_INVITATION_REJECTED`.

## 5. Açık konular

- Davet 409 çakışmasında genel `errors.conflict` metni gösteriliyor; backend ayrı bir kod döndürmüyor. Küçük bir takip işi.
- "+N" rozeti yalnız davet eden yöneticide görünür; diğer yöneticiler görmez. Ürün kararı olarak kaydedildi.
- Bilinen aralıklı test takibi (`team-member-preview` oturum 401'i ve `next start` ERR_CONNECTION_REFUSED) Phase 1 kaydında.

## 6. Kullanıcının kontrol adımları

1. Ekipler sayfasında Kart / Tablo / Şema arasında geç. Aynı ekiplerin göründüğünü, 2. sayfanın korunduğunu ve dar ekranda tablonun listeye dönüştüğünü gör.
2. Ekip Davetleri → "Üye davet et": tam sayfa form açılmalı. Bir kullanıcıyı davet et, listeye dön. Ekip detayından açınca ekip kilitli gelmeli ve başarıda ekip detayına dönülmeli.
3. Başka bir hesapla daveti kabul ya da reddet. Davet eden yöneticinin sidebar'ında "Ekip Davetleri" yanında bekleyen sayıdan ayrı "+1" görünmeli. Ekip Davetleri sayfasındaki şeritte "Okundu işaretle" ile rozet azalmalı.
