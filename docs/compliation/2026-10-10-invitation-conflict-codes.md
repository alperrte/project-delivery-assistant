# project-service-backend — Davet çakışmaları için özel hata kodları

## 1. Teslim ve durum

- Branch: `project-service-backend` (UI refinements final kaydındaki takip maddesi; kullanıcı kararı 2026-10-10).
- Kapsam: Davet 409 yanıtları artık genel "çakışma" metni yerine duruma özel kod ve mesaj taşıyor.
- Durum: Tamamlandı ve doğrulandı. Pre-push sonucu §3'te. Commit/push kullanıcıya aittir.

## 2. Yapılanlar

- **Backend:** Değişiklikler `com.pda.project` altında.
  - `InvitationConflictException`: opsiyonel `code` alanı ve üç kod sabiti eklendi.
  - `ProjectApiErrorHandler`: kodu ProblemDetail'e yazıyor. Durum yine 409, `detail` genel kalıyor ve e-posta adresini içermiyor.
  - `ProjectInvitationService`:
    - Yinelenen bekleyen davet → `INVITATION_ALREADY_PENDING`. Bu kod, benzersiz index yarışında oluşan çakışmayı da kapsıyor; o durum daha önce genel bütünlük 409'u veriyordu.
    - Hedef zaten aktif üye → `INVITATION_TARGET_ALREADY_MEMBER` (oluşturma ve kabul).
    - Artık beklemede olmayan davette kabul, red, iptal ya da yeniden gönderim → `INVITATION_NOT_PENDING`.
- **Frontend:**
  - [error-message.ts](../../frontend/src/lib/api/error-message.ts): `CODE_KEYS` eşlemesi merkezi; tüm çağıranlar otomatik yararlanıyor. Diğer 409'larda genel `errors.conflict` yedek mesaj olarak kalıyor.
  - Davetlinin kendi kabulünde "zaten üye" mesajı ikinci tekil kişiyle gösteriliyor (`inviteeErrorKey`). Kullanılan yerler: `my-invitations-page`, `accept-invitation-view`.
  - TR/EN/DE `errors.invitationAlreadyPending`, `invitationTargetAlreadyMember`, `invitationSelfAlreadyMember`, `invitationNotPending`.
- **Dokümanlar:** [SECURITY.md](../../.agents/SECURITY.md) "Project invitation conflict codes - 2026-10-10".

## 3. Doğrulama

- Backend tam `mvnw clean verify`: 665 test, 0 failure, 0 error, 0 skip.
  - Yeni test `ProjectInvitationApiIntegrationTest.invitationConflictsCarryDedicatedCodesWhileTheStatusStaysConflict`.
  - `ProjectInvitationServiceTest` testlerine kod doğrulamaları eklendi.
  - `TEAM_MEMBER_EXISTS` gibi ilgisiz 409 kodlarının değişmediği doğrulandı.
- Playwright (gerçek backend/PostgreSQL):

  | Spec | Sonuç |
  | --- | --- |
  | `invite-member-page` | 8/8 (yinelenen davette özel mesaj; "son yönetici" metni görünmüyor; zaten üye) |
  | `my-invitations-redesign` | 9/9 (eski davete kabul → `INVITATION_NOT_PENDING` mesajı) |
  | `invitation-remediation` | 4/4 |
  | `invitations-errors` | 3/3 |
  | `02-invitation-roles-squad` | 7/7 |
  | `team-invitations-modernization` | 4/4 |

  Yalnız `inviteeErrorKey` ifade değişikliğinden sonra yeniden koşulanlar:
  - `my-invitations-redesign` ve `invite-member-page` geçti.
  - `invitation-remediation` INV-002 test ortamında harici önizleme rate limit'ine (429) takıldı, sonuç aşağıda.
- Kanonik `.\pre-push\pre-push.cmd`: **FAILED — 817/820**.
  - Backend 665/0/0/0; ESLint, `tsc` ve build temiz.
  - Playwright 817 geçti, 1 skip, 2 başarısız. Bu değişikliğe ait tüm davet testleri (INV-002 dahil) tam koşuda geçti.
  - `auth-session-audit` "oturum bitince kullanıcıya ne gösteriliyor": Alper'in `d840ec6` ile eklediği denetim testi. Uygulamada henüz olmayan iki davranışı arıyor: oturum sona erdi açıklaması ve giriş sonrası `?next=` ile dönüş. Bu bir auth tarafı takip maddesi; bu değişiklikle ilgisi yok.
  - `team-member-preview`: bilinen aralıklı oturum 401'i.
  - **Kullanıcı kararı (2026-10-10):** PASSED şartı bu teslim için bilinçli olarak atlandı; push kullanıcı onayıyla yapıldı.

## 4. API

Yeni endpoint yok. Mevcut davet uçlarının 409 yanıtına `code` alanı eklendi:

| Kod | Ne zaman |
| --- | --- |
| `INVITATION_ALREADY_PENDING` | Aynı kişiye ya da e-postaya bu projede bekleyen davet var |
| `INVITATION_TARGET_ALREADY_MEMBER` | Hedef zaten aktif proje üyesi |
| `INVITATION_NOT_PENDING` | Davet artık beklemede değil |

Swagger: `/swagger-ui/index.html`. ENV, migration, matcher ve yetki değişmedi.

## 5. Açık konular

- Benzersiz index yarışı için ayrı bir test yok; mevcut eşzamanlılık testi yalnız tek oluşturmanın kazandığını doğruluyor.
- Bilinen aralıklı test takibi (`team-member-preview`) önceki kayıtlarda.
- `auth-session-audit` bulgusu (oturum sona erdi mesajı ve `?next=` dönüşü) auth tarafına (Alper) iletilmeli; eklenene kadar tam paket bu testte düşer.

## 6. Kullanıcının kontrol adımları

1. Ekip Davetleri → "Üye davet et": aynı kişiyi ikinci kez davet et. "Bu kişiye bu projede zaten bekleyen bir davet var." görünmeli.
2. Zaten üye olan birini e-postayla davet et. "Bu kişi zaten projenin üyesi." görünmeli.
3. Davetlerim'de başka sekmeden reddedilmiş bir daveti kabul etmeye çalış. "Bu davet artık beklemede değil." görünmeli.
