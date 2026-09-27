# HMZ-PROJ FAZ 7 — Project Home / Overview Backend

**Tamamlanma tarihi:** 2026-09-27
**Durum:** HMZ-PROJ-32 ve HMZ-PROJ-35 tamamlandı. HMZ-PROJ-36 zaten Alper'in Faz 8 (Admin) çalışmasıyla karşılanmıştı, bu fazda ek iş gerekmedi. HMZ-PROJ-33 ve HMZ-PROJ-34 açıkça blocked/kapsam dışı bırakıldı (aşağıya bakın).

## Kapsam ve önemli dosyalar

- [ProjectHomeService](../../backend/src/main/java/com/pda/project/application/service/ProjectHomeService.java) tek bir `PROJECT_VIEW` kontrolüyle header/status/priority, organization (varsa), aktif Project Manager listesi (nickname ile), aktif üye sayısı, success-criteria progress (completed/total) ve repository özetini (bağlı mı, owner/name/branch, son commit, GitHub-unavailable durumu) birleştirir. Yalnız Project modülünün kendi repository'lerini ve `OrganizationService.requireActive`/`UserAccounts` gibi zaten var olan public sözleşmeleri kullanır.
- [ProjectHomeResponse](../../backend/src/main/java/com/pda/project/api/dto/response/ProjectHomeResponse.java) HTTP DTO katmanı; iç içe `OrganizationSummaryResponse`, `ManagerSummaryResponse`, `CriteriaProgressResponse`, `RepositorySummaryResponse` record'larıyla mevcut `CommitResponse`'u yeniden kullanır.
- [ProjectController#home](../../backend/src/main/java/com/pda/project/api/ProjectController.java) `GET /api/v1/projects/{projectId}/home` endpoint'ini sunar. `SecurityBaselineConfiguration`'da değişiklik gerekmedi: mevcut `GET, /api/v1/projects/**` wildcard'ı zaten kapsıyor.
- [ProjectMembershipRepository](../../backend/src/main/java/com/pda/project/infrastructure/repository/ProjectMembershipRepository.java) içine `countByProjectIdAndStatus` ve `findByProjectIdAndStatusAndRole` sorguları eklendi.
- `.agents/architecture.md`, `.agents/folder-structure.md` ve `.agents/SECURITY.md` bölüm 11 güncellendi.

## Mimari karar: Squad count kapsam dışı

Faz planında Project Home'un "Squad count" içermesi isteniyordu. İlk denemede bunun için Squad modülünde `SquadAccess` public contract'ı oluşturup Project'ten çağırdım; ancak Squad zaten `ProjectAccess` üzerinden Project'e bağımlı olduğundan bu, `ModularityTest`'in tespit ettiği bir modül döngüsü (`project -> squad -> project`) yarattı ve `decisions/0001-modular-monolith.md`'nin döngü yasağını ihlal etti. Kullanıcıya bu çakışma soruldu; kullanıcı "Home DTO'dan çıkar" seçeneğini onayladı. Squad count artık Project Home'da yer almıyor; ihtiyaç halinde mevcut `GET /api/v1/projects/{projectId}/squads` endpoint'inin pagination `totalElements` alanından alınabilir. `SquadAccess`/`SquadAccessService` taslağı tamamen geri alındı.

## HMZ-PROJ-33 / HMZ-PROJ-34 — açıkça kapsam dışı

- **HMZ-PROJ-33 (Work Service task counts):** Work Service (task modülü) henüz mevcut değil, public query contract'ı yok. hamza.md kuralı gereği ("Work Service hazır değilse doğrudan repository erişme veya duplicate task model yazma") sahte veri üretilmedi; Project Home yanıtında task-related alan yok.
- **HMZ-PROJ-34 (Recent activity):** Activity modülü henüz mevcut değil, public contract'ı yok; aynı sebeple atlandı.

Her iki madde de Work Service/Activity kendi public sözleşmelerini yayınladığında ayrı bir faz olarak ele alınmalı.

## Doğrulama

| Komut / kontrol | Sonuç |
| --- | --- |
| `mvn -q -Dtest=ModularityTest test` | Squad count'un geri alınmasından sonra geçti (önce cycle nedeniyle başarısızdı) |
| `mvn -q -Dtest=ProjectHomeApiIntegrationTest test` | PostgreSQL Testcontainers üzerinde: üye/dış kullanıcı erişimi, organization/criteria/repository (bağlı/bağlı değil/GitHub unavailable) senaryoları geçti |
| `mvn -q clean test` (tüm suite) | 175 test geçti, 0 hata/atlanan; `ModularityTest` dahil |
| `pre-push\pre-push.cmd` | `PDA PRE-PUSH CHECK PASSED` (backend+frontend Docker build, Postgres healthy, backend/frontend health check `200`) |
| `git diff --check` | Temiz |

## API sözleşmesi

`GET /api/v1/projects/{projectId}/home` — geçerli HttpOnly `PDA_ACCESS` cookie gerektirir (yazma değildir, CSRF gerekmez). Örnek ID: `11111111-1111-4111-8111-111111111111` (gerçek kayda karşılık gelmez).

| Yöntem / yol | Kimlik ve rol/kapsam | Başarı | Önemli hatalar |
| --- | --- | --- | --- |
| `GET /{projectId}/home` | `PROJECT_VIEW` (o projenin üyesi) | `200`; `id,name,slug,status,priority,startDate,targetEndDate,organization\|null,managers[],teamMemberCount,criteriaProgress:{completed,total},repository:{connected,provider,repositoryOwner,repositoryName,defaultBranch,lastCommit\|null,githubUnavailable},createdAt,updatedAt` | `401` cookie yok/geçersiz, `403` proje üyesi değil, `404` proje arşivli/yok |

GitHub çağrısı başarısız olursa (`GitHubIntegrationException`) tüm endpoint değil yalnız `repository.lastCommit=null, repository.githubUnavailable=true` etkilenir.

## Açık konular

- HMZ-PROJ-33/34 yukarıda açıklandığı gibi bilinçli olarak açık bırakıldı.
- Faz 3–6 için bu türde tamamlama kaydı (`docs/compliation/hmz-proj-faz-3..6`) ve `SECURITY.md` bölüm 11 girdileri bu oturumda geriye dönük oluşturulmadı; yalnız `hmz-proj-faz-1/2` mevcuttu. İsterseniz bunları da geriye dönük tamamlayabilirim.
- Squad count ihtiyacı gelecekte gerçek gerekirse (ör. dashboard mimarisi netleşince) ayrı bir mimari karar gerektirir; bu faz onu zorlamadı.

## Kullanıcı kontrolü

1. Docker Desktop açıkken repo kökünde `pre-push\pre-push.cmd` çalıştırın; `PDA PRE-PUSH CHECK PASSED` bekleyin.
2. `backend/` altında `mvn -q clean test` ile 175 testin hatasız geçtiğini doğrulayın.
3. `API_DOCS_ENABLED=true` ile `/swagger-ui/index.html` açın, giriş yapıp `GET /api/v1/projects/{projectId}/home` çağırın; kendi üyesi olmadığınız bir projede `403`, olmayan projede `404` aldığınızı doğrulayın.
4. Bir projeye organization bağlayın, criteria ekleyip birini tamamlayın, GitHub repository bağlayın; `/home` yanıtında organization/criteriaProgress/repository alanlarının güncellendiğini kontrol edin.
