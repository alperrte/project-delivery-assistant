# Veritabanı ve kalıcılık

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

Plan `User`, `Project`, `ProjectMembership`, `Squad`, `Task`, `TaskAssignment`, `Issue`, `TestReport` ve `Comment` kavramlarını tanımlar. Kalıcı uygulama içi bildirimler için ayrı `Notification` modülü bulunur. Bunların fiziksel alanları, foreign key'leri ve lifecycle kuralları henüz kesinleştirilmemiştir. Kavramsal ilişki çizimi: [er-diagram.md](er-diagram.md).

`TaskAssignment` ayrı modeldir: bir task birden çok kullanıcıya atanabilir, sabit assignee üst sınırı yoktur. Aynı `(task_id, user_id)` çifti tekrar edemez. Atanan kullanıcı ilgili projenin üyesi olmalıdır. `assigned_by` ve `assigned_at` izlenebilirlik için tutulur. Üyelik kuralı yalnız veritabanı ilişkisinden çıkarılmamalı; use-case seviyesinde doğrulanmalıdır.

Modüller birbirinin repository implementasyonunu doğrudan kullanmaz. Başka modülün persistence entity'si ortak uygulama modeli yapılmaz; senkron ihtiyaçta hedef modülün public API/contract facade'ı kullanılır.

İlgili kararlar: [0001](decisions/0001-modular-monolith.md), [0002](decisions/0002-postgresql.md).
