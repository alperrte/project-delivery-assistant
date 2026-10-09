<!-- markdownlint-disable MD024 -->
# PDA — UI / Workflow / State / Notification Refinements — Persistent Plan

Kaynak talep: `.agents/PDA_UI_Workflow_State_Notification_Refinements_Plan_and_Implementation.md` (15 talep).
Bu dosya implementation boyunca source of truth'tur; checkbox'lar gerçek zamanlı güncellenir.

Yürütme: implementation → targeted test → bug fix → re-test → DoD → `[x]` → sonraki bağımlı task.
Ajan commit / push / merge / rebase / cherry-pick yapmaz. Her branch fazı sonunda DURUR.
Kullanıcı kararı (2026-10-10): staging (`git add`), branch değiştirme ve `git pull --ff-only origin main` ajan tarafından yapılır; `git commit` ve `git push` yalnız kullanıcıdadır.

## Branch execution status

- [x] Phase 0 — Global read-only preflight/audit
- [x] Phase 1 — `general-features` (2026-10-10, pre-push PASSED)
- [x] Transition Gate 1 — user commit/push confirmation (2026-10-10)
- [x] Phase 2 — `project-service-backend` (Talep 3 + 9 backend prerequisite; 2026-10-10)
- [ ] Transition Gate 2 — user commit/push confirmation
- [ ] Phase 3 — `project-service-frontend`
- [ ] Transition Gate 3 — user commit/push confirmation
- [ ] Phase 4 — `squad-service-backend`
- [ ] Transition Gate 4 — user commit/push confirmation
- [ ] Phase 5 — `notification-service`
- [ ] Transition Gate 5 — user commit/push confirmation
- [ ] Phase 6 — Cross-branch final verification / completion

---

## Phase 0 — Global read-only preflight / audit (TAMAMLANDI 2026-10-09)

- [x] 0.1 Mevcut implementation/reproduction çıkarıldı.
- [x] 0.2 Her talebin owning branch'i doğrulandı.
- [x] 0.3 Talep 2/3/6 için backend prerequisite: 2 → yok (render eksik), 3 → VAR (hasNext yok), 6 → yok (frontend state). Ek: Talep 9 → VAR (davetli banner erişimi yok).
- [x] 0.4 Shared DatePicker/TimePicker consumer inventory tamamlandı.
- [x] 0.5 Team response event/notification semantics doğrulandı.
- [x] 0.6 Notification delete FK/audit etkisi doğrulandı (FK yok, fiziksel silme güvenli).
- [x] 0.7 Commit pagination mevcut backend/provider contract'ı doğrulandı.

DoD: [x] Branch/task dependency haritası net · [x] Açık decision gate kalmadı (kullanıcı kararları aşağıda) · [x] Production/test/schema/config değişikliği yapılmadı.

### Task → branch → dependency haritası

| Talep | Gerçek durum (kanıt) | Backend prereq | Owning branch | Bağımlılık |
| --- | --- | --- | --- | --- |
| 1 Validation summary | `project-create-page.tsx`, `organization-form-page.tsx`: RHF+zod, yalnız inline hata; Project'te focus-to-error yok; `TypePicker` ref yok; repo URL RHF dışı | Yok | general-features | — |
| 2 Priority | `ProjectCardData` priority içermiyor, `ProjectCard` çizmiyor, settings preview memo priority'siz → **render eksik, cache değil** | Yok | project-service-frontend | — |
| 3 Commit pagination | `GET …/repository/commits` düz liste, Link header okunmuyor, hasNext yok | **Var** | project-service-backend + project-service-frontend | Phase 2 → Phase 3 |
| 4 Org kart | `organization-card.tsx` kendi kabuğu (w-full/flex-col/min-h yok) | Yok | general-features | — |
| 5 Kriter sayfası | `criterion-form-dialog.tsx` create+edit; home invalidation eksik (bug) | Yok | project-service-frontend | Phase 1 `StickyFormActions`/`FormErrorSummary` |
| 6 Silinen proje | `use-selected-project.ts` sessionStorage slug'ı temizlenmiyor; sidebar error'u yok sayıyor | Yok | project-service-frontend | — |
| 7 Teams view | Ekipler zaten kart grid; mevcut Liste↔Şema; tablo yok | Yok | squad-service-backend | — |
| 8 Davetlerim | `my-invitations-page.tsx` xl tablo/kart | Yok | project-service-frontend | — |
| 9 Davet banner | Preview DTO bannerVersion yok; banner GET aktif üyelik ister | **Var** | project-service-backend + project-service-frontend | Phase 2 → Phase 3 |
| 10 Üye davet sayfası | `add-team-member-dialog.tsx` | Yok | squad-service-backend | Phase 1 shared form kabuğu |
| 11 Yanıt rozeti | `PROJECT_INVITATION_ACCEPTED/REJECTED` yalnız davet edene, projectId + is_read; API'de projectId filtresi yok | **Var** (notification filtre) | squad-service-backend | — |
| 12 Bildirim silme | DELETE yok; FK yok; matcher gerekli | **Var** | notification-service | — |
| 13 Yorum klavyesi | `mention-textarea.tsx:111` Ctrl+Enter gönderiyor, isComposing yok | Yok | general-features | — |
| 14 Sprint sayfası | `sprint-dialog.tsx` native date | Yok | project-service-frontend | Phase 1 DatePicker + form kabuğu |
| 15 Date/Time picker | `components/ui/date-picker.tsx` (min/max yok); native: reminder date+time, sprint dates, task deadline time, worklog date | Yok | general-features | — |

### Kullanıcı kararları (decision gates — 2026-10-09)

1. Commit pagination: backend `X-Has-Next-Page` header (GitHub Link rel="next"), liste gövdesi geriye uyumlu.
2. Bildirim silme: fiziksel `DELETE /api/v1/notifications/{id}` (yalnız sahibine ait + okunmuş) ve `DELETE /api/v1/notifications?read=true`; iki matcher onaylandı.
3. Yanıt rozeti: `GET /notifications/unread-count` (ve liste) için opsiyonel `projectId` + `type` filtresi; okundu yalnız bildirim merkezi ya da Ekip Davetleri sayfasındaki açık "Okundu işaretle" ile. Rozet yalnız daveti gönderen yöneticide görünür (mevcut recipient kuralı).
4. Ekipler: Grid | Tablo | Şema (üç görünüm, aynı query).
5. Davet banner: `GET /api/v1/project-invitations/{id}/banner` + preview `bannerVersion`; GET matcher onaylandı.
6. Yorum: masaüstü Enter gönder / Ctrl+Enter yeni satır / Shift+Enter yeni satır korunur; dokunmatikte Enter yeni satır.
7. Kriter ve Sprint: create **ve** edit tam sayfaya taşınır; dialoglar kalkar.
8. Kodlama: Sonnet 5.5 (high) alt-ajanları; orkestrasyon/inceleme/test Opus.

### Lokal sıra gerekçesi

- Ortak `StickyFormActions` + `FormErrorSummary` Phase 1'de (Talep 1 ile) çıkarılır; Phase 3 (Kriter/Sprint) ve Phase 4 (Üye Davet) bunları kullanır.
- Sprint dialog tarih alanları Phase 1'de DatePicker'a taşınır (Talep 15 bütünlüğü); Phase 3 sayfaya taşırken devralır.

---

## Phase 1 — `general-features` (Talep 15, 1, 4, 13)

## Task 1 — Shared DatePicker genişletme + yeni TimePicker

### Amaç

Talep 15'in temelini kurmak: `components/ui/date-picker.tsx` source-of-truth kalır, aynı dilde `components/ui/time-picker.tsx` eklenir.

### Neden bu sırada?

Task 2 tüketici migrasyonu ve Phase 3 Sprint sayfası bu bileşenlere bağımlı.

### Prerequisite

Yok.

### Etkilenecek alanlar

- Backend: yok
- Database: yok
- Frontend: `components/ui/date-picker.tsx` (opsiyonel `min`/`max`), yeni `components/ui/time-picker.tsx`
- Navigation: yok
- Cache: yok
- Notification: yok
- Shared Components: DatePicker, TimePicker
- Security: yok
- i18n/a11y: `datePicker.*` ek anahtarlar, yeni `timePicker.*` (TR/EN/DE); klavye, Escape, focus return, listbox semantics
- Tests: `e2e/task-date-picker.spec.ts` regresyon, yeni `e2e/time-picker.spec.ts`, `e2e/helpers.ts` `chooseTime()`

### Checklist

- [x] 1.1 DatePicker `min?`/`max?` (YYYY-MM-DD) geriye uyumlu: aralık dışı gün disabled, Today aralık dışıysa pasif, ay/yıl seçenekleri sınırlı; mevcut tüketiciler değişmez.
- [x] 1.2 TimePicker: Base UI Popover/Button dili; `id,label,value("HH:mm"|""),onChange,onBlur,ref,disabled,invalid,describedBy,minuteStep(5)`; 24 saat; saat/dakika listbox kolonları (ok, Home/End, Enter); Şimdi + Temizle; Escape + focus return.
- [x] 1.3 TR/EN/DE metinleri (`datePicker.outOfRange`, `timePicker.*`).
- [x] 1.4 `chooseTime()` helper eklendi. `time-picker.spec.ts` gerçek tüketici gerektirdiği için (sahte/dev sayfa yok) Task 2.5'e taşındı.

### Definition of Done

- [x] `task-date-picker.spec.ts` geçer (5/5, güncel kodla :3000 dev sunucusunda).
- [x] Yeni picker spec → Task 2.5'e devredildi (gerekçe yukarıda).
- [x] lint + `npx tsc --noEmit` temiz (`npm ci` ile eksik `@axe-core/playwright` kuruldu; lock değişmedi).

## Task 2 — Tarih/saat tüketicilerinin ortak bileşenlere migrasyonu

### Amaç

Audit'teki native date/time girdilerini DatePicker/TimePicker'a taşımak; backend sözleşmelerini korumak.

### Neden bu sırada?

Task 1 bileşenlerine bağlı.

### Prerequisite

Task 1 DoD.

### Etkilenecek alanlar

- Backend: yok (reminder `LocalDate`+`LocalTime`, sprint/worklog `LocalDate`, task `Instant deadlineAt` sözleşmeleri aynen)
- Database: yok
- Frontend: `features/reminders/components/reminder-form-page.tsx`, `features/tasks/components/task-form-page.tsx` (deadline time), `features/tasks/components/detail/time-tracking.tsx` (worklog date), `features/sprints/components/sprint-dialog.tsx` (start/end)
- Navigation: yok
- Cache: yok (mevcut invalidation korunur)
- Notification: yok
- Shared Components: DatePicker/TimePicker tüketimi
- Security: yok
- i18n/a11y: label/describedBy bağları korunur
- Tests: `07-reminders.spec.ts` (persisted değer birebir), `09-tasks.spec.ts`, `task-date-picker.spec.ts`, sprint/worklog etkilenen spec'ler; docs `frontend-design-rules.md` native date/time kuralı güncellenir

### Checklist

- [x] 2.1 Reminder date (create'te `min=today`) + time → Controller + ortak bileşenler; zod şeması aynen; Field hata id'si + `aria-describedby`.
- [x] 2.2 Task deadline time → TimePicker `#task-deadline-time` (ADVANCED koşulu + quick deadline butonları korunur).
- [x] 2.3 Worklog date → DatePicker `max=today` (dialog içinde çalışıyor).
- [x] 2.4 Sprint start/end → DatePicker; end `min=start`; start değişince `trigger("endDate")` (dialog içinde çalışıyor).
- [x] 2.5 Gerçek backend E2E: yeni `time-picker.spec.ts` 8/8 (reminder 09:30 persisted birebir, klavye/Escape/Clear, min, 390px light/dark, sprint + worklog dialog); `task-date-picker` 5/5, `07-reminders` 9/9, `09-tasks` 10/10, `task-planning-assignment` 7/7, `21-task-models` + `project-settings` + `task-board-calendar` geçti.

Not: `06-calendar-page.spec.ts` tek başına koşunca başarısız. Kanıt: `global-setup.ts` her koşuda yeni yönetici açar; spec önceki spec'lerin oluşturduğu projeye bağımlı (sayfa "Takvim bir projeye bağlıdır" boş durumunu gösteriyor). Tarih/saat alanlarına dokunmuyor → mevcut sıra bağımlılığı, bu değişiklikten bağımsız; tam paket sırası pre-push'ta doğrulanacak.

### Definition of Done

- [x] Gerekçesiz native `type="date|time"` kalmadı (`frontend/src` araması boş).
- [x] Persisted değerler birebir doğrulandı.
- [x] Europe/Istanbul deadline testi geçer (`task-date-picker.spec.ts`).

## Task 3 — Create form validation summary + ortak sticky actions

### Amaç

Talep 1: Project/Organization create'te inline hatalar korunarak submit alanına yakın erişilebilir validation summary; Part E ortak create-form kabuğu.

### Neden bu sırada?

Phase 3/4 tam sayfa formları (`StickyFormActions`, `FormErrorSummary`) bunu yeniden kullanacak.

### Prerequisite

Yok.

### Etkilenecek alanlar

- Backend: yok
- Database: yok
- Frontend: yeni `components/common/form-error-summary.tsx`, `components/common/sticky-form-actions.tsx`; `features/projects/components/project-create-page.tsx`; `features/organizations/components/organization-form-page.tsx`
- Navigation: bölüm bağlantısı → scroll + focus
- Cache: yok
- Notification: yok
- Shared Components: FormErrorSummary, StickyFormActions (`data-sticky-actions` kontratı)
- Security: yok
- i18n/a11y: `forms.summary.*` TR/EN/DE; `role="alert"`, `aria-live`, `aria-describedby`, focus management
- Tests: yeni `e2e/create-validation-summary.spec.ts`; `project-create-page.spec.ts` regresyon

### Checklist

- [x] 3.1 `FormErrorSummary` + `focusFormSection` (bölüm listesi, ilk geçersiz alana scroll+focus; panel odak çalmaz, yazarken odak taşınmaz).
- [x] 3.2 `StickyFormActions` (mevcut footer sınıfları, safe-area; Project/Org create'e uygulandı).
- [x] 3.3 Project create: `handleSubmit(onValid, onInvalid)`, repo URL kontrolü iki yolda, `shouldFocusError: false`, TypePicker `[role=radio]` hedefi.
- [x] 3.4 Organization form: aynı summary; partial-upload banner ve busy guard korunur (odak ilk hatalı alana gider, özet role=alert ile duyurulur — iki formda tek davranış).
- [x] 3.5 TR/EN/DE `forms.summary.*` (DE `Sie` diliyle).
- [x] 3.6 E2E T1 `create-validation-summary.spec.ts` 9/9 (Project boş, Project geçersiz repo, Org boş + geçersiz website; 320/390/1440 × light/dark).
- [x] 3.7 Merge sonrası: odak ilk hatalı alana (Alper'in ekip standardı), özet role=alert ile duyurulur

### Definition of Done

- [x] İki form aynı UX.
- [x] Inline hatalar korunuyor.
- [x] Erişilebilirlik (role=alert, aria-labelledby, aria-describedby, focus) doğrulandı; ilgili 5 spec birlikte 36/36.

## Task 4 — Organization kartı ProjectCard ölçülerine hizalama

### Amaç

Talep 4: Org kart kabuğunu ProjectCard ile aynı görsel ritme getirmek; org içeriğini korumak.

### Neden bu sırada?

Bağımsız; Task 3'ten sonra branch içi sıra.

### Prerequisite

Yok.

### Etkilenecek alanlar

- Backend: yok
- Database: yok
- Frontend: `features/organizations/components/organization-card.tsx`, `organization-list.tsx` skeleton
- Navigation: kart stretched link korunur
- Cache: yok
- Notification: yok
- Shared Components: `EntityCard`, `EntityCover`/`OrganizationCover`
- Security: yok
- i18n/a11y: mevcut
- Tests: yeni `e2e/organization-card-dimensions.spec.ts`; `organization-project-association.spec.ts` regresyon

### Checklist

- [x] 4.1 Kart EntityCard kabuğuna taşındı; uzun ad truncate; website/konum/son güncelleme bölümleri (gerçek liste alanları).
- [x] 4.2 Skeleton eşitlendi (`EntityCardSkeleton` ortak).
- [x] 4.3 E2E 320/390/768/1024/1440 bounding-box karşılaştırması; light/dark (`organization-card-dimensions.spec.ts`).
- [x] 4.4 Org form canlı önizleme taslağına `website`/`location` eklendi.

### Definition of Done

- [x] Kart ölçüleri ProjectCard ile ±1px (her genişlikte birebir: ör. 1440 → 368×511 / 368×511).
- [x] Org detail/form preview regresyonu yok (detail/profile/association 29/29; 4.4 sonrası org spec'leri 36/36 içinde yeniden geçti).

## Task 5 — Görev yorumu Enter / Ctrl+Enter

### Amaç

Talep 13: Enter gönder, Ctrl+Enter yeni satır; IME ve mobil güvenli.

### Neden bu sırada?

Bağımsız.

### Prerequisite

Yok.

### Etkilenecek alanlar

- Backend: yok
- Database: yok
- Frontend: `features/tasks/components/detail/mention-textarea.tsx`, `activity-section.tsx`
- Navigation: yok
- Cache: yok
- Notification: yok (mention bildirimi değişmez)
- Shared Components: MentionTextarea
- Security: yok
- i18n/a11y: `tasks.detail.activity.composer.hint` desktop/touch varyantları
- Tests: yeni `e2e/task-comment-keyboard.spec.ts`

### Checklist

- [x] 5.1 Mention listesi açıkken mevcut Enter/Tab seçim davranışı önce gelir.
- [x] 5.2 IME (`isComposing`/keyCode 229) → gönderim yok (mention dalından da önce).
- [x] 5.3 Desktop Enter → gönder (boş/pending/basılı tutma `repeat` değilse); Ctrl/Cmd+Enter → caret'e newline (`maxLength` korunur); Shift+Enter native newline.
- [x] 5.4 Dokunmatik (`hooks/use-touch-primary-input.ts`): Enter = newline; Gönder butonu korunur.
- [x] 5.5 Edit `save()` pending guard.
- [x] 5.6 Hint TR/EN/DE (`composer.hint`, `composer.hintTouch`), textarea `aria-describedby`.
- [x] 5.7 E2E T13 `task-comment-keyboard.spec.ts` 9/9 (tek POST, çok satır, caret ortası, Shift+Enter, boş, IME, mention, touch, edit PATCH).

### Definition of Done

- [x] Senaryolar gerçek backend ile geçer; `09-tasks` + `my-task-cards` 18/18.
- [x] Çift gönderim yok (tek POST/PATCH sayımı).

## Task 6 — Phase 1 entegre regresyon + dokümantasyon

### Amaç

Branch completion gate.

### Neden bu sırada?

Phase 1 tasklarının hepsinden sonra.

### Prerequisite

Task 1–5 DoD.

### Etkilenecek alanlar

- Backend: `mvnw clean verify` (pre-push içinde)
- Database: yok
- Frontend: lint/type/build
- Navigation/Cache/Notification: regresyon
- Shared Components: doc güncellemesi
- Security: yok
- i18n/a11y: üç dil kontrolü
- Tests: hedefli Playwright + pre-push

### Checklist

- [x] 6.1 `npm run lint`, `npx tsc --noEmit`, `npm run build` (pre-push içinde temiz).
- [x] 6.2 Phase 1 hedefli + etkilenen Playwright (ara koşu hataları giderildi: `organization-card-dimensions` sayfalama, `invitation-notification-context` mevcut spec hatası; ayrıntı completion kaydında).
- [x] 6.3 `.\pre-push\pre-push.cmd` PASS (merge öncesi) — backend 649/0/0/0, Chromium 595 + 1 beklenen skip, Docker build/start/health. Alper'in 3 commit'iyle merge sonrası: 709/712; 2 aralıklı hata (`a11y-public` ERR_CONNECTION_REFUSED, `team-member-preview` oturum 401). Kullanıcı kararıyla istisna kaydedildi (completion kaydı §3).
- [x] 6.4 Docs (`frontend-design-rules.md`, `folder-structure.md`, `architecture.md`, web checklist scoped notu) + `docs/compliation/2026-10-10-general-features-ui-refinements.md`.

### Definition of Done (Branch completion)

- [x] Talep 1 tamamlandı/test edildi.
- [x] Talep 4 tamamlandı/test edildi.
- [x] Talep 13 tamamlandı/test edildi.
- [x] Talep 15 tamamlandı/test edildi.
- [x] General-features targeted regression geçti.
- [x] Branch-scoped lint/type/build geçti.
- [x] Kullanıcı değişiklikleri korundu.
- [x] Commit/push/staging yapılmadı.

STOP → `BRANCH COMPLETE — general-features`

## Transition Gate 1

- [x] Kullanıcı `general-features` commit'ini doğruladı (`74f2a73` + merge `ba2d4df`).
- [x] Kullanıcı push'u doğruladı; main'e PR #126 (`7d4924c`) ile merge edildi.
- [x] `project-service-backend` Phase 1 commitlerini içeriyor: `git pull --ff-only origin main` → HEAD `7d4924c`, `merge-base --is-ancestor ba2d4df HEAD` = true, ortak bileşen dosyaları mevcut.

---

## Phase 2 — `project-service-backend` (Talep 3 + 9 backend prerequisite)

## Task 7 — Commit listesi `X-Has-Next-Page`

### Amaç

GitHub Link `rel="next"` bilgisini okuyup commit listesine deterministik sonraki-sayfa bilgisi eklemek.

### Neden bu sırada?

Phase 3 Task 13 bu sözleşmeye bağımlı.

### Prerequisite

Transition Gate 1.

### Etkilenecek alanlar

- Backend: `GitHubRestRepositoryClient`, `GitHubRepositoryClient` contract, `GitHubReadCache`, `ProjectRepositoryConnectionService`, `ProjectRepositoryController#commits`
- Database: yok
- Frontend: yok (Phase 3)
- Navigation: yok
- Cache: GitHub read cache hasNext ile birlikte
- Notification: yok (scan değişmez)
- Shared Components: yok
- Security: header expose (CORS gerekirse); yeni endpoint yok
- i18n/a11y: yok
- Tests: client unit + controller integration

### Checklist

- [x] 7.1 Link header parse (`GitHubRestRepositoryClient.hasNextPage`) + unit test (`GitHubRestRepositoryClientTest`, 2 yeni metot).
- [x] 7.2 `GitHubRepositoryClient.CommitPage(commits, hasNext)`; cache tüm sayfayı tutar; servis page 10'da hasNext=false; controller gövde aynı + `X-Has-Next-Page`; CORS exposed headers'a eklendi (mevcut `X-Access-Token-Expires-In` korunur).
- [x] 7.3 Integration test (`ProjectRepositoryApiIntegrationTest`, 4 yeni metot): header true/false, sayfa 9/10/11, BASIC 409, non-member 403, anonim 401, CORS expose.
- [x] 7.4 SECURITY.md GitHub bölümüne sayfalama başlığı + CORS expose notu eklendi.

### Definition of Done

- [x] Yeni + mevcut repository testleri geçer; tam `mvnw clean verify` 655/0/0/0.
- [x] Liste sözleşmesi geriye uyumlu (gövde değişmedi).

## Task 8 — Davete özel banner endpoint

### Amaç

Davetli kullanıcının proje banner'ını önizlemede görebilmesi.

### Neden bu sırada?

Phase 3 Task 15'e bağımlı.

### Prerequisite

Transition Gate 1.

### Etkilenecek alanlar

- Backend: `InvitationProjectPreview` (`bannerVersion`), `ProjectInvitationService` (logo eşleniği), `MyProjectInvitationController` `GET /api/v1/project-invitations/{id}/banner`
- Database: yok
- Frontend: yalnız tip (Phase 3)
- Navigation: yok
- Cache: `private, no-store`
- Notification: yok
- Shared Components: yok
- Security: `SecurityBaselineConfiguration` GET matcher (onaylı); yalnız davet edilen hesap; yabancı 404
- i18n/a11y: yok
- Tests: integration (davetli 200, yabancı 404, banner yok 404, silinmiş proje 404, oturumsuz 401), `ModularityTest`

### Checklist

- [x] 8.1 `InvitationProjectPreview` additive nullable `bannerVersion`.
- [x] 8.2 `previewBannerMine` (logo ile aynı `invitedProject`: yalnız kendi PENDING daveti, canlı proje; `ProjectBannerService.read` değişmedi) + `GET /api/v1/project-invitations/{id}/banner`.
- [x] 8.3 Tek GET matcher (mevcut davet GET grubuna) + SECURITY.md davet tablosu.
- [x] 8.4 `ProjectInvitationApiIntegrationTest` 2 yeni metot (200/404/401/403, PENDING-only, arşiv ve hard-delete).

### Definition of Done

- [x] `mvnw clean verify` PASS (657/0/0/0).
- [x] Project Service security/lifecycle regresyonu yok (`ProjectBannerIntegrationTest`, `ModularityTest` dahil).
- [x] pre-push: 708/712. `11-project-banner` eski sözleşme testi güncellendi ve geçti; aralıklı `team-member-preview` 401'i için kullanıcı kararıyla istisna kaydedildi (completion §3). 19/19 tekrar.
- [x] Commit/push yapılmadı (staging kullanıcı kararıyla ajan tarafından yapıldı).

STOP → `BRANCH COMPLETE — project-service-backend`

## Transition Gate 2

- [ ] Kullanıcı backend commit/push'u doğruladı.
- [ ] `project-service-frontend` Phase 1 + Phase 2 commitlerini içeriyor.

---

## Phase 3 — `project-service-frontend` (Talep 2, 6, 5, 14, 3, 8, 9)

## Task 9 — Priority kart/önizleme tutarlılığı (Talep 2)

### Amaç

Priority'nin Projeler kartında, ayar/oluşturma önizlemesinde ve davet önizlemesinde güncel görünmesi.

### Neden bu sırada?

Bağımsız; ProjectCard'a dokunduğu için Task 15'ten önce.

### Prerequisite

Transition Gate 2.

### Etkilenecek alanlar

- Backend: yok (ProjectResponse priority taşıyor)
- Database: yok
- Frontend: `project-card.tsx`, `project-settings-form.tsx` preview memo, `project-create-page.tsx` preview
- Navigation: yok
- Cache: mevcut `["projects"]` invalidation yeterli (kanıtlandı)
- Notification: yok
- Shared Components: `PriorityIndicator` (`features/tasks/components/task-badges.tsx`)
- Security: yok
- i18n/a11y: `priorityValues.*`, renk tek başına anlam taşımaz
- Tests: `e2e/project-priority.spec.ts` (T2, C4 izolasyon)

### Checklist

- [ ] 9.1 Kart + preview priority.
- [ ] 9.2 E2E T2.

### Definition of Done

- [ ] Hard reload olmadan edit/kart/preview aynı değer; Project B etkilenmiyor.

## Task 10 — Silinen proje sidebar/route temizliği (Talep 6)

### Amaç

Silinen projeye sidebar/cached navigation ile girişi engellemek.

### Neden bu sırada?

State katmanı; Kriter/Sprint sayfalarından önce temiz seçili-proje davranışı.

### Prerequisite

Transition Gate 2.

### Etkilenecek alanlar

- Backend: yok (hard delete + 404 doğru)
- Database: yok
- Frontend: `features/projects/hooks/use-selected-project.ts`, `project-settings-form.tsx` delete onSuccess, `components/layout/project-sidebar-nav.tsx`
- Navigation: `router.replace("/projects")`, sidebar error durumunda pasif
- Cache: hedefli `removeQueries` (by-slug, proje alt aileleri), list invalidate; global clear yok
- Notification: yok
- Shared Components: yok
- Security: yok
- i18n/a11y: mevcut
- Tests: `e2e/project-delete-navigation.spec.ts` (T3)

### Checklist

- [ ] 10.1 Hook: 404'te remembered slug temizliği + `forgetSelectedProject`.
- [ ] 10.2 Delete akışı.
- [ ] 10.3 Sidebar error durumu.
- [ ] 10.4 E2E T3.

### Definition of Done

- [ ] Stale slug link üretmiyor; eski route 404; başka hesap etkilenmiyor.

## Task 11 — Kriter create/edit tam sayfa (Talep 5)

### Amaç

Kriter dialogunu `criteria/new` ve `criteria/[criterionId]/edit` sayfalarına taşımak.

### Neden bu sırada?

Shared form kabuğu (Phase 1) ve temiz proje state (Task 10) sonrası.

### Prerequisite

Task 10 DoD; Phase 1 `StickyFormActions`/`FormErrorSummary`.

### Etkilenecek alanlar

- Backend: yok (mevcut `/criteria` API)
- Database: yok
- Frontend: yeni route'lar, `features/criteria/components/criterion-form-page.tsx`, `criteria-list.tsx`; dialog kaldırılır
- Navigation: `i18n/routing.ts` PAGE_ROUTES/LEAF_SEGMENTS, `pageTitle`, `app-breadcrumb.tsx`, sidebar aktiflik
- Cache: criteria + home invalidation (bug fix)
- Notification: yok
- Shared Components: StickyFormActions, FormErrorSummary, PageContainer, PageHeader
- Security: UI `isManager`; sunucu `CRITERIA_MANAGE`
- i18n/a11y: TR/EN/DE route segment + metinler
- Tests: `e2e/criteria-pages.spec.ts` (T4)

### Checklist

- [ ] 11.1 Routing.
- [ ] 11.2 Form sayfası.
- [ ] 11.3 Liste entegrasyonu (Link).
- [ ] 11.4 E2E T4.

### Definition of Done

- [ ] Modal açılmıyor; create/edit gerçek DB; Back doğru; home progress güncel.

## Task 12 — Sprint create/edit tam sayfa (Talep 14)

### Amaç

Sprint dialogunu `sprints/new` ve `sprints/[sprintId]/edit` sayfalarına taşımak.

### Neden bu sırada?

Kriter sayfası deseninden sonra; Phase 1 DatePicker'a bağlı.

### Prerequisite

Task 11 DoD; Phase 1 DatePicker.

### Etkilenecek alanlar

- Backend: yok
- Database: yok
- Frontend: yeni route'lar, `features/sprints/components/sprint-form-page.tsx`, `sprints-page.tsx`, `sprint-actions.tsx`; dialog kaldırılır
- Navigation: routing tabloları, breadcrumb ("new"/"edit" sprint adı sanılmaz)
- Cache: mevcut `useTaskMutation` invalidation
- Notification: yok
- Shared Components: DatePicker, StickyFormActions, FormErrorSummary
- Security: UI `isManager && allowsAdvanced`; sunucu `TASK_MANAGE`
- i18n/a11y: TR/EN/DE
- Tests: `e2e/sprint-pages.spec.ts` (T6)

### Checklist

- [ ] 12.1 Routing.
- [ ] 12.2 Sayfa.
- [ ] 12.3 Liste/actions bağlantıları.
- [ ] 12.4 E2E T6.

### Definition of Done

- [ ] Modal yok; shared DatePicker; DB'de sprint; edit çalışır.

## Task 13 — Commit history pagination UI (Talep 3)

### Amaç

GitHub benzeri Önceki · sayfalar · Sonraki listesi.

### Neden bu sırada?

Phase 2 Task 7 sözleşmesine bağlı.

### Prerequisite

Transition Gate 2 (`X-Has-Next-Page` mevcut).

### Etkilenecek alanlar

- Backend: yok (Phase 2)
- Database: yok
- Frontend: `features/repository/api.ts`, `repository-branches.tsx`, BASIC ana dal listesi
- Navigation: `?cpage=` URL; branch/proje değişince reset
- Cache: sayfa bazlı query key; eski sayfa yanlış gösterilmez
- Notification: yok
- Shared Components: toplamsız pagination varyantı (PaginationBar görsel dili)
- Security: yok
- i18n/a11y: pagination etiketleri TR/EN/DE
- Tests: `e2e/commit-pagination.spec.ts` (T7)

### Checklist

- [ ] 13.1 API header okuma.
- [ ] 13.2 Pagination bileşeni + liste.
- [ ] 13.3 E2E T7.

### Definition of Done

- [ ] Sayfa 1 → 2 → Önceki deterministik; loading'de eski liste yok.

## Task 14 — Proje Davetlerim redesign (Talep 8)

### Amaç

Mevcut davranışları koruyarak modern desktop tablo + mobil kart.

### Neden bu sırada?

Task 15 aynı yüzeye dokunur; önce layout.

### Prerequisite

Transition Gate 2.

### Etkilenecek alanlar

- Backend: yok
- Database: yok
- Frontend: `features/invitations/components/my-invitations-page.tsx`
- Navigation: filtre `?status=`
- Cache: actor-scoped key'ler korunur
- Notification: yok
- Shared Components: Table, Badge, PaginationBar, EmptyState
- Security: yok
- i18n/a11y: TR/EN/DE, 44px aksiyonlar
- Tests: mevcut invitation spec'leri + responsive kontrol

### Checklist

- [ ] 14.1 Layout.
- [ ] 14.2 Responsive 320–1440 + light/dark.
- [ ] 14.3 Mevcut invitation spec'leri yeşil.

### Definition of Done

- [ ] Hiçbir mevcut bilgi/davranış kaybolmadı.

## Task 15 — Davet önizleme banner (Talep 9)

### Amaç

Proje bilgileri önizlemesinde gerçek banner, yoksa fallback.

### Neden bu sırada?

Phase 2 Task 8 + Task 14 sonrası.

### Prerequisite

Transition Gate 2; Task 14.

### Etkilenecek alanlar

- Backend: yok (Phase 2)
- Database: yok
- Frontend: `features/invitations/api.ts`, `invitation-project-preview-dialog.tsx`, `project-card.tsx` invitation banner kaynağı
- Navigation: yok
- Cache: `?v=bannerVersion`
- Notification: yok
- Shared Components: EntityCover fallback
- Security: davet-scoped endpoint
- i18n/a11y: dekoratif `aria-hidden`
- Tests: `e2e/invitation-preview-banner.spec.ts` (T9); `frontend-design-rules.md` banner kuralı güncellenir

### Checklist

- [ ] 15.1 Banner kaynağı.
- [ ] 15.2 E2E T9 (banner'lı, banner'sız, bozuk görsel).

### Definition of Done

- [ ] Banner görünüyor; fallback güvenli.

## Task 16 — Phase 3 regresyon

### Amaç

Branch completion gate.

### Neden bu sırada?

Phase 3 tasklarından sonra.

### Prerequisite

Task 9–15 DoD.

### Etkilenecek alanlar

- Backend/Database: pre-push içinde
- Frontend/Navigation/Cache: regresyon
- Notification/Shared Components/Security/i18n: kontrol
- Tests: hedefli Playwright + pre-push

### Checklist

- [ ] 16.1 lint/type/build.
- [ ] 16.2 Hedefli + etkilenen Playwright.
- [ ] 16.3 pre-push PASS.
- [ ] 16.4 Docs + completion kaydı.

### Definition of Done (Branch completion)

- [ ] Talep 2, 3, 5, 6, 8, 9, 14 tamamlandı/test edildi.
- [ ] Targeted Playwright + lint/type/build geçti.
- [ ] Backend contract'ları real API/PostgreSQL ile doğrulandı.
- [ ] Commit/push/staging yapılmadı.

STOP → `BRANCH COMPLETE — project-service-frontend`

## Transition Gate 3

- [ ] Kullanıcı commit/push'u doğruladı.
- [ ] `squad-service-backend` gerekli shared prerequisites'i içeriyor.

---

## Phase 4 — `squad-service-backend` (Talep 7, 10, 11)

## Task 17 — Ekipler Grid | Tablo | Şema (Talep 7)

### Amaç

Mevcut grid ve şemayı koruyarak aynı veri kaynağından tablo görünümü eklemek.

### Neden bu sırada?

Bağımsız; davet akışlarından önce.

### Prerequisite

Transition Gate 3.

### Etkilenecek alanlar

- Backend: yok
- Database: yok
- Frontend: `features/squads/components/teams-page.tsx`, yeni `team-table.tsx`
- Navigation: `?view=grid|table|chart` (eski `list` uyumlu), `?page=`
- Cache: aynı `["projects",id,"squads","all"]` query
- Notification: yok
- Shared Components: Table, Tabs, TeamMemberPreview
- Security: localStorage anahtarı kullanıcıya özel (`pda:teams-view:v1:<userId>`)
- i18n/a11y: TR/EN/DE; md altı yığılmış liste
- Tests: `e2e/teams-view-toggle.spec.ts` (T8)

### Checklist

- [ ] 17.1 Görünüm state.
- [ ] 17.2 Tablo bileşeni.
- [ ] 17.3 E2E T8.

### Definition of Done

- [ ] Üç görünüm aynı veri seti; tek ağ isteği; sayfa korunur.

## Task 18 — Üye Davet Et tam sayfa (Talep 10)

### Amaç

`AddTeamMemberDialog` akışını `/projects/[slug]/team-invitations/new` sayfasına taşımak.

### Neden bu sırada?

Task 19 Ekip Davetleri sayfasına dokunur; önce davet akışı.

### Prerequisite

Task 17; Phase 1 shared form kabuğu.

### Etkilenecek alanlar

- Backend: yok (mevcut invitation API)
- Database: yok
- Frontend: yeni route + `features/squads/components/invite-member-page.tsx`; `invitations-page.tsx`, `team-detail-page.tsx` tetikleyicileri; dialog kaldırılır
- Navigation: routing tabloları; proxy `team-invitations` sanal bölüm çakışması kontrolü; `?team=`
- Cache: mevcut invalidation (teams, invitations, members)
- Notification: yok
- Shared Components: StickyFormActions, RolePicker, MessageField
- Security: sunucu `requireManager` + proje-ekip doğrulaması tek otorite
- i18n/a11y: TR/EN/DE
- Tests: `e2e/invite-member-page.spec.ts` (T5)

### Checklist

- [ ] 18.1 Routing.
- [ ] 18.2 Sayfa.
- [ ] 18.3 E2E T5 (DB'de davet, duplicate 409, yabancı teamId 404).

### Definition of Done

- [ ] Modal yok; mevcut davranışlar (aday, ekibe ekle, e-posta, roller, mesaj) korunuyor.

## Task 19 — Takım daveti yanıt rozeti (Talep 11)

### Amaç

"Ekip Davetleri" yanında PENDING'den ayrı `+N` okunmamış yanıt rozeti.

### Neden bu sırada?

Davet akışları tamamlandıktan sonra.

### Prerequisite

Task 18.

### Etkilenecek alanlar

- Backend: notification `unread-count` ve liste için opsiyonel `projectId` + `type` (allowlist) filtresi; principal scope aynı
- Database: yok (mevcut index'ler kontrol edilir)
- Frontend: `features/notifications` hook/key, `teams-sidebar-menu.tsx`, `invitations-page.tsx` "N yeni yanıt" şeridi + "Okundu işaretle"
- Navigation: yok
- Cache: `["notifications","actor",userId,"count","invitation-responses",projectId]`; okuma sonrası count/list reconcile
- Notification: mevcut `PROJECT_INVITATION_ACCEPTED/REJECTED` reuse; yeni event yok
- Shared Components: PendingInvitationBadge yanında ayrı rozet
- Security: matcher değişmez; SECURITY.md notu
- i18n/a11y: farklı aria-label, TR/EN/DE
- Tests: backend integration + `e2e/team-invitation-response-badge.spec.ts` (T10, iki kullanıcı)

### Checklist

- [ ] 19.1 Backend filtre + test.
- [ ] 19.2 Hook + rozet.
- [ ] 19.3 Şerit + okundu.
- [ ] 19.4 E2E T10.

### Definition of Done

- [ ] Pending ile karışmıyor; proje ve aktör izolasyonu geçti.

## Task 20 — Phase 4 regresyon

### Amaç

Branch completion gate.

### Neden bu sırada?

Phase 4 sonrası.

### Prerequisite

Task 17–19 DoD.

### Etkilenecek alanlar

- Backend: `mvnw clean verify`
- Frontend: lint/type/build
- Tests: team/invitation/notification Playwright + pre-push

### Checklist

- [ ] 20.1 Backend verify.
- [ ] 20.2 lint/type/build.
- [ ] 20.3 Playwright.
- [ ] 20.4 pre-push PASS.
- [ ] 20.5 Docs + completion.

### Definition of Done (Branch completion)

- [ ] Talep 7, 10, 11 tamamlandı/test edildi.
- [ ] Pending count ile response badge karışmıyor.
- [ ] Real accept/reject multi-user flow geçti.
- [ ] Actor/project isolation geçti.
- [ ] Commit/push/staging yapılmadı.

STOP → `BRANCH COMPLETE — squad-service-backend`

## Transition Gate 4

- [ ] Kullanıcı commit/push'u doğruladı.
- [ ] `notification-service` güncel prerequisite tabanını içeriyor.

---

## Phase 5 — `notification-service` (Talep 12)

## Task 21 — Bildirim geçmişi silme backend

### Amaç

Yalnız sahibine ait okunmuş bildirimleri kalıcı silmek.

### Neden bu sırada?

Frontend Task 22 buna bağlı.

### Prerequisite

Transition Gate 4.

### Etkilenecek alanlar

- Backend: `NotificationRepository` (kapsamlı delete), `NotificationService`, `NotificationController` `DELETE /{id}` (204), `DELETE ?read=true` (200 `{count}`)
- Database: şema değişmez (FK yok)
- Frontend: yok
- Navigation: yok
- Cache: yok
- Notification: unread kayıtlar asla silinmez
- Shared Components: yok
- Security: iki DELETE matcher (onaylı), CSRF, IDOR → 404
- i18n/a11y: yok
- Tests: integration (T11, T12, CSRF 403, 401)

### Checklist

- [ ] 21.1 Repository/service.
- [ ] 21.2 Controller + matcher.
- [ ] 21.3 Integration testleri.
- [ ] 21.4 SECURITY.md.

### Definition of Done

- [ ] Single delete persistent; delete-all yalnız read; IDOR kapalı.

## Task 22 — Bildirim geçmişi silme frontend

### Amaç

History satırında çöp kutusu + "Tümünü sil" (onaylı).

### Neden bu sırada?

Task 21 sözleşmesine bağlı.

### Prerequisite

Task 21.

### Etkilenecek alanlar

- Backend: yok
- Database: yok
- Frontend: `features/notifications/components/notification-center.tsx`, `api.ts`, hook
- Navigation: yok
- Cache: history list + count reconcile; son öğe silinince önceki sayfaya clamp
- Notification: New sekmesinde aksiyon yok
- Shared Components: ConfirmDialog (destructive)
- Security: yok
- i18n/a11y: TR/EN/DE, 44px, focus yönetimi
- Tests: `notification-history*.spec.ts` genişletme + DB doğrulama

### Checklist

- [ ] 22.1 Tekli silme.
- [ ] 22.2 Tümünü sil + onay.
- [ ] 22.3 Metinler.
- [ ] 22.4 E2E.

### Definition of Done

- [ ] Hard reload olmadan reconcile; New korunuyor.

## Task 23 — Phase 5 regresyon

### Amaç

Branch completion gate.

### Neden bu sırada?

Phase 5 sonrası.

### Prerequisite

Task 21–22 DoD.

### Etkilenecek alanlar

- Backend/Frontend/Tests: verify, lint/type/build, Playwright, pre-push

### Checklist

- [ ] 23.1 Backend verify.
- [ ] 23.2 lint/type/build.
- [ ] 23.3 Playwright.
- [ ] 23.4 pre-push PASS.
- [ ] 23.5 Docs + completion.

### Definition of Done (Branch completion)

- [ ] Single History delete persistent.
- [ ] Delete All yalnız read/history kayıtlarını siliyor.
- [ ] New/unread kayıtlar korunuyor.
- [ ] Foreign recipient delete IDOR kapalı.
- [ ] Pagination/cache hard reload olmadan reconciled.
- [ ] Targeted backend/frontend notification tests geçti.
- [ ] Commit/push/staging yapılmadı.

STOP → `BRANCH COMPLETE — notification-service`

## Transition Gate 5

- [ ] Kullanıcı commit/push'u doğruladı.

---

## Phase 6 — Final cross-branch verification / completion

- [ ] Tüm branch'lerin ortak integration graph'ında birleştiği kullanıcıyla teyit edildi.
- [ ] Backend `mvnw clean verify`.
- [ ] Frontend lint / TypeScript / production build.
- [ ] Tüm hedefli Playwright paketleri + full Chromium.
- [ ] `.\pre-push\pre-push.cmd` (Docker build/start/health dahil).
- [ ] Ayrı completion dokümanı (`docs/compliation/`), md'deki final başlıklarla.

### Final DoD

- [ ] Tüm branch phase checkbox'ları `[x]`.
- [ ] Tüm transition gate'ler kullanıcı tarafından doğrulandı.
- [ ] Cross-branch integration gerçekten mevcut.
- [ ] Full regression PASS.
- [ ] Canonical pre-push PASS.
- [ ] Separate implementation completion hazır.
- [ ] Agent commit/push/staging yapmadı.
