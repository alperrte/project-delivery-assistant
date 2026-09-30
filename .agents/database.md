# Veritabanı ve kalıcılık

## V32 Teams ve davet değişikliği

`V32__project_teams_and_registered_invitations.sql`, mevcut `squads` tablosuna `parent_squad_id` ve `is_general` ekler; proje başına tek General Team'i ve aynı proje içinde ebeveyni DB kısıtlarıyla korur. Mevcut her projeye General Team ekler, mevcut ekipleri onun altına taşır. `squad_members.user_id`, aktif üyelikle eşleştirilip `project_membership_id` FK'sine dönüştürülür; aktif üyeliği olmayan eski eşleşmeler silinir. General üyeliği ayrı satır olarak tutulmaz. Davetlere en çok 500 karakterlik `rejection_message` ve alıcı listeleme indeksi eklenir. Yeni davetler yalnız kayıtlı kullanıcıyı hedefler; tarihsel e-posta davetleri veri kaybı olmadan kalır fakat kayıtlı hedefi olmayan eski davet yeniden gönderilemez.

> Durum: teknik plan kararı. Fiziksel tablo/kolon adları ve ayrıntılı kısıtlar migration yazılırken belirlenir.

## Altyapı

PDA'nın veritabanı PostgreSQL'dir. Local development için Docker PostgreSQL kullanılır; production için varsayılan yönetilen PostgreSQL sağlayıcısı Neon'dur. Uygulama standart PostgreSQL/JDBC üzerinden çalışmalı, temel davranış için Neon'a özel SDK veya API istememelidir. Bağlantı bilgileri `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` ile verilir ve Git'e eklenmez.

Spring Data JPA + Hibernate persistence katmanıdır. HikariCP bağlantı havuzudur. Çok adımlı iş operasyonlarının `@Transactional` sınırı application/service use-case katmanında kurulur. `spring.jpa.open-in-view=false` kullanılır. İlişkiler, sorgu açıkça başka davranış gerektirmedikçe LAZY olmalıdır; gerekli veri seçili sorgularla alınmalıdır.

## Şema değişiklikleri

Şema evrimini Flyway yönetir. Production'da Hibernate ile otomatik `create`/`update` yapılmaz; hedef `ddl-auto=validate` değeridir. Migration'lar sıralı ve açıklayıcı adlandırılır:

```text
V1__initial_schema.sql
V2__add_project_membership.sql
V3__add_task_assignment.sql
```

Migration değişikliğiyle birlikte ilgili repository ve Testcontainers PostgreSQL testleri eklenir. Index'ler gerçek sorgu ve migration ihtiyacına göre seçilir; ölçülmemiş cache katmanı eklenmez.

## V1 domain kavramları

Task fiziksel şeması V28–V30 migration'larıyla uygulanmıştır: `tasks`, `project_task_counters`, `task_assignments`, `task_status_history`. Proje/User çapraz modül referansları Task Java modelinde scalar UUID'dir; Task key PostgreSQL atomic upsert ile proje bazında üretilir. `tasks.version` optimistic locking sağlar; atama seti task row lock altında değiştirilir. Üyelik doğrulaması Project public contract'ı üzerinden yapılır.

Notification fiziksel şeması V31 migration'ındaki `notifications` tablosudur. Kullanıcı referansı FK, actor/project/resource referansları modül sınırını koruyan scalar UUID'dir. Kullanıcı+tarih sıralaması için birleşik index ve okunmamış liste için kısmi index vardır.

Plan `User`, `Project`, `ProjectMembership`, `Squad`, `Task`, `TaskAssignment`, `Issue`, `TestReport` ve `Comment` kavramlarını tanımlar. Kalıcı uygulama içi bildirimler için ayrı `Notification` modülü bulunur. Uygulanmış modüllerin fiziksel şeması migration'larda belirlenmiştir; kalan kavramların alanları ve lifecycle kuralları ilgili fazda kesinleşir. Kavramsal ilişki çizimi: [er-diagram.md](er-diagram.md).

`TaskAssignment` ayrı modeldir: bir task birden çok kullanıcıya atanabilir, sabit assignee üst sınırı yoktur. Aynı `(task_id, user_id)` çifti tekrar edemez. Atanan kullanıcı ilgili projenin üyesi olmalıdır. `assigned_by` ve `assigned_at` izlenebilirlik için tutulur. Üyelik kuralı yalnız veritabanı ilişkisinden çıkarılmamalı; use-case seviyesinde doğrulanmalıdır.

Modüller birbirinin repository implementasyonunu doğrudan kullanmaz. Başka modülün persistence entity'si ortak uygulama modeli yapılmaz; senkron ihtiyaçta hedef modülün public API/contract facade'ı kullanılır.

İlgili kararlar: [0001](decisions/0001-modular-monolith.md), [0002](decisions/0002-postgresql.md).
