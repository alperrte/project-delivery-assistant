# HMZ-PROJ FAZ 1 — Project Core ve Organization

**Tamamlanma tarihi:** 2026-09-27
**Durum:** HMZ-PROJ-01–05 kapsamı ve Faz 1 gate tamamlandı. İlk yönetici üyeliği için HMZ-PROJ-06/07'nin zorunlu başlangıç kısmı öne alındı.

## Kapsam ve önemli dosyalar

- [Project modeli](../../backend/src/main/java/com/pda/project/domain/entity/Project.java), [Organization modeli](../../backend/src/main/java/com/pda/project/organization/domain/Organization.java) ve repository'leri UUID kimlik, benzersiz slug, temel metadata, owner/creator UUID ve archive durumunu tutar. Project'in Organization ilişkisi opsiyoneldir. V1 `techStack` kısa serbest metindir; visibility `PRIVATE` ile sınırlıdır.
- [V21](../../backend/src/main/resources/db/migration/V21__project_organization_initial.sql) Organization ve Project tablolarını; [V22](../../backend/src/main/resources/db/migration/V22__project_initial_membership.sql) üyelik ve rol tablolarını oluşturur. PostgreSQL kısıtları ve `ddl-auto=validate` ile sınandı. Auth/User entity veya repository'sine doğrudan bağımlılık eklenmedi.
- [ProjectService](../../backend/src/main/java/com/pda/project/application/service/ProjectService.java) create işleminde Project ile ilk `PROJECT_MANAGER` üyeliğini tek transaction içinde kaydeder. Liste ve detay üyelikle, değişiklik ve archive yönetici rolüyle sınırlıdır. Organization seçimi/değişimi yalnız Organization owner'ına açıktır.
- [OrganizationService](../../backend/src/main/java/com/pda/project/organization/application/OrganizationService.java) authenticated create ve owner-only detay/liste/güncelleme/archive kuralını uygular. Organization proje listesi yalnız çağıranın üyesi olduğu aktif projeleri döndürür.
- [ProjectController](../../backend/src/main/java/com/pda/project/api/ProjectController.java), [OrganizationController](../../backend/src/main/java/com/pda/project/organization/api/OrganizationController.java) ve [ProjectApiErrorHandler](../../backend/src/main/java/com/pda/project/api/ProjectApiErrorHandler.java) REST, DTO validation ve güvenli `ProblemDetail` yanıtlarını sağlar. [SecurityBaselineConfiguration](../../backend/src/main/java/com/pda/auth/infrastructure/config/SecurityBaselineConfiguration.java) için kullanıcı onayıyla bu yollar authenticated allowlist ve CORS kapsamına alındı; CSRF korunur, diğer yollar deny-all kalır.
- Push öncesi kalite kapısının frontend tip kontrolü için [RootLayout](../../frontend/src/app/layout.tsx) `children` tipini doğrudan `ReactNode` olarak tanımlar. Runtime smoke test için yalnız `GET /actuator/health` public allowlist'e eklendi; diğer actuator yolları açılmadı.
- `.agents/architecture.md` ve `.agents/folder-structure.md` kısa mevcut durum haritası güncellendi. `.env`, `.env.example`, `pom.xml` ve `alper.md` değiştirilmedi.

## Doğrulama

| Komut / kontrol | Sonuç |
| --- | --- |
| `mvn -q '-Dtest=ProjectApiIntegrationTest' test` | PostgreSQL Testcontainers üzerinde 3 API entegrasyon testi geçti: cookie/CSRF, ilk manager, cross-project, Organization owner, CORS, Swagger, archive |
| `mvn -q clean test` | 52 test geçti; Auth/User regresyonu, Project/Organization domain/repository/API ve `ModularityTest` dahil; hata/atlanan test yok |
| `git diff --check` | Temiz |

API testleri gerçek PostgreSQL üzerinde Flyway V1–V4, V21–V22 sırasını ve Hibernate `validate` ile başlatmayı da doğruladı. Yerel uzun ömürlü veritabanına migration uygulanmadı.

## API sözleşmesi

Aşağıdaki Project/Organization yolları `/api/v1` altındadır ve geçerli HttpOnly access cookie gerektirir. Yazma işlemleri ayrıca `XSRF-TOKEN` cookie ile aynı değerli `X-XSRF-TOKEN` header ister. Kimlik gerektirmeyen isteğe security filter `403`, yetkisiz proje/Organization erişimine `403`, olmayan veya archive edilmiş kayda `404`, geçersiz body/query için `400`, benzersiz veri çakışmasına `409` beklenir. Hatalar güvenli `application/problem+json` biçimindedir. `GET /actuator/health` bu prefix dışında public sağlık kontrolüdür.

| Yöntem / yol | Erişim | İstek ve güvenli örnek | Başarı |
| --- | --- | --- | --- |
| `POST /projects` | Authenticated; creator ilk manager olur. Organization seçilirse owner olmalı | `{"name":"Demo Proje","description":"Örnek","organizationId":null}` | `201`, `Location` ve Project JSON (`id`, `slug`, `status: PLANNING`, `visibility: PRIVATE` vb.) |
| `GET /projects?page=0&size=20` | Yalnız üye olunan aktif projeler | `page` ≥ 0, `size` 1–100 | `200`, `content`, `page`, `size`, `totalElements`, `totalPages` |
| `GET /projects/{projectId}` | Project üyesi | Örnek ID: `11111111-1111-4111-8111-111111111111` | `200`, Project JSON |
| `GET /projects/by-slug/{slug}` | Project üyesi | Örnek slug: `demo-proje-1234abcd` | `200`, Project JSON |
| `PUT /projects/{projectId}` | `PROJECT_MANAGER`; hedef Organization varsa owner | `{"name":"Demo Proje 2","description":"Örnek","priority":"HIGH","startDate":"2026-10-01","targetEndDate":"2026-10-31","projectGoal":"Demo","techStack":"Java","organizationId":null}` | `200`, güncel Project JSON |
| `POST /projects/{projectId}/archive` | `PROJECT_MANAGER` | Body yok | `204`; liste/detaydan çıkar, hard delete yok |
| `POST /organizations` | Authenticated; creator owner olur | `{"name":"Demo Organizasyon","description":"Örnek"}` | `201`, `Location` ve Organization JSON (`id`, `slug`, `ownerUserId`, `status: ACTIVE` vb.) |
| `GET /organizations?page=0&size=20` | Yalnız owner olunan aktif Organization'lar | `page` ≥ 0, `size` 1–100 | `200`, sayfalı Organization listesi |
| `GET /organizations/{organizationId}` | Owner | Örnek ID: `11111111-1111-4111-8111-111111111111` | `200`, Organization JSON |
| `GET /organizations/{organizationId}/projects?page=0&size=20` | Authenticated; yalnız üye olunan projeler | `page` ≥ 0, `size` 1–100 | `200`, sayfalı Project listesi |
| `PUT /organizations/{organizationId}` | Owner | `{"name":"Demo Organizasyon 2","description":"Güncel"}` | `200`, güncel Organization JSON |
| `POST /organizations/{organizationId}/archive` | Owner | Body yok | `204`; aktif Organization listesi/detayından çıkar |
| `GET /actuator/health` | Public; yalnız sağlık durumu | Body/query yok | `200`, Spring Actuator sağlık JSON'u |

`DELETE` endpoint'i yoktur ve security allowlist dışında kalır. Project `status` geçişi, üyelik yönetimi ve diğer roller sonraki fazlardadır. Update body tam alanları taşır; `organizationId: null` ilişkiyi kaldırır.

## Açık konular

- `PROJECT_MANAGER` şu an [ProjectRole](../../backend/src/main/java/com/pda/project/domain/enums/ProjectRole.java) içindeki kullanıcı onaylı geçici tanımdır. Alper'in canonical Auth rol sözleşmesi geldiğinde enum ve V22 rol kısıtı sonraki migration ile uyarlanmalı; V22 uygulanmışsa geriye dönük düzenlenmemelidir.
- Auth tarafında şu an V1–V4 bulunuyor. V21/V22 uzun ömürlü bir veritabanına uygulandıktan sonra Alper'in V5–V20 migration'larını eklemek Flyway sırası açısından koordinasyon gerektirir. Yeni ortak veritabanına V21 uygulanmadan önce düşük numaralı Auth migration'larının durumu kontrol edilmelidir.
- Faz 2'nin üyelik listeleme/değiştirme/son yöneticiyi koruma işleri henüz tamamlanmadı. Organization archive, bağlı Project'leri otomatik archive etmez; mevcut Project üyeleri Project endpoint'inden erişebilir.

## Kullanıcı kontrolü

1. Docker Desktop açıkken `backend/` içinde `mvn -q clean test` çalıştırın; 52 testin hatasız geçmesini bekleyin.
2. Geliştirme ortamında `API_DOCS_ENABLED=true` iken `/swagger-ui.html` açın. `/api/v1/auth/csrf` çağrısıyla CSRF cookie alın, giriş yapın, sonra aynı CSRF değerini `X-XSRF-TOKEN` header'ına koyarak Swagger'dan create/update/archive yollarını deneyin. Gerçek cookie, JWT veya parola değerlerini paylaşmayın.
3. Bir Project oluşturun; yanıtta `201` ve `Location` bekleyin. Başka kullanıcıyla aynı Project detayına `403`, proje listesinde boş sonuç; ilk kullanıcıyla güncelleme ve archive için sırasıyla `200` ve `204` bekleyin.
4. Organization owner hesabıyla Organization ve altında Project oluşturun. Owner dışı hesabın Organization güncelleme/archive isteğine `403`, Organization proje listesinde üyeliği yoksa boş içerik bekleyin.
5. Ortak veritabanına migration çalıştırmadan önce Alper ile V5–V20 sıralamasını kararlaştırın.
