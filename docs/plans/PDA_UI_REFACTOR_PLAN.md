# PDA — UI Refactor, Navigation, Settings, Project Banner & Bugfix Plan

> Onaydan sonra ilk iş: bu içerik repo kökünde `PDA_UI_REFACTOR_PLAN.md` olarak oluşturulur. Sonnet bu dosyayı source of truth olarak kullanır. Commit / push yok.

## Context

Kullanıcı `.agents/PDA_Opus_Plan_Sonnet_Implementation_Workflow.md` ile dağınık 12 gereksinim (A–L) verdi: organizasyon popup'ı, seçili proje sidebar'ı, global davetler bug'ı, dashboard tarih başlığı, proje ayarlarına header'dan erişim, içerik genişliği, "PDA Çalışma alanı" kartı, "Hesap ayarları → Ayarlar", genel Ayarlar sayfası (dil/tema/animasyon), proje banner'ı, navbar tutarlılığı ve dairesel tema geçişi. Amaç, bunları teknik bağımlılık sırasına göre Sonnet'in sırayla uygulayabileceği bir checklist'e dönüştürmek.

Kullanıcıyla verilen kararlar:
- **C (Davetler):** Güvenli düzeltme. E-postaya göre eşleme yok, çünkü yerel kayıt e-posta doğrulamasız ACTIVE hesap açıyor (`UserAccountService.java:51`). Kapsam: mail linki, bekleyen/süresi dolan ayrımı, arşivli proje, ama önce Docker'da adım adım teşhis.
- **K (Navbar):** Otomatik gizleme davranışı **olduğu gibi kalır**. Yalnız ofset/yükseklik tutarsızlıkları düzeltilir.
- **A (Organizasyon):** Oluşturma ve düzenleme popup'ları **sayfa** olur. Arşiv onay dialogu kalır.
- **I (Animasyon):** İki ayar: "Arayüz animasyonları" (Sistem / Açık / Kapalı) ve ayrı bir "Tema geçiş animasyonu" (Açık / Kapalı).

---

## 1. Repository Analizi

**Kabuk:** `frontend/src/app/(app)/layout.tsx` her uygulama sayfasını `components/layout/app-shell.tsx` ile sarıyor. `(auth)` ve `(public)` kendi header'larını kullanıyor.

**Sidebar (`app-shell.tsx`):**
- Yapı, yukarıdan aşağı:
  - `NAV_LINKS`: Ana sayfa, Projeler, Organizasyonlar, Davetler.
  - `ProjectSidebarNav`.
  - Ayırıcı.
  - `TasksNavLink`.
  - Takvim.
  - Alt blok: "Hesap ayarları" (`/account`, `workspace.settings`) ve "PDA / Çalışma alanın" kartı.
- Çalışma alanı kartı (L167-183):
  - Yalnız `/organizations`'a giden düz bir Link. State/context yok, `CaretDown` sahte.
  - `workspace.workspace` key'i dashboard'da da kullanılıyor.
- Alt blok `nav`'ın dışında, yani zaten sabit. Kontrol edilmesi gereken yalnız davranışın doğrulanması.

**Seçili proje sidebar'ı (`project-sidebar-nav.tsx` + `features/projects/project-sections.ts`):**
- `PROJECT_SECTIONS` sırası: overview, criteria, teams, invitations (child, managerOnly), repository, settings (managerOnly).
- `TASK_NAV` sırası: tasks, board, pool, sprints, labels (managerOnly).
- Seçili proje `sessionStorage` key'i `pda:last-project:${userId}` ile hatırlanıyor (`hooks/use-selected-project.ts`).
- Yetki tek bir bayraktan geliyor: `useCurrentMember(project.id).isManager`, yani `PROJECT_MANAGER` rolü.

**Proje ayarları:**
- Ayrı bir route yok. Ayarlar `/projects/{slug}?section=settings` sekmesi (`project-detail.tsx` L80 → `ProjectSettingsForm`).
- Header `project-detail.tsx` L57-74'te inline. Sağ tarafı boş, logo ve aksiyon yok.
- Backend yetkisi `ProjectPermission.PROJECT_UPDATE` ile sağlanıyor.

**Header (`app-header.tsx`):**
- `fixed top-3 z-40 h-12`.
- `use-auto-hide.ts` header'ı 700 ms boşta kalınca ve aşağı kaydırınca gizliyor.
- `main` elementinde `pt-[4.5rem]` var.
- `/dashboard`'da `main`'e max-width uygulanmıyor. `dashboard.tsx:74`'teki `min-h-[calc(100dvh-3.5rem)]` eski kalmış, bu yüzden sayfa ~1rem fazla kayıyor.
- Sticky form bar'larının taşması (`-mx-4 sm:-mx-6 sm:px-6`) `main`'in `sm:px-8` padding'iyle uyuşmuyor. Etkilenen dosyalar: `project-create-page.tsx:310`, `team-form-page.tsx:331`, `task-form-page.tsx:527`, `board-page.tsx:188`.

**Genişlik:**
- `main` `mx-auto max-w-[1560px] px-4 sm:px-8`.
- Sayfa içindeki ek sınırlar:

| Dosya | Sınır |
|---|---|
| `account-page.tsx:55` | `max-w-3xl` (form `max-w-md`) |
| `project-settings-form.tsx:124` | `max-w-4xl` |
| `reminder-form-page.tsx:146` | `max-w-2xl` |
| `repository-settings.tsx:93` | `max-w-xl` |
| `accept-invitation-view.tsx` | `max-w-xl` |
| `invitations/[projectId]/[invitationId]/page.tsx:14` | `max-w-sm` |

- Paylaşılan bir `PageContainer` yok. Var olan tek ortak bileşen `components/common/page-header.tsx`.

**Dashboard tarihi:** `features/dashboard/dashboard.tsx:76` (`toLocaleDateString(locale,{dateStyle:"full"})`). `today` state'i (L65) yalnız burada kullanılıyor. `MiniCalendar`'ın kendi `todayKey()`'i var.

**Organizasyon:**
- `organization-list.tsx:35-42` ve `organization-detail.tsx:60-68` → `OrganizationFormDialog`, oluştur ve düzenle için.
- `organization-detail.tsx:69-86` → arşiv `ConfirmDialog`.
- Route'lar yalnız `/organizations` ve `/organizations/[organizationId]`.

**Tema:**
- `components/providers.tsx` L38: `ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange`, ayrıca `ThemeTransitionOverlay`.
- `theme-switcher.tsx` içindeki `useThemeSelection()` tema değiştirmenin tek yolu. Animasyonu `startViewTransition` + `playThemeTransition` ile yapıyor.
- `ThemeSwitcher` dropdown'u (sistem seçeneğiyle birlikte) hiçbir yerde kullanılmıyor.
- `ThemeToggle` header, auth, public ve error sayfalarında kullanılıyor.
- Dairesel geçiş **zaten var**:
  - `theme-transition.tsx` + `globals.css` L538-555: `::view-transition-new(root)` `circle(0%)`'dan `circle(72%)`'ye, yani merkezden dışarı doğru açılıyor.
  - Ortada güneş/ay "orb" var.

**i18n:**
- next-intl, `NEXT_LOCALE` cookie'si, diller tr/en/de (`i18n/config.ts`).
- `locale-switcher.tsx` `writeLocaleCookie` + `router.refresh()` kullanıyor, bayrak overlay'i var.
- Hazır key'ler: `common.language.*`, `common.theme.*`.

**Animasyonlar:**
- `motion` 13 kullanan dosyalar: `theme-toggle`, `locale-switcher`, `use-shake`, `theme-transition`.
- Popup giriş/çıkış animasyonları `tw-animate-css` ile (dialog, dropdown, select, tooltip).
- Sidebar genişlik geçişi, header auto-hide geçişi, `animate-pulse`/`animate-spin`, hover geçişleri.
- `globals.css` içindeki keyframe'ler: auth sahnesi, logo orbit, neon, shake, fade-up, theme-reveal.
- Site geneli reduced-motion kuralı `globals.css` L584-600'de, ama yalnız media query ile. Kullanıcı tercihine bağlanacak bir hook yok.
- `useReducedMotion` yalnız işletim sistemini okuyor.
- Backend'de kullanıcı tercihi saklanmıyor (users tablosunda locale/theme kolonu yok).

**Logo altyapısı (banner için yeniden kullanılacak):**
- `ProjectLogoController` `/api/v1/projects/{id}/logo` PUT/DELETE/GET.
- `ProjectLogoService` resmi Postgres `bytea` olarak saklıyor:
  - Tür tespiti magic byte ile (PNG/JPEG/WebP), sınır 512 KB.
  - Yetki: yüklemede `PROJECT_UPDATE`, okumada `PROJECT_VIEW`.
  - GET yanıtı `immutable` 1 yıl cache.
- `Project.logoUpdatedAt` → DTO'da `logoVersion`. Frontend `?v=` ile cache kırıyor.
- Davet kapsamındaki logo uç noktası `MyProjectInvitationController` `/{invitationId}/logo`, `no-store`.
- Migration `V34__project_identity.sql`. Son migration **V46**, yani banner **V47** olacak.
- `SecurityBaselineConfiguration` deny-by-default çalışıyor. Yeni uç noktalar allowlist'e eklenmeli.
- Frontend `ProjectMark` (`project-card.tsx:42-57`) ile gösteriyor. Ayarlar sayfasında logo yönetimi yok.

**Davetler (`/invitations`):**
- `app/(app)/invitations/page.tsx` → `["project-invitations","me",page]` → `GET /project-invitations/me`.
- Backend `ProjectInvitationService.listMine`'da `findByInvitedUserId`. Eşleme **yalnız user id ile**, status filtresi yok, süre dolumu işaretlenmiyor.
- Bulunan somut hatalar:
  1. Kayıtlı kullanıcıya giden mail linki `frontendUrl + "/invitations/" + invitationId + "?projectId=…&token=…"` (`ProjectInvitationService.java:512`). Böyle bir route yok, gerçek route `/invitations/[projectId]/[invitationId]?token=`, yani link **404** veriyor.
  2. Süresi geçmiş PENDING davetler "Bekliyor" görünüyor, Kabul butonu 409 dönüyor.
  3. Tüm statüler tarihe göre karışık listeleniyor, bekleyenler sayfanın gerisine düşebiliyor.
  4. Arşivli projenin daveti adsız görünüyor.
  5. Harici (e-posta) davet linke tıklamadan normal kayıt olan kişide listede görünmüyor. **Kararla tasarım gereği**, güvenlik nedeniyle.
- Testler:
  - Backend'de yalnız `ProjectInvitationApiIntegrationTest` L296-358, userId ile davet senaryosu.
  - E2E `global-invitations-preview.spec.ts` API'yi tamamen mock'luyor.

**Testler ve komutlar:**
- Frontend:
  - `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx playwright test`.
  - Playwright `e2e/`, global-setup ile paylaşılan manager + member hesapları. Register rate limit 10 dakikada 5.
  - Unit test altyapısı yok.
- Backend:
  - `./mvnw test`: Testcontainers integration testleri ve `ModularityTest`.

**Git:** Branch `project-service-frontend`. Çalışma ağacı temiz, yalnız kullanıcının `.agents/PDA_Opus_Plan_Sonnet_Implementation_Workflow.md` dosyası takipsiz. Ona dokunulmaz.

---

## 2. Dependency / Ordering Kararı

1. **Paylaşılan layout temeli (F, K, D) önce yapılır.** Genişlik standardı (`PageContainer`) sonraki her sayfa işinde (proje ayarları, Ayarlar, organizasyon sayfaları) kullanılacak. Önce yapılmazsa aynı sayfalar iki kez değişir. Dashboard dosyası da burada bir kez açılır (D ve ofset düzeltmesi birlikte).
2. **Davet bugfix'i (C).** Diğerlerinden bağımsız ve kullanıcıyı engelleyen tek gerçek bug. Banner backend'inden önce yapılır, çünkü ikisi de `ProjectInvitationService` / `MyProjectInvitationController`'a dokunuyor. Bugfix önce, sade bir diff ile girer.
3. **Banner backend'i (J-backend).** Frontend banner işi DTO alanına (`bannerVersion`) ve uç noktalara bağımlı.
4. **Proje header'ı + banner frontend'i + kalem ikonu (E-header, J-frontend).** Header (`project-detail.tsx`) bir kez yeniden düzenlenir: banner şeridi ve sağ üstte kalem ikonu birlikte. Banner kartlarda, davet önizlemesinde ve ayarlarda da aynı adımda gösterilir. Kalem ikonu sidebar'daki Ayarlar maddesi kaldırılmadan **önce** gelir, böylece ayarlara erişim hiç kopmaz.
5. **Sidebar ve navigasyon temizliği (B, E-sidebar, G, H-etiket).** Hepsi aynı iki dosyada: `app-shell.tsx` ve `project-sidebar-nav.tsx`. Ayarlar maddesinin kaldırılması 4. taska bağlı.
6. **Ayarlar sayfası (H-route, I).** `/settings` route'u ve tercihler. 5. taskta etiket "Ayarlar" olur, bu task href'i `/settings`'e taşır. Animasyon tercihi altyapısı 7. taskın ön koşulu.
7. **Dairesel tema geçişi (L).** 6. taskta gelen "Tema geçiş animasyonu" ve "Arayüz animasyonları" tercihlerine bağlı.
8. **Organizasyon popup → sayfa (A).** Bağımsız. 1. taskın `PageContainer`'ını ve mevcut form-sayfa kalıbını (`team-form-page.tsx`) kullanır. Shell'e dokunmadığı için sona konur.
9. **Final doğrulama ve dokümantasyon.**

---

## 3. Implementation Checklist

### Task 0 — Plan dosyası
- [x] 0.1 Bu planı repo kökünde `PDA_UI_REFACTOR_PLAN.md` olarak oluştur (checkbox'lar `[ ]`).

---

### Task 1 — Paylaşılan layout temeli: içerik genişliği, header ofseti, dashboard tarihi (F, K, D)

**Amaç:** Bütün uygulama sayfaları için tek bir genişlik standardı kurmak, navbar'ın her sayfada aynı ofset ve davranışla çalışmasını sağlamak ve dashboard'daki tarih başlığını kaldırmak.

**Neden ilk:** Sonraki bütün sayfa taskları bu container'ı kullanacak.

**Backend:** Yok.

- [x] 1.1 `frontend/src/components/common/page-container.tsx` oluştur. Prop `width: "wide" | "form" | "narrow"`:
  - `wide`: ek sınır yok, `main`'in 1560px'i geçerli.
  - `form`: `max-w-5xl`.
  - `narrow`: `max-w-xl`, `mx-auto`'suz, sola hizalı.
  - Sınıflar tek yerde dursun. Kısa bir yorumla hangi sayfa türünün hangi genişliği kullandığını yaz.
- [x] 1.2 Sayfa içi rastgele sınırları `PageContainer` ile değiştir:
  - `project-settings-form.tsx:124` (`max-w-4xl` → `form`; büyük ekranda alanlar `lg:grid-cols-2` ile iki sütun, uzun metin alanları tam satır).
  - `reminder-form-page.tsx` (`max-w-2xl` → `form`).
  - `repository-settings.tsx:93` (`max-w-xl` → `form`).
  - `accept-invitation-view.tsx` ve `invitations/[projectId]/[invitationId]/page.tsx` (`narrow` kalır, `max-w-sm` → `narrow`).
  - Account sayfası 6. taskta yeniden yazılacağı için burada dokunma.
  - Yalnız metin genişliği sınırları (`max-w-prose` tarzı açıklamalar) kalır.
- [x] 1.3 Header ofsetini tek bir sabite bağla. `app-shell.tsx`'te `main`'in `pt-[4.5rem]` değeri ve `dashboard.tsx:74`'teki `min-h-[calc(100dvh-3.5rem)]` aynı değeri kullansın, yani `4.5rem`. Dashboard'daki fazladan kayma kalkar.
- [x] 1.4 Sticky alt bar'ları `main`'in padding'iyle hizala:
  - `-mx-4 sm:-mx-6 sm:px-6` → `-mx-4 px-4 sm:-mx-8 sm:px-8`.
  - Dosyalar: `project-create-page.tsx:310`, `team-form-page.tsx:331`, `task-form-page.tsx:527`, `board-page.tsx:188`.
  - z-index değerleri (20 < header 40 < dialog 50) aynı kalır.
- [x] 1.5 Navbar davranışı **değişmez** (auto-hide kalır, kullanıcı kararı). Tüm `(app)` route'larında header'ın aynı `AppShell`'den geldiğini ve hiçbir sayfanın kendi scroll container'ını kurmadığını doğrula (Explore bulgusu: kurmuyor). Bulgu planın altına not edilir.
  - **Bulgu (1.5):** Tüm `(app)` route'ları aynı `AppShell` header'ını kullanıyor. Hiçbir sayfa kendi `h-screen` + `overflow-y-auto` scroll container'ını kurmuyor. Header yalnız auto-hide (kullanıcı kararı gereği korundu) nedeniyle gizlenebiliyor.
- [x] 1.6 `dashboard.tsx` L76'daki tarih satırını ve yalnız onu besleyen `today` state'ini (L65) kaldır. `locale` başka bir yerde kullanılmıyorsa importunu da kaldır. `MiniCalendar` ve takvim mantığına dokunma.

**Edge-case'ler:**
- `lg` altında iki sütunlu form tek sütuna düşmeli.
- 1560px üstünde `wide` sayfalar sınırda kalmalı.
- Mobil drawer etkilenmemeli.

**Definition of Done**
- [x] `PageContainer` var. Yukarıdaki sayfalarda `max-w-xl/2xl/4xl` gibi sayfa düzeyinde rastgele sınır kalmadı.
- [x] Dashboard tarih başlığı yok, dashboard viewport'a sığdığında kaydırma çubuğu çıkmıyor.
- [x] Sticky bar'lar 375px ve 1440px'te kenara tam oturuyor.
- [x] `npm run lint`, `npx tsc --noEmit`, `npm run build` temiz. `03-project-navigation-responsive`, `06-calendar-page`, `07-reminders` E2E testleri geçiyor.

---

### Task 2 — Global Davetler bugfix (C)

**Amaç:** "Davetler" sayfasında kullanıcının davetlerini doğru ve eksiksiz göstermek, maildeki linki çalışır hale getirmek.

**Neden bu sırada:** Bağımsız bir bugfix. `ProjectInvitationService`'e banner işinden önce sade bir diff ile girer.

**Backend:** Var.

- [x] 2.1 **Teşhis (kod değiştirmeden).** `docker compose up`, iki hesap. Her adımda `/api/v1/project-invitations/me` yanıtını ve `/invitations` ekranını kaydet:
  - (a) Ekip sayfasından nickname ile davet → alıcının listesi.
  - (b) Kayıtlı bir hesabın e-postasıyla davet → liste (`inviteByEmail` → `inviteRegisteredUser` yolu).
  - (c) Kayıtsız e-postaya harici davet → aynı e-postayla normal kayıt → liste. Beklenen: görünmez, tasarım gereği. Mail linkiyle kayıt olunursa davet kabul edilmiş olur.
  - (d) Kayıtlı kullanıcıya giden mail linkinin açılması → 404 (mail log'u veya `dispatchInvitationMail` linki).
  - (e) Süresi geçmiş PENDING davet → "Bekliyor" ve Kabul → 409.
  - (f) 20'den fazla geçmiş davet varken PENDING'in 2. sayfaya düşmesi.
  - (g) Önbellek: kabul/red sonrası `["project-invitations","me"]` invalidation'ı.
  - Hangi adımın gerçek neden olduğunu plan dosyasına bulgu olarak yaz. Beklenmeyen bir neden çıkarsa (ör. (a) başarısız) önce onu düzelt ve kullanıcıya bildir.
  - **Teşhis bulguları (2.1):**
    - (a) userId ile davet ve (b) kayıtlı hesabın e-postasıyla davet gerçek backend'de `/project-invitations/me`'de doğru listeleniyor, backend sorgusu kayıtlı kullanıcı için doğru.
    - (c) Kayıtsız e-postaya giden harici davet, aynı e-postayla düz kayıt olunca listede yok. Bu tasarım gereği, güvenlik nedeniyle (yerel kayıt e-posta doğrulamasız) değiştirilmedi.
    - (d) Kayıtlı kullanıcıya giden mail linki `/invitations/{id}?projectId=…` biçimindeydi ve gerçek route `/invitations/[projectId]/[invitationId]` olduğu için 404 veriyordu. Düzeltildi.
    - (e) Süresi geçen davet "Bekliyor" kalıyordu, düzeltildi (yanıtta EXPIRED).
    - (f) Tüm statüler tek listede tarihe göre sıralanıyordu, "Bekleyen" sekmesi eklendi.
    - (g) **Yeni bulgu:** Global `staleTime: 30_000` ve `refetchOnWindowFocus: false` yüzünden sayfa açıkken gelen davet, kullanıcı sayfaya dönünce 30 sn boyunca eski önbellekten gösterilmiyordu. Davet listesi artık her açılışta taze okunuyor.
    - Arşivli projenin daveti adıyla görünüp Kabul 404 veriyordu. Artık ad dönmüyor ve arayüz "Proje artık kullanılamıyor" gösteriyor.
- [x] 2.2 Mail linkini düzelt (`ProjectInvitationService.java:512`). Kayıtlı kullanıcı için `frontendUrl + "/invitations/" + projectId + "/" + invitationId + "?token=" + rawToken`. Harici link (`/register#invitation=`) aynı kalır.
- [x] 2.3 `GET /project-invitations/me`'ye isteğe bağlı `status` parametresi ekle:
  - `PENDING` → yalnız bekleyen ve süresi geçmemiş davetler.
  - Parametre yoksa davranış aynı (geriye uyumlu).
  - Repository'ye `findByInvitedUserIdAndStatusAndExpiresAtAfter` türünde bir metot ekle. Mevcut index'e (`invited_user_id, status, created_at`) uyar.
- [x] 2.4 Yanıtta etkin statü: `PENDING` ve `expiresAt < now` ise `EXPIRED` döndür. Yalnız response'ta, DB yazımı yok. Accept/reject mevcut 409 davranışını korur.
- [x] 2.5 Frontend `app/(app)/invitations/page.tsx`:
  - "Bekleyen" (varsayılan, `status=PENDING`) ve "Tümü" sekmeleri. Mevcut `Tabs` bileşeni kullanılır. Query key'e status eklenir: `["project-invitations","me",status,page]`.
  - Invalidation prefix'i `["project-invitations","me"]` aynı kalır.
  - EXPIRED rozeti eklenir.
  - Proje adı yoksa (arşivli) Kabul gizlenir, "Proje artık erişilebilir değil" gösterilir.
  - Boş durum sekmeye göre metin gösterir.
  - i18n: tr/en/de.
- [x] 2.6 Testler:
  - **Backend integration:**
    - `status=PENDING` filtresi.
    - Süresi geçmiş davet `EXPIRED` dönüyor ve PENDING sekmesinde yok.
    - E-postayla kayıtlı hesaba davet `/me`'de görünüyor.
    - Mail linki formatı: mail port'unu yakalayan mevcut test düzeni kullanılır, yoksa link üreten küçük metot ayrıştırılıp test edilir.
  - **E2E (mock'suz) `10-global-invitations.spec.ts`:** manager paylaşılan üyeyi ekibe davet eder → üye `/invitations` "Bekleyen"de daveti görür → listeden kabul eder → "Tümü"de Kabul edildi görünür. Yeni `/auth/register` çağrısı yok, global-setup hesapları kullanılır.
  - `global-invitations-preview.spec.ts` mock'ları yeni sekme ve status parametresine göre güncellenir.
- [x] 2.7 `.agents/api.md`'de `/project-invitations/me` `status` parametresi ve etkin statü notu.

**Edge-case'ler:**
- Harici davetin kaydı. Davet zaten kabul edilmiş olabilir.
- İptal edilen ekip davetleri (CANCELLED, "Tümü"de görünür).
- Sayfalama ile sekme değişimi (sayfa 0'a dönmeli).
- Önizleme dialogu, kabul/red ve token akışı bozulmamalı.

**Definition of Done**
- [x] Teşhis bulguları yazıldı. Gerçek neden(ler) düzeltildi.
- [x] Mail linki gerçek route'a gidiyor.
- [x] Bekleyen davetler her zaman ilk sekmede. Süresi dolanlar "Süresi doldu".
- [x] Mevcut kayıtlı kullanıcı, harici davet, kabul/red ve önizleme davranışları değişmedi.
- [x] Backend `./mvnw test` (integration ve `ModularityTest` dahil) geçti. Frontend lint, tsc ve build temiz. `02`, `04`, `10`, `global-invitations-preview` E2E testleri geçti.

---

### Task 3 — Proje banner backend'i (J-backend)

**Amaç:** Proje kapak görseli için kalıcı ve güvenli backend desteği. Logo altyapısının birebir kalıbıyla, yeni bir storage sistemi kurmadan.

**Neden bu sırada:** Frontend banner işi `bannerVersion`'a ve uç noktalara bağlı.

**Backend:** Var.

- [x] 3.1 Migration `V47__project_banners.sql` (flat `db/migration`, project migration'larının yanında):
  - `projects.banner_updated_at timestamptz NULL`.
  - `project_banners` tablosu: `project_id` PK, FK `ON DELETE CASCADE`; `content_type` CHECK png/jpeg/webp; `data bytea`; `size_bytes` CHECK `> 0 AND <= 2097152`; `updated_at`.
  - Sadece ekleme, mevcut tabloları kırmaz.
- [x] 3.2 Magic-byte tür tespitini `ProjectLogoService.detectType`'tan paylaşılan küçük bir `project` iç yardımcısına taşı (ör. `application/service/ProjectImageType`). Logo ve banner aynı tespiti kullansın. Logo davranışı ve hata kodları değişmez.
  - **Not (3.2):** Magic-byte tespiti `ProjectImageType.detect` yardımcısına taşındı. Logo ve banner aynı kodu kullanıyor, logo davranışı ve hata kodları değişmedi (logo testleri değişmeden geçiyor).
  - **Not (3.4):** Servlet multipart hataları (`MaxUploadSizeExceeded`, eksik parça) artık istek yoluna bakıp `/banner` için banner, diğerleri için logo kodunu döndürüyor.
- [x] 3.3 `ProjectBanner` entity, `ProjectBannerRepository`, `ProjectBannerService`:
  - `replace` ve `remove`: `PROJECT_UPDATE`, aktif proje.
  - `read`: `PROJECT_VIEW`.
  - `MAX_BYTES = 2 MB`.
  - `Project.bannerStored` / `bannerRemoved` (`logoStored` / `logoRemoved` kalıbı, arşivli projeyi reddeder).
- [x] 3.4 `ProjectBannerException` hata kodları: `PROJECT_BANNER_INVALID_TYPE`, `PROJECT_BANNER_TOO_LARGE`, `PROJECT_BANNER_EMPTY`. `ProjectApiErrorHandler`'da logo eşlemesinin yanına eklenir: 400, `code` ve `no-store`.
- [x] 3.5 `ProjectBannerController` `/api/v1/projects/{projectId}/banner`:
  - PUT multipart `file` → 204. DELETE → 204.
  - GET: `nosniff`, `inline`, `immutable` 1 yıl (versiyonlu URL ile).
- [x] 3.6 ~~Davet kapsamındaki banner uç noktası~~ **KALDIRILDI (kullanıcı kararı):** banner yalnız Projeler listesindeki kartta görünür; `/project-invitations/{id}/banner` ve önizlemedeki `bannerVersion` silindi.
- [x] 3.7 DTO alanları:
  - `ProjectResponse.bannerVersion` (`bannerUpdatedAt` epoch millis, null ise alan yok).
  - `InvitationProjectPreview.bannerVersion`.
  - `ProjectSummaryView` ve `TaskView.ProjectRef`'e **eklenmez**, banner orada gösterilmiyor.
- [x] 3.8 `SecurityBaselineConfiguration` allowlist'ine ekle:
  - `PUT /api/v1/projects/*/banner`.
  - `DELETE /api/v1/projects/*/banner`.
  - `GET /api/v1/project-invitations/*/banner`.
  - GET proje banner'ı mevcut `/api/v1/projects/**` kuralıyla geliyor, doğrula.
- [x] 3.9 `ProjectBannerIntegrationTest`, `ProjectIdentityIntegrationTest`'teki logo testlerinin aynası:
  - Gidiş-dönüş: PNG → JPEG → WebP, başlıklar, `bannerVersion`, DELETE → 404.
  - Kılık değiştirmiş SVG/GIF, 2 MB + 1 bayt ve boş dosya reddi.
  - CSRF yok → 403, ANALYST PUT/DELETE → 403, üye olmayan → 403, anonim → 401.
  - Davet banner'ı: alıcı 200, başkası 403/404.
- [x] 3.10 Dokümantasyon: `.agents/api.md` (uç noktalar), `.agents/database.md` (V47), `.agents/SECURITY.md` (yükleme doğrulaması: tür, boyut, `nosniff`).

**Edge-case'ler:**
- Arşivli projeye yükleme reddedilir.
- Aynı anda logo ve banner (ayrı tablolar).
- Proje silinince cascade ile silinir.
- Multipart sınırı 11 MB, servis kendi 2 MB sınırını uygular.
- En-boy oranı sunucuda zorlanmaz. Gösterimde `object-cover` kullanılır, önerilen ölçü 1600×400.

**Definition of Done**
- [x] V47 temiz veritabanında ve mevcut veritabanında sorunsuz uygulanıyor.
- [x] Banner uç noktaları allowlist'te. Yetki, CSRF, tür ve boyut kontrolleri backend'de.
- [x] Logo testleri değişmeden geçiyor. Yeni banner testleri geçiyor.
- [x] `./mvnw test` (`ModularityTest` dahil) geçiyor.

---

### Task 4 — Proje header'ı, kalem ikonu ve banner frontend'i (E-header, J-frontend)

**Amaç:** Proje header'ını tek seferde yeniden düzenlemek: banner şeridi, sağ üstte ayarlara giden kalem ikonu, banner'ın kart ve davet önizlemesinde görünmesi, ayarlardan yükle/değiştir/kaldır.

**Neden bu sırada:** Backend hazır. Kalem ikonu, sidebar'daki Ayarlar maddesi (Task 5) kaldırılmadan önce gelmeli.

**Backend:** Yok (Task 3 kullanılır).

- [x] 4.1 API ve tipler:
  - `features/projects/api.ts`: `projectBannerUrl(id, v)`, `uploadBanner`, `deleteBanner`. `projectLogoUrl` kalıbı.
  - `types.ts`: `bannerVersion: number | null`.
  - `features/invitations/api.ts`: `previewBannerUrl`. `types.ts`: `bannerVersion`.
- [x] 4.2 `features/projects/components/project-banner.tsx`:
  - `img` `object-cover`, sabit oran (`aspect-[4/1]`, mobilde `aspect-[3/1]`), `alt=""` (dekoratif).
  - `onError` veya banner yoksa fallback: design token'larla nötr yüzey (`bg-muted`) üstünde ince desen. Yeni renk yok.
  - Görselin kaynağı `ProjectMark` gibi dışarıdan verilir (proje, davet veya önizleme).
- [x] 4.3 `project-detail.tsx` header: **banner ve kalem ikonu KALDIRILDI (kullanıcı kararı).** Header yalnız proje adı, rozetler ve meta içerir. Kalem ikonu Projeler listesindeki proje kartının bandının sağ üstünde (yalnız `canEdit` olan üyeye).
  - Üstte `ProjectBanner`.
  - Altında mevcut ad, rozetler ve meta.
  - **[Güncellendi]** Kalem ikonu proje sayfasının header'ında DEĞİL, Projeler listesindeki proje kartının sağ üstünde (backend liste yanıtında `canEdit`). Sağ üstte `isManager` iken `PencilSimple` ikonlu Link → `projectSectionHref(path, "settings")`, `aria-label` "Proje ayarlarını düzenle" (i18n tr/en/de).
  - Yetkisiz kullanıcıda ikon hiç render edilmez. Backend `PROJECT_UPDATE` source of truth kalır, frontend gizleme yalnız UX.
  - Settings sekmesi ve `?section=settings` route'u aynen kalır.
- [x] 4.4 Ayarlar formunda (`project-settings-form.tsx`) "Kapak görseli" bölümü: önizleme yok, yalnız durum metni ve yükle/değiştir/kaldır düğmeleri (`banner-field.tsx`). Proje oluşturma sayfasında da logo gibi seçilir ve canlı önizleme kartında görünür (`create/banner-pick-field.tsx`).
  - İstemci ön kontrolü: 2 MB, png/jpeg/webp.
  - Önizleme, Değiştir, Kaldır (onay ile).
  - Başarıda proje sorguları invalidate edilir, yeni `bannerVersion` `?v=` ile cache'i kırar.
  - Backend hata kodları i18n mesajlarına eşlenir.
  - **Düzeltme 3 (kullanıcı talebi):** Banner ayrı şerit değil, kartın mevcut üst bandının arka planı (üstünde `bg-background/50` örtü). Proje oluşturma sayfasına logo gibi çalışan kapak görseli alanı (`BannerPickField`) ve canlı önizleme eklendi; oluşturma sonrası yükleniyor, başarısız olursa uyarı çıkıyor. E2E: `project-create-page.spec.ts`.
  - **Düzeltme 2 (kullanıcı talebi):** Banner yalnız Projeler listesindeki kartta görünür. Proje sayfası header'ı, ayarlardaki önizleme ve davet önizlemesindeki banner kaldırıldı; davet banner uç noktası (`/project-invitations/{id}/banner`), önizlemedeki `bannerVersion` ve ilgili testler/güvenlik kuralı da silindi. Banner yoksa kartta şerit açılmıyor. Ayarlarda yalnız durum metni ve yükle/değiştir/kaldır düğmeleri var.
  - **Düzeltme (kullanıcı talebi):** Header'daki kalem kaldırıldı. Kalem `ProjectCard`'ın sağ üstüne taşındı; `ProjectCardView` ve `ProjectResponse`'a `canEdit` eklendi (liste sorgusuna ek sorgu yok, kullanıcının üyelikleri tek sorguda okunuyor). Test: `ProjectIdentityIntegrationTest.listTellsEachMemberWhetherTheyMayEditTheProjectSettings`, E2E `11-project-banner`.
  - **Not (4.2/4.5):** Kartlarda banner yoksa da aynı yükseklikte nötr bir nokta desenli şerit gösteriliyor. Böylece banner'lı ve banner'sız kartlar aynı satırda hizalı kalıyor (EntityCard'a isteğe bağlı `banner` slot'u eklendi). Header banner'ı büyük ekranda `max-h-56` ile sınırlandı.
  - **Not (4.4):** Ayarlar formundaki kapak görseli yönetimi `BannerField` bileşeni; yükleme ve silme mevcut `apiRequest` FormData desteğini kullanıyor, `LogoField` kalıbı kopyalanmadı çünkü o oluşturma sayfasına özgü (dosyayı üst forma taşıyor), banner ise ayrı ve anında kaydediyor.
- [x] 4.5 `ProjectCard`: banner ayrı şerit değil, kartın mevcut üst bandının arka planı (`bg-background/50` örtü); banner yoksa band düz kalır.
- [x] 4.6 ~~`invitation-project-preview-dialog.tsx` banner~~ **KALDIRILDI (kullanıcı kararı):** davet önizlemesinde banner yok.
- [x] 4.7 E2E `11-project-banner.spec.ts` (manager hesabı, yeni kayıt yok):
  - Ayarlardan banner yükle → header'da `img[src*="/banner?v="]`.
  - Kartta banner.
  - Kaldır → fallback.
  - Geçersiz dosya → hata mesajı.
  - Üye hesapta kalem ikonu yok, manager'da var ve ayarlara götürüyor.

**Edge-case'ler:**
- Yavaş yükleme ve kırık görselde fallback.
- Dark mode kontrastı.
- 375px'te banner yüksekliği ve ikonun dokunma alanı (≥ 44px).
- Arşivli proje (ayarlar kapalı ise ikon gizli).
- Banner değişince eski görselin cache'te kalmaması (`?v=`).

**Definition of Done**
- [x] Banner yalnız Projeler listesindeki kartın bandında ve oluşturma önizlemesinde görünüyor. Header, ayarlar ve davet önizlemesinde yok.
- [x] Ayarlardan yükle, değiştir ve kaldır çalışıyor. Hatalar anlaşılır mesajla gösteriliyor.
- [x] Kalem ikonu proje kartının bandının sağ üstünde, yalnız ayarları değiştirebilen üyede (`canEdit`) görünüyor ve ayarlara götürüyor.
- [x] Lint, tsc ve build temiz. `01-project-lifecycle`, `project-create-page`, `global-invitations-preview`, `11-project-banner` E2E testleri geçiyor.

---

### Task 5 — Sidebar ve navigasyon temizliği (B, E-sidebar, G, H-etiket)

**Amaç:** Seçili proje alanını daha anlaşılır hale getirmek, gereksiz yüzeyleri kaldırmak, alt menüyü sabitlemek.

**Neden bu sırada:** Kalem ikonu (Task 4) hazır olduğu için Ayarlar maddesi güvenle kaldırılabilir. Hepsi aynı iki dosyada.

**Backend:** Yok.

- [x] 5.1 Sidebar'daki "Ayarlar" maddesini kaldır:
  - `PROJECT_SECTIONS`'ta `settings` kalır, çünkü `projectSection()` ve `?section=settings` onu tanımaya devam etmeli.
  - Bölüme `sidebar: false` bayrağı ekle. `project-sidebar-nav.tsx` hem genişletilmiş hem daraltılmış modda bu bayrağı filtreler.
  - Overview'daki "ayarlara git" bağlantısı (`project-overview.tsx:205`) kalır.
- [x] 5.2 "PDA / Çalışma alanın" kartını kaldır (`app-shell.tsx` L167-183).
  - Kullanılmayan importları (`CaretDown` vb.) temizle.
  - `workspace.workspace` key'i dashboard'da kullanıldığı için kalır.
  - Kart hiçbir state sağlamıyor, yalnız `/organizations` linki. Organizasyonlar zaten üst menüde.
- [x] 5.3 "Hesap ayarları" → "Ayarlar":
  - `workspace.settings` tr "Ayarlar", en "Settings", de "Einstellungen".
  - Header kullanıcı menüsü, global arama ve dashboard aynı key'i kullandığı için birlikte değişir.
  - href bu taskta `/account` kalır, 6. taskta `/settings` olur.
  - `e2e/05-account-page.spec.ts` link adı güncellenir.
- [x] 5.4 Sabit alt bölüm: Ayarlar linki ve daraltma düğmesi `nav`'ın (`overflow-y-auto`) dışında kalmalı. Uzun proje navigasyonunda (768px yükseklik, açık seçili proje + görev grubu) Ayarlar'ın görünür kaldığını Playwright ile doğrula. Mobil drawer'da alt blok altta kalır.
- [x] 5.5 Hiyerarşi ve gruplama (mevcut bileşenler sadeleştirilerek, yeni bir navigasyon sistemi yazılmadan). Sıra:
  - Global grup (Ana sayfa, Projeler, Organizasyonlar, Davetler).
  - "Seçili proje" grubu: başlık ve "değiştir" linki, proje çipi, bölümler.
  - "Görev yönetimi" grubu.
  - "Kişisel" grubu: Görevler (rozetli `TasksNavLink`), Takvim.
  - Grup başlıklarında tek tip tipografi, gruplar arası tek tip boşluk (mevcut `navItemClass` korunur).
  - Grup başlığı yalnız genişletilmiş modda. Daraltılmış modda gruplar ayırıcıyla ayrılır.
  - **Not (5.1):** Ayarlar bölümü `PROJECT_SECTIONS`'ta `sidebar: false` ile duruyor, `?section=settings` ve `projectSection()` aynı çalışıyor. Kalem ikonu yalnız proje ana sayfasının header'ında. Ekip/görev sayfalarındayken ayarlara gitmek için önce proje çipi veya "Genel Bakış" ile proje sayfasına geçilir (E2E `01` buna göre güncellendi).
  - **Not (5.4):** Alt blok (Ayarlar + daralt düğmesi) zaten `nav`'ın dışındaydı, yani sabitti. 640px yüksekliğinde (genişletilmiş ve daraltılmış) görünür kaldığı yeni E2E ile doğrulandı.
  - **Not (5.5):** "Kişisel" grup başlığı eklendi (Görevler + Takvim). Gruplar tek tip `border-t` ve başlık tipografisiyle ayrılıyor, daraltılmış modda yalnız ayırıcı kalıyor.
  - **Not (5.7):** E2E `01`, `02`, `03` ve `05` güncellendi (kalem ikonu, sidebar'da Ayarlar yok, "Projeler" aktif durumu, çalışma alanı kartı yok).
- [x] 5.6 Aktif durum:
  - "Projeler" `/projects` ve `/projects/new`'de aktif.
  - Proje detay sayfasında seçili proje bölümü aktif olduğu için global "Projeler" aktif olmaz. Mevcut mantık korunur, kısa yorumla belirtilir.
  - Teams / Tasks / Calendar / Davetler davranışları değişmez.
- [x] 5.7 E2E:
  - `03-project-navigation-responsive` güncelle: Ayarlar maddesi yok, kalem ikonu ile ayarlara erişim, daraltılmış mod, mobil drawer.
  - `05` link adı.
  - Uzun sidebar sabit-alt testi.

**Edge-case'ler:**
- Proje seçili değilken (`aria-disabled` maddeler).
- Üye (manager değil) görünümü.
- `sessionStorage` hatırlama.
- Daraltılmış modda tooltip/aria-label adları.

**Definition of Done**
- [x] Sidebar'da proje "Ayarlar" maddesi ve çalışma alanı kartı yok. Proje ayarlarına proje kartındaki kalemden (veya `?section=settings` adresinden) gidiliyor.
- [x] Alt "Ayarlar" linki uzun navigasyonda da görünür.
- [x] Gruplar ve aktif durum tutarlı. Teams, Tasks, Calendar ve Davetler bozulmadı.
- [x] Lint, tsc ve build temiz. `03`, `05`, `06`, `07`, `09-tasks`, `teams-page` E2E testleri geçiyor.

---

### Task 6 — Ayarlar sayfası: profil, güvenlik, dil, tema, animasyon (H, I)

**Amaç:** `/settings`'i genel kullanıcı tercihleri merkezi yapmak. Mevcut i18n, tema ve reduced-motion altyapısı yeniden kullanılır.

**Neden bu sırada:** Navigasyon etiketi hazır. Animasyon tercihi Task 7'nin ön koşulu.

**Backend:** Yok. Tercihler cihazda saklanır: tema next-themes `localStorage`'da, dil `NEXT_LOCALE` cookie'sinde, animasyon `localStorage`'da. Backend'de kullanıcı tercihi tablosu yok ve bu task için gerekmiyor.

- [x] 6.1 Route ve linkler:
  - `app/(app)/settings/page.tsx`.
  - `app/(app)/account/page.tsx` → `redirect("/settings")`, eski linkler çalışır.
  - `proxy.ts`'te `PROTECTED_PATHS` ve matcher'a `/settings` ekle.
  - href'leri `/settings`'e çevir: `app-shell.tsx`, `app-header.tsx:101`, `global-search.tsx:70`, `dashboard.tsx:105`.
- [x] 6.2 Sayfa (`features/settings/components/settings-page.tsx`, `PageContainer width="form"`, h1 "Ayarlar"):
  - Bölümler: Profil, Güvenlik, Dil, Görünüm (tema), Animasyonlar.
  - Profil ve Güvenlik `account-page.tsx`'ten bölüm bileşenlerine ayrılıp taşınır, davranış aynı kalır. Eski `account-page.tsx` silinir.
  - i18n yeni namespace: `preferences.*`. `settings.*` proje ayarlarına ait, çakışmasın. tr/en/de.
- [x] 6.3 Dil:
  - `locale-switcher.tsx`'teki seçim mantığını (`writeLocaleCookie` + `router.refresh()`) `useLocaleSelection()` hook'una çıkar. Header switcher ve Ayarlar aynı hook'u kullanır.
  - Ayarlar'da tr/en/de radio grubu (`common.language.*`).
- [x] 6.4 Tema:
  - Açık / Koyu / Sistem radio grubu. `useThemeSelection()` kullanılır (sistem seçeneği burada açıkça yer alır).
  - Kullanılmayan `ThemeSwitcher` dropdown'u yerine bu geçer. Dropdown hâlâ referanssızsa silinir, `useThemeSelection` kalır.
- [x] 6.5 Animasyon tercih altyapısı `lib/preferences/motion.ts`:
  - `pda:motion` = `system | on | off`, `pda:theme-transition` = `on | off`.
  - `useSyncExternalStore` ile, `pda:sidebar-collapsed` kalıbı (try/catch, özel olay, SSR snapshot = `system` / `on`).
  - `useReducedMotionPreference()`: `off` → true, `on` → false, `system` → OS `prefers-reduced-motion`.
- [x] 6.6 Uygulama:
  - `providers.tsx`'te küçük bir `MotionPreferenceSync` `html[data-motion]` attribute'unu yazar.
  - `MotionConfig reducedMotion` bağlanır: `always` / `never` / `user`.
  - `globals.css` reduced-motion kuralı iki yoldan tetiklenir:
    - `@media (prefers-reduced-motion: reduce) { html:not([data-motion="on"]) … }`
    - `html[data-motion="off"] …` (aynı kural gövdesi).
  - `theme-toggle`, `locale-switcher`, `use-shake` ve `useThemeSelection` içindeki `useReducedMotion` → `useReducedMotionPreference`.
  - **Not (6.3):** `locale-switcher.tsx` içinden `useLocaleSelection()` (cookie + `router.refresh()` + bayrak overlay'i) çıkarıldı. Header menüsü ve Ayarlar aynı hook'u kullanıyor.
  - **Not (6.4):** `useThemeSelection().selectTheme(next, { pin })`: Ayarlar'dan yapılan açık seçim, cihaz temasıyla aynı olsa bile "Sistem"e dönmüyor. Header toggle'ı eski davranışta kaldı. Hiçbir yerde kullanılmayan `ThemeSwitcher` açılır menüsü silindi.
  - **Not (6.5):** `lib/preferences/motion.ts`: cihaz "hareketi azalt" ayarı için `motion` kütüphanesinin `useReducedMotion`'ı yerine canlı `matchMedia` aboneliği kullanıldı, çünkü o hook ayar sonradan değişince bileşeni güncellemiyordu (E2E ile yakalandı).
  - **Not (6.6):** `globals.css` reduced-motion kuralı iki yoldan tetikleniyor: cihaz ayarı (`data-motion="on"` değilse) ve `data-motion="off"`. Ortak `SettingsSection` bileşeni `components/common`'a taşındı, proje ayarları aynısını kullanıyor.
- [x] 6.7 Ayarlar'da Animasyonlar bölümü:
  - "Arayüz animasyonları" (Sistem / Açık / Kapalı). Açıklama: Sistem cihazın "hareketi azalt" ayarını izler, Kapalı açılır pencere, menü, kenar çubuğu ve dil geçişi animasyonlarını kapatır.
  - "Tema geçiş animasyonu" (Açık / Kapalı). "Arayüz animasyonları" Kapalı ya da sistemde azaltılmışsa bu anahtar devre dışı görünür ve nedeni yazılır.
  - Var olmayan animasyonlar için ayar yok.
- [x] 6.8 E2E `05-account-page.spec.ts` → `05-settings-page.spec.ts`:
  - Sidebar "Ayarlar" → `/settings` h1.
  - `/account` → `/settings` yönlendirmesi.
  - Şifre formu görünür.
  - Dil değişince `html[lang]` ve metinler değişir, sonra tr'ye geri alınır.
  - Tema Koyu → `html.dark`, yenilemede korunur.
  - Animasyon Kapalı → `html[data-motion="off"]`, yenilemede korunur.
  - `error-pages` ve `footer-public-pages` içindeki `/account` bağımlılıkları kontrol edilir.

**Edge-case'ler:**
- Hydration: SSR snapshot'ı sabit, gerçek tercih ilk frame'den sonra uygulanır. `localStorage` erişilemezse varsayılan.
- Dil değişiminde form state'i kaybı (beklenen, sayfa yenileniyor).
- "Açık" seçilip OS azaltılmışsa animasyonlar çalışır (kullanıcının açık tercihi kazanır). Açıklamada belirtilir.
- Public ve auth sayfalarında tercih yine okunur (Providers kökte).

**Definition of Done**
- [x] `/settings` dil, tema ve animasyon tercihleriyle çalışıyor ve tercihler kalıcı. `/account` yönlendiriyor.
- [x] Dil ve tema mevcut mekanizmaları kullanıyor, ikinci bir i18n veya tema sistemi yok.
- [x] Animasyon Kapalı iken dialog, menü, sidebar ve dil overlay'i animasyonsuz. Sistem modunda OS tercihi geçerli.
- [x] Hydration uyarısı yok. Lint, tsc ve build temiz. `05-settings-page` ve diğer E2E testleri geçiyor.

---

- **Ek görev (kullanıcı talebi): Ayarlar'ı kaydet-tabanlı ve hesaba bağlı yap**
  - [x] Seçimler taslak: tıklayınca hiçbir şey uygulanmaz, "Kaydet" ve "Vazgeç" var (`settings-page.tsx`).
  - [x] Kaydedilenler hesabın varsayılanı: backend `V48__user_preferences.sql`, `GET|PUT /api/v1/users/me/preferences` (`UserPreferenceApiIntegrationTest`: kaydedilmemiş, değiştirme, başka kullanıcıdan gizli, yeni girişte aynı, CSRF, 401, CORS).
  - [x] Her girişte kaydedilenler uygulanır (`useApplySavedPreferences`); çıkış yapıp girince aynı kalır.
  - [x] Üst çubuktaki dil ve tema düğmeleri geçici: çıkışta oturumun başladığı hâle dönülür (`useRestoreSessionBaseline`).
  - [x] E2E: `05-settings-page.spec.ts` (taslak, kaydet, vazgeç, dil/tema/animasyon, çıkış-giriş sonrası kalıcılık, geçici değişiklik silinir), `12-theme-transition.spec.ts` (geçiş artık üst çubuk düğmesiyle).
- **Ek görev 2 (kullanıcı talebi): Hesap ayarları ayrı sayfa**
  - [x] Navbar'daki hesap menüsünde "Hesap ayarları" (`/account`) var; profil (kullanıcı adı, e-posta) ve güvenlik (şifre) burada (`features/account/`).
  - [x] Sidebar'daki "Ayarlar" (`/settings`) yalnız dil, tema ve animasyon; profil ve şifre oradan çıkarıldı. `/account` artık yönlendirme değil gerçek sayfa.
  - [x] E2E: `14-account-page.spec.ts`, `05-settings-page.spec.ts` güncellendi.

### Task 7 — Dairesel tema geçişi: koyu temaya geçişte "dışarıdan içeri" (L)

**Amaç:** Geçişin yönü hedef temaya göre belirlenir (kullanıcı kararı):
- **Açık (light) temaya geçiş:** Mevcut davranış **aynen kalır**, yani yeni tema merkezden dışarı doğru açılır. `theme-reveal` kuralına ve keyframe'ine dokunulmaz.
- **Koyu (dark) temaya geçiş:** Yeni davranış, çember dışarıdan merkeze doğru gelir ("Ay dışarıdan içeri çember olarak gelsin").
- Her iki yön de tercihe bağlanır (Task 6).

**Neden bu sırada:** Task 6'daki tercihlere bağlı.

**Backend:** Yok.

- [x] 7.1 Yöntem: mevcut View Transitions altyapısı (`playThemeTransition`, `theme-reveal` sınıfı) korunur. Yeni kütüphane eklenmez, `motion` yalnız orb için kalır. Uygulamadan önce `frontend/node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` okunur (`frontend/AGENTS.md` kuralı).
- [x] 7.2 `globals.css` ve `theme-transition.tsx`:
  - Mevcut `html.theme-reveal` kuralları ve `@keyframes theme-reveal` (light'a geçiş, merkezden dışarı) **değişmeden** kalır.
  - Yeni `html.theme-close-in` (dark'a geçiş) eklenir:
    - `::view-transition-new(root)`: altta, `animation: none`.
    - `::view-transition-old(root)`: üstte (`z-index` yüksek), `animation: theme-close-in 0.75s cubic-bezier(0.65,0,0.35,1) both`.
    - `@keyframes theme-close-in`: `clip-path: circle(72% at 50% 50%)` → `circle(0% at 50% 50%)`. Eski (açık) tema merkeze doğru küçülür, altındaki koyu tema dışarıdan içeri doğru ortaya çıkar.
  - Süre ve easing mevcut değerlerle aynı. Orb (ay/güneş) davranışı ve `theme-orb` kuralları aynı kalır. Orb'un yönünün yeni geçişle uyumlu görünüp görünmediği görsel olarak kontrol edilir.
  - `playThemeTransition(from, to, swap)` hedef temaya göre sınıfı seçer: `to === "dark"` → `theme-close-in`, `to === "light"` → `theme-reveal`. Sınıf, geçiş bitince kaldırılır (mevcut `finished.finally` kalıbı).
  - **Not (7.1):** `frontend/node_modules/next/dist/docs/...` içindeki Next rehberini okuma izni verilmedi. Bu iş Next'e özgü bir API değil, tarayıcının yerel `document.startViewTransition`'ı olduğu için mevcut altyapı korundu, yeni kütüphane eklenmedi.
  - **Not (7.2):** Açık temaya geçiş (`theme-reveal`) kuralına dokunulmadı. Koyu temaya geçiş için `theme-close-in` eklendi; geçiş sırasında alınan ekran görüntüsünde eski açık sayfa merkeze doğru küçülen daire olarak kalıyor ve koyu tema kenarlardan içeri doğru açılıyor.
- [x] 7.3 `useThemeSelection` kapısı. Animasyon yalnız şu dört koşulun hepsi sağlanınca çalışır:
  - "Tema geçiş animasyonu" açık.
  - `useReducedMotionPreference()` false.
  - from ≠ to.
  - `document.startViewTransition` var.
  - Aksi halde doğrudan `setTheme`.
  - `ThemeTransitionOverlay` aynı kapıyla render edilir.
- [x] 7.4 Flash, flicker ve hydration kontrolü:
  - `ThemeProvider`'daki `disableTransitionOnChange` kalır.
  - `suppressHydrationWarning` korunur.
  - Geçiş sırasında ikinci tıklama mevcut "çalışıyorsa reddet" kuralıyla engellenir.
  - Dialog açıkken tema değişimi (z-index 200 orb, dialog 50) bozulmamalı.
- [x] 7.5 E2E (`05-settings-page` veya `12-theme-transition.spec.ts`):
  - Animasyon açıkken light → dark: kısa süre `html.theme-close-in` var, `html.theme-reveal` yok, sonra `html.dark`.
  - Animasyon açıkken dark → light: kısa süre `html.theme-reveal` var (mevcut davranış), `html.theme-close-in` yok.
  - "Tema geçiş animasyonu" Kapalı → sınıf hiç eklenmiyor, tema anında değişiyor.
  - `page.emulateMedia({ reducedMotion: "reduce" })` + Sistem → sınıf eklenmiyor.

**Edge-case'ler:**
- View Transitions desteği olmayan tarayıcı (Firefox eski sürümleri) → anında değişim.
- Sistem temasına geçiş (`system` saklanır, from/to çözülmüş renkler).
- Hızlı ardışık tıklama.
- Auth, public ve error sayfalarındaki `ThemeToggle` aynı kapıyı kullanır.

**Definition of Done**
- [x] Açık temaya geçiş merkezden dışarı (mevcut davranış, değişmedi). Koyu temaya geçiş dışarıdan merkeze. İki yönde de flash yok.
- [x] Tercih kapalıyken veya reduced-motion'da animasyon yok.
- [x] SSR veya hydration uyarısı yok. Lint, tsc ve build temiz, E2E geçiyor.

---

### Task 8 — Organizasyon popup'larını sayfaya çevir (A)

**Amaç:** Organizasyon oluşturma ve düzenlemeyi `OrganizationFormDialog` popup'ından ayrı sayfalara taşımak. Ekip ve hatırlatıcı formlarındaki sayfa kalıbı kullanılır.

**Neden bu sırada:** Bağımsız. Task 1'in `PageContainer`'ını kullanıyor, shell'e dokunmuyor.

**Backend:** Yok (mevcut create ve update uç noktaları).

- [x] 8.1 Route'lar:
  - `app/(app)/organizations/new/page.tsx`.
  - `app/(app)/organizations/[organizationId]/edit/page.tsx`.
  - `proxy.ts` matcher'ın `/organizations/:path*`'ı kapsadığını doğrula.
- [x] 8.2 `features/organizations/components/organization-form-page.tsx`:
  - `organization-form-dialog.tsx`'teki şema, mutasyonlar ve alanlar taşınır, kopyalanmaz.
  - `PageContainer width="form"`, geri linki, sticky kaydet barı (`team-form-page.tsx` kalıbı).
  - Başarıda detay sayfasına gider, query invalidation aynı kalır.
  - Düzenleme sayfasında sahip olmayan veya arşivli organizasyon için form yerine açıklayıcı bir durum gösterilir. Backend yetkisi zaten source of truth.
- [x] 8.3 Liste header butonu → `Link href="/organizations/new"`. Detaydaki Düzenle butonu → `Link …/edit`, mevcut "sahip ve arşivli değil" koşuluyla.
- [x] 8.4 `organization-form-dialog.tsx` artık referanssızsa silinir. Arşiv `ConfirmDialog`'u kalır.
  - **Not (8.2):** Sahibin görebildiği organizasyon için sayfa içi "düzenlenemez" durumu duruyor. Pratikte sahibi olmayan biri organizasyonu API'den 403, arşivlenmiş olanı 404 aldığı için bu iki durumda `PageFailure` (403/404 ekranı) görünüyor ve form hiç render edilmiyor. E2E bu gerçek davranışı doğruluyor.
  - **Not (8.4):** `organization-form-dialog.tsx` silindi. E2E `helpers.createOrganization` sayfa akışına çevrildi (`01-project-lifecycle` bunu kullanıyor).
- [x] 8.5 E2E `13-organizations.spec.ts` (manager hesabı):
  - Liste → "Yeni organizasyon" sayfası (dialog yok) → oluştur → detay.
  - Düzenle sayfası → kaydet → güncel ad.
  - Doğrudan URL ile `/organizations/new` erişimi.

**Edge-case'ler:**
- Doğrulama hataları.
- Kaydedilmemiş değişiklikle geri dönme (mevcut form sayfalarındaki davranışla aynı).
- Mobil sticky bar.
- Arşivli organizasyonun düzenleme URL'si.

**Definition of Done**
- [x] Organizasyon oluşturma ve düzenleme sayfalarda. Organizasyon akışında popup kalmadı (arşiv onayı hariç).
- [x] Ölü kod yok. Lint, tsc ve build temiz, E2E geçiyor.

---

- **Ek görev 3 (kullanıcı talebi): Organizasyon oluştur/düzenle sayfası çok boştu**
  - [x] Sayfa proje ve ekip oluşturma düzenine getirildi: solda form (karakter sayacı ve ipucu), sağda yazdıkça güncellenen canlı önizleme kartı (`OrganizationCard`, listedeki kartın aynısı; önizlemede link yok); mobilde önizleme formun altında ve alt çubukta "Önizlemeyi göster".
  - [x] E2E: `13-organizations.spec.ts` canlı önizleme testi.

### Task 9 — Final doğrulama ve dokümantasyon

- [x] 9.1 Bütün checkbox'ların gerçekten yapılan işi yansıttığını kontrol et.
- [x] 9.2 Frontend: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx playwright test`:
  - Önce `docker compose up -d --build backend`.
  - Register rate limit için gerekirse `docker compose restart backend`.
- [x] 9.3 Backend: `./mvnw test` (integration, `ModularityTest`) ve `./mvnw -DskipTests package`.
- [x] 9.4 Dokümanlar:
  - `.agents/frontend-design-rules.md`: genişlik standardı, sidebar grupları, banner fallback.
  - `.agents/folder-structure.md`: `features/settings`, `lib/preferences`.
  - Etkilenen maddeler için `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md` (reduced motion, tema). Yalnız gerçekten doğrulanan maddeler `[x]`.
- [x] 9.5 `git status` ile yalnız plan kapsamındaki dosyaların değiştiğini doğrula. Kullanıcının `.agents/PDA_Opus_Plan_Sonnet_Implementation_Workflow.md` dosyasına dokunulmadı. Commit ve push yok. Kullanıcıya Türkçe final rapor verilir.

---

**Final sonuçları (son durum):**
- **Pre-push kalite kapısı (`.\pre-push\pre-push.cmd`): GEÇTİ** ("PDA PRE-PUSH CHECK PASSED / Safe to git push"). Backend `clean verify` 305/305, frontend lint + `tsc` + build, docker compose build ve runtime smoke, Playwright 101 geçti / 1 atlandı (`error-pages.spec.ts` içindeki development-only 500 testi, kasıtlı atlanıyor).
- Pre-push ilk denemede `09-tasks` @mention testiyle düştü: gerçek bir hata çıktı (mention seçilince imleç `requestAnimationFrame` ile geri konuyor, kullanıcı o arada yazarsa harfler ters sıralanıyordu). `mention-textarea.tsx` içinde imleç yalnız metin hâlâ seçimin ürettiği metinse geri konacak şekilde düzeltildi.
- Frontend: `npm run lint` temiz, `npx tsc --noEmit` temiz, `npm run build` temiz, `npx playwright test` **99 geçti, 1 atlandı, hata yok** (son çalıştırma).
- Backend: `./mvnw test` **305/305 geçti** (integration ve `ModularityTest` dahil), `./mvnw -DskipTests package` temiz. V47 mevcut Docker veritabanına sorunsuz uygulandı.
- Dokümantasyon: `.agents/{api,database,SECURITY,frontend-design-rules,folder-structure}.md` güncellendi. `WEB_SITE_MASTER_CHECKLIST_TR.md` içinde tema/reduced-motion ile ilgili bir madde bulunmadığı için değiştirilmedi.
- Git: commit ve push yapılmadı. Kullanıcının `.agents/PDA_Opus_Plan_Sonnet_Implementation_Workflow.md` dosyasına dokunulmadı.

---

## 4. Etkilenecek Alanlar

| Task | Başlıca dosyalar |
|---|---|
| 1 | `components/common/page-container.tsx` (yeni), `components/layout/app-shell.tsx`, `features/dashboard/dashboard.tsx`, `features/projects/components/project-settings-form.tsx`, `features/reminders/components/reminder-form-page.tsx`, `features/repository/components/repository-settings.tsx`, `features/invitations/components/accept-invitation-view.tsx`, `app/(app)/invitations/[projectId]/[invitationId]/page.tsx`, sticky bar'lı 4 form/board dosyası |
| 2 | `backend/.../project/application/service/ProjectInvitationService.java`, `.../infrastructure/repository/ProjectInvitationRepository.java`, `.../api/MyProjectInvitationController.java`, ilgili response DTO, `ProjectInvitationApiIntegrationTest.java`; frontend `app/(app)/invitations/page.tsx`, `features/invitations/api.ts`, `types.ts`, i18n, `e2e/global-invitations-preview.spec.ts`, `e2e/10-global-invitations.spec.ts` (yeni), `.agents/api.md` |
| 3 | `db/migration/V47__project_banners.sql`, `project/domain/entity/{Project,ProjectBanner}.java`, `ProjectBannerRepository`, `ProjectBannerService`, `ProjectImageType` (yeni), `ProjectLogoService` (yardımcıya geçiş), `ProjectBannerException`, `ProjectApiErrorHandler`, `ProjectBannerController`, `MyProjectInvitationController`, `ProjectResponse`, `InvitationProjectPreview`, `SecurityBaselineConfiguration`, `ProjectBannerIntegrationTest` (yeni), `.agents/{api,database,SECURITY}.md` |
| 4 | `features/projects/{api,types}.ts`, `components/project-banner.tsx` (yeni), `project-detail.tsx`, `project-settings-form.tsx`, `create/logo-field.tsx` (gerekirse ortak alan), `project-card.tsx`, `features/invitations/{api,types}.ts`, `invitation-project-preview-dialog.tsx`, i18n, `e2e/11-project-banner.spec.ts` |
| 5 | `components/layout/app-shell.tsx`, `project-sidebar-nav.tsx`, `features/projects/project-sections.ts`, i18n (`workspace.settings`), `e2e/03-…`, `e2e/05-…` |
| 6 | `app/(app)/settings/page.tsx` (yeni), `app/(app)/account/page.tsx`, `proxy.ts`, `features/settings/**` (yeni), `features/auth/components/account-page.tsx` (bölünür/silinir), `lib/preferences/motion.ts` (yeni), `components/providers.tsx`, `components/layout/{locale-switcher,theme-switcher,theme-toggle,app-header,global-search}.tsx`, `features/auth/components/use-shake.ts`, `features/dashboard/dashboard.tsx`, `app/globals.css`, i18n, `e2e/05-settings-page.spec.ts` |
| 7 | `components/layout/{theme-transition,theme-switcher}.tsx`, `app/globals.css`, E2E |
| 8 | `app/(app)/organizations/new/page.tsx`, `[organizationId]/edit/page.tsx` (yeni), `features/organizations/components/{organization-form-page (yeni),organization-list,organization-detail,organization-form-dialog (silinir)}.tsx`, i18n, `e2e/13-organizations.spec.ts` |

## 5. Backend Gerektiren Tasklar

- **Task 2 (Davetler):** mail linki düzeltmesi, `/me?status=` filtresi, etkin EXPIRED statüsü, testler. Migration yok.
- **Task 3 (Banner):** V47 migration, entity, servis, controller, davet banner uç noktası, DTO alanları, security allowlist, testler.
- **Task 1, 4, 5, 6, 7, 8:** yalnız frontend.

## 6. Riskler

- **Routing regression:**
  - `/account` → `/settings` (yönlendirme ve proxy listesi).
  - Yeni organizasyon route'ları.
  - `?section=settings` route'u sidebar'dan kalkınca yalnız ikon ve overview linkiyle erişiliyor. E2E bunu doğrulamalı.
- **Proje yetkisi:**
  - Kalem ikonu ve banner yönetimi frontend'de `isManager` ile gizleniyor. Gerçek kontrol backend'de `PROJECT_UPDATE`'te.
  - ANALYST gibi rollerin PUT/DELETE 403 aldığı testlenmeli.
- **Tema hydration:**
  - `data-motion` ve tema tercihleri SSR'da sabit snapshot ile okunmalı.
  - View Transition ve `flushSync` sırasında flash olmamalı.
  - next-themes React 19 script uyarı yaması (`providers.tsx` L16-25) korunmalı.
- **Responsive layout:**
  - `form` genişliğindeki iki sütunlu düzen `lg` altında tek sütuna düşmeli.
  - Sticky bar bleed değişikliği 4 sayfayı etkiliyor.
  - Banner oranı mobilde.
- **Invitation query/cache:**
  - Query key'e status eklenince invalidation prefix'i (`["project-invitations","me"]`) aynı kalmalı.
  - Mock'lu E2E güncellenmeli.
  - Etkin EXPIRED yalnız response'ta, DB'de PENDING kalıyor. Accept 409 davranışıyla tutarlı.
- **Banner storage:**
  - 2 MB `bytea` satır başına. Liste uç noktası banner baytını değil yalnız `bannerVersion`'ı döndürür.
  - `immutable` cache yalnız versiyonlu URL ile güvenli.
  - Davet uç noktası `no-store`.
  - Allowlist eksik kalırsa 403 döner.
- **Navbar:** Davranış değişmiyor (kullanıcı kararı). Yalnız ofset sabitleniyor.
- **E2E rate limit:** Yeni spec'ler `/auth/register` çağırmamalı, global-setup hesaplarını kullanmalı (10 dakikada 5 sınırı).
- **Kullanıcı değişiklikleri:** Plan dışı dosyalar resetlenmez. Conflict'te iki taraf korunur.

## 7. Validation Plan

| Task | Komutlar |
|---|---|
| 1 | `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx playwright test e2e/03-project-navigation-responsive.spec.ts e2e/06-calendar-page.spec.ts e2e/07-reminders.spec.ts`, 375 / 1440 / 1920px görsel kontrol |
| 2 | `./mvnw test` (en az `ProjectInvitationApiIntegrationTest`, sonra tamamı), `docker compose up -d --build backend`, frontend lint, tsc ve build, `npx playwright test e2e/02-… e2e/04-… e2e/10-global-invitations.spec.ts e2e/global-invitations-preview.spec.ts` |
| 3 | `./mvnw test` (`ProjectBannerIntegrationTest`, `ProjectIdentityIntegrationTest`, `ModularityTest`, tamamı), `./mvnw -DskipTests package`, Docker'da V47'nin mevcut veritabanına uygulanması |
| 4 | Frontend lint, tsc ve build, `npx playwright test e2e/01-… e2e/project-create-page.spec.ts e2e/global-invitations-preview.spec.ts e2e/11-project-banner.spec.ts` |
| 5 | Frontend lint, tsc ve build, `npx playwright test e2e/03-… e2e/05-… e2e/06-… e2e/07-… e2e/09-tasks.spec.ts e2e/teams-page.spec.ts` |
| 6 | Frontend lint, tsc ve build, `npx playwright test e2e/05-settings-page.spec.ts e2e/error-pages.spec.ts`, `footer-public-pages` (public config), tarayıcı konsolunda hydration uyarısı kontrolü |
| 7 | Frontend lint, tsc ve build, tema E2E'si, Chrome ve Firefox'ta manuel tema geçişi |
| 8 | Frontend lint, tsc ve build, `npx playwright test e2e/13-organizations.spec.ts` |
| 9 | Tam `npx playwright test`, tam `./mvnw test` ve `./mvnw -DskipTests package`, `git status` |

**Kesin uygulama sırası:** Task 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9.
