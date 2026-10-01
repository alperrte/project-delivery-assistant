# External project invitation registration — 2026-10-01

## Teslim ve durum

Kayıtlı kullanıcı davetleri korunarak, PDA hesabı olmayan kişilere e-posta daveti ve davet bağlantısıyla kayıt akışı eklendi. Kod `project-service-backend` worktree'sinde (`.local/backend-source`) ve kök `project-service-frontend` çalışma ağacında hazırdır. Commit, push ve çalışan backend container'ına yeniden başlatma yapılmadı.

## Yapılanlar

- `backend/src/main/java/com/pda/project/domain/entity/ProjectInvitation.java`: dış davette ad, soyad, normalize e-posta, isteğe bağlı mesaj; hashlenmiş token, 7 gün süre, kimlik karşılaştırması ve tek kullanımlık durum geçişi.
- `backend/src/main/java/com/pda/project/application/service/ProjectInvitationService.java`: kayıtlı/dış davet ayrımı, rol ve üyelik denetimi, iptal/yeniden gönderme, token satır kilidi, kabulde üyelik ve rol ataması, commit sonrası mail/bildirim.
- `backend/src/main/java/com/pda/project/ProjectInvitationOnboarding.java`, `backend/src/main/java/com/pda/auth/application/service/RegistrationWorkflow.java`: modül sınırını koruyan public contract ve kullanıcı/üyelik kabulünü tek transaction içinde yürütme.
- `backend/src/main/java/com/pda/project/api/ExternalProjectInvitationController.java`, `backend/src/main/java/com/pda/auth/api/AuthRegistrationController.java`: public preview, davetle kayıt ve aynı e-postayla önceden kayıt olmuş hesabın kabulü.
- `backend/src/main/resources/db/migration/V33__external_project_invitations.sql`: nullable ad/soyad ve mesaj alanları; bekleyen davet e-postası ile kullanıcı e-postasında case-insensitive benzersiz indeksler. Eski kayıtlar silinmez veya yeniden yazılmaz.
- `frontend/src/features/invitations/components/invite-member-dialog.tsx`: kayıtlı kullanıcı araması veya yeni PDA kullanıcısı formu; ad, soyad, e-posta, roller, 100 karakterlik mesaj.
- `frontend/src/features/invitations/components/external-invitation-registration.tsx`, `frontend/src/features/invitations/components/register-page-content.tsx`: URL fragment içindeki token ile preview, kayıt, mevcut hesapla kabul, giriş ve davet edilen projeye yönlendirme.
- Davet tabloları ve kullanıcının kendi davetleri mesajı/uygun kimlik adını gösterir. TR/EN/DE metinleri güncellendi. `.agents/SECURITY.md` bölüm 11 ve `.agents/database.md` güncellendi.

## Akış ve güvenlik

```text
Kayıtlı: Davet → uygulama içi bildirim (+ etkinse e-posta) → kabul → ProjectMembership
Dış: Davet → e-posta → fragment-token bağlantısı → preview → kayıt/kimlik eşleşmesi → ProjectMembership
```

Mesaj frontend ve backend'de en çok 100 karakter, DB'de `VARCHAR(100)`; boşluklardan oluşan mesaj `null` olur. E-posta kırpılıp küçük harfe çevrilir; ad/soyad Unicode korunarak NFC, boşluk ve uygun büyük/küçük harf eşleşmesiyle denetlenir. Şifre normal BCrypt kayıt yolunu kullanır. Role istemcinin kayıt body’sinden alınmaz, davet kaydından üyeliğe aktarılır. General Team üyeliği mevcut sistemde aktif ProjectMembership üzerinden türetilir.

Token 32 kriptografik rastgele bayttan URL güvenli üretilir, DB'de yalnız SHA-256 hash saklanır; 7 gün sonra geçersizdir. Kabul/kullanım, iptal ve yeniden gönderme satır kilidi ve durum kontrolüyle korunur. Dış davet bağlantısı token'ı URL fragment'ında taşır. Dış davette sahte kullanıcı bildirimi üretilmez; kabul sonrasında davet edene `PROJECT_INVITATION_ACCEPTED` bildirimi gider. Mail ancak transaction commit olduktan sonra mevcut `MAIL_ENABLED`/SMTP ayarları üzerinden denenir; yeni environment değişkeni yoktur.

## API ve Swagger

Swagger: `API_DOCS_ENABLED=true` iken `/swagger-ui/index.html`; POST işlemlerinden önce `GET /api/v1/auth/csrf` ile CSRF cookie/header alınır. Hatalar güvenli `ProblemDetail` döner; token içeren ve onboarding yanıtları `Cache-Control: no-store` kullanır.

| Yöntem / yol | Yetki | Body / yanıt | Önemli hatalar |
| --- | --- | --- | --- |
| `POST /api/v1/projects/{projectId}/invitations` | `MEMBER_MANAGE` + CSRF | Kayıtlı: `{userId,roles,message?}`; dış: `{email,firstName,lastName,roles,message?}`; `201` tek seferlik token | `400` alan, `403` yetki/CSRF, `409` mükerrer/üye, `429` limit |
| `POST /api/v1/project-invitations/external/preview` | Public + CSRF | `{token}`; `200` proje/davet eden/rol/mesaj/kimlik/süre/durum | `404` kullanılamayan token, `429` limit |
| `POST /api/v1/auth/register/invitation` | Public + CSRF | `{token,email,firstName,lastName,nickname,password,confirmPassword}`; `200` `{projectId,projectSlug}` | `400` alan/kimlik, `404` token, `409` hesap, `429` limit |
| `POST /api/v1/project-invitations/external/accept` | Davet e-postasıyla eşleşen oturum + CSRF | `{token}`; `200` `{projectId,projectSlug}` | `403` farklı hesap/CSRF, `404` token, `409` üyelik, `429` limit |
| `POST /api/v1/projects/{projectId}/invitations/{id}/resend` ve `DELETE .../{id}` | `MEMBER_MANAGE` + CSRF | Yeniden gönderim token'ı döndürür; iptal `204` | `403`, `404`, `409` |

## Doğrulama

- `docker compose build backend`: başarılı; production jar ve test kaynakları derlendi.
- Docker Maven/Testcontainers ile `ProjectInvitationDomainTest`, `ProjectInvitationServiceTest`, `ProjectInvitationRepositoryTest`: 23 test başarılı; PostgreSQL 16/17 üzerinde V33 migration uygulandı. Bildirim assertion'ı eklenen dış kabul testi ayrıca yeniden çalıştı ve geçti.
- Docker Maven/Testcontainers ile `ProjectInvitationApiIntegrationTest`, `ModularityTest`: 8 test başarılı; public preview, kimlik uyuşmazlığında rollback, kayıt, token tüketimi ve Spring Modulith sınırı doğrulandı.
- `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `npm.cmd run build`: başarılı.
- Playwright ile mock API üzerinden kayıt sayfası 1280 px ve 390 px genişlikte incelendi: yatay taşma ve JavaScript page error yok.
- `frontend/e2e/04-external-invitation-registration.spec.ts` uçtan uca senaryo eklendi. Canlı backend container'ı bu değişikliklerle yeniden başlatılmadığı için bu senaryo çalıştırılmadı.
- Her iki worktree'de `git diff --check`: başarılı.

## Açık konular

- Kullanıcının mevcut PostgreSQL verisine V33 uygulanmadı ve çalışan backend container'ı değiştirilmedi. `docker compose up -d --build backend` öncesinde mevcut veride case-insensitive çakışan kullanıcı/bekleyen davet e-postası bulunmadığı kontrol edilmeli; benzersiz indeks böyle bir çakışmada migration'ı bilinçli olarak durdurur.
- Gerçek SMTP teslimi `MAIL_ENABLED` ve mevcut SMTP ayarlarına bağlıdır; mail provider ile uçtan uca gönderim bu teslimde denenmedi.
- Playwright E2E, güncellenmiş backend çalışan bir yerel ortamda yürütülmelidir.

## Kullanıcı kontrolü

1. Backend değişikliklerini `project-service-backend` worktree'sinde, frontend değişikliklerini kök `project-service-frontend` çalışma ağacında inceleyin. Önceki Compose uyumluluk değişiklikleri ayrıca kökte duruyor.
2. Güncellenmiş backend ve frontend ile bir proje yöneticisi olarak Teams ekranından yeni PDA kullanıcısına ad/soyad/e-posta, `TESTER` rolü ve kısa mesajla davet gönderin. Mail etkinse bağlantı iletilmeli; preview proje/kimlik/rol/mesajı göstermeli.
3. Yanlış ad/soyadla kayıt denemesinin reddedildiğini; doğru bilgilerle kaydın projeye yönlendirdiğini ve General Team'de `TESTER` rolünü gösterdiğini kontrol edin. Aynı bağlantı ikinci kez çalışmamalı.
4. Aynı davet e-postasıyla normal kayıt yapıp davet bağlantısından giriş yaparak kabul etmeyi; yeniden gönderimde eski bağlantının geçersizleşmesini ve iptalde bağlantının kapanmasını kontrol edin.
5. Etkin yerel backend üzerinde `cd frontend && npm run test:e2e -- --grep "external invitation"` ile eklenen Playwright senaryosunu çalıştırın.
