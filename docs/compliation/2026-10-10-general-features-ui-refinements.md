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
  - Inline hatalar korunur. Panel `role="alert"`; başarısız gönderimde odak sayfa sırasındaki ilk geçersiz alana gider, panel odak çalmaz ve her başarısız gönderimde yeniden mount edilerek (`key={submitCount}`) tekrar duyurulur; bölüm bağlantısı o bölümün ilk geçersiz alanına odaklar.
  - Merge with origin/general-features (Alper'in form standardı): `origin/general-features` başarısız gönderimde ilk hatalı alana odak standardını getirdi (`form-first-error-focus*.spec.ts`). Karar: odak ilk hatalı alanda; özet görünür kalır, `role=alert` ile duyurulur, bağlantıları çalışır ama odağı çalmaz (`focusKey` kaldırıldı). Alper'in `form-first-error-focus.spec.ts` testi seçici migrasyonuna uyarlandı: görev son saat `chooseTime(task-deadline-time)`, çalışma kaydı tarihi silme picker'ın Temizle düğmesiyle; iddialar (odak hedefi, hata metni) aynı kaldı. `create-validation-summary.spec.ts` özet odağı yerine ilk hatalı alan odağını doğrular.
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

- Merge öncesi ağaç (yalnız bu fazın değişiklikleri): `.\pre-push\pre-push.cmd` **PDA PRE-PUSH CHECK PASSED**.
  - Backend `mvnw clean verify`: 649 test, 0 failure, 0 error, 0 skip.
  - ESLint, `tsc --noEmit` ve `next build` temiz.
  - Playwright Chromium: 595 geçti + 1 skip (beklenen production crash-route skip'i).
  - Docker build/start/health: geçti.
- `origin/general-features` (Alper'in 3 commit'i) ile merge edilmiş son ağaç: `.\pre-push\pre-push.cmd` **FAILED — 709/712**.
  - Backend 649/0/0/0, ESLint, `tsc` ve build temiz; Playwright 709 geçti, 1 skip, 2 başarısız.
  - `a11y-public › axe tr dark desktop › /license`: `page.goto` doğrudan `net::ERR_CONNECTION_REFUSED` aldı. Pre-push'un başlattığı `next start` sunucusu bağlantıyı reddetti; sayfa koduna ulaşılmadı.
  - `team-member-preview`: paylaşılan üyenin kayıtlı `notification-setup` oturumu 401 aldı. 4 tam koşunun 3'ünde, merge öncesinde de görüldü. Tek başına ve tüm `team-*` spec'leriyle birlikte her seferinde geçiyor (27/27). Muhtemel mekanizma: `team-deletion-notifications` aynı kayıtlı oturumu iki tarayıcı bağlamında paylaşıyor; uzun koşuda token yenilemesi çakışınca backend refresh-token yeniden kullanımını algılayıp oturumu iptal ediyor.
  - Diff auth, oturum, team ya da public sayfa koduna dokunmuyor. Değişikliklerimiz olmadan aynı tam koşu çalıştırılmadığı için bu kesin kanıt değil.
  - **Kullanıcı kararı (2026-10-10):** bu iki aralıklı hata nedeniyle PASSED şartı bu teslim için bilinçli olarak atlandı; push kullanıcı onayıyla yapıldı.
- Merge sırasında düzeltilen mevcut spec hatası: `destructive-actions` proje silme testi. Yerelleştirilmiş `/duzenle` adresi `/\/edit/` regex'iyle hiç eşleşmediği için bekleme anında geçiyor, geciktirilmiş DELETE ile yarışıyordu. Artık `/projeler`'e yönlendirme ve 404 bekleniyor; dosyanın tamamı geçti.
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
- **Takip (test altyapısı):** `team-member-preview` uzun koşularda kayıtlı oturum 401'i veriyor (4 tam koşunun 3'ünde). `team-deletion-notifications`'ın oturumu iki bağlamda paylaşması düzeltilmeli. Ayrıca pre-push'un `next start` sunucusu ara sıra `ERR_CONNECTION_REFUSED` veriyor. İkisi çözülene kadar tam pre-push aralıklı FAILED verebilir.
- **Ortam tuzağı:** pre-push'un son adımı backend'i `docker-compose.e2e.yml` olmadan yeniden başlatıyor. Sonraki E2E koşusundan önce `docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d` gerekli; yoksa admin, analytics ve iletişim testleri toplu düşer.
- Kapak görseli olan organizasyon kartı için ayrı ölçüm yapılmadı (aynı banner slotu).
- Sonraki fazlar: `PDA_UI_WORKFLOW_STATE_NOTIFICATION_REFINEMENTS_PLAN.md` Phase 2–6.

## 6. Kullanıcının kontrol adımları

1. Yeni proje sayfasında boş formu gönder. Inline hataları ve alttaki "Proje oluşturulamadı / Eksik bölümler" özetini kontrol et. "Tür" bağlantısına tıklayınca odağın tür seçimine gittiğini doğrula. Aynısını Yeni organizasyon için dene.
2. Takvim'den yeni anımsatıcı oluştur. Tarih ve saat seçicileriyle 09:30 seç, kaydet, düzenlemede aynı değerin geldiğini kontrol et. Geçmiş günlerin seçilemediğini doğrula.
3. Görev formunda (gelişmiş mod) deadline saatini, çalışma kaydı tarihini ve sprint dialogundaki tarihleri dene.
4. Projeler ve Organizasyonlar sayfalarında kartların aynı boyda olduğunu dar ve geniş ekranda kontrol et.
5. Görev detayında yorum yaz. Enter ile gönderildiğini ve Ctrl+Enter'ın yeni satır eklediğini doğrula. Telefonda Enter'ın yeni satır eklediğini kontrol et.
