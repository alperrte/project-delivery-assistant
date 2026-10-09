# project-service-backend — Commit sayfalama başlığı ve davet önizleme banner'ı

## 1. Teslim ve durum

- Branch: `project-service-backend` — Phase 2 / `PDA_UI_WORKFLOW_STATE_NOTIFICATION_REFINEMENTS_PLAN.md`
- Kapsam: Talep 3 ve Talep 9'un Phase 0'da kanıtlanan backend ön koşulları. Arayüz Phase 3'te (`project-service-frontend`).
- Durum: Tamamlandı ve doğrulandı. Commit/push kullanıcıya aittir; ajan commit ve push yapmadı.

## 2. Yapılanlar

- **Talep 3 — commit sayfalama:**
  - [GitHubRepositoryClient.java](../../backend/src/main/java/com/pda/project/application/service/GitHubRepositoryClient.java): `CommitPage(commits, hasNext)`.
  - [GitHubRestRepositoryClient.java](../../backend/src/main/java/com/pda/project/infrastructure/github/GitHubRestRepositoryClient.java): GitHub `Link` başlığında `rel="next"` olup olmadığını okur.
  - [ProjectRepositoryConnectionService.java](../../backend/src/main/java/com/pda/project/application/service/ProjectRepositoryConnectionService.java): sayfa 10'da `hasNext=false`.
  - [ProjectRepositoryController.java](../../backend/src/main/java/com/pda/project/api/ProjectRepositoryController.java): gövde aynı, `X-Has-Next-Page` başlığı eklendi.
  - `SecurityBaselineConfiguration`: CORS exposed headers listesine `X-Has-Next-Page` eklendi.
- **Talep 9 — davet banner'ı:**
  - [MyProjectInvitationController.java](../../backend/src/main/java/com/pda/project/api/MyProjectInvitationController.java): `GET /api/v1/project-invitations/{id}/banner`.
  - [ProjectInvitationService.java](../../backend/src/main/java/com/pda/project/application/service/ProjectInvitationService.java): `previewBannerMine` ve preview'da nullable `bannerVersion`.
  - `SecurityBaselineConfiguration`: tek bir GET matcher eklendi.
- **Dokümanlar:** [SECURITY.md](../../.agents/SECURITY.md) (davet tablosu ve GitHub bölümü), [architecture.md](../../.agents/architecture.md), [folder-structure.md](../../.agents/folder-structure.md).

## 3. Doğrulama

- Hedefli testler:
  - `GitHubRestRepositoryClientTest`: 2 yeni metot.
  - `ProjectRepositoryApiIntegrationTest`: 4 yeni metot.
  - `ProjectInvitationApiIntegrationTest`: 12 test, 2'si yeni.
  - `ProjectBannerIntegrationTest`, `ProjectHomeApiIntegrationTest`, `RepositoryCommitScanIntegrationTest` ve `ModularityTest`: geçti.
- Tam `mvnw clean verify`: 657 test, 0 failure, 0 error, 0 skip, BUILD SUCCESS.
- Kanonik `.\pre-push\pre-push.cmd`: **FAILED — 708/712**.
  - Backend 657/0/0/0, ESLint, `tsc` ve build temiz; Playwright 708 geçti, 1 skip, 2 başarısız, 1 koşmadı (seri dosyada önceki test düştüğü için).
  - `11-project-banner` "davetli banner görmez": test eski kuralı doğruluyordu (`/project-invitations/{id}/banner` → 403, adres yokken deny-all). Bu fazda adres bilinçli olarak eklendiği için banner'sız projede 404 bekleyecek şekilde güncellendi. Üyelere özel `/projects/{id}/banner`'ın davetliye 403 döndüğü de ayrıca doğrulanıyor.
  - `team-member-preview`: bilinen aralıklı oturum 401'i (önceki fazın kaydında takipte).
  - Banner dosyası ve tüm `team-*` spec'leri birlikte yeniden koşuldu: 19/19.
  - **Kullanıcı kararı (2026-10-10):** aralıklı `team-member-preview` hatası nedeniyle PASSED şartı bu teslim için bilinçli olarak atlandı; push kullanıcı onayıyla yapıldı.

## 4. API

| Yöntem/yol | Yetki | Girdi | Başarı | Hatalar |
| --- | --- | --- | --- | --- |
| `GET /api/v1/projects/{projectId}/repository/commits` (genişledi) | Aktif proje üyesi | `branch`, `author`, `page` 1..10, `limit` 1..50 | `200` aynı commit listesi + `X-Has-Next-Page: true\|false` (sayfa 10'da her zaman `false`) | Değişmedi: `400`, `401`, `403`, `404`, `409 REPOSITORY_ADVANCED_REQUIRED`, `429`, `503` |
| `GET /api/v1/project-invitations/{invitationId}/banner` (yeni) | Yalnız davet edilen hesap, kendi PENDING daveti, canlı proje | UUID path | `200` görsel; kayıtlı Content-Type, `Cache-Control: private, no-store`, `nosniff`, `inline` | `401` oturumsuz; `404` başka alıcı/üye, cevaplanmış veya süresi dolmuş davet, arşivlenmiş/silinmiş proje, banner yok; GET dışı yöntemler `403` |
| `GET /api/v1/project-invitations/{invitationId}/preview` (additive) | Değişmedi | — | Ek nullable `bannerVersion` (epoch ms) | Değişmedi |

- Swagger: `API_DOCS_ENABLED=true` iken `/swagger-ui/index.html`. Önce `GET /api/v1/auth/csrf`, ardından giriş yapılır.
- Banner kontrolü: davet edilen hesapla preview'daki `bannerVersion`'ı oku, sonra `/project-invitations/{id}/banner` çağır.
- ENV, migration ve bağımlılık değişmedi. Üyelik isteyen `GET /projects/{id}/banner` aynı kaldı; davetli için hâlâ `403`.

## 5. Açık konular

- Frontend tüketimi (sayfalama arayüzü, önizlemede banner) Phase 3'te yapılacak.
- Bilinen test altyapısı takibi (`team-member-preview` oturum 401'i ve `next start` ERR_CONNECTION_REFUSED) önceki fazın kaydında; bu fazda değişmedi.

## 6. Kullanıcının kontrol adımları

1. Swagger'da bir projenin `GET .../repository/commits?page=1` yanıtında `X-Has-Next-Page` başlığını gör. Bağlı depo çok commit'liyse `true`, `page=10`'da `false` olmalı.
2. Bir kullanıcıyı banner'lı bir projeye davet et. Davet edilen hesapla `GET /project-invitations/{id}/preview` yanıtında `bannerVersion`, `GET /project-invitations/{id}/banner` çağrısında görseli gör. Başka bir hesapla aynı çağrı `404` dönmeli.
