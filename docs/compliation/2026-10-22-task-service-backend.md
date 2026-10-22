# TSF-01 / TSF-04 — Atama kaynağı ve Görevlerim sıralaması

2026-10-22, Europe/Istanbul. Backend teslim branch'i: `task-service-backend`.

## Tamamlanan kapsam ve kök nedenler

- TSF-01: TaskViewAssembler gerçek kendine atama satırlarını `assignedBy == userId` karşılaştırmasıyla gizliyordu. Bu istisna kaldırıldı. Havuzdan alma zaten `(userId=actor, assignedBy=actor)` saklar; artık aynı gerçek aktör iki tarafta görünür. Önceki 12 Ekim API kuralı, bu görevin açık kullanıcı gereksinimiyle değiştirilmiştir.
- Bir görev zaman içinde farklı kişilerce atanmışsa tek bir toplu aktör listesinden çiftler tahmin edilemez. Eklenen `assignmentDetails` yalnız mevcut TaskAssignment satırlarının `userId`, nullable `assignedBy`, `assignedAt` değerlerini taşır. Mevcut satırın aktörü normal düzenleme veya başka bir alıcının eklenmesiyle değişmez. Kaldırılan satır eski aktiviteden geri üretilmez.
- `assigners` tekilleştirilmiş gerçek aktörleri, son atama zamanı DESC / eşitlikte aktör ID sırasıyla döndürür. Pasif aktörün ID'si korunur; aktif kullanıcı dizininde bulunmayan kişinin adı/fotoğrafı null'dır. Oluşturan veya son düzenleyen atayan yerine kullanılmaz. Boş eski assignedBy için veri uydurulmaz.
- TSF-04: ALL sıralaması SQL'de filtrelerden sonra, LIMIT/OFFSET öncesinde DONE için 1, diğer durumlar için 0 önceliğini uygular. Seçilen updatedAt/deadlineAt/priority ve yön, boş deadline'ın sonda olması ve taskNumber DESC korunur; projeler arası eşitlikte task ID ASC eklenir. OPEN/DONE davranışı korunur; count sorgusuna sıralama eklenmez.

Controller → service → repository, mevcut batch assembler ve public modül portları korunur. İlave relation/user sorgusu, yeni endpoint, migration, bağımlılık veya ENV yoktur.

## Önemli dosyalar

- `backend/src/main/java/com/pda/task/application/{TaskView,TaskViewAssembler,MyTasksService}.java`
- `backend/src/main/java/com/pda/task/infrastructure/TaskSpecifications.java`
- `backend/src/test/java/com/pda/task/{TaskAssignmentViewTest,TaskAttributionAndOrderingIntegrationTest,TaskPoolAndMyTasksApiIntegrationTest}.java`
- `.agents/api.md`, `.agents/SECURITY.md` §11.

## API / güvenlik / Swagger

Var olan `POST /api/v1/projects/{p}/tasks`, `GET /api/v1/projects/{p}/tasks`, `GET /api/v1/projects/{p}/tasks/{t}`, alt görev ve diğer TaskView yanıtlarına yalnız yukarıdaki atama ayrıntıları eklenir. `PUT /api/v1/projects/{p}/tasks/{t}/assignees` mevcut UUID setini değiştirmeyi sürdürür. `POST .../claim` ve `POST .../release` mevcut kuralları korur.

`GET /api/v1/tasks/mine?scope=OPEN|DONE|ALL&sort=updatedAt|deadlineAt|priority&direction=asc|desc&page=0&size=20`: kimlik yalnız oturumdan, yalnız aktif projelerindeki kendisine atanmış arşivlenmemiş görevler; size 1–100, aynı filtreli content/totalElements/totalPages ve mevcut counts. ALL'de tamamlananlar bütün sonuç kümesinin sonundadır. Tarih+ID sırası farklı HTTP çağrıları arasında atomik snapshot garantisi değildir; eşzamanlı değişiklikler mevcut GF-02 yenilemesine yansır.

Cookie auth, CSRF, CORS, RBAC, private/no-store ve modül sınırları değişmedi. Proje okuması mevcut PROJECT_VIEW/üyelik, atama TASK_MANAGE, claim/release mevcut TASK_WORK/üyelik/ekip/claimant sınırını kullanır. Anonim 401, proje dışı erişim 403/404, yabancı task ID 404, geçersiz sayfa/size/sort 400, state uyuşmazlığı mevcut 409 sözleşmesini korur.

SECURITY §11 Swagger: docs zaten açık geliştirme ortamında `/swagger-ui/index.html` veya `/v3/api-docs`; normal login + GET `/api/v1/auth/csrf`, mutation için X-XSRF-TOKEN. Kendine ve başkasına ata, GET detay/list/mine sonuçlarındaki çiftleri karşılaştır, atamayı kaldır. ALL için ardışık sayfalarda DONE'dan sonra açık görev kalmadığını ve toplamları kontrol et. Docs veya ENV ayarı bu iş için açılmadı.

## Doğrulama

Java 25 ile:

```powershell
cd backend
.\mvnw.cmd '-Dtest=TaskAssignmentViewTest,TaskAttributionAndOrderingIntegrationTest,TaskPoolAndMyTasksApiIntegrationTest,TaskApiIntegrationTest' verify
```

Son koşu: **20 test PASS, 0 failure/error/skip, BUILD SUCCESS** (`tmp/tsf-backend-final.log`); 19 gerçek PostgreSQL/Testcontainers/MockMvc entegrasyon örneği + 1 Mockito assembler unit testi. İlk aynı kapsamlı koşu da 20/20 geçti; sayılar birbirine eklenmez.

Seçici stash/apply sonrasında `task-service-backend` branch'inde `.\mvnw.cmd '-Dtest=TaskAssignmentViewTest,TaskAttributionAndOrderingIntegrationTest' verify` tekrar çalıştırıldı: **8 PASS, 0 failure/error/skip, BUILD SUCCESS** (`tmp/tsf-backend-branch.log`). Bunlar yukarıdaki 20 testin alt kümesidir. Bütünleşik frontend QA koşusu ayrıca 33/33 geçti; kesin scope frontend teslim kaydındadır.

Yeni sıralama regresyonu iki erişilebilir projede 128 görev + ayrı kullanıcı/projesinde 64 görev kurar. updatedAt/deadlineAt/priority × ASC/DESC, 20'lik bütün sayfalar, boş deadline/eşit timestamp/projeler arası eşit taskNumber, tek proje, çoklu ve tek durum/boş filtre, overdue, OPEN/DONE/ALL, tamamlama/geri açma, counts ve yabancı proje filtresini gerçek PostgreSQL'in beklenen sırasıyla birebir karşılaştırır. Null legacy aktör current NOT NULL şemasında zorlanmaz: yalnız unit fixture'da doğrulanır. Pasif gerçek aktör, iki farklı yönetici, normal düzenlemede kaynak koruma, kaldırma ve outsider reddi entegrasyonda doğrulanır.

## Git ayrımı ve manuel kontrol

Başlangıçta çalışma ağacı temizdi. Mevcut iki task branch'i `origin/main` `a33f909` seviyesine `--ff-only` ile getirildi; yeni branch oluşturulmadı. Kullanıcı bu görev için kendi kimliğiyle yerel commit hazırlanmasına ayrıca izin verdi; push kullanıcıdadır. Backend dosyaları, API/güvenlik belgeleri ve bu kaydın toplam 10 pathspec'i `f1d00c7fbf378066682b106729e26d98daacdcaa` seçici stash'ine ayrılıp güncel backend branch'ine `stash apply` ile uygulandı; pop kullanılmadı. Frontend teslim commit'i `bf82c1023801fc14dbf46f55ceda5b78b11fdea3` ve 17 frontend/test/frontend-belge dosyası içerir. Backend commit'i yalnız yukarıdaki 10 backend/test/API-belge dosyasını içerir. Başarılı backend commit'i ve temiz ağaç doğrulanmadan stash silinmez. Backend commit SHA final raporda verilir; kayıt üzerindeki commit `git log -1 --format='%h %s' -- docs/compliation/2026-10-22-task-service-backend.md` ile bulunabilir. Codex/OpenAI/Co-authored-by eklenmez.

Tam pre-push final aşamaya ertelendi. Push, PR merge, release ve deployment yapılmadı. Her iki teslim birlikte entegre edilmelidir. Manuel: aynı ve farklı aktörlerce atama, havuz claim/release, farklı sayfalarda DONE sınırı, filtre toplamları ve yetkisiz hesapla reddi kontrol edin. UI/GF-02 sonuçları frontend completion kaydındadır.
