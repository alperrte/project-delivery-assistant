# general-features — Ortak tarih/saat seçiciler, form doğrulama özeti, organizasyon kartı, yorum klavyesi

## 1. Teslim ve durum

- Branch: `general-features` — Phase 1 / `PDA_UI_WORKFLOW_STATE_NOTIFICATION_REFINEMENTS_PLAN.md`
- Kapsam: Talep 15 (ortak DatePicker + yeni TimePicker + tüm tüketiciler), Talep 1 (Proje/Organizasyon create doğrulama özeti), Talep 4 (Organizasyon kartı = Proje kartı ölçüleri), Talep 13 (görev yorumu Enter / Ctrl+Enter).
- Durum: Tamamlandı ve doğrulandı. Commit/push kullanıcıya aittir; ajan commit, push ve staging yapmadı.

## 2. Yapılanlar

- Tarih/saat:
  - [date-picker.tsx](../../frontend/src/components/ui/date-picker.tsx): geriye uyumlu opsiyonel `min`/`max`.
  - [time-picker.tsx](../../frontend/src/components/ui/time-picker.tsx): yeni 24 saat seçici.
  - Taşınan tüketiciler: hatırlatıcı tarih+saat ([reminder-form-page.tsx](../../frontend/src/features/reminders/components/reminder-form-page.tsx)), görev deadline saati ([task-form-page.tsx](../../frontend/src/features/tasks/components/task-form-page.tsx)), çalışma kaydı tarihi ([time-tracking.tsx](../../frontend/src/features/tasks/components/detail/time-tracking.tsx)), sprint başlangıç/bitiş ([sprint-dialog.tsx](../../frontend/src/features/sprints/components/sprint-dialog.tsx)).
  - `frontend/src` içinde native `type="date|time"` kalmadı.
  - Backend sözleşmeleri değişmedi: reminder `LocalDate`+`LocalTime`, sprint/worklog `LocalDate`, deadline Instant.
- Doğrulama özeti:
  - [form-error-summary.tsx](../../frontend/src/components/common/form-error-summary.tsx) (`FormErrorSummary`, `focusFormSection`) ve [sticky-form-actions.tsx](../../frontend/src/components/common/sticky-form-actions.tsx).
  - Uygulandığı yerler: [project-create-page.tsx](../../frontend/src/features/projects/components/project-create-page.tsx) ve [organization-form-page.tsx](../../frontend/src/features/organizations/components/organization-form-page.tsx).
  - Inline hatalar korunur. Panel `role="alert"`; başarısız gönderimde odak alır; bölüm bağlantısı ilk geçersiz alana gider.
- Organizasyon kartı:
  - [organization-card.tsx](../../frontend/src/features/organizations/components/organization-card.tsx) artık ortak `EntityCard` kabuğunu kullanıyor.
  - Ortak `EntityCardSkeleton`: [entity-card.tsx](../../frontend/src/components/common/entity-card.tsx).
  - Form önizlemesine website ve konum eklendi.
- Yorum klavyesi:
  - [mention-textarea.tsx](../../frontend/src/features/tasks/components/detail/mention-textarea.tsx), [activity-section.tsx](../../frontend/src/features/tasks/components/detail/activity-section.tsx), [use-touch-primary-input.ts](../../frontend/src/hooks/use-touch-primary-input.ts).
  - Masaüstünde Enter gönderir, Ctrl/Cmd+Enter imlece yeni satır ekler, Shift+Enter yeni satır olarak kalır.
  - IME ve @mention güvenli. Dokunmatikte Enter yeni satırdır.
  - Düzenleme kaydına bekleyen istek koruması eklendi.
- i18n: TR/EN/DE `datePicker.outOfRange`, `timePicker.*`, `forms.summary.*`, `tasks.detail.activity.composer.{hint,hintTouch}`.
- Testler:
  - Yeni: [time-picker.spec.ts](../../frontend/e2e/time-picker.spec.ts), [create-validation-summary.spec.ts](../../frontend/e2e/create-validation-summary.spec.ts), [organization-card-dimensions.spec.ts](../../frontend/e2e/organization-card-dimensions.spec.ts), [task-comment-keyboard.spec.ts](../../frontend/e2e/task-comment-keyboard.spec.ts).
  - `helpers.ts` içine `chooseTime()` eklendi.
  - `task-date-picker` ve `task-planning-assignment` güncellendi.
  - [invitation-notification-context.spec.ts](../../frontend/e2e/invitation-notification-context.spec.ts)'teki mevcut iki spec hatası düzeltildi. Döngü sonrası `NEXT_LOCALE=de` çerezi yüzünden sayfa Almanca açılıyor ve test asılı kalıyordu. Ayrıca `/home` filtresi alıcının kendi projesini yanlış pozitif olarak yakalıyordu; filtre davet edilen projeyle sınırlandı.
- Dokümanlar: [frontend-design-rules.md](../../.agents/frontend-design-rules.md), [folder-structure.md](../../.agents/folder-structure.md), [architecture.md](../../.agents/architecture.md), web checklist kapsamlı notu.

## 3. Doğrulama

- Hedefli Playwright (gerçek backend/PostgreSQL):

  | Spec | Sonuç |
  | --- | --- |
  | `time-picker` | 8/8 |
  | `task-date-picker` | 5/5 |
  | `07-reminders` | 9/9 |
  | `09-tasks` | 10/10 |
  | `task-planning-assignment` | 7/7 |
  | `create-validation-summary` | 9/9 |
  | Organizasyon spec'leri | 29/29 |
  | Phase 1 + org birlikte | 36/36 |
  | `task-comment-keyboard` | 9/9 |
  | `09-tasks` + `my-task-cards` | 18/18 |
  | `task-comment-keyboard` + tüm `team-*` | 19/19 |

- `.\pre-push\pre-push.cmd`: **PDA PRE-PUSH CHECK PASSED**.
  - Backend `mvnw clean verify`: 649 test, 0 failure, 0 error, 0 skip.
  - ESLint, `tsc --noEmit` ve `next build` temiz.
  - Playwright Chromium: 595 geçti + 1 skip (beklenen production crash-route skip'i).
  - Docker build/start/health: geçti.
- Ara koşuda görülen ve giderilen hatalar:
  - `organization-card-dimensions`: spec sayfalama hatası; düzeltildi.
  - `invitation-notification-context`: mevcut spec hatası; düzeltildi.
  - `invitation-pending-contract`: bir önceki hatanın zincirleme sonucu.
  - GitHub 503: dış servis.
  - `team-member-preview` 401: uzun koşuda aralıklı. Aynı sırayla izole tekrar 19/19 geçti.
- Ortam notu: `node_modules` içinde eksik olan `@axe-core/playwright`, `npm ci` ile kuruldu. Lock dosyası değişmedi.

## 4. API

Yeni veya değişen endpoint yok. Backend, şema, ENV, yetki ve bağımlılık değişikliği yok.

## 5. Açık konular

- `team-form-page`, `task-form-page` ve `settings-page` hâlâ kendi sticky footer kopyalarını taşıyor. Kapsam dışı bırakıldı; sonraki tam sayfa formlar `StickyFormActions` kullanacak.
- `06-calendar-page.spec.ts` tek başına koşunca başarısız oluyor (yeni yöneticinin projesi olmuyor). Tam pakette geçiyor; mevcut bir sıra bağımlılığı.
- `team-member-preview` uzun koşuda kayıtlı oturum 401'i gösterdi (aralıklı).
- Kapak görseli olan organizasyon kartı için ayrı ölçüm yapılmadı (aynı banner slotu).
- Sonraki fazlar: `PDA_UI_WORKFLOW_STATE_NOTIFICATION_REFINEMENTS_PLAN.md` Phase 2–6.

## 6. Kullanıcının kontrol adımları

1. Yeni proje sayfasında boş formu gönder. Inline hataları ve alttaki "Proje oluşturulamadı / Eksik bölümler" özetini kontrol et. "Tür" bağlantısına tıklayınca odağın tür seçimine gittiğini doğrula. Aynısını Yeni organizasyon için dene.
2. Takvim'den yeni anımsatıcı oluştur. Tarih ve saat seçicileriyle 09:30 seç, kaydet, düzenlemede aynı değerin geldiğini kontrol et. Geçmiş günlerin seçilemediğini doğrula.
3. Görev formunda (gelişmiş mod) deadline saatini, çalışma kaydı tarihini ve sprint dialogundaki tarihleri dene.
4. Projeler ve Organizasyonlar sayfalarında kartların aynı boyda olduğunu dar ve geniş ekranda kontrol et.
5. Görev detayında yorum yaz. Enter ile gönderildiğini ve Ctrl+Enter'ın yeni satır eklediğini doğrula. Telefonda Enter'ın yeni satır eklediğini kontrol et.
