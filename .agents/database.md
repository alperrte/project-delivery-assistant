# Veritabanı ve kalıcılık

## Invitations remediation — 2026-10-06

Migration/entity/cardinality değişmedi. Existing physical PENDING+past expiry target row mutation sırasında pessimistic lock ile EXPIRED yapılıp flush edilir; unique partial index bypass/drop edilmez. Reads effective expiry representation/filter kullanır, GET DB state mutation yapmaz. Resend expired row retained EXPIRED ve new pending row; expired cancel acknowledges204 without membership grant. PostgreSQL barrier iki create'i aynı expired row üzerinde bekletti; yalnız biri yeni pending commit etti, other conflict. Current module model/roles/team membership transaction unchanged.

## V52 Organization profili ve media ledger (2026-10-04)

### V53 — Organization notes (2026-10-05)

Referans UI sonrasında kullanıcının kararıyla nullable `organizations.notes VARCHAR(1000)` eklenir. Description'dan bağımsız, opsiyonel düz metindir; create/edit DTO, domain ve istemci 1000 UTF-16 karakter sınırını uygular, boş/whitespace null olur. V52 değiştirilmez; eski profil/veri korunur. Notes da mevcut organization owner kapsamındadır.


`organizations`: nullable `website` (2048), `contact_email` (254), `location` (200), `logo_key` ve `cover_image_key` (36). Eski kayıtlar null alanlarla çalışır; eski migration değiştirilmez. Organization'a ait BYTEA kolon bulunmadığından binary taşıma/backfill yoktur. Project/User kolonları korunur.

`organization_media_objects`: UUID object key, organization FK, LOGO/COVER kind, doğrulanmış MIME, byte size, PENDING/ACTIVE/DELETE_PENDING state, created_at ve lease_until. DB sadece metadata tutar. Referans değişikliği owner/active organization row lock altında yapılır; silme hatası ledger'da kalır, 60 saniyelik cleanup tekrar dener; pending lease 5 dakikadır. Archive referansları retention için korur fakat API bunları sunmaz. Kurtarma için PostgreSQL ve media volume aynı tutarlı backup setinde saklanmalıdır.

## V50 Şifre sıfırlama toplam deneme penceresi (2026-10-03)

`V50__password_reset_failure_window.sql`, `password_reset_challenges` tablosuna `window_failures` (INT, varsayılan 0, CHECK >= 0) ve `failure_window_started_at` (TIMESTAMPTZ, NULL olabilir) ekler. Yeni kod istemek kod başına 5 deneme sayacını sıfırlıyordu; bu iki sütun yanlış tahminleri hesabın tüm kodları boyunca bir saatlik pencerede sayar, penceredeki 5. yanlış tahminden sonra pencere bitene kadar sıfırlama bloklanır. Yalnız ekleme yapar, mevcut satırlar 0 ile başlar.

## V49 Profil fotoğrafı (2026-10-02)

`V49__user_profile_photos.sql`, `users.profile_photo_updated_at` (NULL = fotoğraf yok; API'de `profilePhotoVersion` olarak epoch milisaniye) ve baytları ayıran `user_profile_photos` tablosunu ekler: `user_id` PK (`users` FK, `ON DELETE CASCADE`), `content_type` (`image/png|jpeg|webp` CHECK), `data BYTEA`, `size_bytes` (1–5242880 CHECK), `updated_at`. Kullanıcı başına tek satır tutulur; değiştirmek aynı satırın üzerine yazar, yani sahipsiz bayt kalmaz. Yapı `project_logos` ve `project_banners` ile aynıdır; kullanıcı ve üye listeleri baytlara dokunmaz. Yalnız ekleme yapar, mevcut tablo/veriyi değiştirmez. Görev ekleri silindiğinde artık `task_attachment_data` satırı da silinir (kayıt geçmiş olarak kalır).

## V48 Kullanıcı tercihleri (2026-10-02)

`V48__user_preferences.sql`, `user_preferences` tablosunu ekler: `user_id` PK (`users` FK, `ON DELETE CASCADE`), `locale` (`tr|en|de`), `theme` (`system|light|dark`), `motion` (`system|on|off`), `theme_transition` (boolean) ve `updated_at`. Sütunlar CHECK ile sınırlıdır ve NULL "hiç kaydedilmedi" demektir. Yalnız ekleme yapar, mevcut hiçbir tabloya dokunmaz.

## V47 Proje banner'ı (2026-10-02)

`V47__project_banners.sql`, `projects.banner_updated_at` (NULL = banner yok; API'de `bannerVersion` olarak epoch milisaniye) ve baytları ayıran `project_banners` tablosunu ekler: `project_id` PK (`projects` FK, `ON DELETE CASCADE`), `content_type` (`image/png|jpeg|webp` CHECK), `data BYTEA`, `size_bytes` (1–2097152 CHECK), `updated_at`. Yapı `project_logos` ile aynıdır; liste sorguları baytlara dokunmaz. Yalnız ekleme yapar, mevcut tablo/veriyi değiştirmez.

## V37–V46 Task genişletmesi (2026-10-02)

- `V37__task_deadline.sql`: `tasks.deadline_at TIMESTAMPTZ` (mevcut `due_date` değerleri `Europe/Istanbul` 23:59 olarak taşınır, `due_date` ve `ck_tasks_dates` kalkar), `deadline_reminded_at`, `deadline_overdue_notified_at` ve açık görevler için kısmi `deadline_at` indeksi.
- `V38__task_pool.sql`: `pool_open`, `pool_team_id` (`squads` FK), `claimed_from_pool`; havuz kısmi indeksi. Havuz görevinin ataması boş olmalıdır, kuralı servis korur.
- `V39__task_subtasks_checklist.sql`: `parent_task_id` (tek seviye) ve `task_checklist_items`.
- `V40__task_comments_activity.sql`: `task_comments`, `task_comment_mentions`, `task_activities` (`task_status_history` backfill edilir, tablo kalır).
- `V41__task_labels_estimates.sql`: `project_labels` (proje içinde `lower(name)` benzersiz, renk sabit token), `task_labels`, `estimate_points` (CHECK 0,1,2,3,5,8,13,21), `time_estimate_minutes`.
- `V42__task_relations.sql`: `task_relations` (`BLOCKS|RELATES|DUPLICATES`, `(source,target,type)` benzersiz).
- `V43__task_watchers.sql`: `task_watchers` (PK `(task_id,user_id)`).
- `V44__task_attachments.sql`: `task_attachments` (meta + `sha256`) ve baytları ayıran `task_attachment_data` (`BYTEA`); liste sorguları baytlara dokunmaz.
- `V45__sprints.sql`: `sprints` (projede tek `ACTIVE` için kısmi unique indeks, `end_date >= start_date`, `version`) ve `tasks.sprint_id`.
- `V46__task_worklogs.sql`: `task_worklogs` (1–1440 dakika, soft delete).

Başka modüllere (kullanıcı, proje, ekip) giden referanslar Task Java modelinde scalar UUID'dir; üyelik ve ekip doğrulaması servis katmanında `ProjectAccess` ve `ProjectTeamDirectory` portuyla yapılır. Geri dönüş: yeni tablolar silinmemelidir; `due_date` dönüşümü tek yönlüdür (`deadline_at` UTC anıdır).

## V51 Proje mesajlaşması

`V51__project_chat.sql` üç tablo ekler. `chat_conversations`: `project_id` (`projects` FK), `type` (`PROJECT`|`DIRECT`), `direct_user_low`/`direct_user_high` (yalnız `DIRECT`), `created_at`, `last_message_at`. `CHECK` kısıtı `PROJECT` için iki kullanıcı alanının boş, `DIRECT` için ikisinin dolu ve `direct_user_low < direct_user_high` olmasını şart koşar: kullanıcı çifti kanonik sırada saklanır (Hamza↔Alper ile Alper↔Hamza aynı satırdır, kendiyle konuşma DB düzeyinde imkânsızdır; sıra PostgreSQL'in işaretsiz `uuid` sırasıdır, Java'daki `ChatConversation.compareLikePostgres` aynısını uygular). Kısmi benzersiz indeksler bir projede tek `PROJECT` grubunu (`uk_chat_conversations_project`) ve bir projede bir kullanıcı çifti için tek `DIRECT` konuşmayı (`uk_chat_conversations_direct`) garanti eder; eşzamanlı ilk kullanımda `INSERT ... ON CONFLICT DO NOTHING` ile tek satır kalır. `chat_messages`: `conversation_id` FK, `sender_user_id`, `content` (`TEXT`, `CHECK char_length BETWEEN 1 AND 2000`), `created_at`; bir mesaj tek satırdır (üye başına satır yok); `(conversation_id, created_at DESC, id DESC)` indeksi geçmiş imleci, son mesaj ve okunmamış sayımı için tek yoldur. `chat_read_states`: `(conversation_id, user_id)` birincil anahtar, `last_read_at`; okunmamış, başkasının `last_read_at`'ten yeni mesajlarıdır (proje grubunda ayrıca üyenin `joinedAt` değerinden yeni olması gerekir).

Grup üyeliği tabloda tutulmaz, `ProjectMembership`'ten türetilir; üye projeden çıkarılınca hiçbir satır silinmez (erişim her istekte kontrol edilir). Kullanıcı kimlikleri için FK yoktur (modül sınırı; hesaplar silinmez, yalnız durumu değişir). **Geriye uyumluluk.** V51 yalnız yeni tablolar ve indeksler ekler, tek bağımlılığı `projects(id)` FK'sıdır; V51 öncesi bir uygulama sürümü bu tabloları bilmez ve `ddl-auto=validate` yalnız eşlediği entity'leri denetlediği için çalışmaya devam eder. Geri dönüşte tabloları silmek gerekmez ve silinmemelidir.

## V35 Proje takvim anımsatıcıları

`V35__project_reminders.sql`, `project_reminders` tablosunu ekler: `project_id` (`projects` FK), `creator_user_id`, `title` (100), `description` (500, opsiyonel), `type`, `scope`, `reminder_date` (`DATE`), `reminder_time` (`TIME`, opsiyonel), `created_at`, `updated_at`. `type` ve `scope` değerleri `CHECK` ile sınırlıdır. Tarih ve saat kasıtlı olarak zaman dilimsiz `DATE`/`TIME` tutulur; böylece "3 Ekim" hiçbir dönüşümde 2 Ekim'e kaymaz. Takvim okumaları hep "tek proje + tarih aralığı" olduğundan tek indeks `(project_id, reminder_date)` yeterlidir; PERSONAL/PROJECT görünürlüğü bu dilim üzerinde ucuz bir filtredir.

**Geriye uyumluluk.** V35 yalnız yeni bir tablo ve indeks ekler; mevcut hiçbir tabloya, kolona veya veriye dokunmaz ve tek bağımlılığı `projects(id)` FK'sıdır. V35 öncesi bir uygulama sürümü bu tabloyu bilmez ve `ddl-auto=validate` yalnız eşlediği entity'leri denetlediği için çalışmaya devam eder; Flyway de daha yüksek uygulanmış sürümü varsayılan olarak yok sayar. Geri dönüşte tabloyu silmek gerekmez ve silinmemelidir: anımsatıcı verisi kalır, uygulama tekrar yükseltilince kaldığı yerden devam eder. Üye projeden çıkarılınca anımsatıcı satırları silinmez (ayrıntı `SECURITY.md` §11 "Project calendar reminders").

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

## V33 dış proje davetleri

`V33__external_project_invitations.sql` davetlere davet edilenin adını, soyadını ve en çok 100 karakterlik isteğe bağlı mesajı ekler; kullanıcı tablosuna da ad ve soyad ekler. Eski kullanıcı/davet kayıtları için bu alanlar nullable kalır. Bekleyen e-posta davetlerinde `(project_id, lower(email))`, kullanıcı e-postalarında `lower(email)` benzersiz indeksleri yinelenen kimlikleri engeller. Ham davet token'ı saklanmaz; `project_invitations.token_hash` kalır. Kabul akışı aynı transaction içinde kullanıcı ve proje üyeliğini oluşturur; General Team üyeliği aktif proje üyeliğinden türetilir.

`V35__teams_without_general.sql` `squads.updated_by` (backfill `created_by`) ve `project_invitations.team_id` ekler. Mevcut General Team'ler normal ekibe dönüşür: hiçbir özel ekipte olmayan aktif proje üyeleri ona `squad_members` satırı olarak yazılır (`added_by = projects.created_by`, `added_at = joined_at`), `ck_squads_general_root`, `uk_squads_general_per_project` ve `is_general` kaldırılır. Bekleyen eski davetler projelerinin eski General Team'ine bağlanır; `teamId` zorunluluğunu yeni davetlerde servis katmanı sağlar.

İlgili kararlar: [0001](decisions/0001-modular-monolith.md), [0002](decisions/0002-postgresql.md).


## V54 Basit / gelişmiş görev türleri (2026-10-05)

`V54__task_creation_modes.sql`: projects.task_management_mode nullable VARCHAR(16), CHECK SIMPLE/ADVANCED/BOTH; mevcut bütün projeler (arşivliler dahil) BOTH, yeni projeler ilk kurucu seçimine kadar null. tasks.creation_mode NOT NULL DEFAULT ADVANCED ve CHECK SIMPLE/ADVANCED; mevcut görevler ADVANCED. Aktif görevlerin (project_id,creation_mode) kısmi indeksi tür filtresini destekler.

task_watchers.manual_watch NOT NULL DEFAULT FALSE, otomatik bildirim takipçisi ile kullanıcının açık izleme tercihini ayırır. Eski köken bilinmediği için tarihsel satırlar TRUE backfill edilir. Yeni otomatik takip ON CONFLICT ile açık tercihi bozmaz; manuel watch upsert TRUE yapar. Yorum/otomatik takip basite dönüşü engellemez; açık izleme tercihi engeller.

Migration kayıt silmez; yorum/üyelik/ekler/ilişkiler/zaman ve arşiv bilgileri korunur. Tür kısıtları ve veri kaybı olmadan 53→54 upgrade PostgreSQL Testcontainers ile doğrulanır. Project politika exclusive kilidi Task'ın public ProjectAccess shared kilidiyle tutarlıdır; gelişmiş ilişkili veriler Task row lock ile dönüşüme karşı korunur. Project DynamicUpdate, başka metadata değişikliklerinin politikayı eski değere döndürmesini önler. Geri dönüşte kolonları veya verileri silmeyin; eski uygulama tür politikasını uygulamayacağından eski backend ile SIMPLE projelerini çalıştırmak davranışsal olarak güvenli rollback değildir.

## V55 ? Chat replies and reactions

Nullable scalar `chat_messages.reply_to_message_id`; `(reply_to_message_id, conversation_id)` composite FK, `UNIQUE(id,conversation_id)` ve self-reply CHECK ayn? konu?may? DB'de korur; non-null reply i?in partial index. `reaction_version` nonnegative BIGINT default0; content/time de?i?mez. `chat_message_reactions` scalar message/user UUID, alt?-code CHECK, timestamp; PK(message_id,user_id,emoji_code), message FK ON DELETE CASCADE. PK message prefix'i batch aggregation i?in yeterlidir; duplicate message veya gereksiz standalone user index yok. Row lock alt?nda insert/delete + version tek transaction; no-op art?rmaz. Version/count/mine tek SQL snapshot. V51/V54 de?i?medi; V54?V55 legacy round-trip, FK/PK/CHECK ve Hibernate validate ger?ek PostgreSQL testleriyle do?rulan?r.

## Organization–Project lifecycle integrity (2026-10-05)

No schema or migration change: V21 nullable organization_id FK, NO ACTION delete behavior and (organization_id,archived_at) index remain. Organization archive retains associations and projects stay active; project archive does not affect organization/siblings. New/changed association validation uses existing organization row lock throughout the write transaction, shared with owner archive synchronization. Same-ID co-manager metadata and null detach preserve their prior policy. PostgreSQL barrier and physical NULL/UUID round-trip tests verify integrity; organization page query count at 30/100 remains fixed.


## V56 Task status notification snapshots (2026-10-06)

V56__task_status_notification_snapshots.sql adds nullable notifications columns task_status_previous/task_status_current VARCHAR(20), task_key VARCHAR(125), task_title VARCHAR(160), actor_nickname VARCHAR(32). Existing read/unread records remain unchanged with null snapshots. A CHECK permits all-null legacy records or complete TASK_STATUS_CHANGED/TASK snapshots with valid status names; nickname is optional. No new task/project foreign key or index is necessary: existing recipient/time/unread indexes serve the unchanged API queries. Display data is captured at the committed change, so later task renames cannot rewrite notification history. PostgreSQL upgrade from V55, constraints and Hibernate schema validation are tested. Migration is additive; do not delete old notifications or edit prior migrations.

## Squad modernization persistence - 2026-10-06

V57 additive notification migration introduces source_event_id, bounded team-deletion scalar display snapshot and popup_presented_at. SQUAD_DELETED consistency CHECK, partial event/recipient unique dedup and oldest own unpresented/unread claim index; V56 task snapshot and older migrations unchanged. Claim atomic CTE UPDATE + SKIP LOCKED does not alter read/read_at. Notification DynamicUpdate prevents stale JPA read writes from reverting a concurrent presentation marker.

Team deletion reuses squads.archived_at; retains team/member rows and task/invitation FK history. Effective pending invitations finalize CANCELLED/EXPIRED under existing project-first locks. No hard delete/reopen/cascade or automatic General Team. Existing project row lock -> ordered team locks -> invitation row lock/revalidation. Prepared team-page statement count size30=11 and size100=11 on actual100-team/500-member fixture.

## Own nickname mutability - 2026-10-07

Existing users.nickname/uk_users_nickname reused; no schema or migration change. Own active User row lock, normalized validation/friendly duplicate precheck, save/flush named-constraint conflict409. Actual blocked unique-index race commits one actor only. Stale photo transaction reproduced undoing a committed rename; User DynamicUpdate now writes dirty fields only. Actual stale photo/password barriers preserve nickname, photo/password/session/roles; no new version column or auth workflow rewrite. Immutable notification/event display snapshots are not rewritten by profile rename.
## V58 Project permanent delete cascade (2026-10-07)

`V58__project_delete_cascade.sql` drops and re-adds the foreign keys that point (directly or through `tasks`, `project_labels`, `chat_conversations`, `chat_messages`, `squad_members`) at `projects` with `ON DELETE CASCADE`: project_memberships, squads, project_invitations, project_task_counters, tasks, project_repository_connections, project_criteria, project_reminders, task_attachments, task_comments, task_activities, task_relations, project_labels, task_worklogs, sprints, chat_conversations, and the child tables task_assignments, task_status_history, task_checklist_items, task_watchers, task_labels, task_comment_mentions, chat_messages, chat_read_states, plus `squad_members.project_membership_id`. The last one matters: `NO ACTION` keys are checked at the end of each nested cascade statement, so a membership row removed before its `squad_members` row would otherwise abort the delete. No row is touched, earlier migrations stay as they are.

This differs from team deletion on purpose: a team keeps its rows (`squads.archived_at`), a project deletion is final and removes the data. Sibling `NO ACTION` keys (`tasks.sprint_id`, `tasks.pool_team_id`, `tasks.parent_task_id`, `project_invitations.team_id`, chat reply key) are unchanged. `notifications.project_id` is still not a foreign key; `ProjectDeletionCleanup` deletes those rows in the deletion transaction. Everything that deletes a `projects` row now deletes its data, so the only caller is `ProjectService.delete` (founder only). `ProjectDeleteCascadeMigrationTest` migrates to V57, fills one project through every table next to an untouched second project, migrates to V58 and proves that only the first project's rows disappear.

## V59 — depo commit takibi (2026-10-07)

`project_repository_connections`: `notified_head_sha VARCHAR(64)` (en son bildirilen/taban çizgisi commit'i) ve `last_scanned_at TIMESTAMPTZ`. Bağlanırken `notified_head_sha` o anki varsayılan dal ucuna ayarlanır, geçmiş commit'ler bildirilmez; alınamazsa boş kalır ve ilk tarama yalnız taban çizgisini yazar. `notifications`: `repo_project_name`, `repo_full_name`, `repo_branch`, `repo_commit_count`, `repo_commits_truncated`, `repo_head_message`, `repo_head_author` + `ck_notification_repository_commits_snapshot` (ya hepsi boş ya da `type='REPOSITORY_COMMITS_PUSHED'`, `resource_type='PROJECT'` ve zorunlu alanlar dolu, `repo_commit_count >= 1`) ve `ck_notification_repository_commits_required` (bu tipte `repo_commit_count` boş olamaz). Tarama sırası `ix_project_repository_connections_scan (last_scanned_at NULLS FIRST)` ile desteklenir. Önceki migration'lara dokunulmadı.
