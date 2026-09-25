# ADR 0002: PostgreSQL ve Flyway

- Durum: Kabul edildi (teknik plan)
- Tarih: 2026-09-25

## Bağlam

PDA'nın proje, üyelik, görev ve atama verileri ilişkisel bütünlük gerektirir. Açık kaynak kullanıcıların yerelde kolay çalıştırabilmesi ve production'da yönetilen bir seçenek kullanabilmesi beklenir.

## Karar

Veritabanı motoru PostgreSQL'dir. Local development Docker PostgreSQL kullanır. Production için varsayılan yönetilen sağlayıcı Neon'dur; uygulamanın çekirdek davranışı Neon'a özel SDK/API'ye bağımlı olmayacaktır. Erişim Spring Data JPA/Hibernate ve HikariCP üzerinden yapılır. Şema evrimini Flyway yönetir; production Hibernate şema değişikliği yapmaz ve `ddl-auto=validate` kullanır.

Çok adımlı işlemlerin transaction sınırı application/service use-case katmanındadır. Open Session in View kapalıdır. İlişkiler varsayılan olarak LAZY kullanılır; ihtiyaç duyulan fetch açık sorguyla belirlenir.

## Sonuçlar

- Yerel ve production ortamları aynı SQL motorunu kullanır; Testcontainers PostgreSQL entegrasyon testlerini destekler.
- Her şema değişikliği sıralı, açıklayıcı Flyway migration'ı ve ilgili testlerle gelir.
- `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` secret olarak sağlanır; en az yetki uygulanır.
- Production backup/restore düzeni deployment kararıyla birlikte netleştirilecektir.

İlgili belgeler: [database.md](../database.md), [er-diagram.md](../er-diagram.md), [deployment.md](../deployment.md).
