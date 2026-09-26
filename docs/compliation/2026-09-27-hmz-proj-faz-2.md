# HMZ-PROJ FAZ 2 — ProjectMembership ve rol yönetimi

**Tamamlanma tarihi:** 2026-09-27
**Durum:** HMZ-PROJ-06–11 kapsamı ve Faz 2 backend authorization gate tamamlandı.

## Kapsam ve önemli dosyalar

- [ProjectMembership](../../backend/src/main/java/com/pda/project/domain/entity/ProjectMembership.java) aktif/çıkarılmış durumunu, `joinedAt` ve `removedAt` zamanlarını ve birden çok proje rolünü tutar. Aynı `(project_id, user_id)` çifti tek üyelik kaydıdır. Çıkarılan üyelik yeniden etkinleştirilebilir.
- [V23 migration](../../backend/src/main/resources/db/migration/V23__project_membership_lifecycle_roles.sql), V22 üyeliklerine `ACTIVE` durumunu atar ve geçici rol kümesini genişletir. V22 verisiyle upgrade testi mevcut manager rolünün korunduğunu doğrular. [ProjectRole](../../backend/src/main/java/com/pda/project/domain/enums/ProjectRole.java) içindeki dokuz rol, Alper'in canonical Auth project-role contract'ı gelene kadar kullanıcı onaylı geçici tanımdır.
- [ProjectMembershipService](../../backend/src/main/java/com/pda/project/application/service/ProjectMembershipService.java) aktif kullanıcıyı User modülünün public `UserAccounts` sözleşmesinden doğrular; Project Manager için role add/replace/remove ve üyelikten çıkarma işlemlerini yapar. Son manager değişikliği, proje satırı transaction içinde kilitlenerek eşzamanlı isteklere karşı korunur. Moderator ve contributor bu işlemleri yapamaz.
- [ProjectMembershipController](../../backend/src/main/java/com/pda/project/api/ProjectMembershipController.java) üye listeleme/detay, rol ve çıkarma API'lerini sunar. [SecurityBaselineConfiguration](../../backend/src/main/java/com/pda/auth/infrastructure/config/SecurityBaselineConfiguration.java) yalnız bu method/yolları authenticated allowlist'e ve `DELETE` CORS yöntemine ekler; yazma işlemlerinde CSRF devam eder. [ProjectApiErrorHandler](../../backend/src/main/java/com/pda/project/api/ProjectApiErrorHandler.java) son yönetici/üyelik çatışmasına güvenli `409 ProblemDetail` döndürür.
- [ProjectAccess](../../backend/src/main/java/com/pda/project/ProjectAccess.java) diğer modüllere `isMember`, `rolesForUserInProject`, `canAccessProject` okuma sözleşmesini açar. Archive edilmiş projeler ve çıkarılmış üyeler erişim alamaz. Rol kodları Auth sözleşmesine geçişe kadar string olarak döner.
- `.agents/architecture.md` ve `.agents/folder-structure.md` kısa özetleri güncellendi. `.env`, `.env.example`, `pom.xml` ve `alper.md` değiştirilmedi.

## Doğrulama

| Komut / kontrol | Sonuç |
| --- | --- |
| `mvn -q '-Dtest=ProjectApiIntegrationTest' test` | PostgreSQL üzerinde manager/moderator/contributor izinleri, rol değiştirme, çıkarma/yeniden etkinleştirme, cross-project ve eşzamanlı son manager koruması geçti |
| `mvn -q '-Dtest=ProjectMembershipMigrationTest' test` | V22 verisinden V23'e upgrade; mevcut manager kaydı korundu |
| `mvn -q clean test` | 56 test geçti; Auth/User regresyonu ve `ModularityTest` dahil, hata/atlanan test yok |
| `git diff --check` | Temiz |

## API sözleşmesi

Tüm yollar `/api/v1/projects/{projectId}` altındadır. Geçerli HttpOnly access cookie gerektirirler. POST/PUT/DELETE istekleri ayrıca `XSRF-TOKEN` cookie ile eşleşen `X-XSRF-TOKEN` header ister. Örnek ID olarak `11111111-1111-4111-8111-111111111111` kullanılabilir; bu değer gerçek kayda karşılık gelmez.

| Yöntem / yol (prefix sonrası) | Kimlik ve rol/kapsam | İstek / güvenli örnek | Başarı |
| --- | --- | --- | --- |
| `GET /members?page=0&size=20` | Proje üyesi | `page` ≥ 0, `size` 1–100 | `200`, `content`, `page`, `size`, `totalElements`, `totalPages`; her üyede `userId`, `roles`, `joinedAt` |
| `GET /members/{userId}` | Proje üyesi | `userId`: örnek UUID | `200`, üye özeti |
| `POST /members/{userId}/roles` | `PROJECT_MANAGER` | `{"role":"MODERATOR"}` | `200`, güncel üye özeti |
| `PUT /members/{userId}/roles` | `PROJECT_MANAGER` | `{"roles":["BACKEND_DEVELOPER","TESTER"]}` | `200`, yeni rol kümesiyle üye özeti |
| `DELETE /members/{userId}/roles/{role}` | `PROJECT_MANAGER` | Örnek `role`: `TESTER`; body yok | `200`, kalan rollerle üye özeti |
| `DELETE /members/{userId}` | `PROJECT_MANAGER` | Body yok | `204`, üyelik `REMOVED` olur; Project erişimi kapanır |

`403`: proje dışı kullanıcı, moderator/contributor yönetim girişimi veya geçersiz CSRF. `404`: aktif proje/üyelik yok. `400`: bilinmeyen rol, boş rol kümesi, son tek rolü kaldırma veya geçersiz sayfalama. `409`: son Project Manager'ın rolünü/üyeliğini kaldırma. Bütün uygulama hataları güvenli `ProblemDetail` yanıtıdır. Rol seti bir üyede boş bırakılamaz.

Doğrudan `POST /members` yoktur. Yeni üye ekleme service use-case'i iç kullanıma hazırdır; kullanıcıyı projeye davet ederek dahil etme HTTP akışı Faz 3 kapsamındadır. İlk Project Manager üyeliği Project create ile otomatik yaratılmaya devam eder.

## Açık konular

- Auth canonical project-role contract'ı henüz kodda yoktur. Geldiğinde geçici `ProjectRole`, public rol çıktısı ve V23 veritabanı kısıtı uyarlanmalıdır; uygulanmış migration değiştirilmemeli, yeni migration yazılmalıdır.
- Üyelik daveti/kabulü, kullanıcı arama ve e-posta akışı Faz 3'tedir. Mevcut üyelik API'si yalnız önceden oluşturulmuş üyeleri yönetir.
- V21/V22'nin Auth V5–V20 öncesi uygulanmasıyla ilgili Flyway sıralama koordinasyonu sürer. Ortak veritabanı stratejisi Alper ile netleşmelidir.

## Kullanıcı kontrolü

1. Docker Desktop açıkken `backend/` altında `mvn -q clean test` çalıştırın; 56 testin hatasız geçmesini bekleyin.
2. `API_DOCS_ENABLED=true` ile `/swagger-ui.html` açın. Auth girişini ve `/api/v1/auth/csrf` çağrısını tamamladıktan sonra yazma isteklerinde `X-XSRF-TOKEN` header'ını kullanın. Gerçek parola, token veya cookie değerlerini paylaşmayın.
3. Bir Project oluşturun; ilk kullanıcı `PROJECT_MANAGER` olarak üye listesinde görünmeli. Son yöneticinin kendi rolünü veya üyeliğini kaldırma isteği `409` dönmeli.
4. Mevcut bir ikinci üyeyi manager/moderator/contributor rolüyle hazırladığınız test veritabanında, moderator/contributor ile listeleme `200`, rol değiştirme `403` bekleyin. İkinci manager atandıktan sonra ilk manager'ın downgrade/çıkarma işlemi mümkün olmalı; projede en az bir manager kalmalı.
5. Bir üyeyi çıkardıktan sonra Project detayına erişiminin `403`, proje listesinin boş ve üyelik durumunun `REMOVED` olduğunu doğrulayın.
