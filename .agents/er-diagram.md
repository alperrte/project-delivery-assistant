# Kavramsal ER diyagramı

> Bu çizim teknik plandaki V1 kavramlarını gösterir; uygulanmış SQL şeması değildir. `id` tipleri, fiziksel tablo/kolon adları ve aşağıda belirtilmeyen kardinaliteler feature planları ve Flyway migration'larıyla kesinleşecektir.

```mermaid
erDiagram
    USER ||--o{ PROJECT_MEMBERSHIP : "projeye katılır"
    PROJECT ||--o{ PROJECT_MEMBERSHIP : "üyeleri vardır"
    PROJECT ||--o{ SQUAD : "squad içerir"
    PROJECT ||--o{ TASK : "işleri vardır"
    TASK ||--o{ TASK_ASSIGNMENT : "atanır"
    USER ||--o{ TASK_ASSIGNMENT : "assignee olur"

    USER {
        string identity "tip ve kolon adı TBD"
    }
    PROJECT {
        string identity "tip ve kolon adı TBD"
    }
    PROJECT_MEMBERSHIP {
        string project_roles "birden fazla rol olabilir; saklama modeli TBD"
    }
    SQUAD {
        string membership_model "üye ilişkisi TBD"
    }
    TASK {
        string status "değerler TBD"
        string priority "değerler TBD"
    }
    TASK_ASSIGNMENT {
        string task_id "kavramsal ilişki"
        string user_id "kavramsal ilişki"
        string assigned_by "izlenebilirlik"
        datetime assigned_at "izlenebilirlik"
    }
```

`TaskAssignment` için `(task_id, user_id)` benzersizdir. Bir task'ın bir veya çok assignee'si olabilir; V1'de sabit üst limit yoktur. Atanan kullanıcı task'ın projesinin üyesi olmalıdır. Bu son kural application/service katmanında doğrulanır.

## Diğer V1 kavramları

| Kavram | Planın belirlediği amaç | Açık kalan ilişki |
| --- | --- | --- |
| `Issue` | Proje/task problemi veya blocker takibi | Projeye ve/veya task'a bağlama biçimi |
| `TestReport` | Tamamlanan iş için tester geri bildirimi | Task/tester bağları ve sonuç şeması |
| `Comment` | İlgili iş öğelerinde tartışma/not | Hedef öğe modeli |
| `Notification` | Kalıcı uygulama içi bildirim ve okunma durumu | Üretici event, alıcı ve fiziksel şema |
| `Squad` | Proje içi grup ve üye yönetimi | Üyelik tablosu/kardinalite |
| `ProjectMembership` | Kullanıcı ve projeyi proje rolleriyle bağlama | Çoklu rolün fiziksel saklama modeli |

Bu ilişkiler netleşmeden foreign key veya polymorphic ilişki tasarımı sabitlenmemelidir. Fiziksel şema için [database.md](database.md) ve ilgili Flyway migration'ları esas alınır.
