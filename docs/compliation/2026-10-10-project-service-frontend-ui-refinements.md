# project-service-frontend — Öncelik, silinen proje, kriter/sprint sayfaları, commit sayfalama, Proje Davetlerim

## 1. Teslim ve durum

- Branch: `project-service-frontend` — Phase 3 / `PDA_UI_WORKFLOW_STATE_NOTIFICATION_REFINEMENTS_PLAN.md`
- Kapsam: Talep 2, 3, 5, 6, 8, 9 ve 14.
- Durum: Tamamlandı ve doğrulandı. Pre-push sonucu §3'te. Commit/push kullanıcıya aittir.

## 2. Yapılanlar

- **Talep 2 — öncelik:** Kart başlık bandında öncelik çipi gösteriliyor (`ProjectPriorityChip`, `EntityCard.cornerStart`; kart yüksekliği değişmedi). Renk proje skalasından geliyor (`projectPriorityDotClass`), proje başlığı ve organizasyon tablo satırıyla aynı. Ekran okuyucu için "Öncelik:" öneki var. Ayarlar önizlemesi formu canlı izliyor. Sorun cache değil, render eksikliğiydi.
  - Dosyalar: [project-card.tsx](../../frontend/src/features/projects/components/project-card.tsx), [project-settings-form.tsx](../../frontend/src/features/projects/components/project-settings-form.tsx).
- **Talep 6 — silinen proje:**
  - [use-selected-project.ts](../../frontend/src/features/projects/hooks/use-selected-project.ts): 404/403'te seçimi bırakır (`forgetSelectedProject`).
  - Silme sonrası yalnız o projenin anahtarları (`["projects", id]`, by-slug, detail) kaldırılır, ardından `router.replace("/projects")` yapılır. Global cache temizlenmez.
  - Sidebar mevcut "Proje seçin" durumuna düşer. Eski adresler gömülü 404 gösterir.
- **Talep 5 ve 14 — kriter ve sprint tam sayfa:**
  - Kriter: `criteria/new`, `criteria/[criterionId]/edit` → [criterion-form-page.tsx](../../frontend/src/features/criteria/components/criterion-form-page.tsx).
  - Sprint: `sprints/new`, `sprints/[sprintId]/edit` → [sprint-form-page.tsx](../../frontend/src/features/sprints/components/sprint-form-page.tsx).
  - TR adresleri `kriterler/yeni` ve `sprintler/yeni`. Breadcrumb, başlık ve sidebar aktifliği güncellendi.
  - Dialoglar kaldırıldı.
  - Kriter mutasyonları Project Home'u da yeniliyor; eski hatada genel bakıştaki ilerleme güncellenmiyordu.
  - Tek bölümlü formlarda özet paneli yok: inline hata ve ilk alana odak (tasarım kuralı netleştirildi).
- **Talep 3 — commit sayfalama:**
  - [cursor-pagination.tsx](../../frontend/src/components/common/cursor-pagination.tsx): Önceki · numaralar · Sonraki.
  - `apiRequestWithHeaders` ile `X-Has-Next-Page` okunuyor. Dal görünümünde 30'lu sayfalar; durum `?cpage=` ile URL'de.
  - Yüklenirken eski satırlar gösterilmiyor (iskelet). Dal veya yazar değişince sayfa 1'e dönülüyor.
  - BASIC modda yalnız son 10 commit özeti var; değişmedi.
- **Talep 8 — Proje Davetlerim:** [my-invitations-page.tsx](../../frontend/src/features/invitations/components/my-invitations-page.tsx).
  - `xl` ve üstünde semantik tablo: Proje, Roller, Davet eden, Tarih, Durum, İşlemler.
  - Altında kart listesi. 1024 px'te altı sütun sidebar ile taştığı için eşik `xl` (ölçüldü; eski eşikle aynı).
  - Filtre `?status=ALL` ve sayfa `?page=` URL'de. Kabul, red, önizleme, sayaç, polling ve aktöre bağlı cache anahtarları korundu.
- **Talep 9 — davet önizleme banner'ı:** `bannerVersion` varsa `invitationsApi.bannerUrl` ile davete özel uç noktadan gerçek banner gösteriliyor. Yükleme hatasında `EntityCover` yedek yüzeye düşüyor.
- **Dokümanlar:** [frontend-design-rules.md](../../.agents/frontend-design-rules.md) (banner, davetler, depo sayfalama, tam sayfa formlar, tek bölümlü form özeti), [architecture.md](../../.agents/architecture.md), [folder-structure.md](../../.agents/folder-structure.md).

## 3. Doğrulama

- Hedefli Playwright (gerçek backend/PostgreSQL):

  | Spec | Sonuç |
  | --- | --- |
  | `project-priority` | 1/1 |
  | `project-delete-navigation` | 2/2 |
  | `criteria-pages` | 9/9 |
  | `sprint-pages` | 10/10 |
  | `commit-pagination` | 7/7 |
  | `repository-management` | 8/8 |
  | `my-invitations-redesign` | 8/8 |
  | `invitation-preview-banner` | 4/4 |
  | Davet, depo, form, rota, breadcrumb, görev ve banner regresyon paketleri | Geçti (ajan raporları; plan Task 9–15) |
  | `17-project-chat` (production build) | 21/21 |

- `17-project-chat` dev sunucusunda düşüyor, çünkü dev modu sayfaları ilk açılışta derliyor ve bu zamanlamayı bozuyor. Production build'de 21/21 geçiyor.
- `commit-pagination` gerçek GitHub yerine frontend→backend isteğini `page.route` ile taklit ediyor (GitHub saatlik kotası). Gerçek `X-Has-Next-Page` başlığı ve CORS ayarı Phase 2 backend entegrasyon testlerinde kanıtlı.
- Lint, `tsc --noEmit` ve `git diff --check`: temiz.
- Kanonik `.\pre-push\pre-push.cmd`: **FAILED — 751/754**.
  - Backend 657/0/0/0, ESLint, `tsc` ve build temiz; Playwright 751 geçti, 1 skip, 2 başarısız.
  - `project-priority` (bu fazın yeni spec'i): tam pakette yöneticinin çok projesi olduğu için kart liste sayfası 1'de değildi. Spec, kartın sayfasını API'den bulup listenin kendi "Sonraki/Önceki" düğmeleriyle (yeniden yükleme olmadan) gidecek şekilde düzeltildi. Çok projeli yeniden kullanılan yönetici ve yeni yönetici ile ikisinde de geçti.
  - `team-member-preview`: bilinen aralıklı oturum 401'i (Phase 1 kaydında takipte).
  - **Kullanıcı kararı (2026-10-10):** aralıklı `team-member-preview` hatası nedeniyle PASSED şartı bu teslim için bilinçli olarak atlandı; push kullanıcı onayıyla yapıldı.

## 4. API

Yeni backend endpoint'i yok; Phase 2'deki `X-Has-Next-Page`, preview `bannerVersion` ve `GET /api/v1/project-invitations/{id}/banner` tüketilir. ENV, şema, yetki ve bağımlılık değişikliği yok.

## 5. Açık konular

- Başka sekmede veya cihazda silinen proje, 30 sn `staleTime` nedeniyle bir sonraki yenilemeye kadar sidebar'da kalabilir.
- BASIC depo modunda yalnız son 10 commit özeti var. İstenirse aynı sayfalama özete de eklenebilir (backend destekliyor).
- Kriter API'sinde tek kriter GET'i yok; düzenleme sayfası liste sorgusundan okuyor.
- Bilinen aralıklı test takibi (`team-member-preview` oturum 401'i ve `next start` ERR_CONNECTION_REFUSED) önceki fazların kaydında.

## 6. Kullanıcının kontrol adımları

1. Proje ayarlarında önceliği değiştir. Projeler listesindeki kartta ve ayar önizlemesinde yenilemeden güncellendiğini gör.
2. Bir projeyi ayarlardan sil. `/projeler`'e gidildiğini, sidebar'da projenin kalmadığını ve eski proje adresinin 404 verdiğini kontrol et.
3. Kriterler'de "Yeni kriter": tam sayfa form açılmalı. Oluşturduktan sonra genel bakıştaki ilerleme güncellenmeli. Düzenle bağlantısı da sayfa açmalı.
4. Gelişmiş modlu bir projede Sprintler → "Yeni sprint": tam sayfa form ve tarih seçici.
5. Depo → Dallar: commit listesinde Önceki/1/2/Sonraki ile gezin; adres `?cpage=` almalı.
6. Davetler (Proje davetlerim): geniş ekranda tablo, dar ekranda kart görünümü. "Proje bilgileri"nde banner'lı projenin kapak görselini gör.
