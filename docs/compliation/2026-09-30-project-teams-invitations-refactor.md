# Project Teams, Membership ve Invitations refactor — 2026-09-30

## Teslim ve durum

`ProjectMembership` proje erişimi ve rollerin tek kaynağı olarak kaldı. Var olan Squad veri modeli Teams organizasyon katmanına genişletildi. Davetler yalnız kayıtlı aktif hesaplara yönelir. `.env`/`.env.example` ve dependency değiştirilmedi.

## Yapılanlar

- [V32 migration](../../backend/src/main/resources/db/migration/V32__project_teams_and_registered_invitations.sql) eski projelere tek General Team ekler, mevcut ekipleri onun altına bağlar, custom ekip üyeliğini aktif `ProjectMembership` FK'sine taşır. Eşleşmeyen eski squad member satırları temizlenir. Davet ret mesajı ve alıcı indeksi eklenir.
- [ProjectAccess](../../backend/src/main/java/com/pda/project/ProjectAccess.java) aktif üyeleri güvenli, sayfalı/batch özetle diğer modüle verir. [SquadService](../../backend/src/main/java/com/pda/squad/application/service/SquadService.java) General Team'i proje oluşturulurken aynı transaction içinde kurar; üyelerini ProjectMembership'den türetir. Custom ekip üyelikleri çıkarılan proje üyesiyle birlikte temizlenir. Alt ekip taşıma döngü ve proje kapsamı denetimiyle yapılır.
- [TeamController](../../backend/src/main/java/com/pda/squad/api/TeamController.java) yeni `/teams` API'sidir. Mevcut `/squads` yolu uyumluluk için kalır ve General Team'i eski listeye katmaz. Proje rolleri `/members/.../roles` API'sinde ve `ProjectMembership` üzerinde kalır; Teams ekranındaki rol yönetimi bunu kullanır.
- [ProjectInvitationService](../../backend/src/main/java/com/pda/project/application/service/ProjectInvitationService.java) yalnız kayıtlı kullanıcıyı davet eder; alıcı dışındaki hesabın tokenla bile kabul/ret işlemini reddeder. Kendi davetlerini listeleme, tokensız kabul ve isteğe bağlı en çok 500 karakter ret mesajı eklendi. Yalnız yönetici davet geçmişinde mesajı görebilir. Eski kayıtsız e-posta davetleri korunur fakat yeniden gönderilemez.
- [ProjectInvitationEvents](../../backend/src/main/java/com/pda/project/ProjectInvitationEvents.java) create/accept/reject olaylarını taşır; [NotificationEventListener](../../backend/src/main/java/com/pda/notification/application/NotificationEventListener.java) commit sonrasında alıcıya veya davet edene bildirir. Kendi kendine bildirim bastırılır.

## API ve Swagger kontrolü

Swagger: `API_DOCS_ENABLED=true` iken `/swagger-ui/index.html`. Önce `GET /api/v1/auth/csrf`, sonra login; tüm yollar access cookie, mutasyonlar `X-XSRF-TOKEN` ister. `PROJECT_VIEW` aktif proje üyesidir; `SQUAD_MANAGE` ve davet yönetimi Project Manager izni gerektirir. Sayfalama `page=0&size=20` (size 1–100). Hatalar `ProblemDetail` biçimindedir. Tam yetki/hata matrisi [SECURITY.md §11](../../.agents/SECURITY.md) içindedir.

| Yöntem / yol | Kapsam ve güvenli girdi | Başarı | Önemli hatalar |
| --- | --- | --- | --- |
| `GET /api/v1/projects/{projectId}/teams` | `PROJECT_VIEW`; `?page=0&size=20` | `200` General/custom ekipler, parent, üye sayısı | `400/401/403` |
| `GET /api/v1/projects/{projectId}/teams/{teamId}` | `PROJECT_VIEW`; UUID | `200` ekip | `401/403/404` |
| `POST /api/v1/projects/{projectId}/teams` | `SQUAD_MANAGE`; `{"name":"Backend","parentTeamId":"<team-uuid>"}` | `201` ekip | `400/403/404` |
| `PUT /api/v1/projects/{projectId}/teams/{teamId}` | `SQUAD_MANAGE`; `{"name":"API"}` | `200` ekip | `400/403/404/409` |
| `PUT /api/v1/projects/{projectId}/teams/{teamId}/parent` | `SQUAD_MANAGE`; `{"parentTeamId":"<team-uuid>"}` | `200` taşınan ekip | `400/403/404/409` döngü |
| `DELETE /api/v1/projects/{projectId}/teams/{teamId}` | `SQUAD_MANAGE`; UUID | `204` archive | `403/404/409` General/alt ekip |
| `GET /api/v1/projects/{projectId}/teams/{teamId}/members` | `PROJECT_VIEW`; `?page=0&size=20` | `200` user/nickname/email/roller | `400/403/404` |
| `POST /api/v1/projects/{projectId}/teams/{teamId}/members` | `SQUAD_MANAGE`; `{"userId":"<active-member-uuid>"}` | `201` üye | `400/403/404/409` |
| `DELETE /api/v1/projects/{projectId}/teams/{teamId}/members/{userId}` | `SQUAD_MANAGE`; UUID | `204` | `403/404/409` General |
| `GET /api/v1/project-invitations/me` | Oturum sahibi; `?page=0&size=20` | `200` yalnız kendi davetleri | `400/401` |
| `POST /api/v1/project-invitations/{id}/accept` | Davet edilen hesap; body yok | `200` project member | `401/403/404/409` |
| `POST /api/v1/project-invitations/{id}/reject` | Davet edilen hesap; `{"message":"Şu an uygun değilim"}` isteğe bağlı | `204` | `400/401/403/404/409` |
| `GET /api/v1/projects/{projectId}/invitations/all` | Project Manager; `?page=0&size=20` | `200` geçmiş, ret mesajı | `400/401/403` |
| `POST /api/v1/projects/{projectId}/invitations` | Project Manager; `{"userId":"<registered-user-uuid>","roles":["TESTER"]}` | `201` invitation ID ve tek seferlik token | `400/401/403/404/409/429` |

Eski project member/role ve `/squads` API'leri çalışır. Eski tokenlı accept/reject yolu alıcı sahipliğini zorunlu kılar. Davet create/resend/accept/reject ve yeni alıcı yanıtları IP/yol başına 10 dakika içinde 10 istekle sınırlıdır.

## Doğrulama

- `mvn -q -DskipTests package`: geçti.
- Hedefli Squad, Invitation, Notification testleri: geçti.
- Yeni Teams hiyerarşi/General/üyelik temizliği ve alıcı ret mesajı entegrasyon testleri: geçti.
- `git diff --check`: geçti.
- `mvn -q test`: 234 test, 0 failure, 0 error, 0 skipped; `ModularityTest` geçti.

## Açık konular

Eski kayıtsız e-posta davetleri veri geçmişi olarak kalır; hedef hesapları olmadığı için yeni alıcı listesinde görünmez ve yeniden gönderilemez. Yeni kayıtlı hesap daveti kullanılmalıdır. Frontend custom ekiplerin parent bilgisini API'den alır, fakat mevcut kart görünümü hiyerarşiyi ağaç olarak çizmez; taşımayı Swagger/API üzerinden yapabilirsiniz.

## Kullanıcı kontrolü

1. Yeni proje oluşturup Teams'e girin: yalnız General Team ve kurucu manager görünmeli.
2. İkinci kayıtlı kullanıcıyı davet edin: kişi `/invitations` ekranında daveti görmeli; başka hesap kabul edememeli. Kabul sonrası General Team sayısı artmalı.
3. Bir custom ekip ve altında başka ekip oluşturun. Üye ekleyin; proje üyeliği olmadan ekleme ve döngü yaratan taşıma reddedilmeli.
4. Custom ekipten kullanıcı çıkarmanın proje üyeliğini koruduğunu, projeden çıkarmanın General ve custom listelerinden kaldırdığını kontrol edin.
5. Yeni bir daveti gerekçeyle reddedin. Yönetici Teams davet geçmişinde `REJECTED` ve mesajı görmeli; bildirimler davet gönderimi ile kabul/ret olaylarını göstermeli.

## Çalışma zamanı kontrolü — 2026-09-30

Kullanıcı ortamında backend `postgres:5436` adresine bağlanmaya çalışırken mevcut PostgreSQL container'ı eski `5432` komutuyla çalışıyordu. `.env` içindeki `DB_PORT` ve `DB_URL` zaten `5436` idi; dosyalar değiştirilmedi. Volume korunarak PostgreSQL ve backend güncel Compose ayarıyla yeniden oluşturuldu. PostgreSQL `5436` üzerinde healthy, backend ayakta, Flyway V32 uygulandı ve `/actuator/health` HTTP 200 verdi. Eski container'ı yalnız yeniden başlatmak port konfigürasyonunu güncellemez.

Oturumsuz yeni `/teams` GET isteğinin 403 yerine 401 dönmesi de düzeltildi; frontend böylece oturum yenilemeyi deneyebilir. `SquadApiIntegrationTest` geçti, çalışan backend'de oturumsuz Teams ve kendi davetleri uç noktaları 401 döndü. Giriş yapmış fakat proje üyesi olmayan hesap için 403 yetki sınırı korunur.
