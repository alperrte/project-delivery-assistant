# HMZ-PROJ-01 — Project domain ve persistence

**Tamamlanma tarihi:** 2026-09-27
**Durum:** HMZ-PROJ-01 kapsamı tamamlandı. FAZ 1 tamamlanmadı; üretim şeması ve uygulama taraması sonraki işlerde gerekli.

## Kapsam ve yapılanlar

- [Project.java](../../backend/src/main/java/com/pda/project/domain/entity/Project.java) içinde UUID kimlik, ad, benzersiz slug, açıklama, durum, öncelik, tarihler, hedef, tech stack, opsiyonel organization kimliği, private visibility, creator kimliği ve audit/archive zamanları modellendi. V1 tech stack alanı sınırlı uzunlukta serbest metindir.
- [ProjectStatus.java](../../backend/src/main/java/com/pda/project/domain/enums/ProjectStatus.java), [ProjectPriority.java](../../backend/src/main/java/com/pda/project/domain/enums/ProjectPriority.java) ve [ProjectVisibility.java](../../backend/src/main/java/com/pda/project/domain/enums/ProjectVisibility.java) eklendi.
- [ProjectRepository.java](../../backend/src/main/java/com/pda/project/infrastructure/repository/ProjectRepository.java) benzersiz slug kontrolü ile archive edilmiş projeleri normal liste/detay sorgularından ayırır. Veritabanı unique constraint'i eşzamanlı slug çakışmasını da yakalar.
- Alan doğrulaması, tarih sırası ve archive sonrası değişiklik yasağı için [ProjectDomainTest.java](../../backend/src/test/java/com/pda/project/application/ProjectDomainTest.java); gerçek PostgreSQL üzerinde unique slug, archive filtresi ve metadata round-trip için [ProjectRepositoryTest.java](../../backend/src/test/java/com/pda/project/repository/ProjectRepositoryTest.java) eklendi. İlk task anında geçici bir test uygulaması JPA taramasını sağlıyordu; Faz 1 sonunda kaldırılarak ana `BackendApplication` kullanıldı.

## Migration, yapılandırma ve sözleşmeler

- **Migration:** Bu taskta eklenmedi. Project/Organization Flyway migration'ı HMZ-PROJ-03 kapsamında `V21`–`V40` aralığında yazılacak. Repository testleri geçici PostgreSQL konteynerinde yalnız test için `create-drop` kullanır; production `ddl-auto=validate` ayarı değiştirilmedi.
- **ENV/dependency:** Yeni değişken veya dependency yok; `.env`, `.env.example` ve `pom.xml` değiştirilmedi.
- **API/Swagger:** Endpoint eklenmedi; HTTP method, kimlik ve rol gereksinimi bu task için yok.
- **Cross-module:** Auth/User entity veya repository'sine erişim yok; `createdBy` ve `organizationId` UUID olarak saklanır. Work Service, GitHub ve mail entegrasyonu yok.
- **Güvenlik:** Kullanıcı girdisi SQL'e birleştirilmez. Repository Spring Data JPA kullanır. Yetkilendirme katmanı bu taskın kapsamı değildir; dışarı açık endpoint açılmadı.

## Doğrulama

| Komut | Sonuç |
| --- | --- |
| `mvn -Dtest=ProjectDomainTest test` | 3 test geçti |
| `mvn -q -Dtest=ProjectRepositoryTest test` | PostgreSQL Testcontainers üzerinde 3 test geçti |
| `git diff --check` | Temiz |

## Açık konular ve sonraki task handoff'u

- Production veritabanında `projects` tablosu henüz yok. HMZ-PROJ-03 migration'ı yazılıp `ddl-auto=validate` ile sınanmadan uygulama çalışır kabul edilmemeli.
- Ana `BackendApplication` sınıfı `com.pda.backend` paketinde olduğu için `com.pda.project` kardeş paketini taramıyor. Ortak, yüksek çakışma riskli bu yapılandırma değişikliği ayrı rapor/onay sonrasında yapılmalı.
- Creator'ın ilk `PROJECT_MANAGER` üyeliği HMZ-PROJ-07; authorization ve API sonraki tasklardadır. HMZ-PROJ-02 Organization modeline geçilebilir, fakat FAZ 1 gate için migration ve API testleri gerekir.
- `V21` uygulanmadan önce gerekli düşük numaralı Auth migration'larının mevcut ve uygulanmış olduğu doğrulanmalı.

## Kullanıcı kontrolü

1. Project entity ve repository alanlarının HMZ-PROJ-01 kapsamıyla eşleştiğini inceleyin.
2. Yukarıdaki iki test komutunu Docker Desktop çalışırken `backend/` dizininde çalıştırın; 3 + 3 testin geçmesini bekleyin.
3. `backend/src/main/resources/db/migration/` içinde henüz Project SQL'i olmadığını ve bunun HMZ-PROJ-03'e bırakıldığını doğrulayın.

**Sonraki durum notu:** Aynı gün Alper'in teslimi uygulama sınıfını `com.pda` köküne taşıdı. HMZ-PROJ-03 çalışmasında `V21__project_organization_initial.sql` eklendi ve repository testleri Flyway ile `ddl-auto=validate` kullanacak şekilde güncellendi. Yukarıdaki ilk teslim doğrulaması HMZ-PROJ-01 tamamlandığı andaki sonuçtur.

**Faz 1 son durumu:** Bu kaydın geçici test uygulaması referansı ve açık konu maddeleri ilk task anını anlatır; geçici test uygulaması kaldırıldı. Güncel uygulama, migration, API ve test durumu için [Faz 1 teslim kaydını](2026-09-27-hmz-proj-faz-1.md) esas alın.
