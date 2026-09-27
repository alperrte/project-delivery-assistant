# Project Service — Genel Teslim Özeti (Faz 1–11)

**Tamamlanma tarihi:** 2026-09-27
**Durum:** Planlanan 11 fazın tamamı (HMZ-PROJ-01–54) tamamlandı. Bu kayıt, `docs/compliation/` altındaki tek tek faz kayıtlarını tekrar etmez; genel durumu, toplam doğrulamayı ve açık risk/borcu tek yerde özetler. Kod ve git geçmişi esas alınmıştır (AGENTS.md kuralı gereği plan belgesi tek başına kanıt sayılmadı).

## Faz bazlı durum

| Faz | Kapsam | Durum | Kanıt |
| --- | --- | --- | --- |
| 1 | Project persistence (temel proje CRUD + ilk üyelik) | Tamamlandı | `9b0f872`; [2026-09-27-hmz-proj-faz-1.md](2026-09-27-hmz-proj-faz-1.md), [-01-project-persistence.md](2026-09-27-hmz-proj-01-project-persistence.md) |
| 2 | Organization | Tamamlandı | `fb886ee`; [2026-09-27-hmz-proj-faz-2.md](2026-09-27-hmz-proj-faz-2.md) |
| 3 | User search + invitations | Tamamlandı | `29d9ccf` — bu fazın ayrı bir compliation kaydı oluşturulmamış; kod ve testler `project/api/ProjectInvitationController`, `ProjectMembershipController#search` altında mevcut ve Faz 9/11 E2E'sinde uçtan uca doğrulandı |
| 4 | Squad + Faz 3 temizliği | Tamamlandı | `5e9bead` — ayrı kayıt yok; kod `squad/` modülünde, [folder-structure.md](../../.agents/folder-structure.md) §Squad Service |
| 5 | Settings + Criteria + lifecycle | Tamamlandı | `ea97b87` — ayrı kayıt yok; `ProjectCriterion`/`ProjectCriterionService` (V26 migration), [folder-structure.md](../../.agents/folder-structure.md) |
| 6 | Public GitHub repository integration | Tamamlandı | `38c86bc` — ayrı kayıt yok; `ProjectRepositoryConnection` (V27 migration), SSRF-safe URL parser |
| 7 | Project Home aggregate backend | Tamamlandı | `325824e`; [2026-09-27-hmz-proj-faz-7.md](2026-09-27-hmz-proj-faz-7.md) |
| 8 | Frontend: Organization/Project/Membership/Invitation/Squad UI | Tamamlandı | [2026-09-27-hmz-proj-faz-8.md](2026-09-27-hmz-proj-faz-8.md) |
| 9 | Frontend: Settings/Criteria/Repository/Project Home UI | Tamamlandı | `5b38ab9`; [2026-09-27-hmz-proj-faz-9.md](2026-09-27-hmz-proj-faz-9.md) |
| 10 | Authorization/security test hardening | Tamamlandı | `240b3b8`; [2026-09-27-hmz-proj-faz-10.md](2026-09-27-hmz-proj-faz-10.md) |
| 11 | E2E / Regression / Documentation Gate | Tamamlandı | HMZ-PROJ-51: `803cf30` / [2026-09-27-hmz-proj-faz-11-backend.md](2026-09-27-hmz-proj-faz-11-backend.md); HMZ-PROJ-52/53/54: bu kayıt |

**Bilinen kayıt boşluğu:** Faz 3–6'nın kendi `docs/compliation/` kaydı hiç oluşturulmamış (o oturumlarda atlanmış). Kod ve fonksiyonellik gerçek — `folder-structure.md`'deki faz notları ve bu fazın E2E suite'inin (aşağıya bakın) davet/squad/criteria/repository akışlarını uçtan uca çalıştırması bunu doğruluyor. Geriye dönük kayıt yazmak bu kaydın kapsamı dışında tutuldu; isterseniz ayrıca istenebilir.

## HMZ-PROJ-52 — Project E2E (bu fazda eklendi)

`frontend/e2e/` altında kalıcı bir Playwright test suite'i kuruldu (`@playwright/test`, `frontend/playwright.config.ts`, `package.json`'da `test:e2e` script'i — artık `pre-push.cmd` bunu otomatik olarak zorunlu hale getiriyor).

- [01-project-lifecycle.spec.ts](../../frontend/e2e/01-project-lifecycle.spec.ts): Login → Organizasyon → Proje oluştur → PROJECT_MANAGER olma; Ayarlar düzenle → Kriter ekle/tamamla; Genel GitHub deposu bağla → commit'ler görünür; Projeyi arşivle.
- [02-invitation-roles-squad.spec.ts](../../frontend/e2e/02-invitation-roles-squad.spec.ts): Kullanıcı ara → Davet et → Kabul et → Üyelik; Rol ata → üye projeyi kendi listesinde görür; Ekip oluştur → üye ekle; **manager olmayan rol** hem UI'da (Ayarlar sekmesi hiç render edilmiyor) hem backend'de (raw `fetch` ile doğrudan API çağrısı → `403`) proje ayarı değiştiremiyor; **contributor** hem UI'da (rol düzenle/çıkar butonları görünmüyor) hem backend'de (raw `fetch` → `403`) üyelik mutasyonu yapamıyor.
- Planın "MODERATOR" ismi kodda yok (gerçek roller `PROJECT_MANAGER` + 7 paylaşımlı contributor rolü) — testler gerçek rol adlarıyla yazıldı, bu belirsizlik burada çözüldü.
- "Work Service hazırsa" koşullu akışı (Task/Issue Project Home özeti) atlandı — Work Service bu repoda henüz yok.
- **Sonuç: 11/11 test geçti** (bkz. Doğrulama tablosu).

## HMZ-PROJ-53 — Frontend final pass

- Build/Lint/Type-check: tüm frontend genelinde temiz (yalnız Faz 9 dosyaları değil).
- TR/EN/DE i18n anahtar bütünlüğü programatik olarak doğrulandı: üç dosyada da **293/293** anahtar birebir eşleşiyor, eksik/fazla yok.
- Responsive tarama: Faz 9 ekranları (Faz 9 kaydında detaylı) + login/register/organizations sayfaları 390px genişlikte kontrol edildi.
  - **Bilinen, bu fazın kapsamı dışında olan bulgu:** app-shell header'ı (Faz 8, `frontend/src/components/layout/app-shell.tsx`) mobilde hafif yatay taşma yapıyor (`/organizations`, `/projects` gibi sayfalarda gözlendi). Project Service'in kendi kapsamı değil ama not düşülüyor.
  - **Bu fazın kapsamı dışında olan bulgu:** login/register sayfasının "hero/preview" mockup bileşeni (Alper'in auth-service-frontend'i) mobilde taşıyor. Kod sahipliği Project Service dışında, dokunulmadı.
- Loading/empty/error/confirmation-dialog/rol-duyarlı UI: E2E suite'i bunları zaten fonksiyonel olarak kapsıyor (arşivleme confirm dialog'u, rol-gated Ayarlar/Davetler sekmeleri, boş kriter/depo state'leri).

## HMZ-PROJ-54 — GitHub entegrasyonu ve V2 sınırı

- **V1 davranışı:** proje başına yalnız **1 genel (public) GitHub deposu** bağlanabilir (`ProjectRepositoryConnection`, tekil). URL yalnız `github.com` host'una izin verir; backend kullanıcının verdiği URL'yi hiç fetch etmez, yalnızca `java.net.URI` ile parse eder (SSRF-safe). Son commit'ler unauthenticated GitHub REST API ile çekilir (rate limit'e tabi — bu yüzden frontend'de 429'u ayrı gösteren bir commit widget'ı var).
- **V2 sınırı (henüz yok, plan dışı bırakılmadı ama bu repoda implement edilmedi):** private repo desteği yok. Private bir repo bağlanmaya çalışılırsa GitHub API 404 döner, `GitHubIntegrationException` olarak yakalanıp yalnız repository endpoint'ini etkiler (projenin geri kalanını bozmaz) — ama kullanıcıya "bu repo private olduğu için bağlanamıyor" diye açık bir ayrım gösterilmiyor, genel bir hata olarak görünür. Private repo desteği (OAuth token ile GitHub App/PAT entegrasyonu) V2 kapsamı olarak burada resmi bir açık iş olarak not düşülüyor.

## Doğrulama (bu kaydın kapsadığı final koşu)

| Komut / kontrol | Sonuç |
| --- | --- |
| `backend\mvnw.cmd clean verify` | **204 test, 0 hata**, `BUILD SUCCESS` |
| `npx tsc --noEmit` (frontend, e2e dahil) | Hatasız |
| `npm run lint` (frontend, e2e dahil) | Hatasız |
| `npm run build` | Başarılı; 9 route derlendi |
| `npm run test:e2e` (Playwright, Docker stack'e karşı) | **11/11 test geçti** (~18s) |
| TR/EN/DE i18n anahtar paritesi | 293/293, fark yok |
| `pre-push\pre-push.cmd` | Faz 9 sonunda `PDA PRE-PUSH CHECK PASSED` olarak doğrulandı; bu fazda E2E suite eklendiği için script artık `npm run test:e2e`'yi de otomatik çalıştıracak (bir sonraki push öncesi tekrar çalıştırılması önerilir) |

**Not — rate limit / E2E tekrar çalıştırma:** `AuthRateLimitFilter` register/login path'lerinde IP+path başına 10 dakikada 5 istek sınırlıyor. E2E suite'i birden fazla kez art arda çalıştırırsanız (örn. hata ayıklama sırasında) bu sınıra takılabilirsiniz — normal, tek geçişlik bir `pre-push` koşusu bu sınırın çok altında kalır.

## Açık konular / risk ve borç (toplu)

- Faz 3–6'nın ayrı compliation kayıtları hiç yazılmamış (yukarıda not edildi) — geriye dönük yazılması isteğe bağlı.
- `InvitationResponse` hâlâ nickname taşımıyor (Faz 8'de kapsam dışı bırakılan bilinçli bir karar, Faz 10'da tekrar teyit edildi).
- Security-layer/controller-layer 403 gövde şekli farkı kasıtlı olarak dokunulmadı (Faz 10, kullanıcı kararı).
- V2 private GitHub repo desteği yok (yukarıda detaylandırıldı).
- App-shell header'ının mobil taşması ve login/register hero bileşeninin mobil taşması — ikisi de Project Service kapsamı dışı, ilgili sahiplerine (Faz 8/Alper) bildirilmesi gerekiyor.
- Work Service (Task/Issue) henüz yok — Project Home'daki "task summary/issue summary" alanları ve E2E'nin koşullu akışı bu yüzden boş/atlanmış durumda.
- `.impeccable/critique/` altında Faz 9'un critique kaydı hâlâ "açık" (7-sekme IA bulgusu kullanıcı kararıyla ertelendiği için kapatılmadı).

## Kullanıcı kontrolü

1. `pre-push\pre-push.cmd` çalıştırıp `PDA PRE-PUSH CHECK PASSED` görün (artık E2E suite'ini de otomatik çalıştırır).
2. `frontend/` altında tek başına `npm run test:e2e` çalıştırıp 11 testin de geçtiğini doğrulayın.
3. `docs/compliation/2026-09-27-hmz-proj-faz-9.md` ve `-faz-10.md` ve `-faz-11-backend.md` kayıtlarındaki kullanıcı kontrol adımlarını (henüz yapılmadıysa) tek tek uygulayın.
4. GitHub entegrasyonunu bir private repo URL'siyle deneyip hata mesajının kullanıcı dostu ama "private" ayrımını netlikle belirtmediğini gözlemleyin (yukarıdaki V2 notunu doğrulamak için).
