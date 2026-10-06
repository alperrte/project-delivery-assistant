# PDA — Invitations End-to-End Integration Audit

> Historical audit snapshot. Four findings were subsequently remediated after explicit approval; current implementation evidence is in [separate remediation completion](docs/compliation/2026-10-06-invitations-integration-remediation.md). Original audit verdict/counts below were not overwritten as implementation proof.

Tarih: 2026-10-06. **Audit-only; remediation uygulanmadı.**

Source of truth: [.agents/PDA_Invitations_End_to_End_Integration_Audit.md](.agents/PDA_Invitations_End_to_End_Integration_Audit.md), 1–44 bölümler ve kritik kuralların tamamı. Başlangıç HEAD `63a21275f59c23cd38d93a61efe928ef9cdd5a74`, branch `project-service-backend`. Önceki completion kayıtları bu audit'in runtime başarı kanıtı olarak kullanılmadı.

## 1. Executive Summary

Davet sistemi gerçek backend ve PostgreSQL'e bağlıdır. Kayıtlı kullanıcıya ve yeni e-postaya UI formundan davet oluşturuldu; global kabul/ret, dış davetle kayıt, proje erişimi, roller ve seçilen ekip üyeliği doğrulandı. Accept yalnız status değiştirmiyor: fiziksel `project_memberships`, `project_membership_roles` ve `squad_members` kayıtları oluşuyor.

**Dört kesin bulgu:**

| ID | Severity | Classification | Özet |
| --- | --- | --- | --- |
| INV-AUD-003 | HIGH | SECURITY ISSUE | Client-side hesap değişiminde kullanıcıya göre ayrılmamış cache başka alıcının davetini gösteriyor |
| INV-AUD-001 | MEDIUM | BUG | Süresi dolan fiziksel PENDING davet yeni davet/resend/cancel akışını kilitliyor |
| INV-AUD-002 | MEDIUM | CACHE ISSUE | Eski tokenlı kabul sonrası sıcak proje listesi yeni üyeliği göstermiyor |
| INV-AUD-004 | LOW | UX MISMATCH | External preview 429 yanıtı “geçersiz veya süresi dolmuş davet” olarak sunuluyor |

45 hedefli backend testi geçti, failure/error/skip0. Bu testler dört eksik davranışı kapsamadığı için yeşil sonuç bug bulunmadığı anlamına gelmiyor. Normal başarılar gerçek Chromium/API/DB ile; yalnız expiry zamanı ve gecikmeli response senaryoları açık TEST-ONLY fixture'larıyla doğrulandı. SMTP bu ortamda kapalı; gerçek e-posta teslimi doğrulanmadı.

## 2. Overall Verdict

**PARTIALLY CONNECTED**

Temel create/accept/reject/registration/persistence zincirleri bağlıdır. Ancak kullanıcı izolasyonu UI cache katmanında kırılıyor; expiry sonrası yeniden davet ve tokenlı kabul sonrası cache zinciri eksik. Bu nedenle FULLY CONNECTED veya güvenli uçtan uca tamamlanmış verdict'i verilmedi. SMTP bağlantısının runtime kanıtı da eksik.

## 3. Invitation Domain Model

Gerçek model ayrı bir `ExternalProjectInvitation` entity'si içermez. Hem kayıtlı hem e-posta daveti aynı [ProjectInvitation](backend/src/main/java/com/pda/project/domain/entity/ProjectInvitation.java) entity'sidir:

- `projectId`, `invitedUserId` veya normalize `email`, `inviteeFirstName`, `inviteeLastName`, `message`, `invitedBy`, `teamId`.
- `initialRoles: Set<ProjectRole>`, SHA-256 `tokenHash`, created/expires/accepted/rejected/cancelled timestamp'ları, `rejectionMessage`.
- [InvitationStatus](backend/src/main/java/com/pda/project/domain/enums/InvitationStatus.java): PENDING, ACCEPTED, REJECTED, CANCELLED, EXPIRED. TTL7 gün; token32 SecureRandom byte, URL-safe Base64. `acceptedAt`+ACCEPTED durumu consume kanıtıdır; ayrı consumed_at alanı yok.
- [ProjectMembership](backend/src/main/java/com/pda/project/domain/entity/ProjectMembership.java): ACTIVE/REMOVED, proje/kullanıcı/rol seti; erişimin sahibi.
- Ekip katmanındaki gerçek entity [SquadMembership](backend/src/main/java/com/pda/squad/domain/entity/SquadMembership.java), fiziksel tablo `squad_members`; `project_membership_id` taşır. “TeamMembership” işlevinin adı budur.
- [CreateInvitationRequest](backend/src/main/java/com/pda/project/api/dto/request/CreateInvitationRequest.java), [InvitationTokenRequest](backend/src/main/java/com/pda/project/api/dto/request/InvitationTokenRequest.java), [InvitationResponse](backend/src/main/java/com/pda/project/api/dto/response/InvitationResponse.java), [CreatedInvitationResponse](backend/src/main/java/com/pda/project/api/dto/response/CreatedInvitationResponse.java), [InvitationSummary](backend/src/main/java/com/pda/project/application/service/InvitationSummary.java) gerçek DTO/mapper'lardır.

PENDING ve expiresAt>now iken accept/reject/cancel izinlidir. Resend eski daveti CANCELLED yapıp yeni ID/token üretir. Süre dolunca accept reddedilir; `expire(now)` yalnız çağrılırsa fiziksel EXPIRED yazar. Normal oluşturma/listeleme/resend/cancel yolları bu geçişi tamamlamıyor (INV-AUD-001). Team archive sırasında [ProjectAccessService:185](backend/src/main/java/com/pda/project/application/service/ProjectAccessService.java) expire/cancel uyguluyor.

## 4. API Inventory

Base `/api/v1`. Cookie session; POST/DELETE için mevcut CSRF. Manager = aktif proje üyeliği + MEMBER_MANAGE; global ADMIN bu service içinde üyelik yerine geçmez. Session/principal payload dışında actorId kabul edilmez.

| Method | Path | Auth | Request | Response | Permission | DB Effect |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/projects/{p}/invitations` | session+CSRF | teamId, roles; tam bir userId/email; external için firstName,lastName; message? |201 CreatedInvitationResponse; tek seferlik token, no-store | MEMBER_MANAGE, active own-project team | invitation+roles INSERT |
| GET | `/projects/{p}/invitations` | session | page,size |200 pending PageResponse | MEMBER_MANAGE | read; fiziksel PENDING |
| GET | `/projects/{p}/invitations/all` | session | status?,page,size |200 InvitationResponse page | MEMBER_MANAGE | history read; ham status filter |
| POST | `/projects/{p}/invitations/{i}/resend` | session+CSRF | body yok |200 new invitation/token, no-store | MEMBER_MANAGE + same project/pending | cancel old + insert new |
| DELETE | `/projects/{p}/invitations/{i}` | session+CSRF | body yok |204 | MEMBER_MANAGE + same project/pending | CANCELLED |
| POST | `/projects/{p}/invitations/{i}/accept` | session+CSRF | token |200 MemberResponse | token+project+ID+recipient | invitation + project/team membership |
| POST | `/projects/{p}/invitations/{i}/reject` | session+CSRF | token |204 | token+project+ID+recipient | REJECTED |
| GET | `/project-invitations/me` | session | page,size; status yalnız PENDING veya omitted |200 MyInvitationResponse page | principal recipient only | read; expiry presentation mapping |
| GET | `/project-invitations/{i}/preview` | session | UUID |200 safe project card; private,no-store | recipient + pending/unexpired + active project | read |
| GET | `/project-invitations/{i}/logo` | session | UUID, v? |200 image bytes; private,no-store,nosniff | same preview scope | project BYTEA read |
| POST | `/project-invitations/{i}/accept` | session+CSRF | body yok |200 MemberResponse | principal recipient; row lock | atomic accept/membership/team |
| POST | `/project-invitations/{i}/reject` | session+CSRF | optional `{message}` <=500 |204 | principal recipient; row lock | status/reason/timestamp |
| POST | `/project-invitations/external/preview` | public+CSRF | token |200 Preview; no-store | live external bearer token | read |
| POST | `/project-invitations/external/accept` | session+CSRF | token |200 Accepted(projectId,projectSlug) | live token + account email equality | atomic membership/team/consume |
| POST | `/auth/register/invitation` | public+CSRF | token,email,firstName,lastName,nickname,password,confirmPassword |200 Accepted; no-store | token+identity/validation | user + membership/team + consume |

Controller kanıtları: [ProjectInvitationController](backend/src/main/java/com/pda/project/api/ProjectInvitationController.java), [MyProjectInvitationController](backend/src/main/java/com/pda/project/api/MyProjectInvitationController.java), [ExternalProjectInvitationController](backend/src/main/java/com/pda/project/api/ExternalProjectInvitationController.java), [AuthRegistrationController:47](backend/src/main/java/com/pda/auth/api/AuthRegistrationController.java). Matcher: [SecurityBaselineConfiguration](backend/src/main/java/com/pda/auth/infrastructure/config/SecurityBaselineConfiguration.java), 142–148 ve projects invitation mapping'leri.

Önemli hatalar: validation/enum/pagination400, session401, permission/CSRF403, missing/foreign target404, conflict/non-pending409, rate-limit429+Retry-After. `/me?status=ACCEPTED` desteklenmez; history için filter omitted gerekir. Invitation POST quota10/10dk/IP/URI +200 toplam; external preview/register sensitive quota5/10dk. Limiter in-memory; dağıtık/global limit garantisi verilmedi.

Swagger kontrol yolu: `http://localhost:8080/swagger-ui/index.html`, `/v3/api-docs`; normal `/auth/csrf` ve login ile kullanılır. Yeni endpoint, ENV veya güvenlik policy'si oluşturulmadı. Güvenli örnek: `{"teamId":"<QA-team-uuid>","userId":"<QA-user-uuid>","roles":["TESTER"],"message":"Ekibe katılın"}`. Raw token/password/cookie örneği yayınlanmadı.

## 5. Global Invitations Integration

Logical `/invitations`, Türkçe `/tr/davetler`, sidebar `NAV_LINKS` Davetler. Component [app/(app)/invitations/page.tsx](frontend/src/app/(app)/invitations/page.tsx). Gerçek `invitationsApi.mine` → MyProjectInvitationController → listMine → ProjectInvitationRepository. Page20; Bekleyen/ Tümü; accepted/rejected ayrı filter tab'ı yok.

Project/team adı, inviter nickname/photoVersion, initialRoles, inviter message, status/timestamp backend DTO'dan gelir. Global ayrı pending badge yok; seçili projedeki manager pending count farklı mekanizmadır. Accept gerçek200 sonrası `project-invitations/me` + projects root invalidation; reject204 sonrası me prefix invalidation. Busy çift tıklamayı engeller; loading/empty/error/refetch ve optional rejection dialog mevcut.

Başarı zinciri runtime'da doğrulandı. Ancak query key actor içermez: `['project-invitations','me',filter,page]`. Yeni hesabın fetch'i beklerken eski data render ediliyor: INV-AUD-003. Backend recipient filter doğru kalıyor.

## 6. Project / Team Invitation Integration

Seçili proje `?section=invitations`; [project-sections.ts](frontend/src/features/projects/project-sections.ts) managerOnly ve teams parent. Proje geçmişi [InvitationsPage](frontend/src/features/invitations/components/invitations-page.tsx); create/invite aynı [AddTeamMemberDialog](frontend/src/features/squads/components/add-team-member-dialog.tsx).

Team detail Üye ekle → candidate search → role/message → `invitationsApi.create`. Runtime registered body fields `message,roles,teamId,userId`; external body `email,firstName,lastName,message,roles,teamId`. İkisinde201, doğru seçili team, TESTER rolü ve fresh PostgreSQL PENDING/hash64 doğrulandı. API/DTO max message100, name100, email320; UI message maxLength100 ve role seçim zorunlu. Backend exactly-one target ve team scope kontrolünün sahibidir.

Proje üyesi olup başka ekibe girecek kişi için UI doğrudan squadsApi.addMember kullanır; bu invitation oluşturmayı taklit etmek değildir, DIFFERENT BY DESIGN. Yeni/registered dış kişi invitation ile katılır. Otomatik General Team yok; seçilen normal ekip gerçek join hedefidir.

## 7. Accept Flow

Global accept: [acceptMine/acceptOwned](backend/src/main/java/com/pda/project/application/service/ProjectInvitationService.java), 425–456. lockById → recipient/pending/expiry → active project → inviter hâlâ manager → active user → membership create/reactivate + roles → ACCEPTED → synchronous Accepted event → SquadMembership.

Runtime200, physical ACCEPTED, ACTIVE, `[FRONTEND_DEVELOPER]`, teamRows1; project GET200 ve sıcak client navigation proje kartı görünür. Same-ID tekrar kabul409; no duplicate membership/team row. Double accept gerçek eşzamanlı200/409, teamRows1. Accept-vs-reject200/409, aynı DB'de tutarlı ACCEPTED+ACTIVE+teamRows1 gözlendi; bu bir gözlem, tüm concurrency schedule'larının formel garantisi değildir.

Legacy token accept de persistence'ı doğru yapar; [AcceptInvitationView:27–35](frontend/src/features/invitations/components/accept-invitation-view.tsx) yalnız setDone yapar, query invalidation yok. DB başarı ile UI cache ayrışıyor: INV-AUD-002.

## 8. Reject Flow

Global optional `{message}` <=500 → rejectMine → ownPending row lock → rejectOwned → status/rejectedAt/rejectionMessage save + Rejected event. UI500 maxlength, busy/error/success ve me prefix refresh mevcut. Runtime UI204 + physical REJECTED, membership null, teamRows0; tekrar accept409. Ret mesajının manager history'ye taşınması güncel ProjectInvitationApiIntegrationTest ile doğrulandı. Legacy reject token yolu optional reason taşımaz; mevcut farklı contract'tır.

## 9. Membership / Team Membership Persistence

Fresh docker/psql prepared UUID sorguları ORM/cache dışından yapıldı. Global, legacy ve external kabul fiziksel kayıtlarla doğrulandı; reject üyelik oluşturmadı. Roles `project_membership_roles` tablosunda, ekip bağı `squad_members.project_membership_id` ile. [SquadService:65–79](backend/src/main/java/com/pda/squad/application/service/SquadService.java) synchronous @EventListener/@Transactional aynı acceptance transaction'a katılır.

External normal API register200/login200; DB ACCEPTED/ACTIVE/TESTER/teamRows1, replay404. Normal UI form→register→login→gerçek proje redirect de geçti; ekip memberCount2 (creator + new guest). Invitation status başarı tek başına kabul kanıtı sayılmadı.

## 10. Authorization / IDOR

Runtime: non-member create403, foreign-project team404, foreign recipient accept404, foreign preview404, missing CSRF403, duplicate409. Backend target/principal eşleşmesi ve project permission controller görünürlüğünden bağımsızdır. Güncel backend testleri non-manager mutation, wrong-project invitation IDs, registered recipient, archived project ve removed/demoted inviter senaryolarını kapsar.

Backend'de bu audit'te başarılı unauthorized grant/IDOR yeniden üretilmedi. Fakat aynı-document client logout/login C hesabında eski B daveti görüldü; C sender veya recipient değil, project GET403 ve kendi me endpoint'i bu daveti içermiyor. Bu **frontend unauthorized data exposure**: INV-AUD-003. Actor scope server'da doğru olması cache kaynaklı sızıntıyı ortadan kaldırmıyor.

Gerçek global ADMIN nonmember ve disabled-account live browser matrisi ayrıca koşulmadı; service aktif membership+permission kullanır ve global role bypass içermez (static kanıt). Team archive-vs-accept / issuer demotion-vs-accept deterministik barrier schedule'ı koşulmadı; kanıt olmadan yeni locking önerilmedi.

## 11. External Invitation / Registration

Unregistered e-posta için tek ProjectInvitation.email target; names/message ve team/role gerçek. Preview live external hash+pending check yapar; registration [RegistrationWorkflow:46–58](backend/src/main/java/com/pda/auth/application/service/RegistrationWorkflow.java) user create ve onboarding accept'i aynı transaction'da tutar. Yanlış identity400 ardından aynı e-postayla doğru registration200, rollback/consume davranışını destekler; hedefli integration test de bunu doğrular.

Email strip+ROOT lowercase, names NFC/whitespace normalization; raw token DB'ye yazılmaz. External URL fragment token [useInvitationToken](frontend/src/features/invitations/hooks/use-invitation-token.ts) ile okunur; mail registered link'i mevcut legacy query-token sayfasına gider. Kabul edilmiş email-target davet invitedUserId null kalır; global me list'i UUID-target sorgusu olduğundan bu external history global incoming history'ye otomatik eklenmez (mevcut model, yeni feature varsayılmadı).

[SmtpProjectInvitationMailAdapter](backend/src/main/java/com/pda/project/infrastructure/mail/SmtpProjectInvitationMailAdapter.java) mevcut MAIL_* / SMTP_* config, From validation, English plain-text template, control-character sanitization ve best-effort error handling kullanır. Create/resend dispatch afterCommit. Locale-specific mail template seçimi mevcut değil. Bu ortam **MAIL_ENABLED=false**: SMTP/inbox teslimi PARTIAL/UNVERIFIED, manual token aktarımı gerçek email teslimi diye sayılmadı. ENV veya limit ayarı değiştirilmedi.

## 12. Database Integrity

Gerçek migration'lar: V22 memberships/roles, V23 membership lifecycle, [V24 invitations](backend/src/main/resources/db/migration/V24__project_invitations.sql), [V32 registered invitations/team membership](backend/src/main/resources/db/migration/V32__project_teams_and_registered_invitations.sql), [V33 external fields](backend/src/main/resources/db/migration/V33__external_project_invitations.sql), **[V36 teams without general](backend/src/main/resources/db/migration/V36__teams_without_general.sql)**. Bazı eski dokümanlardaki V35 ismi yerine gerçek V36 esas alındı.

Token hash unique; pending project/user ve project/email partial unique; V33 lower(email) pending unique + lower(users.email) unique. Membership project/user unique; team/member unique. Roles join FK cascade, parent resource FK'leri mevcut; scalar user IDs uygulama public facade'ı ile doğrulanır. Invitation.teamId legacy için nullable, yeni DTO @NotNull. Same-project team invariant service'dedir; invitation team FK simple FK, composite same-project FK değildir. Bu tek başına API IDOR kanıtı sayılmadı.

Duplicate concurrent INSERT için DB constraint ikinci korumadır. Fresh duplicate409 kanıtı var; iki concurrent invite-create deterministik schedule'ı bu tur koşulmadı. Double accept ve accept/reject concurrency runtime'da doğrulandı.

Expiry fixture yalnız bu audit'in QA invitation UUID'sinin expires_at değerini geçmişe aldı; production saati, config veya kullanıcı kaydı değiştirilmedi. Sonrasında normal server409 cevapları, global EXPIRED/manager PENDING ve DB PENDING gözlendi. Bu boundary TEST-ONLY, bug sonucu gerçek service davranışıdır.

## 13. Cache Consistency

Global normal accept invalidation doğrudur; gerçek sıcak Projects→Invitations→accept→Projects turunda hard reload gerekmedi. Reject pending listeyi tazeler. Create UI team/invitations/members prefix'lerini invalidates; project resend/cancel own invitation prefix'ini tazeler. Manager selected-project count `usePendingInvitationCount` gerçek `/all?status=PENDING&size=1` totalElements kullanır; expired ham PENDING bu sayacı da etkileyebilir.

İki kesin cache kırılması: legacy accept projects invalidation eksik (INV-AUD-002); global me query actor isolation eksik ve logout yalnız session query kaldırıyor (INV-AUD-003). External signed-in accept da yalnız router.replace kullanır; onun sıcak cache alt senaryosu ayrı yeniden üretilmedi, legacy finding'in kanıtı yerine geçmez.

## 14. Runtime / E2E Evidence

| Komut / kanıt | Sonuç |
| --- | --- |
| `backend/mvnw.cmd -Dtest=ProjectInvitationDomainTest,ProjectInvitationServiceTest,ProjectInvitationRepositoryTest,ProjectInvitationApiIntegrationTest,SquadApiIntegrationTest,SmtpProjectInvitationMailHeaderTest test` |45 tests,0 failure/error/skip, BUILD SUCCESS,exit0 |
| `node .local/invitations-audit/runtime.cjs` final |exit0; real API/browser/DB cases, expiry+legacy bug sonuçları dahil |
| `node .local/invitations-audit/account-cache.cjs` final |exit0; third-account project403, old invitation visible, own server list excludes; response geldiğinde temizlenir |
| `node .local/invitations-audit/forms.cjs` final |exit0; registered/external UI POST201, correct body/DB; external UI register/login200/project redirect/team membership |
| default quota exhausted preview |real429; UI invalid/expired message; INV-AUD-004 |
| Git/source comparison |1753 baseline file hashes; production/test/config source değişmedi, HEAD/index korundu |

Probe exit0 yalnız kanıt toplama tamamlandı demektir; bulunan broken davranışlar PASS olarak gizlenmedi. İlk private runtime script'te register URL'si yanlış yazılmıştı; actual authApi yolu `/auth/register/invitation` ile tekrarlandı. İlk external UI probe SSR generic formu yerine invitation formu hazır olmasını beklemiyordu; hazır-form wait sonrası ayrıldı. Bir diğer koşum default sensitive quota429 aldı: gerçek LOW UX bulgusu kaydedildi. Bağımsız normal UI koşumu için yalnız yerel backend restart edildi, config/limit değişmedi; son UI akışı başarılıdır.

Mevcut `02-invitation-roles-squad`, `04-external-invitation-registration`, `10-global-invitations`, `teams-page` E2E kaynakları incelendi. Bu audit'te `npx playwright test` tüm/spec paketi yeniden koşulmadı; bunun yerine private Playwright orchestration ile yukarıdaki gerçek Chromium kontrolleri yapıldı. Full regression/pre-push bu audit için çalıştırılmadı ve eski pre-push sonucu yeni audit kanıtı yapılmadı.

Network artifacts yalnız method/path/status ve güvenli body alanları/roles/team-match taşır; token/cookie/password raw capture rapora alınmadı. Private kanıt `.local/invitations-audit/`: runtime.json, forms.json, account-cache.json ve QA screenshot'ları. Privacy test'te gerçek GET yalnız geciktirildi; expiry QA timestamp injection dışında normal başarı response'ları mock/fulfill değildi. Tüm probe'ların finally cleanup'ı kendi QA project UUID'lerini archive API ile arşivledi; kullanıcı veri/volume'leri silinmedi. Test hesapları ve arşivli davet/üyelik/mesaj metadata'sı kalabilir.

**Son servis durumu:** Probes tamamlandıktan sonraki health kontrolünde Docker Desktop Linux daemon pipe erişilemezdi;3000/8080 listener bulunmadı. Son health/Swagger GET PASS sayılmadı. Bu son durum önceki başarılı API/browser/DB kayıtlarını iptal etmez; nedeninin uygulama kodu veya kullanıcı işlemi olduğuna dair kanıt yok. Docker Desktop/servisler bu final kontrolde yeniden başlatılmadı. Swagger adresi source/config kontrol yoludur; final runtime GET200 iddiası değildir.

## 15. Mock / Fake Audit

Authenticated production invitation yollarında local-only accept, fake invitation status, static project cards veya stubbed mutation bulunmadı. Draft/reset/busy state üretim persistence sayılmadı. Preview Card'daki `team.preview=[]` ve `updatedBy=null` safe DTO'nun taşımadığı alanları gizlemek içindir, sahte DB membership değildir; gerçek memberCount backend'den gelir.

`frontend/e2e/global-invitations-preview.spec.ts` explicit route.fulfill ve test PDA_SESSION kullanır: **MOCK / TEST-ONLY UI render/error contract**, gerçek integration kanıtı değildir. Service unit mocks ve expiry clock fixture'ları da aynı şekilde sınırlıdır. Landing/demo component verileri authenticated invitation chain yerine geçirilmedi. Audit success yolları gerçek backend/DB idi.

## 16. Frontend ↔ Backend Mapping

| Feature | Frontend | API | Backend | DB | Authorization | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Global invitations list | app/(app)/invitations/page.tsx/useQuery | GET me | MyController/listMine/repository | recipient page | server correct; actor cache broken | PARTIAL |
| Project invite create | AddTeamMemberDialog/RolePicker/MessageField | POST projects/p/invitations | ProjectController/inviteRegisteredUser | normal create real; expired conflict INV-001 | manager + own-project team | PARTIAL |
| Team invite | fixed/chosenTeam, squads candidates | same POST | ProjectTeamDirectory active check | team_id + later squad_members; expiry conflict | cross-team404 tested | PARTIAL |
| Accept global | MyInvitationsPage mutation | POST i/accept | ownPending/acceptOwned/event | status+membership+roles+team | recipient/CSRF; cache scope finding | PARTIAL |
| Accept legacy token | AcceptInvitationView | POST projects/p/i/accept | token scope/acceptOwned | persisted correctly | recipient and token | PARTIAL |
| Reject | MyInvitationsPage/dialog | POST i/reject | ownPending/rejectOwned | REJECTED/reason; no membership | server recipient/CSRF; shared UI actor cache INV-003 | PARTIAL |
| Membership creation | global/legacy/external consumers | accept/register | ProjectInvitationService | ACTIVE + roles | project/inviter/user check | CONNECTED |
| Team membership | selected team + team members UI | accept/register/team read | synchronous SquadService listener | squad_members unique row | team/project checks | CONNECTED |
| Project preview | InvitationProjectPreviewDialog | GET i/preview/logo | recipient pending/active project | real summary/BYTEA | scoped controller | CONNECTED |
| External registration | ExternalInvitationRegistration/authApi | preview + register/invitation + login | RegistrationWorkflow/onboarding | user/member/team/consume | identity+CSRF+rate limit | PARTIAL |
| SMTP delivery | no client delivery receipt | server afterCommit mail port | SMTP adapter | invite commit separate from delivery | configured SMTP | PARTIAL |
| Resend/cancel & expiry | InvitationsPage actions | POST resend/DELETE | pendingInvitationIn | expired row blocks unique | manager enforced | BROKEN |

CONNECTED yalnız bu audit'te kanıtlı normal akış içindir; olası her concurrency/device/SMTP schedule garantisi değildir. External registration normal persistence/UI bağlı, fakat error mapping ve actual mail delivery eksikleri nedeniyle PARTIAL. Global kabulde persistence başarılı olsa da actor cache problemi tüm kullanıcı-isolated UI akışını tamamlanmış saymayı engeller.

## 17. Findings by Severity

### INV-AUD-003 — HIGH — SECURITY ISSUE

**Akış:** logout/login same document → global invitations. **Beklenen:** yeni hesap yalnız kendi davetlerini görür. **Gerçek:** B'nin invite name/message/metadata'sı yeni C hesapta GET beklerken görünür; C sender/recipient değil, project GET403, own me backend list excludes invitation. Real response gelince silinir.

**Kanıt:** app/(app)/invitations/page.tsx:51 actor'sız query key ve data render; AppShell:61,74 yalnız session remove; LoginForm:78 yalnız session set; Providers:45 QueryClient document boyunca yaşar. `.local/invitations-audit/account-cache.json` final booleans ve account-cache.png. TEST-ONLY delay gerçek GET'i tutar, fake body üretmez; eski data gerçek B cache'idir.

**Root cause:** principal boundary query key/cleanup'a yansımıyor; staleTime0 background refetch cached data render'ını engellemiyor. **Etki:** paylaşılan tarayıcı oturumunda private invitation metadata görünürlüğü; server grant/IDOR bypass değil, UI data isolation kırılmasıdır.

**Minimum öneri:** recipient query/preview keys'i session user ID ile scope et; hesap sınırında ilgili eski private queries/in-flight işlemleri temizle veya user-key altında izole et. Actor değişirken eski data render etme. Gerçek client-side switch ve delayed real GET regression'ı ekle. Yetki modelini, CSRF/CORS veya cookie'leri gevşetme.

### INV-AUD-001 — MEDIUM — BUG

**Akış:** expiry → manager resend/cancel/new invite. **Beklenen:** expired davet expired olarak görünür ve aktif pending conflict'i yaratmaz; yeni davet mümkün olur. **Gerçek:** recipient EXPIRED; manager PENDING; physical PENDING+pastExpiry; accept/resend/cancel/new create hepsi409. Üyelik oluşmuyor; yanlış erişim verilmedi fakat onboarding yeniden başlatılamıyor.

**Kanıt:** runtime.json expired-fixture; ProjectInvitationService:109/113/147 conflict checks yalnız status; 160–175 manager mapping ham status; 205–230 yalnız recipient presentation expiry; 494–502 pendingInvitationIn expiry reject. V24/V33 pending unique indexes physical status'a bağlı. ProjectAccessService:185–200 expire yalnız team archive yolunda çağrılıyor.

**Root cause:** logical expiry fiziksel pending uniqueness/lifecycle ile koordine edilmiyor. **Minimum öneri:** create/resend boundary'de expired pending satırı güvenli transaction/row-lock ile EXPIRED yapıp conflict'i kaldır; manager query/status/action semantics'i aynı etkin expiry tanımıyla uyumlu olsun. Süresi dolmuş yeniden davet/cancel UI politikası açıklaştırılsın. PostgreSQL index'e `now()` ekleyerek çözüm önerilmiyor; eski migrations değiştirilmeden mevcut constraint korunmalı. Clock/QA expiry + fresh invite + duplicate race regression'ı ekle.

### INV-AUD-002 — MEDIUM — CACHE ISSUE

**Akış:** Projects cache sıcak → legacy token accept → Projelere git. **Beklenen:** yeni üyelik kart/sidebar listesine yansır. **Gerçek:** db ACCEPTED/ACTIVE/TESTER/teamRows1, backend listContains=true; UI cardVisible=false, navigation sonrası newListRequests0.

**Kanıt:** runtime.json legacy-warm-cache ve legacy-cache.png; AcceptInvitationView:27–35 onSuccess yalnız setDone; Providers:48 staleTime30s. Global accept:61–62 projeleri invalidate ederek aynı sorunu yaşamıyor.

**Etki:** mailden gelen registered-user link'inde başarılı kabul yeni projeyi anında göstermiyor; refresh/stale timeout'a bağımlılık. **Minimum öneri:** legacy accept success'te mevcut projects root ve own invitations prefix'lerini invalidate et; gerekiyorsa ilgili cached membership/team keys'i aynı mevcut fabrikalarla tazele. Hard reload çözüm olmasın. Warm client navigation + no-duplicate POST + real DB regression ekle. External existing-account success aynı family'de ayrıca test edilmeli; onun failure'ı bu finding ile kanıtsız birleştirilmedi.

### INV-AUD-004 — LOW — UX MISMATCH

**Akış:** public external preview request429. **Beklenen:** rate-limit/geçici hata doğru açıklanır; valid token expired diye sunulmaz. **Gerçek:** fresh invitation oluşturulmuşken default quota429 → “Bu davet geçersiz veya süresi dolmuş.” UI. Son bağımsız budget koşumunda aynı normal form family'si başarıyla çalıştı.

**Kanıt:** forms probe'da iki preview429 ve literal alert captured; ExternalInvitationRegistration:39–42 bütün Promise.all failures'ı externalExpired'a eşliyor. Source limiter AuthRateLimitFilter default quota gerçek; fake error body veya yükseltilmiş limit yok.

**Root cause:** error type/status kaybediliyor. **Etki:** kullanıcı geçerli linki kullanılamaz sanıyor; retry/wait yönlendirmesi yanlış. **Minimum öneri:** yalnız invalid/missing/expired token404 için expired copy;429 ve network/server failures için mevcut errorKey/correct message, retry affordance ve stale error reset. Normal başarılı flow mock olmasın; failure fixture ayrı TEST-ONLY regression olabilir.

## 18. Bugs vs Missing Features vs Different-by-Design

- Dört finding yukarıdaki gerçek broken/unsafe behavior'dır; mevcut olmayan zorunlu feature uydurulmadı.
- General Team auto-add yok: V36 ile kasıtlı kaldırılmış; gerçek selected team membership var.
- Global filter Pending/All, manager status tabs; global bağımsız badge yok. Product scope kararı, otomatik MISSING FEATURE değil.
- Existing project member'ı başka team'e doğrudan eklemek invitation taklidi değil.
- Disabled SMTP gerçek email teslimini doğrulamayı engeller; fake persistence veya kod bug'ı sayılmadı. Locale mail template English mevcut sınırdır.
- Eski dokümanlarda General/V35 açıklamaları ve create Swagger “existing email only” açıklaması mevcut source'a göre eskimiş; INFO documentation mismatch. Actual service external email destekler ve migration V36'dır.
- Doğrulanmış dead endpoint yok; legacy routes gerçek consumer/compatibility taşır. Bir endpoint'in tek frontend'de çağrılmaması tüm repo için dead-code kanıtı değildir.

## 19. Final Recommendation

Önce HIGH actor-cache izolasyonu, ardından expiry lifecycle ve legacy cache, sonra external error presentation minimum kapsamla giderilmeli. Yeni feature, genel refactor, otomatik General Team, auth widening veya ENV değişikliği önerilmedi. SMTP/inbox, diğer browser/device matrisi, deterministic team/issuer race ve global ADMIN live checks ayrı doğrulama sınırlarıdır.

**Production/backend/frontend/migration/test source/config değiştirilmedi. Commit/push/staging/pull/merge yapılmadı. Remediation tamamlandı iddiası yok.**

**Bu bulguları minimum kapsamla düzeltmemi ister misin?** Kullanıcı açık onay vermeden implementation'a geçilmeyecek.
