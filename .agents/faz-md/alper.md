# PDA — Alper Çalışma Planı

> **Sahip:** Alper Temiz  
> **Ana alan:** Auth Service / Identity & Access  
> **Proje:** PDA — Project Delivery Assistant  
> **Çalışma modeli:** Modular Monolith içinde servis sahipliği mantığı  
> **Tarih:** 26 Eylül 2026  
> **Durum:** Uygulama planı — task task ilerle, bir task bitmeden sonraki task'a geçme.

---

## 0. Bu dosyanın amacı

Bu dosya Alper'in sahip olduğu **Auth Service** alanını tek yerde toplar. Amaç, mikroservis projesindeki servis sahipliği mantığını PDA'nın mevcut **Spring Modulith / modular monolith** mimarisine uygulamaktır.

Bu dosya aşağıdaki konularda önceki planın ilgili kısımlarını günceller:

- Auth/User/UserSession backend sahipliği artık **Alper**'dedir.
- `admin`, `auth` ve `user` paketleri Alper'in ana çalışma alanıdır.
- Local login/register yanında **Google Login** ve **GitHub Login** eklenecektir.
- 27 Eylül 2026 geçiş kararı: register ve local login doğrudan çalışır; e-posta doğrulaması frontend auth fazına ertelenmiştir. Hesap `ACTIVE`, e-posta durumu `PENDING` kalır.
- 27 Eylül 2026 API kararı: register, login ve logout başarılı olduğunda `200 OK` döner; local register şifresi 8–128 karakterdir.
- Rol modeli aşağıda tanımlanan yeni yapıya göre uygulanacaktır.
- Admin, Auth Service kapsamına alınmıştır.

> **Önemli:** Bu dosya yalnızca yukarıdaki ürün/sahiplik kararlarını günceller. Güvenlik, modular monolith, PostgreSQL/Flyway, HttpOnly cookie, CSRF/CORS, secret yönetimi ve modül sınırı kuralları geçerliliğini korur.

---

# 1. Auth Service sınırı

## 1.1 Alper'in ana backend paketleri

Repo mevcut yapısı doğrulandıktan sonra ana çalışma alanı:

```text
backend/src/main/java/com/pda/
├── auth/       # ALPER
├── user/       # ALPER
├── admin/      # ALPER
└── shared/     # ORTAK — yalnız gerçekten ortak teknik ihtiyaç varsa
```

`shared` Alper'e ait bir servis değildir. Auth tarafından kullanılabilir ancak domain kodu `shared` içine taşınmaz.

## 1.2 Auth Service neyi yönetecek?

### Authentication

- Local register
- E-posta doğrulaması (frontend auth fazında etkinleştirilecek)
- Local login
- Logout
- Google ile giriş
- GitHub ile giriş
- Access JWT
- Refresh JWT
- Refresh rotation
- Refresh revocation
- Session yönetimi
- Password change
- İlk admin girişinde zorunlu password change

### User / Account

- User hesabı
- Email
- Nickname
- Password hash
- Account status
- Email verification status
- Temel profil
- Connected OAuth accounts
- Active sessions

### Authorization

- Global `ADMIN`
- Project role tanımları
- Permission/policy kuralları
- Spring Security authentication/authorization altyapısı
- 401 / 403 davranışı

### Admin

- ENV tabanlı ilk admin bootstrap
- İlk login password change
- Basit admin backend API'leri
- Basit admin panel
- Kullanıcıları görüntüleme / aktif-pasif yönetimi
- Proje özetini görüntüleme
- Session revoke gibi temel instance yönetimi

---

# 2. Auth Service dışı sınırlar

Auth Service aşağıdaki business logic'i **sahiplenmez**:

- Project CRUD
- Project'in fiziksel membership persistence'ı
- Squad business logic
- Task CRUD
- TaskAssignment
- Task workflow/history
- Issue
- TestReport
- Comment
- Activity business logic

Auth Service rol/permission tanımlarını sağlar; ancak **kullanıcının hangi projede hangi role sahip olduğu** Project Service'in proje üyeliği kaydı üzerinden tutulmalıdır.

Örnek:

```text
Auth Service:
PROJECT_MANAGER rolünün anlamını ve permission politikasını bilir.

Project Service:
User X'in Project Y içinde PROJECT_MANAGER olduğunu tutar.
```

Modüller birbirinin repository'sine doğrudan erişmez. Gerekirse public contract/facade kullanılır.

---

# 3. Authentication kararları

## 3.1 Local register

Register formu:

```text
Email
Nickname
Password
Confirm Password
```

`Confirm Password` yalnız request/UI doğrulaması içindir; persistence alanı değildir.

Geçiş döneminde kayıt başarılı olduğunda hesap doğrudan `ACTIVE` olur; doğrulanmamış e-posta `PENDING` olarak kalır. Login bu dönemde email verification istemez. Bu karar email'i `VERIFIED` işaretlemez.

Akış:

```text
REGISTER
   ↓
User oluştur
   ↓
Account ACTIVE, email verification PENDING
   ↓
Login yapılabilir
```

### Frontend auth fazına ertelenen e-posta doğrulama standardı

Aşağıdaki değerler implementation başlangıç varsayımıdır; kodlama sırasında ürün ihtiyacı değişirse ayrıca karar verilebilir:

- 6 haneli sayısal doğrulama kodu
- 10 dakika geçerlilik
- En fazla 5 yanlış deneme
- Yeniden gönderim için 60 saniye bekleme
- Kod veritabanında plaintext tutulmaz; hash saklanır
- Kullanılmış/expired kod tekrar kullanılamaz
- Endpoint rate limit uygulanır

> Bu akış frontend auth fazında backend verify/resend API ve UI birlikte hazır olduğunda yeniden etkinleştirilir. Geçiş döneminde register mail göndermez, verify/resend public değildir. Her login sırasında mail OTP istenmez.

## 3.2 Local login

- Email + password ile giriş
- Password BCrypt ile doğrulanır
- Geçiş döneminde `ACTIVE` ve email durumu `PENDING` olan local hesap login olabilir; `VERIFIED` yalnız gerçek doğrulama sonrası yazılır
- Disabled/blocked hesap login olamaz
- Başarılı login sonrası access + refresh token üretimi
- Tokenlar HttpOnly cookie ile taşınır
- Auth tokenları localStorage/sessionStorage/IndexedDB'ye yazılmaz

## 3.3 JWT ve session

- Access token kısa ömürlüdür; mevcut plan varsayılanı 15 dakika
- Refresh token mevcut plan varsayılanı 7 gün
- Refresh rotation zorunlu
- Refresh revoke desteklenir
- Persist edilen refresh token plaintext tutulmaz
- UserSession refresh token hash ve lifecycle bilgisini tutar
- Logout ilgili session'ı revoke eder
- Revoke edilmiş/eski refresh token yeni session üretemez
- Kullanıcı aktif sessionlarını görebilir
- Kullanıcı seçili session'ı sonlandırabilir

JWT mümkün olduğunca minimal tutulur. Project bazlı tüm roller JWT içine gömülmez.

Önerilen temel claim mantığı:

```text
sub = userId
sid = sessionId
globalRole = ADMIN | USER
```

Project-scoped authorization request sırasında ilgili project membership üzerinden doğrulanır.

## 3.4 Google Login

UI adı: **Google ile devam et**.

Akış:

```text
Google OAuth
   ↓
Provider identity doğrula
   ↓
Bağlı PDA hesabını bul / kontrollü hesap oluştur
   ↓
PDA kendi UserSession'ını oluşturur
   ↓
PDA access + refresh JWT üretir
   ↓
HttpOnly cookies
```

Google tokenı PDA access tokenı olarak kullanılmaz.

## 3.5 GitHub Login

Google akışıyla aynı temel prensip:

```text
GitHub OAuth
   ↓
Provider identity doğrula
   ↓
Connected identity bul / kontrollü hesap oluştur
   ↓
PDA session
   ↓
PDA JWT cookies
```

## 3.6 Account linking güvenlik kuralı

Aynı email'e sahip local hesap ile OAuth hesabı **sessizce otomatik merge edilmez**.

Mevcut hesap varsa kullanıcı önce mevcut hesabını doğrulamalı ve provider'ı hesap ayarından bağlamalıdır.

Connected Accounts örneği:

```text
Google   Connected / Not connected
GitHub   Connected / Not connected
```

---

# 4. Rol ve yetki modeli

## 4.1 Global rol

```text
ADMIN
```

`ADMIN` PDA instance seviyesindeki yöneticidir. Normal proje iş akışında Project Manager yerine geçmek zorunda değildir.

## 4.2 Project-scoped roller

Canonical rol tanımları Auth Service'te tutulacaktır:

```text
PROJECT_MANAGER
MODERATOR
BACKEND_DEVELOPER
FRONTEND_DEVELOPER
FULL_STACK_DEVELOPER
AI_ML_DEVELOPER
UI_UX_DEVELOPER
TESTER
ANALYST
```

Bir kullanıcının farklı projelerde farklı rolleri olabilir.

Role assignment'ın hangi kullanıcı + hangi proje için geçerli olduğu Project Service membership kaydı üzerinden tutulur.

## 4.3 PROJECT_MANAGER

Project Manager projenin yöneticisidir.

Yetkiler:

- Proje oluşturabilir
- Proje ayarlarını değiştirebilir
- Projeyi archive/silebilir
- Kullanıcı davet edebilir
- Üye çıkarabilir
- Proje içi rol atayabilir/değiştirebilir
- Moderator atayabilir
- Task oluşturabilir
- Task düzenleyebilir
- Task atayabilir
- Multi-assignee yönetebilir
- Deadline belirleyebilir/değiştirebilir
- Priority değiştirebilir
- Task status değiştirebilir
- Task kapatabilir/reopen edebilir
- Block/unblock yapabilir
- Label/Milestone yönetebilir
- Issue/TestReport/Activity verilerini görebilir

Projeyi oluşturan kullanıcı otomatik olarak `PROJECT_MANAGER` olur.

Bir projede birden fazla Project Manager bulunabilir.

## 4.4 MODERATOR

Moderator, task yönetimi konusunda Project Manager yardımcısıdır.

Yapabilir:

- Task oluşturma
- Task düzenleme
- Task atama / assignee değiştirme
- Deadline belirleme/değiştirme
- Priority değiştirme
- Task status değiştirme
- Block/unblock
- Task kapatma/reopen
- Mevcut label/milestone'u task'a bağlama
- Issue/comment/task operasyonlarını yönetme

Yapamaz:

- Proje oluşturma
- Proje silme/archive
- Proje temel ayarlarını değiştirme
- Üye davet etme
- Üye çıkarma
- Project Manager atama
- Moderator atama
- Proje üyelerinin rolünü değiştirme

## 4.5 Developer rolleri

Aşağıdaki roller temel contributor davranışını paylaşır:

```text
BACKEND_DEVELOPER
FRONTEND_DEVELOPER
FULL_STACK_DEVELOPER
AI_ML_DEVELOPER
UI_UX_DEVELOPER
ANALYST
```

Temel yetkiler:

- Üyesi olduğu projeyi görüntüleme
- Projedeki taskları görüntüleme
- Kendisine atanmış task üzerinde çalışma
- İzin verilen task lifecycle geçişlerini yapma
- Comment ekleme
- Issue açma
- Activity görüntüleme

Varsayılan olarak yapamaz:

- Başkasına task atama
- Proje genelinde task oluşturma
- Deadline değiştirme
- Project role yönetme
- Üye yönetme
- Proje ayarı değiştirme

## 4.6 TESTER

`TESTER` temel contributor haklarına ek olarak TestReport akışında özel capability alabilir:

- TestReport oluşturma
- Test sonucu girme
- Test sonucu güncelleme (iş kuralı izin veriyorsa)

Bu capability backend authorization ile açıkça test edilmelidir.

---

# 5. Admin kararı

Admin Auth Service içinde geliştirilecektir.

## 5.1 Bootstrap

Mevcut ENV yaklaşımı korunur:

```text
ADMIN_EMAIL
ADMIN_INITIAL_PASSWORD
```

İlk startup:

```text
Admin yok
   ↓
ENV oku
   ↓
ADMIN oluştur
   ↓
Password BCrypt hash
   ↓
mustChangePassword = true
```

Admin zaten varsa restart mevcut hesabı overwrite etmez.

İlk login sonrası zorunlu password change yapılır.

## 5.2 Basit Admin Panel V1

### Dashboard

- Total users
- Total projects
- Uygulama health bilgisi

### Users

- Kullanıcı listesi
- Kullanıcı detayını görüntüleme
- Account active/disabled durumu
- Gerekirse active session revoke

### Projects

- Projeleri listeleme
- Proje detayını görüntüleme
- Gerekirse yönetimsel archive/deactivate işlemi

### System

- Uygulama versiyonu
- Mail enabled/disabled
- Mail provider adı
- API docs enabled/disabled
- Health status

Admin panel aşağıdaki secret değerleri **asla göstermez**:

```text
JWT_SECRET
DB_PASSWORD
SMTP_PASSWORD
BREVO_API_KEY
OAuth client secrets
```

---

# 6. Auth'a özel mail yaklaşımı

Mail ayrı deploy edilen servis yapılmayacaktır.

Auth Service aşağıdaki mail use-case'lerini sahiplenir:

- Frontend auth fazında register email verification
- Frontend auth fazında verification code resend
- Güvenlik açısından gerekli hesap bildirimleri
- İleride password reset eklenirse ilgili mail akışı

Mevcut ortak SMTP/Brevo transport altyapısı varsa reuse edilir. Yoksa domain'den bağımsız transport adapter kontrollü şekilde ortak altyapıda konumlandırılabilir.

Auth domain kodu doğrudan SMTP/Brevo detayına bağımlı olmamalıdır; application port/interface üzerinden çağırıp infrastructure adapter kullanmalıdır.

---

# 7. Uygulama fazları

Her faz kendi branch/PR/task'ı ile ilerler. Bir fazın acceptance kriterleri geçmeden sonraki bağımlı faz tamamlanmış sayılmaz.

---

## FAZ 0 — Repo ve gerçek kod durumu keşfi

### ALP-AUTH-00 — Source-of-truth audit

**Amaç:** Kod yazmadan önce repo içindeki gerçek yapıyı ve mevcut implementasyonu doğrulamak.

Codex şu dosyaları önce okumalıdır:

```text
AGENTS.md
.agents/SECURITY.md
.agents/architecture.md
.agents/folder-structure.md
.agents/authentication.md
.agents/database.md
.agents/api.md
.agents/decisions/0001-modular-monolith.md
.agents/decisions/0002-postgresql.md
.agents/decisions/0003-cookie-auth.md
```

Ayrıca:

```text
backend/src/main/java/com/pda/auth/**
backend/src/main/java/com/pda/user/**
backend/src/main/java/com/pda/admin/**
backend/src/test/java/com/pda/**
backend/src/main/resources/db/migration/**
frontend/**
docs/compliation/**
```

mevcut durum için incelenmelidir.

**Çıktı:**

- Gerçek mevcut dosya ağacı
- Var olan auth kodları
- Placeholder/.gitkeep alanları
- Mevcut migration son numarası
- Mevcut Spring Security config
- Mevcut frontend auth yapısı
- Yeni dependency gereksinimleri
- Yeni ENV gereksinimleri
- Conflict riski

**Acceptance:** Kod değişikliği yok. Önce keşif raporu ve uygulama planı çıkar.

---

## FAZ 1 — User Identity + UserSession persistence

### ALP-AUTH-01 — User domain/persistence

**Kapsam:**

- User identity modeli
- Email unique
- Nickname unique/validation politikası
- Password hash
- Account status
- Email verification status
- created/updated timestamps

**Dosya scope:** Gerçek repo yapısı doğrulandıktan sonra `com.pda.user` altında domain/application/infrastructure katmanları.

**Test:**

- Repository tests
- Validation tests
- Duplicate email
- Duplicate nickname
- Password plaintext persist edilmediğinin doğrulanması

### ALP-AUTH-02 — UserSession persistence

**Kapsam:**

- Session identity
- User relation
- Refresh token hash
- CreatedAt
- ExpiresAt
- RevokedAt / revoked state
- LastUsedAt
- User-agent gibi güvenli metadata (uygunsa)

**Test:**

- Session create/read/revoke
- Expired/revoked filtering
- Refresh plaintext DB'de yok

### ALP-AUTH-03 — Flyway migration

Schema değişiklikleri yalnız gerçek mevcut migration dizisi incelendikten sonra yapılır.

**Kurallar:**

- Mevcut en son migration numarasını doğrula
- Hamza'nın paralel migration geliştirip geliştirmediğini kontrol ettir
- Çakışabilecek migration numarası üretme
- `ddl-auto=validate` ile uyumlu ol

**Gate:** Migration + repository testleri yeşil.

---

## FAZ 2 — Doğrudan Register (27 Eylül 2026 kararı)

**Mevcut kod durumu:** `ALP-AUTH-04` yeni doğrudan kayıt davranışıyla uygulanmıştır. `ALP-AUTH-05`–`07` backend hazırlığı ve `V3` migration'ı korunur; verify/resend public değildir. `V4` migration'ı önceki sürümde oluşmuş pending local hesapları email durumunu değiştirmeden aktif yapar. Kodun varlığı email doğrulamanın şu anda kullanıcıdan istendiği anlamına gelmez.

### ALP-AUTH-04 — Register API

**Kapsam:**

- Email
- Nickname
- Password
- Confirm password request validation
- BCrypt
- Duplicate kullanıcı kontrolü
- Account doğrudan `ACTIVE`; email verification status `PENDING`
- Register sırasında mail veya doğrulama kodu zorunlu değil

### ALP-AUTH-05 — Verification code lifecycle

**Durum:** Backend hazırlığı saklanır; public akış frontend auth fazına ertelendi.

**Kapsam:**

- Kod üretme
- Hash saklama
- Expiry
- Attempt count
- Consume/use-once
- Resend cooldown

### ALP-AUTH-06 — Verification mail integration

**Durum:** Backend hazırlığı saklanır; register sırasında çağrılmaz. Entegrasyon frontend auth fazında etkinleştirilir.

**Kapsam:**

- Mail port/interface
- Mevcut SMTP/Brevo altyapısını reuse
- Mail başarısız olduğunda güvenli hata davranışı
- Secret loglama yok

### ALP-AUTH-07 — Verify / resend API

**Durum:** Public endpoint'ler kapalıdır; frontend auth fazında yeniden etkinleştirilir.

**Kapsam:**

- Verify endpoint
- Resend endpoint
- Expired/wrong/already-used kod durumları
- Rate limit baseline

**FAZ 2 Gate:**

```text
register → ACTIVE user (email verification PENDING) → doğrudan local login
```

entegrasyon testi geçmeli.

---

## FAZ 3 — Local Login + Logout + JWT

**Mevcut kod durumu:** `ALP-AUTH-08`–`11` backend'de uygulanmıştır; JWT access/refresh HttpOnly cookie, aktif session kontrolü ve logout revoke entegrasyon testleri vardır. `ALP-AUTH-12`–`14` (Faz 4: refresh rotation, reuse/replay koruması, aktif oturum API'leri) 27 Eylül 2026'da backend'de tamamlanmıştır; kayıt: `docs/compliation/2026-09-27-auth-faz-4.md`. Active session UI Faz 9 işidir. Production domain topolojisi ayrıca doğrulanmalıdır.

### ALP-AUTH-08 — Login API

- Email/password authentication
- BCrypt verification
- `ACTIVE` hesap kontrolü; geçiş döneminde email verification `PENDING` login'i engellemez
- Disabled user kontrolü
- Başarılı/başarısız login

### ALP-AUTH-09 — JWT generation/validation

- Access JWT
- Refresh JWT/session binding
- JWT signing secret yalnız backend ENV
- Safe claims
- Expiration

### ALP-AUTH-10 — HttpOnly cookie contract

- Access cookie
- Refresh cookie
- HttpOnly
- Production Secure=true
- Geçiş sözleşmesi: `SameSite=Lax`, host-only; HTTP local dev `Secure=false`, HTTPS/production `Secure=true`. Domain topolojisi kesinleşince tekrar doğrula
- Token browser storage'a yazılmaz

### ALP-AUTH-11 — Logout

- İlgili session revoke
- Cookie temizleme
- Revoke sonrası refresh başarısız

**FAZ 3 Gate:**

```text
ACTIVE local user (email PENDING) → login → authenticated request → logout → session revoked
```

---

## FAZ 4 — Refresh Rotation + Active Sessions

### ALP-AUTH-12 — Refresh endpoint

- Refresh hash doğrulama
- Expiry
- Rotation
- Eski refresh invalidate
- Yeni session/token state

### ALP-AUTH-13 — Refresh reuse/replay protection

- Revoke edilmiş token yeniden kullanılamaz
- Beklenen güvenli hata
- Şüpheli replay davranışı test edilir

### ALP-AUTH-14 — Active sessions API

- Kendi sessionlarını listeleme
- Tek session revoke
- Gerekirse diğer tüm sessionları revoke

**FAZ 4 Gate:**

```text
login → refresh → old refresh rejected → session list → revoke → access denied as expected
```

---

## FAZ 5 — Google OAuth Login

### ALP-AUTH-15 — OAuth dependency/config discovery

Önce mevcut `pom.xml` ve config doğrulanır.

> Yeni dependency veya `.env/.env.example` değişikliği gerekiyorsa **kodlamadan önce kullanıcı onayı iste**.

Muhtemel yeni config ihtiyacı implementation sırasında belirlenecektir; secret isimlerini kendiliğinden kesinleştirme.

### ALP-AUTH-16 — Google provider login

- OAuth2/OIDC provider validation
- Provider identity model
- Existing connected account lookup
- New account onboarding
- PDA UserSession
- PDA JWT cookies

### ALP-AUTH-17 — Google account linking

- Otomatik unsafe email merge yok
- Authenticated user provider bağlayabilir
- Disconnect güvenlik koşulları

**FAZ 5 Gate:** Google login gerçek test/dev provider konfigürasyonuyla doğrulanabilir hale gelmeli.

---

## FAZ 6 — GitHub OAuth Login

### ALP-AUTH-18 — GitHub provider login

Google ile aynı güvenlik modeli:

- Provider identity doğrulama
- Connected account lookup
- Onboarding
- PDA session/JWT

### ALP-AUTH-19 — GitHub account linking

- Connect
- Disconnect
- Duplicate/linked-to-another-account güvenlik senaryoları

**FAZ 6 Gate:** GitHub login ve account linking senaryoları testli.

---

## FAZ 7 — Role / Permission Authorization

### ALP-AUTH-20 — Canonical role model

Tanımlar:

```text
ADMIN
PROJECT_MANAGER
MODERATOR
BACKEND_DEVELOPER
FRONTEND_DEVELOPER
FULL_STACK_DEVELOPER
AI_ML_DEVELOPER
UI_UX_DEVELOPER
TESTER
ANALYST
```

Auth Service rol tanımlarının canonical kaynağı olur.

### ALP-AUTH-21 — Permission policy

- Global ADMIN policy
- Project Manager policy
- Moderator task-management policy
- Developer contributor policy
- Tester capability
- Deny-by-default

### ALP-AUTH-22 — Project authorization contract

Project Service'in projectId + userId bağlamında rol/üyelik bilgisini güvenli şekilde sağlayacağı public contract tanımlanır.

Auth modülü Project repository/entity'sine doğrudan erişmez.

### ALP-AUTH-23 — Security tests

- Role allow/deny
- Cross-project access denied
- Moderator project management denied
- Developer unauthorized task-management denied
- Tester report capability

**FAZ 7 Gate:** Her hassas endpointin açık authorization kuralı vardır.

---

## FAZ 8 — Admin Backend

### ALP-AUTH-24 — Admin bootstrap

- ADMIN_EMAIL
- ADMIN_INITIAL_PASSWORD
- İlk startup create-if-absent
- BCrypt
- Restart overwrite yok
- mustChangePassword

### ALP-AUTH-25 — First-login password change

- Admin ilk login sonrası zorunlu değişiklik
- Initial password tekrar runtime authority sağlamaz

### ALP-AUTH-26 — Admin user management API

- User list/detail
- Active/disabled status
- Session revoke

### ALP-AUTH-27 — Admin project/system overview API

- Project overview
- System health/status
- Secret değer gösterme yok

**FAZ 8 Gate:** Admin bootstrap + first-login + temel admin API security testleri yeşil.

---

## FAZ 9 — Frontend Auth / User / Admin

> Frontend'in gerçek klasör yapısı Faz 0'da doğrulanmadan yeni path uydurulmaz.

### ALP-AUTH-28 — Register UI

- Email
- Nickname
- Password
- Confirm password
- Inline validation
- Loading/error

### ALP-AUTH-29 — Email verification UI

- Önce ertelenen `ALP-AUTH-05`–`07` backend verify/resend akışını tekrar etkinleştir ve güvenlik testlerini güncelle
- Yeni register hesaplarına doğrulama zorunluluğunun ne zaman uygulanacağını ve mevcut `ACTIVE/PENDING` hesapların geçişini açık kararla belirle

- Code input
- Countdown
- Resend
- Expired/wrong code states

### ALP-AUTH-30 — Login UI

- Email/password
- Google ile devam et
- GitHub ile devam et
- Loading/error

### ALP-AUTH-31 — Auth state + protected routes

- Cookie based auth
- `localStorage/sessionStorage` token yok
- 401 handling
- Refresh integration
- Protected pages

### ALP-AUTH-32 — Account/Profile UI

- Nickname/profile
- Password change
- Connected Accounts

### ALP-AUTH-33 — Active Sessions UI

- Session list
- Current session indicator
- Revoke action

### ALP-AUTH-34 — Admin Panel

- Overview
- Users
- Projects overview
- System status
- Secret gösterme yok

---

## FAZ 10 — Final Security / E2E / Documentation Gate

### ALP-AUTH-35 — Backend regression

- Unit
- Service
- Repository
- Validation
- Security
- MockMvc/API
- Integration
- Testcontainers PostgreSQL

### ALP-AUTH-36 — Auth E2E

Minimum gerçek akışlar:

```text
Geçiş dönemi: Register → Login → Protected Route → Refresh → Logout
Frontend auth fazı sonrası: Register → Verify Email → Login → Protected Route → Refresh → Logout
Login → Active Sessions → Revoke Session
Google Login → PDA Session
GitHub Login → PDA Session
Admin First Login → Forced Password Change → Admin Panel
Project Role Allow / Deny flows
```

### ALP-AUTH-37 — Security final pass

Kontrol:

- Secret hardcode yok
- Token browser storage yok
- CSRF bypass yok
- Unsafe CORS wildcard yok
- Password/token/cookie log yok
- Stack trace/SQL detail response yok
- Refresh plaintext DB'de yok
- Cross-project authorization bypass yok
- Swagger sample secret yok

### ALP-AUTH-38 — Docs / handoff

Gerçek tamamlanan implementasyona göre:

- Auth docs güncelle
- API docs güncelle
- Yeni ENV varsa onay sonrası `.env.example` güncelle
- Swagger doğrulama adımları
- `docs/compliation/YYYY-MM-DD-auth-service.md` tamamlanma kaydı
- Test sonuçları
- Açık riskler

**Final Gate:** pre-push quality gate başarılı olmadan push önerilmez.

---

# 8. Git / branch çalışma standardı

Örnek:

```text
feature/ALP-AUTH-01-user-persistence
feature/ALP-AUTH-04-register-api
feature/ALP-AUTH-08-login-api
feature/ALP-AUTH-12-refresh-rotation
feature/ALP-AUTH-16-google-login
feature/ALP-AUTH-18-github-login
feature/ALP-AUTH-24-admin-bootstrap
feature/ALP-AUTH-30-login-ui
```

Kurallar:

- Bir PR mümkün olduğunca tek task ID
- Unrelated refactor yok
- Shared/high-conflict dosya değişikliği önceden raporlanır
- Migration numarası paralel geliştirici ile çakıştırılmaz
- PR öncesi ilgili test/build suite çalıştırılır
- Push/merge insan geliştirici tarafından yapılır

---

# 9. Codex için zorunlu çalışma kuralları

Codex her taskta aşağıdaki sırayı uygular.

## Task öncesi

1. `AGENTS.md` oku.
2. `.agents/SECURITY.md`, `.agents/architecture.md`, `.agents/folder-structure.md` oku.
3. Task auth/user/admin ise ilgili auth/database/API/ADR belgelerini oku.
4. Plan belgesini uygulanmış kod kabul etme; gerçek source tree'yi incele.
5. Doğru path'i kendin bul; var olmayan klasör/dosya uydurma.
6. Bağımlılıkları doğrula.
7. Dokunulacak dosyaları listele.
8. Migration gerekip gerekmediğini söyle.
9. API contract etkisini söyle.
10. Shared/config conflict riskini söyle.
11. Test planını yaz.
12. Kullanıcı onayı gereken güvenlik/config değişikliği varsa kodlama yapmadan dur.

## Özellikle DUR ve onay iste

Aşağıdakilerden biri gerekiyorsa:

- `.env` değişikliği
- `.env.example` değişikliği
- Yeni secret/env variable
- OAuth client secret/config contract
- `pom.xml` dependency ekleme/değiştirme shared ownership conflict yaratıyorsa
- Global security davranışı değiştirme
- CSRF/CORS gevşetme
- Yeni public endpoint açma kararı belirsizse
- Başka modülün entity/repository'sine doğrudan erişme ihtiyacı oluşursa
- Mimari plandan sapma gerekirse

## Task sonrası

Codex şu raporu üretir:

```text
Task ID:
Durum:
Tamamlanan değişiklikler:
Değişen dosyalar:
Migration:
ENV etkisi:
API/endpointler:
Auth/role gereksinimleri:
Çalıştırılan testler:
Sonuçlar:
Açık risk/borç:
Sonraki task için handoff:
```

---

# 10. CODEX MASTER PROMPT

Aşağıdaki prompt yeni bir Codex oturumunun başında kullanılabilir.

```text
PDA — Project Delivery Assistant üzerinde çalışıyorsun.

Ben Alper'im ve Auth Service'in sahibiyim. Bu projede mikroservis gibi servis sahipliği kullanıyoruz ancak gerçek mimari Modular Monolith + Spring Modulith'tir. Ayrı deploy edilen auth microservice oluşturma.

BENİM SCOPE'UM:
- backend/src/main/java/com/pda/auth/**
- backend/src/main/java/com/pda/user/**
- backend/src/main/java/com/pda/admin/**
- bu alanların backend testleri
- ilgili frontend auth/user/admin feature'ları
- gerekli Auth Service migration'ları

shared/** ortak alandır; domain kodunu oraya taşıma ve gereksiz değişiklik yapma.

ÖNCE MUTLAKA OKU:
1. AGENTS.md
2. .agents/SECURITY.md
3. .agents/architecture.md
4. .agents/folder-structure.md
5. .agents/authentication.md
6. .agents/database.md
7. .agents/api.md
8. .agents/decisions/0001-modular-monolith.md
9. .agents/decisions/0002-postgresql.md
10. .agents/decisions/0003-cookie-auth.md
11. docs/compliation/ içindeki ilgili önceki teslimler
12. alper.md

Plan dosyalarını uygulanmış kod sanma. Önce gerçek repo tree'sini ve mevcut kodu incele. Doğru dosya yollarını kendin bul. Var olmayan path, class veya config uydurma.

YENİ KİLİTLİ AUTH KARARLARI:
- Auth Service = auth + user + admin.
- Local register: email + nickname + password + confirm password.
- Geçiş döneminde register doğrudan `ACTIVE`, email durumu `PENDING`; login mail doğrulaması istemez. Email verification frontend auth fazına ertelendi.
- Local login/logout olacak.
- Google Login olacak.
- GitHub Login olacak.
- PDA kendi access + refresh JWT'sini üretir.
- Access/refresh token yalnız HttpOnly cookie'de taşınır.
- localStorage/sessionStorage/IndexedDB'ye auth token yazılmaz.
- Refresh rotation + revocation zorunlu.
- Persist edilen refresh token plaintext olmaz.
- User active sessions görüntüleyip revoke edebilir.
- OAuth hesabı aynı email gerekçesiyle sessizce mevcut hesaba merge edilmez.
- Global ADMIN Auth Service kapsamındadır.
- Admin ENV'den ilk startup'ta oluşturulur ve ilk login'de password değiştirmek zorundadır.

PROJECT ROLLERİ:
- PROJECT_MANAGER
- MODERATOR
- BACKEND_DEVELOPER
- FRONTEND_DEVELOPER
- FULL_STACK_DEVELOPER
- AI_ML_DEVELOPER
- UI_UX_DEVELOPER
- TESTER
- ANALYST

PROJECT_MANAGER proje yönetimini yapar.
MODERATOR yalnız task operasyonlarında PM yardımcısıdır; proje oluşturamaz/silemez, üye/rol yönetemez.
Developer roller temel contributor haklarına sahiptir.
TESTER TestReport capability alabilir.

Auth Service rol/permission tanımlarını sahiplenir; kullanıcının hangi project'te hangi role sahip olduğu Project Service membership kaydıdır. Başka modülün repository/entity'sine doğrudan erişme. Gerekirse public contract/facade kullan.

GÜVENLİK:
- BCrypt kullan.
- CSRF'yi kolaylık için kapatma.
- Production CORS wildcard kullanma.
- Secret hardcode etme.
- Password/JWT/cookie/refresh token/secret loglama.
- ProblemDetail hata standardını koru.
- Backend authorization source-of-truth'tur.
- Deny-by-default davranışı koru.
- Cross-project erişimi engelle.

ÖNEMLİ ONAY KURALI:
.env veya .env.example değişikliği, yeni ENV/secret, OAuth provider config, güvenlik mimarisi değişikliği veya shared/high-conflict dosya değişikliği gerekiyorsa önce raporla ve kullanıcı onayı almadan değiştirme.

Git push, merge, release veya GitHub repo ayarı yapma.

HER TASK ÖNCESİ ŞUNU ÇIKAR:
- Task ID / amaç
- Dependency hazır mı?
- Mevcut kod durumu
- Dokunulacak gerçek dosyalar
- Migration ihtiyacı
- ENV/config etkisi
- API contract etkisi
- Security etkisi
- Conflict riski
- Test planı
- Acceptance criteria

Sonra yalnız o task'ın scope'unda implementasyon yap.

HER TASK SONRASI ŞUNU ÇIKAR:
- Tamamlananlar
- Değişen dosyalar
- Migration
- ENV etkisi
- Endpointler ve auth/role gereksinimleri
- Test komutları ve sonuçları
- Açık riskler
- Bir sonraki task handoff'u

Şu anda sadece bana verdiğim task ID üzerinde çalış. Sonraki faza kendiliğinden geçme.
```

---

# 11. İlk çalışma promptu — bugün başlamak için

Önce yalnız **FAZ 0 / ALP-AUTH-00** çalıştırılması önerilir.

```text
PDA repo'sunda alper.md dosyasını ve AGENTS.md tarafından işaret edilen zorunlu belgeleri oku.

Sadece ALP-AUTH-00 — Source-of-truth audit görevini yap.

Henüz kod değiştirme.

Şunları doğrula ve raporla:
1. backend/src/main/java/com/pda/auth gerçek içeriği
2. backend/src/main/java/com/pda/user gerçek içeriği
3. backend/src/main/java/com/pda/admin gerçek içeriği
4. mevcut Spring Security configuration
5. mevcut User/UserSession entity veya migration olup olmadığı
6. backend/src/main/resources/db/migration içindeki son gerçek migration
7. mevcut auth testleri
8. frontend içindeki mevcut auth/user/admin yapı ve gerçek path'ler
9. pom.xml içinde auth, security, JWT ve OAuth için mevcut dependency'ler
10. OAuth için eksik dependency/config ihtiyacı
11. email verification için mevcut mail abstraction/adapter olup olmadığı
12. yeni ENV ihtiyacı olup olmadığı
13. shared/high-conflict dosyalara dokunma gereksinimi
14. eski plan belgeleriyle alper.md arasındaki bilinçli supersede edilen noktalar
15. ALP-AUTH-01 için önerilen gerçek dosya scope'u ve test planı

.env, .env.example, pom.xml, security config veya migration üzerinde değişiklik yapma. Yalnız keşif raporu ver ve ALP-AUTH-01 başlamadan önce benden onay bekle.
```

---

# 12. Definition of Done — Auth Service

Auth Service tamamlandı denebilmesi için minimum:

- [ ] Local register çalışıyor
- [ ] Email verification frontend auth fazında yeniden etkinleştirildi ve mevcut `ACTIVE/PENDING` hesap geçişi kararlaştırıldı
- [ ] Local login/logout çalışıyor
- [ ] Access + refresh HttpOnly cookie çalışıyor
- [ ] Refresh rotation/revocation testli
- [ ] Active sessions görüntüleme/revoke çalışıyor
- [ ] Google Login çalışıyor
- [ ] GitHub Login çalışıyor
- [ ] Unsafe automatic OAuth account merge yok
- [ ] User profile/account akışı çalışıyor
- [ ] Project role definitions/policies uygulanmış
- [ ] PROJECT_MANAGER permissionları testli
- [ ] MODERATOR yalnız task-management yetkileriyle sınırlandırılmış
- [ ] Developer role authorization testli
- [ ] TESTER capability testli
- [ ] Admin bootstrap çalışıyor
- [ ] Admin first-login password change zorunlu
- [ ] Basit admin panel çalışıyor
- [ ] Token browser storage'a yazılmıyor
- [ ] Password/refresh token plaintext persist edilmiyor
- [ ] CSRF/CORS/security kontrolleri geçiyor
- [ ] Cross-project access testleri geçiyor
- [ ] Backend regression yeşil
- [ ] Frontend build/lint/type-check yeşil
- [ ] Kritik Playwright E2E akışları yeşil
- [ ] Swagger/API davranışı güncel
- [ ] Completion/handoff dokümanı yazılmış
- [ ] Pre-push quality gate başarılı

---

## Son kural

**Tek seferde bütün Auth Service'i yazma.**

Sıra:

```text
FAZ 0 → FAZ 1 → FAZ 2 → FAZ 3 → FAZ 4 → FAZ 5 → FAZ 6 → FAZ 7 → FAZ 8 → FAZ 9 → FAZ 10
```

Her faz sonunda test + kullanıcı kontrolü + handoff yapılır. Onay olmadan bağımlı sonraki faza geçilmez.
