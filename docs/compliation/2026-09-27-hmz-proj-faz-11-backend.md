# HMZ-PROJ FAZ 11 (backend kısmı) — HMZ-PROJ-51: Backend Regression

**Tamamlanma tarihi:** 2026-09-27
**Durum:** HMZ-PROJ-51 tamamlandı. Faz 11'in geri kalanı (HMZ-PROJ-52 E2E, HMZ-PROJ-53 frontend final pass, HMZ-PROJ-54 docs/handoff) kullanıcı kararıyla Faz 9 (frontend) bittikten sonraya bırakıldı.

## Yaklaşım

hamza.md'nin listelediği 9 regression kategorisi (Unit, Service, Repository, Validation, Security, MockMvc/API, Integration, Testcontainers PostgreSQL, Modulith architecture tests) tek tek denetlendi. `backend/src/test/java/com/pda/project` ve `.../squad` altındaki her entity için hem domain-unit hem repository testi var mı diye karşılaştırıldı.

## Bulgu ve kapatma

Proje/squad modülündeki **tek** entity'nin (`ProjectMembership`) hiç domain-unit testi ve hiç repository testi olmadığı bulundu — diğer tüm entity'lerin (Project, Organization, ProjectCriterion, ProjectInvitation, ProjectRepositoryConnection, Squad, SquadMembership) ikisi de vardı. `ProjectMembership` bu modülün en çok kullanılan, iş kuralı en yoğun entity'si olmasına rağmen yalnız `ProjectApiIntegrationTest` üzerinden dolaylı test ediliyordu.

- [ProjectMembershipDomainTest](../../backend/src/test/java/com/pda/project/application/ProjectMembershipDomainTest.java) (9 test) — `initialManager`/`active` factory'leri, `hasRole`, `addRole`/`replaceRoles`/`removeRole` (son-rol koruması dahil), `remove`/`reactivate` durum geçişleri, `getRoles()`'un immutable olduğu.
- [ProjectMembershipRepositoryTest](../../backend/src/test/java/com/pda/project/repository/ProjectMembershipRepositoryTest.java) (6 test) — `@DataJpaTest` + Testcontainers; `(project_id, user_id)` unique kısıtı, tüm custom `@Query` metotları (`countActiveByProjectIds`, `countWithRole`, `countByProjectIdAndStatus`, `findByProjectIdAndStatusAndRole`) dahil.

Diğer 8 kategori zaten sağlıklıydı: Security ve Validation/ProblemDetail Faz 10'da kapsamlı şekilde güçlendirilmişti; MockMvc/API, Integration, Testcontainers PostgreSQL ve Modulith architecture (`ModularityTest`) her fazda zaten çalıştırılıyordu.

## Doğrulama

| Komut / kontrol | Sonuç |
| --- | --- |
| `mvn -o clean test` | 204 test geçti (189 → 204, +15 yeni test), 0 hata; `ModularityTest` dahil |
| `pre-push\pre-push.cmd` | `PDA PRE-PUSH CHECK PASSED` |

## Açık konular

- HMZ-PROJ-52 (E2E), HMZ-PROJ-53 (frontend final pass), HMZ-PROJ-54 (docs/handoff) bilinçli olarak bu kayda dahil değil — sıradaki fazlar Faz 9 (frontend) ve ardından Faz 11'in geri kalanı.

## Kullanıcı kontrolü

1. `pre-push\pre-push.cmd` çalıştırıp `PDA PRE-PUSH CHECK PASSED` görün.
2. `backend/` altında `mvn -q clean test` ile 204 testin hatasız geçtiğini doğrulayın.
