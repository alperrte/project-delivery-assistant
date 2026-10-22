# SSF — Organizasyon sayfalarında kayıt kaybı düzeltmesi

2026-10-22, Europe/Istanbul. Branch: `squad-service-backend`.

## Tamamlanan kapsam ve kök neden

Bağlantılı şema görünümünün takip regresyonunda, önceki koşuda geçen büyük üyelik testi tekrarlandığında 206 benzersiz üyeden 205'inin döndüğü görüldü. API sayfalaması yalnız tarih alanıyla sıralanıyordu. Eşit tarihlerde PostgreSQL farklı sayfalarda farklı eşitlik sıraları üretebiliyordu. Fixture değiştirilerek sorun gizlenmedi.

Mevcut sıralamalara benzersiz entity `id` ikincil anahtarı eklendi:

- `GET /api/v1/projects/{projectId}/members?page=&size=` → `joinedAt,id ASC`.
- `GET /api/v1/projects/{projectId}/teams?page=&size=` → `createdAt,id ASC`.
- `GET /api/v1/projects/{projectId}/teams/{teamId}/members?page=&size=` → `addedAt,id ASC`.

Endpoint/DTO/girdi/yanıt/hata sözleşmesi ve 1–100 sayfa boyutu korunur. Okuma güncel proje üyeliği/PROJECT_VIEW gerektirir; başka proje/ekip erişimi kapalıdır. Auth/cookie/CSRF/CORS, private/no-store, Spring Modulith sınırları ve repository erişimi değişmedi. Yeni endpoint, query per-row genişletmesi, migration veya ENV yoktur.

## Önemli dosyalar

- `backend/src/main/java/com/pda/project/api/ProjectMembershipController.java`.
- `backend/src/main/java/com/pda/squad/api/TeamController.java`.
- `backend/src/test/java/com/pda/squad/integration/SquadApiIntegrationTest.java`.
- `.agents/api.md`.

Yeni regresyon aynı tarihlere sahip 205 fixture + yöneticiyle her üç API'yi 100/100/6 sayfada okur. Yanıtları gerçek PostgreSQL'deki tarih+ID sırasıyla birebir karşılaştırır; bütün 206 ID'nin tekil ve eksiksiz olduğunu doğrular.

## Doğrulama

Java25, gerçek PostgreSQL Testcontainers:

```powershell
cd backend
.\mvnw.cmd '-Dtest=SquadApiIntegrationTest,ProjectApiIntegrationTest' verify
```

29 test PASS; 0 failure/error/skip, BUILD SUCCESS. İzole8081 QA backend'i yeniden build edilip gerçek browser/HTTP'de 206 üyelik testi de geçti. İlk browser koşusundaki 205/206 hata düzeltmenin gerekçesidir; başarılı diye kaydedilmez. Frontend'in son test sonuçları ilgili frontend takip kaydında raporlanır.

Backend branch'ine `stash apply` sonrası `.\mvnw.cmd '-Dtest=SquadApiIntegrationTest' verify` tekrar çalıştırıldı: 9 test PASS, 0 failure/error/skip, BUILD SUCCESS (`tmp/ssf-pagination-backend-branch.log`). Bu 9 test yukarıdaki 29 testin alt kümesidir.

SECURITY §11 uyarınca Swagger kontrolü: yalnız mevcut geliştirme docs ayarı açık ortamda `/swagger-ui/index.html` üzerinden yukarıdaki üç GET'i aktif proje üyesi oturumuyla size100/page0–2 çalıştırın; ID'lerin tekrarsız toplamıyla API `totalElements` eşleşmelidir. Üye olmayan hesap403, oturumsuz401 ve geçersiz page/size400 davranışları korunur. Üretimde docs veya ENV ayarı değiştirilmedi.

## Git ayrımı, sınırlar ve manuel kontrol

Bu düzeltmenin beş backend/test/API-belge dosyası seçici stash ile frontend commit'inden ayrıldı; backend branch'inde `stash apply` kullanıldı, `pop` yapılmadı. Frontend diyagram düzeltmesi `853fb1d` commit'indedir. Başarılı backend commit'i doğrulanmadan stash silinmez. Backend commit SHA ve son ayrım final raporda verilir.

Tarih+ID sırası eşitlik problemini giderir; farklı HTTP çağrıları arasında aynı anda veri ekleme/silme için atomik snapshot iddiası değildir. Mevcut GF-02 sonraki yenilemede güncel veriye yakınsar. Tam pre-push kullanıcı talimatıyla planlı ertelendi; push/merge/deployment yapılmadı.

Manuel: aynı tarihli çok üyeli projede bütün sayfaları karşılaştırın; başka projeye erişimin reddedildiğini kontrol edin. Frontend ve backend commit'lerini bütün görevler sonunda birlikte entegre edip final kalite kapısını çalıştırın.
