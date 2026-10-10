# squad-service-backend — Ekip üyesi kartı (avatar + ad + rol) ve admin kullanıcı listesi DELETED filtresi düzeltmesi

## 1. Özet

- Branch: `squad-service-backend` — Phase 2 / `PDA_ACCOUNT_PUBLIC_UI_THEME_TEAMS_REFINEMENTS_PLAN.md` (Task 6–8).
- Kaynak talep: `.agents/PDA_Account_Public_UI_Theme_Teams_Refinements_Plan_and_Implementation.md` (Talep 5). Talep 1–4 `2026-10-10-general-features-account-public-ui-theme.md` kaydındadır.
- Durum: Task 6–8 tamamlandı (8.4 `pre-push` kullanıcı kararıyla Phase 3'e bırakıldı, bölüm 7). Commit/push kullanıcıya aittir; ajan commit ve push yapmadı.
- Ek: `main` üzerinde düşen `AdminIntegrationTest` DELETED filtresi testi bu fazda düzeltildi (bölüm 4).
- Tek cümlelik sonuç: Ekipler sayfasının kart görünümünde her üye artık yan yana kutudur: profil fotoğrafı (yoksa baş harfler), altında **tam görünen ad**, altında ana rol ve birden çok rol varsa `+N`; roller liste yanıtındaki mevcut üyelik verisinden gelir (yeni sorgu yok, e-posta yok).

## 2. Task 6 — Ekip üyesi veri sözleşmesi (rol)

- **Yanıt şekli:** `TeamView.MemberPreview` ve `TeamController.MemberPreviewResponse` `List<ProjectRole> roles` alanı kazandı. Sıra **enum sırasıdır** (`member.roles().stream().sorted()`); ilk eleman ana roldür. Alan dizi olarak serileştirilir, örnek öğe: `{"userId":"…","nickname":"…","profilePhotoVersion":1,"firstName":"…","lastName":"…","roles":["BACKEND_DEVELOPER","TESTER"]}`.
- **Kaynak:** `SquadService.views()` zaten yüklenmiş `ProjectMemberView.roles()` değerini kullanır; ek repository çağrısı, migration, ENV veya bağımlılık yoktur.
- **Güvenlik:** e-posta eklenmedi (API testi `memberPreview[*].email` boş/yok doğrular); yalnız proje/ekip yetkisinden sonra, en yeni 5 üye; roller yalnız etikettir, erişim vermez.
- **Sorgu sayısı kanıtı:** `SquadServiceTest` 30 ve 100 ekipli sayfada hazırlanan sorgu sayısını karşılaştırır ve çok rollü üyeler eklenmiş veriyle de aynı kalır. Çıktı: `Team preview prepared queries: size30=11, size100=11` (N+1 yok). Test ayrıca rol ekleme sırası (önce `TESTER`, sonra `BACKEND_DEVELOPER`) ters olsa da çıktının enum sırasında (`[BACKEND_DEVELOPER, TESTER]`) olduğunu doğrular.
- **Modulith:** değişmedi; `squad` zaten `com.pda.user.ProjectRole` içe aktarıyordu, `ModularityTest` geçti.
- **Testler:** `SquadServiceTest` (roller dolu + sıralı + sorgu sayısı sabit), yeni `SquadApiIntegrationTest.teamListPreviewCarriesEnumOrderedProjectRolesWithoutEmails` (liste ve ayrıntı yanıtında rol sırası, geçerli enum değerleri, e-posta yok).
- **Dokümanlar:** `.agents/api.md` ve `.agents/SECURITY.md` `memberPreview` satırlarına `roles` notu eklendi.

## 3. Task 7 — Ekip kartında avatar + ad + pozisyon

- **Veri:** `features/squads/types.ts` `TeamMemberPreview.roles: ProjectRole[]`. `team-form-page.tsx` canlı önizlemesindeki oluşturucu üye `roles: []` taşır; landing demo verisine roller eklendi (`demo-data.ts`).
- **Üye kutusu (`team-member-preview.tsx`, kart varyantı):** ızgara `repeat(auto-fill, minmax(5.5rem, 7rem))`; kutuda avatar `size-10` (fotoğraf veya baş harfler) → tam görünen ad → ana rol etiketi (mevcut `roles.*` çevirileri) + birden çok rolde `+N` çipi.
- **Kullanıcı geri bildirimi ve karar:** ilk sürümde ad/rol tek satırda kısaltılıyordu; kullanıcı "Hamza Taşb…" ve "Proje Yöneti…" gibi kesilmiş metni **kabul etmedi**. Karar: **hiçbir kısaltma yok**; uzun ad ve rol kutuda alt satıra kayar (`overflow-wrap:anywhere`), kart yüksekliği içeriğe göre büyür.
- **Erişilebilirlik:** Tooltip ad + tüm rolleri listeler; `li` `aria-label` değeri "Ad, Rol1, Rol2" (ad–rol ilişkisi ekran okuyucuda anlamlı). `components/ui/avatar.tsx` isteğe bağlı `title` özelliği aldı (`false` verilirse yerel `title` yazılmaz; zengin tooltip sarmalarken çift tooltip olmaz).
- **Korunanlar:** en fazla 5 üye + "+N" balonu; 0 üyede boş durum; kompakt (tablo) varyant ve şema (chart) görünümü değişmedi; üye başına ek istek yok.
- **Kart düzeni:** `team-card.tsx` içinde üye sayısı metni kendi satırına alındı (`flex-col`); üye sütunu tooltip çalışsın diye `relative z-10` taşır.
- **Testler:** `team-member-preview.spec.ts` genişletildi: çok rol ("Proje Yöneticisi +1"), 60 karakterlik fotoğrafsız ad (sarar, kırpılmaz), "Hamza Taşbay" tam metin, 0 üyeli ekip, API'de roller enum sırasında ve e-posta yok, 320/390/768/1024/1440 × light/dark'ta kırpılma ve yatay taşma yok, üye başına istek sıfır, tablo ve şema görünümü hâlâ çizilir. Ekran görüntüleri (geçici): `teams-card-{390,1440}-{light,dark}.png`.

## 4. Admin kullanıcı listesi DELETED filtresi düzeltmesi

- **Neden:** hesap silme özelliği `AccountStatus`'a `DELETED` ekledi (anonimleştirilmiş silinmiş hesaplar). `GET /api/v1/admin/users?status=DELETED` bu yüzden artık geçerli bir `valueOf` sayıldı ve `200` döndü; `main`'deki `AdminIntegrationTest.listFiltersOnTheServerAndProblemBodiesCarryStableCodes` (satır ~371, `400` bekler) düştü. PR #137 sonrası birleşik `main` üzerinde alınan `pre-push` raporundaki 1 gerçek başarısızlık budur.
- **Karar (kullanıcı):** admin liste süzgeci `DELETED` değerini diğer geçersiz durumlarla **aynı 400** ile reddeder (`TERMINATED` gibi bilinmeyen değerler de reddedilmeye devam eder). İzinli süzgeç değerleri: `ACTIVE`, `DISABLED`, `PENDING_VERIFICATION`.
- **Uygulama:** `UserAdministrationService.filter(...)` `AccountStatus.valueOf` sonrası `DELETED` ise `IllegalArgumentException` fırlatır. Bu, geçersiz `valueOf`'un zaten `400`'e dönüştüğü yolla aynıdır (`UserApiErrorHandler` `IllegalArgumentException` → 400), dolayısıyla problem gövdesi ve kodu `TERMINATED` ile aynıdır. `AdminUserController` OpenAPI açıklaması "any other value, including DELETED, is a 400" diye güncellendi. `.agents/SECURITY.md` bölüm 11 admin kullanıcı listesi satırı (`?page&size&search&status`, izinli değerler, `400`) güncellendi.
- **Test:** mevcut `DELETED → 400` ve `TERMINATED → 400` doğrulamaları olduğu gibi duruyor; yanına `status=PENDING_VERIFICATION → 200` kabulü eklendi.
- **Frontend (yalnız denetlendi, değişmedi):** `features/admin/components/users-page.tsx` `STATUS_OPTIONS = ["ALL","ACTIVE","DISABLED","PENDING_VERIFICATION"]` ve `features/admin/api.ts` `AccountStatus` tipi zaten `DELETED` içermiyor; süzgeçte DELETED sunulmaz.

## 5. Değişen dosyalar (git status)

Backend (kaynak):

- `backend/src/main/java/com/pda/squad/api/TeamController.java`
- `backend/src/main/java/com/pda/squad/application/service/SquadService.java`
- `backend/src/main/java/com/pda/squad/application/service/TeamView.java`
- `backend/src/main/java/com/pda/user/application/service/UserAdministrationService.java`
- `backend/src/main/java/com/pda/admin/api/AdminUserController.java`

Backend (test):

- `backend/src/test/java/com/pda/squad/application/SquadServiceTest.java`
- `backend/src/test/java/com/pda/squad/integration/SquadApiIntegrationTest.java`
- `backend/src/test/java/com/pda/admin/integration/AdminIntegrationTest.java`

Frontend (kaynak):

- `frontend/src/components/ui/avatar.tsx`
- `frontend/src/features/landing/demo/demo-data.ts`
- `frontend/src/features/squads/components/team-card.tsx`
- `frontend/src/features/squads/components/team-form-page.tsx`
- `frontend/src/features/squads/components/team-member-preview.tsx`
- `frontend/src/features/squads/types.ts`

Frontend (test):

- `frontend/e2e/team-member-preview.spec.ts`
- `frontend/e2e/03-project-navigation-responsive.spec.ts`

Dokümanlar:

- `PDA_ACCOUNT_PUBLIC_UI_THEME_TEAMS_REFINEMENTS_PLAN.md` (Task 6–8 ve Phase 2 işaretleri)
- `.agents/SECURITY.md`, `.agents/api.md`, `.agents/frontend-design-rules.md`, `.agents/folder-structure.md`, `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md` (scoped not)
- `docs/compliation/2026-10-10-squad-service-teams-member-cards.md` (bu kayıt)

## 6. API

Yeni endpoint yok. Değişen sözleşmeler:

- `GET /api/v1/projects/{projectId}/teams` ve `GET /api/v1/projects/{projectId}/teams/{teamId}`: `memberPreview[]` her öğede `roles` (ProjectRole adları, enum sırası, ilk = ana rol) döndürür; yetki ve hata kodları değişmedi (`401`, `403`, `404`). E-posta alanı yoktur.
- `GET /api/v1/admin/users?page&size&search&status` (ADMIN, `USER_MANAGE`): `status` yalnız `ACTIVE`, `DISABLED`, `PENDING_VERIFICATION`; `DELETED` ve bilinmeyen değerler `400`.

Swagger kontrol yolu: `/swagger-ui/index.html`. Ekip listesi için giriş yapıp `GET /api/v1/projects/{projectId}/teams` çağır, `content[].memberPreview[].roles` dizisini gör. Admin için `GET /api/v1/admin/users?status=DELETED` → `400`, `?status=PENDING_VERIFICATION` → `200`.

## 7. Test sonuçları

| Kontrol | Komut / kapsam | Sonuç |
| --- | --- | --- |
| Backend Task 6 hedefli koşu | `SquadServiceTest`, `SquadApiIntegrationTest`, `ModularityTest` ve ilgili ekip testleri | 20 / 20 |
| Sorgu sayısı | `SquadServiceTest` çıktısı | `Team preview prepared queries: size30=11, size100=11` |
| Admin düzeltmesi (A1) | `backend\mvnw.cmd test -Dtest=AdminIntegrationTest` | BUILD SUCCESS, `AdminIntegrationTest` 11 / 0 failure / 0 error |
| Admin + squad + Modulith (A2) | `backend\mvnw.cmd test -Dtest=SquadServiceTest,SquadApiIntegrationTest,ModularityTest,AdminIntegrationTest` | 31 / 0 failure / 0 error / 0 skip (Admin 11, Modularity 1, SquadService 11, SquadApi 8) |
| Playwright (no-truncation öncesi) | Phase 2 hedefli paket | 19 / 19 |
| Playwright (no-truncation sonrası) | `team-member-preview` | 2 / 2 |
| Playwright | `teams-view-toggle` + `teams-page` | 11 / 11 |
| Playwright | `member-initials` + `03-project-navigation-responsive` | 6 / 6 |
| Lint / `tsc` | `npm run lint`, `tsc --noEmit` | lint 0 hata (önceden var olan 2 uyarı), `tsc` temiz |
| `git diff --check` | tüm çalışma ağacı | temiz |

### Test politikası notu

Kullanıcı kararı (2026-10-10): faz başına yalnız **hedefli** kontroller çalıştırılır; tam `pre-push` (backend `clean verify`, `next build`, tam Chromium E2E, Docker) **yalnız Phase 3'te bir kez** çalışır. Bu, `.agents/SECURITY.md` bölüm 2'deki "her teslimde tam doğrulama" beklentisinden **bilinçli bir sapmadır**. Sonuçları: plan 8.4 `[ ]` ve (kullanıcı kararı: Phase 3'te) notuyla bırakıldı; 8.1/8.2 yalnız hedefli koşu ve lint + `tsc` kanıtıyla işaretlendi (`next build` ve tam `verify` Phase 3'te).

### Birleşik `main` (PR #137) `pre-push` raporu

Önceki arka plan `pre-push` koşusu 1 başarısızlık + 7 hata bildirdi. 7 hata (`NoClassDefFoundError TaskRelationService$1`, GitHub repository testleri, task testleri) iki Maven sürecinin `backend/target` dizinini paylaşmasından geldi; tek başına koşulduklarında geçti (`ProjectRepositoryApiIntegrationTest` 16/16, `TaskCollaborationApiIntegrationTest` 5/5, `TaskModesApiIntegrationTest` 31/31). Tek gerçek başarısızlık `AdminIntegrationTest` DELETED süzgeciydi (bölüm 4, düzeltildi). Not: aynı anda iki Maven süreci çalıştırma.

## 8. Kalan konular

- **Üyeye tıklama ekibi açmaz:** üye sütunu tooltip çalışsın diye `relative z-10` aldığından, bir üyenin avatarına/adına tıklamak artık ekibi açmaz. Kartın geri kalanı ve "Ekibi aç" bağlantısı ekibi açmaya devam eder. Gerekirse üye kutusu için ayrı bir tıklama davranışı ürün kararıdır.
- **Kart yüksekliği büyür:** kısaltma olmadığı için çok uzun ad veya rol etiketi kutuyu uzatır; aynı satırdaki kartlar farklı yükseklikte olabilir (kırpma/taşma yok, ölçüyle doğrulandı).
- **390 px'te satırda iki üye:** ızgara `minmax(5.5rem, 7rem)` ile dar ekranda satır başına iki üye sığar; beş üye üç satıra iner.
- **Tam doğrulama Phase 3'te:** backend `clean verify`, `next build` ve tam `pre-push` bu fazda çalıştırılmadı (bölüm 7).
- Firefox koşusu yok (önceki fazdan devam eden not).

## 9. Bekleyen ürün kararları

- **E-posta doğrulama:** uzun süredir açık karar. Alper'in PR #135 ile e-posta kodu doğrulamasını eklediği görülüyor; bu iş kararı karşılamış **görünüyor**, ancak kapsamı ve kararın kapanıp kapanmadığı kullanıcı tarafından **teyit edilmeli**. Bu fazda e-posta doğrulama davranışı değiştirilmedi.
- **BASIC commit sayfalama:** ertelendi; `+N` rozeti yalnız davet edende kalır (karar verildi).

## 10. Kullanıcının kontrol adımları

1. Bir projede en az 3 üyeli ve en az bir üyesi birden çok rollü bir ekip olsun. Ekipler → Kart görünümünde her üyenin fotoğraf (yoksa baş harf), altında tam ad, altında ana rol ve çok rollüde `+N` gösterdiğini doğrula; "Hamza Taşbay" ve "Proje Yöneticisi" gibi metinler kesilmemeli (alt satıra geçer).
2. Üyenin üzerine gel: tooltip ad + tüm rolleri listelemeli. Ekran okuyucuda öğe "Ad, Rol1, Rol2" okunmalı.
3. Dar ekranda (390 px) ve karanlık temada kartın yatay taşmadığını, 5'ten fazla üyede "+N" balonunun göründüğünü, 0 üyeli ekipte boş durumun aynı kaldığını kontrol et. Tablo ve Şema görünümlerinin eskisi gibi çalıştığına bak.
4. Bir üyenin adına/avatarına tıkla: ekip açılmaz (bilinen sınırlama, bölüm 8); kartın boş yerine veya "Ekibi aç"a tıklayınca açılır.
5. Admin → Kullanıcılar: durum süzgecinde yalnız Tümü / Aktif / Devre dışı / Doğrulama bekliyor seçeneklerinin olduğunu gör. Swagger'dan `status=DELETED` isteği `400` dönmeli.
6. E-posta doğrulama kararının PR #135 ile karşılanıp karşılanmadığını teyit et (bölüm 9).
