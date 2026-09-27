# HMZ-PROJ FAZ 8 — Frontend Organization / Project / Membership

**Tamamlanma tarihi:** 2026-09-27
**Durum:** HMZ-PROJ-37–41 kapsamı tamamlandı. Ayrıca bu fazın ön koşulu olan (planda ayrı bir task olarak adlandırılmayan ama zorunlu) oturum/korumalı-route altyapısı da bu fazda kuruldu.

## Kapsam ve önemli dosyalar

**Temel altyapı (bu fazdan önce hiç yoktu):**
- [use-session.ts](../../frontend/src/features/auth/hooks/use-session.ts) — `GET /api/v1/auth/me` üzerine React Query hook'u; [auth/api.ts](../../frontend/src/features/auth/api.ts) içine `me`/`logout` eklendi.
- [app-shell.tsx](../../frontend/src/components/layout/app-shell.tsx) + [app/(app)/layout.tsx](../../frontend/src/app/(app)/layout.tsx) — korumalı route group: oturum yoksa `/login`'e yönlendirir, üst navigasyon (Projects/Organizations, dil/tema, kullanıcı menüsü + logout) sağlar.
- [app/(app)/account/page.tsx](../../frontend/src/app/(app)/account/page.tsx) — `login-form.tsx`'teki asılı `/account` hedefi artık `/projects`'e yönlendiriyor.
- [lib/api/client.ts](../../frontend/src/lib/api/client.ts) — `apiRequest` artık PUT/DELETE de destekliyor; [error-message.ts](../../frontend/src/lib/api/error-message.ts) 404 → `notFound` eşlemesi eklendi.
- [types/pagination.ts](../../frontend/src/types/pagination.ts) — paylaşılan `Page<T>` tipi.
- Eksik shadcn primitive'leri (`Textarea`, `Select`) `shadcn add` ile eklendi.

**HMZ-PROJ-37 — Organization UI:** [features/organizations/](../../frontend/src/features/organizations/) — create/edit dialog, list (pagination), detail (archive + organization altındaki proje listesi).

**HMZ-PROJ-38 — Project UI:** [features/projects/](../../frontend/src/features/projects/) — create dialog (organization seçimi opsiyonel), list, `[slug]` route ile detail shell (tabs: Overview/Members/Invitations/Squads), loading/empty/error state'leri.

**HMZ-PROJ-39 — Members UI:** [projects/components/members/](../../frontend/src/features/projects/components/members/) — üye listesi, rol badge'leri, rol düzenleme dialog'u, üye çıkarma (confirm dialog).

**HMZ-PROJ-40 — Invite UI:** [features/invitations/](../../frontend/src/features/invitations/) — kullanıcı arama + rol seçimi ile davet gönderme, bekleyen davet listesi (resend/cancel), token'lı accept/reject sayfası (`/invitations/{projectId}/{invitationId}?token=`).

**HMZ-PROJ-41 — Squad UI:** [features/squads/](../../frontend/src/features/squads/) — create/edit/archive, üye ekleme/çıkarma dialog'u.

## Doğrulama

| Komut / kontrol | Sonuç |
| --- | --- |
| `npx tsc --noEmit` | Hatasız |
| `npm run build` | Başarılı; 9 route (dinamik) derlendi |
| `npm run lint` | Hatasız |
| `pre-push\pre-push.cmd` | `PDA PRE-PUSH CHECK PASSED` |
| `curl` ile `/login`, `/projects`, `/organizations`, `/account` (hem dev server hem prod Docker container) | Hepsi `200`, runtime hatası yok |

**Önemli sınırlama:** Bu ortamda interaktif bir tarayıcı otomasyon aracı (Playwright vb.) yoktu; gerçek tıklama/form doldurma akışlarını (create/invite/accept gibi) uçtan uca test edemedim. Doğrulama yalnız derleme/tip kontrolü/lint/route-seviyesi HTTP kontrolüyle sınırlı kaldı. **Kullanıcının tarayıcıda gerçek akışları elle test etmesi gerekiyor** (aşağıdaki kontrol adımlarına bakın).

## Ek: üye listelerinde nickname (aynı gün, ayrı onayla eklendi)

İlk teslimde açık konu olarak not edilen "üye/squad listelerinde ham `userId` gösteriliyor" sorunu, kullanıcı onayıyla aynı gün çözüldü:

- [MemberResponse](../../backend/src/main/java/com/pda/project/api/dto/response/MemberResponse.java) ve [MemberSummary](../../backend/src/main/java/com/pda/project/application/service/MemberSummary.java) artık `nickname` alanı taşıyor; [ProjectMembershipService](../../backend/src/main/java/com/pda/project/application/service/ProjectMembershipService.java) `UserAccounts.findActiveById` ile Faz 7'deki `ProjectHomeService` deseniyle aynı şekilde çözüyor. [ProjectInvitationService#accept](../../backend/src/main/java/com/pda/project/application/service/ProjectInvitationService.java) de güncellendi.
- Yeni [SquadMemberSummary](../../backend/src/main/java/com/pda/squad/application/service/SquadMemberSummary.java) record'u ve [SquadMemberResponse](../../backend/src/main/java/com/pda/squad/api/dto/response/SquadMemberResponse.java) aynı şekilde nickname taşıyor; `SquadService` artık `UserAccounts`'a bağımlı (Squad zaten Project'e bağımlıydı, User foundational bir modül olduğu için `ModularityTest` yine yeşil).
- Migration yok, yeni endpoint yok — mevcut response'lara additive alan eklendi.
- Frontend: `Member`/`SquadMember` tiplerine `nickname` eklendi, `member-list.tsx` ve `squad-members-dialog.tsx` artık `nickname ?? userId` gösteriyor.
- Doğrulama: `mvn -o clean test` → 175 test, 0 hata (`ModularityTest` dahil); `npx tsc --noEmit` temiz; `pre-push\pre-push.cmd` → PASSED.

## Açık konular

- `InvitationResponse`'da hâlâ nickname yok (yalnız `email`/`invitedUserId`) — kullanıcı bunu kapsam dışı bıraktı, istenirse ayrı ele alınabilir.
- `frontend/AGENTS.md` ve `frontend/CLAUDE.md`, `next dev` tarafından otomatik üretiliyor (Next.js 16 özelliği); ilk kez bu oturumda ortaya çıktılar. Commit'e dahil edip etmemek size kalmış.
- HMZ-PROJ-42 (Project Settings UI, tam ayarlar düzenleme formu) kasıtlı olarak bu fazda YOK — hamza.md'de bu açıkça Faz 9'un kapsamı; Faz 8'deki proje detay sayfası yalnız "shell" (header + tabs).

## Kullanıcı kontrolü

1. `pre-push\pre-push.cmd` çalıştırıp `PDA PRE-PUSH CHECK PASSED` görün (zaten yapıldı, tekrar çalıştırıp teyit edebilirsiniz).
2. `http://localhost:3000` üzerinden giriş yapın; `/account`'ın `/projects`'e yönlendiğini doğrulayın.
3. Bir organization oluşturun, düzenleyin, projelerini listeleyin, arşivleyin.
4. Bir proje oluşturun (organization seçerek/seçmeden), slug ile detay sayfasına gidin, sekmeler arasında geçin.
5. Members sekmesinde kendi rolünüzü görün (PROJECT_MANAGER iseniz düzenleme/çıkarma butonlarının göründüğünü doğrulayın; değilseniz görünmediğini).
6. Invitations sekmesinde (yalnız PM görür) bir kullanıcı arayıp davet edin, bekleyen listede görün, resend/cancel deneyin. Davet linkini (`/invitations/{projectId}/{invitationId}?token=...`) başka bir kullanıcıyla açıp accept/reject akışını deneyin.
7. Squads sekmesinde bir ekip oluşturun, üye ekleyin/çıkarın, arşivleyin.
