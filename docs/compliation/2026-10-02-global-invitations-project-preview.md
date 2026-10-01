# Global davetler ve proje önizlemesi — 2026-10-02

## Teslim ve kapsam

`/invitations` sayfası davet listesi olarak yeniden düzenlendi. Masaüstünde tablo, dar ekranda kısa satır kartları kullanılıyor. Proje özeti davet satırındaki “Proje bilgileri” düğmesiyle modal içinde açılıyor. Bu çalışma davet/üyelik yaşam döngüsünü ve bildirimleri değiştirmedi.

## Yapılanlar

- [Global davet sayfası](<../../frontend/src/app/(app)/invitations/page.tsx>): proje, ekip, ekipten türetilen davet başlığı, mesaj, davet eden, tarih, rol, durum ve işlemler; sayfalama, yükleme/hata/boş durumları. Kabul ve ret yalnız `PENDING` davetlerde görünür. Ret nedeni isteğe bağlıdır.
- [Önizleme modalı](../../frontend/src/features/invitations/components/invitation-project-preview-dialog.tsx) mevcut [ProjectCard](../../frontend/src/features/projects/components/project-card.tsx) sunumunu kullanır. Ad, kısa açıklama, durum, tür, teknolojiler, üye sayısı, son güncelleme ve varsa logo gösterilir. Üye adları aktarılmaz. Davet önizlemesinde “Projeyi aç” bağlantısı yoktur.
- [Ortak durum rozeti](../../frontend/src/features/invitations/components/invitation-status-badge.tsx), global ve proje davet listelerinde kullanılır. TR/EN/DE çeviriler eklendi.
- [Alıcıya özel API](../../backend/src/main/java/com/pda/project/api/MyProjectInvitationController.java): mevcut `GET /me` yanıtına `teamName` eklendi; proje kartı özeti ve logo için alıcı denetimli iki GET yolu eklendi. [Servis](../../backend/src/main/java/com/pda/project/application/service/ProjectInvitationService.java) davet sahibini doğrular; proje detay yetkisi veya üyelik vermez. [Güvenlik allowlist](../../backend/src/main/java/com/pda/auth/infrastructure/config/SecurityBaselineConfiguration.java) yalnız bu iki kimlik doğrulamalı yolu açar.

## API ve Swagger kontrolü

`API_DOCS_ENABLED=true` geliştirme ortamında `/swagger-ui/index.html` açılır. Önce `GET /api/v1/auth/csrf`, sonra oturum açılır. Aşağıdaki GET yolları oturum çerezi ister; CSRF başlığı gerektirmez. Hatalar `ProblemDetail` döner. [SECURITY.md §11](../../.agents/SECURITY.md) de güncellendi.

| Yöntem ve yol | Örnek | Başarı | Hatalar |
| --- | --- | --- | --- |
| `GET /api/v1/project-invitations/me` | `?page=0&size=20` | `200` yalnız hesabın davetleri; `teamName` dahil | `400`, `401` |
| `GET /api/v1/project-invitations/{invitationId}/preview` | `{invitationId}` = hesaba ait davetin UUID'si | `200` `{ "projectId": "<uuid>", "name": "Örnek", "status": "PLANNING", "memberCount": 1, ... }`; kart düzeyinde proje alanları; `private, no-store` | `401`, `404` başka alıcı veya aktif proje yok |
| `GET /api/v1/project-invitations/{invitationId}/logo` | Aynı davet UUID'si | `200` logo baytları; `private, no-store`, `nosniff` | `401`, `404` başka alıcı veya logo yok |

Mevcut `POST /api/v1/project-invitations/{invitationId}/accept` ve `/reject` yolları korunur; POST isteklerinde `X-XSRF-TOKEN` gerekir. Ret body örneği: `{ "message": "Şu an uygun değilim" }`; `message` boş bırakılabilir, en çok 500 karakterdir.

## Doğrulama

- `frontend`: `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `npm.cmd run build` — başarılı.
- `frontend`: [Playwright testleri](../../frontend/e2e/global-invitations-preview.spec.ts) sahte API ile masaüstü/dar ekran listeyi, modalı, proje açma bağlantısının yokluğunu, geçmiş davette işlem düğmelerini, kabul/ret ve isteğe bağlı ret nedenini, liste yenilenmesini, yükleme/hata/tekrar deneme ve boş durumlarını kontrol etti — 3 geçti. Yerel test için geçici Playwright yapılandırması kullanıldı ve kaldırıldı.
- Tam `.\pre-push\pre-push.cmd` kapısı geçti: backend `clean verify` 282/282 test, frontend lint/tip kontrolü/build, Playwright 37/37 test, Docker build ve backend health. [Proje oluşturma E2E testleri](../../frontend/e2e/project-create-page.spec.ts), art arda koşularda kayıt hız sınırını tüketmemek için mevcut test yönetici oturumunu kullanacak şekilde düzeltildi.
- `backend`: `mvn.cmd -q -Dtest=ProjectInvitationApiIntegrationTest test` — PostgreSQL Testcontainers üzerinde 7 test geçti. Test, önizleme sahipliğini, üyelik olmadan proje detayına erişilemediğini ve logonun alıcıya sunulmasını da kapsar.
- `backend`: `mvn.cmd -q -DskipTests package` — başarılı.
- `git diff --check` — temiz.

## Açık konular ve kullanıcı kontrolü

Bilinen işlevsel açık konu yok. Çalışan uygulamada gerçek hesapla görsel kontrol, sahte API tarayıcı testini tamamlar:

1. Bir hesaba proje daveti gönderip `/invitations` sayfasını açın. Proje/ekip/davet başlığı/mesaj/davet eden/tarih/durum ve “Proje bilgileri” görünmeli.
2. Önizlemeyi açın. Kartta projenin gerçek özeti ve varsa logo görünmeli; “Projeyi aç” bağlantısı olmamalı. Escape veya kapatma düğmesi modalı kapatmalı.
3. Bekleyen davette kabul ve ret işlemlerini ayrı davetlerle deneyin. Ret nedeni boş bırakılabilmeli. Tamamlanmış davette kabul/ret düğmeleri görünmemeli.
4. Dar ekran genişliğinde liste kartlarını ve işlemleri kontrol edin.

Commit ve push yapılmadı.
