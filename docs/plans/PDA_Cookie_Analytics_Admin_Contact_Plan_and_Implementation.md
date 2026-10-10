# PDA — Cookie Consent, Privacy-Safe Analytics, Admin Panel & Public Contact System

PDA için birbiriyle ilişkili dört ana özellik geliştirilecek:

1. KVKK uyumlu Cookie Consent / Cookie Preferences sistemi.
2. Kullanıcıların site kullanımını ölçen Analytics altyapısı ve Admin Analytics Dashboard.
3. Admin paneli üzerinden kullanıcı hesaplarının görüntülenmesi ve üyeliklerinin sonlandırılması.
4. Kayıt olmamış kullanıcıların da kullanabileceği public Contact formu ve Footer'da Cookie Policy erişimi.

Bu maddeleri yazıldıkları sırayla körlemesine implement etme.

Önce repository'yi incele, mevcut authentication, users, roles, email, frontend layout, footer, privacy/legal, analytics, database ve admin altyapısını çıkar.

Ardından gerçek dependency graph'a göre taskları sırala.

Her task tamamlanmadan bağımlı task'a geçme.

---

# TEMEL ÜRÜN KARARLARI

Aşağıdaki kararlar bu feature'ın source-of-truth ürün davranışlarıdır.

## Cookie / Analytics

- Analytics çerezleri ve analytics tracking **default olarak kapalı** olacak.
- Kullanıcı açıkça analytics'e izin vermeden analytics davranışsal veri toplama başlamayacak.
- Necessary / Strictly Necessary kategorisi gerekiyorsa default aktif ve kapatılamaz olabilir.
- Analytics kategorisi default:

```text
OFF
```

olmalı.

- Kullanıcıya:
  - Tümünü Kabul Et
  - Tümünü Reddet
  - Tercihleri Yönet

seçenekleri sunulmalı.

- Analytics consent sonradan geri çekilebilmeli.
- Consent geri çekildiğinde yeni analytics event gönderimi anında durmalı.
- Analytics amacıyla oluşturulmuş non-essential client identifier/cookie/local state varsa güvenli biçimde temizlenmeli.
- Cookie banner kullanıcıyı "Kabul Et" seçeneğine zorlayan dark-pattern tasarıma sahip olmamalı.

## Analytics kapsamı

Admin aşağıdaki verileri görebilmeli:

```text
- Site ziyaretleri
- Unique visitor/session sayıları
- Trafik kaynakları
- Direct giriş
- Search engine üzerinden giriş
- Referral / başka siteden geliş
- Paylaşılan/campaign link üzerinden geliş
- UTM source / medium / campaign varsa bunlar
- Ortalama ziyaret / engagement süresi
- Tarihe göre ziyaret trendi
- Kayıt olan hesapların sayısı
- Tarihe göre registration trendi
- Aktif kullanıcı hesabı sayısı
- Sonlandırılmış kullanıcı hesabı sayısı
- Genel iletişim formu gönderim sayısı
- Tarihe göre iletişim talebi trendi
```

Ancak:

> Behavioral analytics ile operational business metrics aynı şey değildir.

### Consent gerektiren analytics

Örneğin:

```text
page view
visitor/session
traffic source
referrer
UTM
entry page
engagement/session duration
```

analytics consent olmadan toplanmamalı.

### Analytics consent'e bağlı OLMAYAN operasyonel metrikler

Aşağıdaki veriler kendi authoritative backend kaynaklarından alınmalı:

```text
registered account count
active account count
terminated account count
successful contact request count
```

Bunları analytics cookie kabulüne bağlama.

Örneğin kullanıcının analytics consent vermemiş olması:

```text
hesabının registration metric'inde sayılmamasına
```

sebep olmamalı.

---

# "AKTİF KULLANICI" TANIMI

Bu taskta:

```text
Aktif kullanıcı = hesabı sistem tarafından aktif durumda olan kullanıcı
```

anlamına gelir.

Bu:

```text
şu anda online olan kullanıcı
```

anlamına gelmez.

Sırf bu feature için WebSocket/presence/real-time online tracking sistemi kurma.

Repository'de zaten güvenilir lastSeen / presence sistemi varsa plan sırasında ayrıca raporla; ancak kullanıcı yönetimi için zorunlu değildir.

---

# CONTACT FORM DAVRANIŞI

Public bir:

```text
İletişim
```

sayfası oluşturulacak.

Kullanıcı login olmak zorunda olmayacak.

Form minimum olarak:

```text
Ad
Soyad
E-posta
Mesaj
```

alanlarını içermeli.

Başarılı submission sonucunda mail otomatik olarak:

```text
pdassistant@gmail.com
```

adresine gönderilmeli.

Ancak SMTP credential veya password kod içerisine hard-code edilmemeli.

Mevcut mail infrastructure/config varsa reuse edilmeli.

Mail:

```text
From: PDA'nın doğrulanmış mail adresi
To: pdassistant@gmail.com
Reply-To: kullanıcının forma yazdığı email
```

mantığında olmalı.

Kullanıcının email adresini doğrudan `From` olarak kullanma.

Header injection / CRLF injection engellenmeli.

---

# ÇALIŞMA MODELİ

İlk turda production kodu değiştirmeye başlama.

Önce audit yap.

Özellikle aşağıdaki alanları incele:

```text
Authentication
User entity
User status / enabled / active alanları
Admin role / permissions
Session/JWT/cookie authentication
Logout/session revocation
EmailSettings / SMTP service
Existing email templates
Rate limiting
CSRF
CORS
AppShell
Footer
Public routes
Authenticated routes
Admin routes
Existing admin components
Cookie usage
localStorage/sessionStorage usage
analytics dependency/package/script varsa
Privacy/KVKK pages
i18n TR/EN/DE
Database/Flyway
Playwright
Spring Modulith/module boundaries
```

Mevcut infrastructure varken paralel ikinci sistem oluşturma.

---

# PERSISTENT PLAN

Repository root'unda:

```text
PDA_COOKIE_ANALYTICS_ADMIN_CONTACT_PLAN.md
```

oluştur.

Bu dosya implementation boyunca source of truth olacak.

Taskları repository'nin gerçek dependency sırasına göre oluştur.

Her task şu yapıda olmalı:

```md
## Task N — ...

### Amaç
...

### Neden bu sırada?
...

### Prerequisite
...

### Etkilenecek alanlar
- Backend:
- Database:
- Frontend:
- Authentication:
- Privacy:
- Analytics:
- Email:
- Cache:
- Security:
- i18n/a11y:
- Tests:

### Checklist
- [ ] N.1 ...
- [ ] N.2 ...
- [ ] N.3 ...

### Definition of Done
- [ ] ...
- [ ] ...
```

Implementation sırasında checkboxlar gerçekten güncellenecek:

```text
[ ]
```

→

```text
[x]
```

Zorunlu çalışma akışı:

```text
implementation
→ targeted test
→ gerekli bug fix
→ targeted re-test
→ Definition of Done
→ checkbox [x]
→ sonraki bağımlı task
```

Bir taskın DoD'si tamamlanmadan bağımlı task'a geçme.

Kullanıcı plan dosyasından ilerlemeyi görebilmeli.

---

# PART A — PREFLIGHT / PRIVACY & DATA AUDIT

## 1. Mevcut cookie kullanımını çıkar

Repository'de kullanılan tüm cookie'leri ve browser storage davranışlarını tespit et.

Her biri için mümkün olduğunca belirle:

```text
name
owner
purpose
necessary / analytics / other
expiration
HttpOnly
Secure
SameSite
client-readable mı
```

Authentication/session/CSRF gibi gerçekten necessary cookie'leri analytics ile karıştırma.

## 2. Mevcut analytics var mı?

Ara:

```text
Google Analytics
GA4
gtag
Google Tag Manager
Plausible
Matomo
PostHog
Umami
Vercel Analytics
custom analytics
tracking pixel
analytics SDK
```

Mevcut sistem varsa doğrudan ikinci analytics sistemi kurma.

Önce ne yaptığını ve consent gate olup olmadığını raporla.

## 3. Mevcut Admin sistemi

Ara:

```text
ADMIN role
admin permissions
admin routes
admin layout
user management endpoints
account disable/enable
session invalidation
```

Yeni privilege modeli uydurmadan mevcut authorization sistemini kullan.

## 4. Mevcut User lifecycle

Özellikle belirle:

```text
User hard delete ediliyor mu?
enabled / active / disabled / deleted alanı var mı?
login hangi state'i kontrol ediyor?
refresh/session cookie nasıl revoke ediliyor?
ProjectMembership ne oluyor?
historical audit kayıtları kullanıcıya FK taşıyor mu?
```

Admin "üyeliği sonlandır" davranışı buna göre güvenli şekilde tasarlanmalı.

## 5. Existing email infrastructure

SMTP / EmailService / template / sender config varsa reuse et.

`pdassistant@gmail.com` recipient olarak kullanılabilir fakat credential değildir.

Credential repository'ye yazılmamalı.

---

# PART B — COOKIE CONSENT FOUNDATION

## 6. Consent kategorileri

Minimum kategoriler:

```text
Necessary
Analytics
```

Necessary:

```text
always enabled
```

Analytics:

```text
default false
```

olmalı.

UI gelecekte yeni kategorilerin eklenmesine izin verecek kadar temiz olabilir ancak şu anda gereksiz kategoriler üretme.

## 7. İlk ziyaret Cookie Banner

Kullanıcının henüz consent kararı yoksa banner göster.

Actions:

```text
Tümünü Kabul Et
Tümünü Reddet
Tercihleri Yönet
```

Analytics toggle default OFF.

## 8. Consent persistence

Consent durumunu persistence'a al.

En az:

```text
necessary=true
analytics=true/false
consentVersion
updatedAt
```

semantiği bulunmalı.

Consent storage'ın kendisi necessary kategoride kabul edilebilir.

Ama kullanıcı consent vermeden analytics identifier üretme.

## 9. Consent version

Cookie/analytics politikası anlamlı şekilde değişirse eski consent'in nasıl ele alınacağını yönetebilmek için version kullanılmalı.

Örneğin:

```text
consentVersion = 1
```

Hard-coded magic string yerine merkezi contract tercih et.

## 10. Consent değiştirme

Kullanıcı Footer veya Cookie Policy üzerinden `Çerez Tercihlerini Yönet` ekranını tekrar açabilmeli.

Analytics `ON → OFF` yapıldığında tracking yeni event göndermeyi bırakmalı.

## 11. Consent initialization

Sayfa ilk açılırken consent state okunmadan analytics script/event yanlışlıkla çalışmamalı.

Şu race engellenmeli:

```text
page load
→ analytics starts
→ consent read
→ user was actually opted-out
```

Default state analytics için deny olmalı.

---

# PART C — COOKIE POLICY

## 12. Cookie Policy sayfası

Public bir Cookie Policy page ekle.

Localized routes kullanılıyorsa `/tr/...`, `/en/...`, `/de/...` modeliyle uyumlu yap.

Politika gerçek implementation'a dayanmalı.

Olmayan cookie'leri varmış gibi yazma.

## 13. Cookie Policy içeriği

En az şunları açıklamalı:

```text
Çerez nedir?
Necessary cookies
Analytics cookies
Her kategorinin amacı
Kullanılan gerçek cookie/storage isimleri
Provider
Retention/expiration
Analytics'in default kapalı olduğu
Kullanıcının tercih değiştirebileceği
Consent'in nasıl geri çekileceği
İletişim bilgisi
```

Teknik gerçekliği olmayan hukuki iddialar üretme.

Eksik şirket/unvan/adres gibi hukuki metadata gerekiyorsa `LEGAL CONTENT REQUIRED` olarak raporla; hayali şirket verisi oluşturma.

## 14. Footer entegrasyonu

Footer'a en az `Çerez Politikası` linki ekle.

Uygunsa `Çerez Tercihlerini Yönet` aksiyonu da footer'dan erişilebilir olsun.

Existing footer layout'u bozma.

---

# PART D — PRIVACY-SAFE ANALYTICS

## 15. Analytics başlamadan önce consent

Analytics event gönderme fonksiyonunun merkezinde:

```text
analyticsConsent === true
```

guard'ı bulunmalı.

Sadece component tarafında gizlemek yeterli değildir.

Event transport katmanı da consent'i enforce etmeli.

## 16. PII toplama

Analytics eventlerinde gereksiz kişisel veri toplama.

Özellikle göndermemeye çalış:

```text
name
surname
email
contact message
access token
invitation token
password
raw form contents
query string içindeki sensitive tokenlar
```

Authenticated kullanıcı analytics'e izin verdiyse gerekirse internal pseudonymous user UUID kullanılabilir.

Email/name analytics identity'si olarak kullanılmamalı.

## 17. Anonymous visitor/session

Analytics consent verilmiş anonim ziyaretçiler için first-party anonymous session/visitor identifier gerekiyorsa üretilebilir.

Analytics consent yokken bu identifier üretilmemeli.

Browser fingerprinting yapma.

FingerprintJS benzeri sistem ekleme.

## 18. Traffic source

İlk landing için source classification oluştur.

Minimum:

```text
DIRECT
SEARCH
REFERRAL
CAMPAIGN
```

UTM mevcutsa `utm_source`, `utm_medium`, `utm_campaign` gibi safe campaign alanları saklanabilir.

Referrer için mümkün olduğunca domain/origin seviyesinde bilgi yeterli olsun.

Tam URL query'lerinden sensitive değerleri analytics'e taşıma.

## 19. Paylaşılan link

"Paylaşılan linkten geldi" bilgisi clipboard/mesaj uygulaması takibi ile tahmin edilmemeli.

Güvenilir UTM/campaign parameter varsa CAMPAIGN / SHARED sınıflandırması yapılabilir.

Referrer olmayan bir kullanıcıyı otomatik olarak "paylaşılan link" diye etiketleme; DIRECT olabilir.

## 20. Search

Search-engine referrer domain'leri Google, Bing, DuckDuckGo, Yandex vb. source category altında sınıflandırılabilir.

Aşırı ayrıntılı kullanıcı profillemesi yapma.

## 21. Session duration

Analytics consent verildiyse engagement süresini ölç.

Browser açık fakat background tab durumunu gerçek aktif kullanım gibi sayma.

Visibility/focus lifecycle'ını dikkate al.

Uygunsa:

```text
session start
page view
engagement heartbeat / visibility transition
session end approximation
```

modeli kullanılabilir.

Bu measurement'ın browser kapanması/crash nedeniyle approximation olduğunu kabul et.

## 22. Analytics event schema

Repository architecture'a göre minimal ve sorgulanabilir event/session modeli tasarla.

Örnek alanlar:

```text
eventType
occurredAt
sessionId
anonymousVisitorId nullable
userId nullable
path
entryPath
sourceType
referrerDomain nullable
utmSource nullable
utmMedium nullable
utmCampaign nullable
engagementSeconds nullable
consentVersion
```

BU SADECE ÖRNEKTİR.

Repository mimarisine uymuyorsa daha doğru model oluştur.

Raw sensitive query/body saklama.

## 23. Server authority

Frontend'ten gelen arbitrary `userId`, `duration`, `role`, `account state` alanlarına körü körüne güvenme.

Authenticated user identity backend principal'dan çözülmeli.

Analytics API abuse/rate limit/body bounds kontrol edilmeli.

## 24. Consent withdrawal

Kullanıcı analytics consent'i kaldırınca:

```text
new analytics collection stops
existing analytics identifier cleared
```

olmalı.

Mevcut önceden toplanmış aggregate/event verisinin silinmesi konusunda repository'de/policy'de açık bir contract yoksa kendi kendine yeni "right to deletion" workflow tasarlama.

Bunu policy decision olarak raporla.

---

# PART E — OPERATIONAL METRICS

## 25. Registration metrics

Registration count analytics eventlerinden hesaplanmamalı.

Authoritative source `User table / auth domain` olmalı.

Admin date range için mümkünse `createdAt` kullan.

## 26. Account metrics

Admin:

```text
total accounts
active accounts
terminated accounts
```

görebilmeli.

Bunlar analytics consent'ten bağımsızdır.

## 27. Contact request metrics

Successful contact form submission sayısı analytics consent'e bağlı olmamalı.

Contact delivery için minimum server-side operational audit gerekiyorsa oluştur.

Ama sadece sayım için mesaj metnini kalıcı olarak DB'ye kopyalama.

Mümkün olan minimum metadata:

```text
id
createdAt
deliveryStatus
```

gibi olabilir.

Repository'de zaten contact/support entity varsa reuse et.

---

# PART F — PUBLIC CONTACT PAGE

## 28. Public route

Contact page authentication istememeli.

Logged-out kullanıcı erişebilmeli.

Existing localized public routing'e uy.

## 29. Form

Minimum:

```text
Ad
Soyad
E-posta
Mesaj
```

Validation:

```text
required fields
name length
surname length
valid email
message min/max
trim
empty/whitespace
server-side validation
```

Client validation tek security boundary değildir.

## 30. Recipient

Server destination:

```text
pdassistant@gmail.com
```

olmalı.

Client request arbitrary recipient alamamalı.

Kullanıcı başka adrese mail göndermek için endpoint'i relay olarak kullanamamalı.

## 31. Email format

Email içeriği okunabilir olmalı.

Örneğin:

```text
Yeni PDA İletişim Talebi

Ad Soyad:
Alper Temiz

E-posta:
example@example.com

Mesaj:
...
```

User input plain text/safe encoded olarak işlenmeli.

HTML template kullanılıyorsa escape et.

## 32. Reply-To

Mail:

```text
From = configured PDA SMTP sender
To = pdassistant@gmail.com
Reply-To = form sender email
```

olmalı.

User supplied input SMTP headers'a doğrudan yazılmamalı.

CRLF/header injection test edilmeli.

## 33. Abuse protection

Public mail formu spam relay'e dönüşmemeli.

Mevcut rate-limit infrastructure varsa reuse et.

En az:

```text
request rate limit
body length limits
validation
CSRF behavior
duplicate rapid-submit protection
```

kontrol edilmeli.

Captcha'yı otomatik dependency olarak ekleme.

Gerçek abuse testleri CAPTCHA ihtiyacı gösterirse ayrı decision gate oluştur.

## 34. Success / failure UX

Başarılı mail `Mesajınız gönderildi.` gibi açık feedback vermeli.

Double submit engellenmeli.

SMTP failure success gibi gösterilmemeli.

User-facing hata SMTP credential/internal host bilgisi sızdırmamalı.

## 35. Analytics ilişkisi

Contact form open/submit gibi behavioral eventler yalnız analytics consent varsa analytics sistemine gönderilebilir.

Ancak `successful contact submission total` operational metric'i consent'ten bağımsız tutulur.

Analytics event içine mesaj/ad/soyad/email gönderme.

---

# PART G — ADMIN PANEL FOUNDATION

## 36. Admin route

Admin page oluştur veya mevcut admin alanını genişlet.

Route yalnız gerçek ADMIN authorization ile erişilebilir olmalı.

Frontend route guard tek güvenlik değildir.

Backend endpointleri ayrıca ADMIN kontrol etmeli.

## 37. Kullanıcı listesi

Admin kullanıcı listesinde en az:

```text
Ad / display identity
Email
Account status
Created date
```

mevcut data model izin veriyorsa göster.

Password hash/token/security secret ASLA dönme.

Pagination server-side olmalı.

Büyük user tablosunu tek request ile tamamen çekme.

## 38. Search/filter

Mevcut backend pattern'leriyle uyumlu şekilde `search`, `status`, `page`, `size` gibi server-side controls eklenebilir.

Frontend tüm kullanıcıları indirip client-side filtrelememeli.

---

# PART H — ADMIN USER TERMINATION

## 39. "Üyeliği sonlandır"

Bu feature'da fiziksel user DELETE varsayılan çözüm değildir.

Önce existing account lifecycle'ı incele.

Mevcut enabled/status modeli varsa reuse et.

Yoksa minimum güvenli account state tasarla.

Örneğin:

```text
ACTIVE
TERMINATED
```

Ancak repository'deki gerçek domain naming'i kullan.

## 40. Termination semantics

Admin üyeliği sonlandırdığında:

```text
future login blocked
active session/access yeniden kullanılamaz hale gelir
refresh/session credentials revoke edilir
account admin listesinde terminated görünür
historical project/task/audit data bozulmaz
```

olmalı.

Hard delete ile relational history'yi bozma.

## 41. Current session revocation

Kullanıcı başka cihazda login durumundaysa yalnız `status=disabled` yazıp mevcut session'ın sonsuza kadar çalışmasına izin verme.

Repository'nin auth modeline göre `session invalidation`, `security stamp/version`, `token/session revocation` gibi mevcut mekanizmayı kullan.

JWT tamamen stateless ise mevcut authorization filter her request'te disabled user state kontrol ediyor mu doğrula.

## 42. Self-termination

Admin kendi hesabını yanlışlıkla sonlandıramamalı veya repository'nin mevcut policy'si neyse uygulanmalı.

Minimum güvenli davranış:

```text
current admin cannot terminate itself
```

olabilir.

Existing multi-admin/last-admin semantics varsa koru.

Yeni owner transfer sistemi uydurma.

## 43. Confirmation

Destructive action confirmation olmadan tek click ile kullanıcı sonlandırma yapma.

Confirmation kullanıcı identity, etki ve irreversible/reversible durumunu açıkça belirtmeli.

Eğer sistemde reactivate yoksa UI bunu "geçici devre dışı bırak" gibi göstermemeli.

## 44. Authorization / IDOR

Normal user admin user list, termination endpoint veya analytics dashboard'a erişememeli.

Foreign UUID göndererek başka kullanıcı üzerinde admin işlemi yapılamamalı.

ADMIN authority backend source of truth.

---

# PART I — ADMIN ANALYTICS DASHBOARD

## 45. Dashboard bölümleri

Admin Analytics page minimum olarak:

```text
Overview
Traffic
Registrations
Users
Contact Requests
```

bölümlerini içersin.

Exact visual organization mevcut PDA design system'e göre belirlenebilir.

## 46. Overview cards

Örnek:

```text
Visits
Unique Sessions
Average Engagement
Registrations
Active Accounts
Contact Requests
```

Ancak traffic metrikleri consented analytics'ten; account/contact metrikleri operational backend kaynaklarından gelmeli.

## 47. Date range

Analytics ekranında uygun date-range filtrelemesi sağla.

Örneğin:

```text
Last 7 days
Last 30 days
Last 90 days
Custom
```

Ancak mevcut UI/date picker altyapısına göre karar ver.

Timezone backend/frontend arasında açık ve tutarlı olsun.

## 48. Traffic source breakdown

Göster:

```text
Direct
Search
Referral
Campaign
```

ve varsa safe source details.

Paylaşılan linki yalnız reliable UTM/campaign signal varsa ayır.

## 49. Engagement duration

Average engagement/session duration insan tarafından okunabilir formatta göster.

Örneğin:

```text
4 dk 32 sn
```

TR/EN/DE formatları doğal olmalı.

## 50. Registration trend

User `createdAt` kaynağından tarihsel registration chart/metric üret.

Analytics consent'i burada rol oynamaz.

## 51. Contact request trend

Successful server-side contact submission kayıtlarından tarihsel total üret.

Failed SMTP attempt success count'a dahil edilmemeli.

Mesaj içeriği analytics dashboard'a taşınmamalı.

## 52. Chart library

Repository'de chart library varsa reuse et.

Sırf birkaç chart için ikinci büyük visualization dependency ekleme.

Mevcut dependency yoksa önce minimum yaklaşımı değerlendir.

Yeni dependency gerekiyorsa plana açıkça yaz ve nedenini belirt.

---

# PART J — COOKIE / PRIVACY UI

## 53. Banner görünümü

Cookie banner PDA design language ile uyumlu olmalı.

Light/dark desteklemeli.

Desktop ve mobile'da içerik kapatacak kadar agresif olmamalı.

## 54. Preference dialog

Analytics toggle `OFF` olarak açılmalı.

Necessary toggle varsa `ON + disabled` olmalı.

## 55. Reject All

Reject All gerçekten `analytics=false` yapmalı.

Sadece banner'ı gizleyip analytics'i çalıştırmaya devam etmemeli.

## 56. Accept All

Accept All:

```text
necessary=true
analytics=true
```

yapabilir.

Choice persisted olmalı.

## 57. Consent olmadan network kanıtı

Browser testinde analytics reject/default halinde analytics collection endpoint'e request gitmemesi kanıtlanmalı.

UI toggle kontrolü tek başına yeterli test değildir.

---

# PART K — CACHE / ACCOUNT BOUNDARIES

## 58. Admin query keys

Admin users/analytics private query keys actor/admin scoped olmalı.

Logout sonrası Admin A'nın dashboard/user listesi User B'ye görünmemeli.

## 59. Terminated user's client cache

Bir kullanıcının hesabı terminate olduğunda tekrar authenticated private state kullanamamalı, API 401/403 semantics'i repository standardına göre çalışmalı ve private cache temizlenmeli.

## 60. Analytics consent state

Consent account'a değil browser/device choice'a bağlıysa bunu açıkça modelle.

Login/logout analytics consent'i yanlışlıkla tersine çevirmemeli.

Ancak authenticated analytics events user UUID ile ilişkilendiriliyorsa account switch'te eski user ID kesinlikle taşınmamalı.

---

# PART L — SECURITY & PRIVACY

## 61. Analytics endpoint abuse

Rate limit/body limits/type validation uygula.

Client arbitrary `eventType=ADMIN_LOGIN`, `userId=...` gibi fake trusted business events oluşturamamalı.

Operational metrics analytics event endpoint'inden alınmamalı.

## 62. XSS

Contact name/message, referrer/source label, campaign values ve admin user display data plain text / escaped render edilmeli.

## 63. Open mail relay

Contact endpoint `to`, `cc`, `bcc`, `from`, `smtp host` gibi client-controlled recipient/header alanları kabul etmemeli.

## 64. Sensitive analytics

Asla analytics'e gönderme:

```text
password
access token
refresh token
CSRF token
invitation token
email verification token
contact message
full email
Authorization header
Cookie header
```

## 65. URL sanitization

Analytics path capture sırasında sensitive query parametreleri düşür.

Özellikle:

```text
invite
token
code
verification
reset
```

gibi query değerlerini analytics'te saklama.

Mümkünse pathname bazlı analytics kullan.

---

# PART M — I18N / ACCESSIBILITY / RESPONSIVE

## 66. TR / EN / DE

Aşağıdakilerin tamamı localized olmalı:

```text
Cookie banner
Cookie Preferences
Cookie Policy
Contact page
Contact validation/success/error
Admin analytics
Admin users
Termination confirmation
Analytics labels
Empty/loading/error states
```

## 67. Accessibility

Cookie dialog keyboard navigation, focus trap, Escape semantics, screen reader labels, real buttons ve toggle labels açısından uyumlu olmalı.

Admin tables/charts accessible fallback text sağlamalı.

Contact validation error'ları ilgili inputlarla ilişkilendirilmeli.

## 68. Responsive matrix

Minimum:

```text
320
390
768
1024
1440
```

viewportlarda doğrula.

Ayrıca light/dark/reduced motion/keyboard/touch/TR/EN/DE kontrol et.

---

# PART N — REAL TEST MATRIX

## 69. First visit / default deny

```text
open PDA
→ cookie banner visible
→ analytics default OFF
→ user does nothing
→ no analytics collection request
```

## 70. Reject

```text
fresh browser
→ Reject All
→ reload
→ analytics remains OFF
→ no analytics collection
→ application/auth necessary functionality continues
```

## 71. Accept

```text
fresh browser
→ Accept Analytics
→ page navigation
→ real analytics events hit backend
→ real PostgreSQL records
```

## 72. Withdraw

```text
analytics ON
→ events exist
→ manage preferences
→ analytics OFF
→ next navigation
→ no new analytics event
```

## 73. Traffic source

Real browser scenarios: direct, search-style referrer where testable, referral, UTM campaign.

Do not fake business success solely with frontend mocks.

## 74. Duration

Foreground/background tab behavior doğrulanmalı.

Background süre active engagement olarak şişmemeli.

## 75. Registration

```text
User B registers
→ real User row
→ admin registration metric +1
```

Bu test analytics consent'ten bağımsız olmalı.

## 76. Contact form

Logged-out browser:

```text
open Contact
→ fill name/surname/email/message
→ submit
→ backend validates
→ real configured mail service invocation
→ recipient fixed pdassistant@gmail.com
→ success
→ operational contact count +1
```

SMTP gerçek dış delivery CI'da güvenilir test edilemiyorsa existing mail test infrastructure/local SMTP sink kullanılabilir.

Ancak production code gerçek SMTP service'i kullanmalı.

`route.fulfill` normal success kanıtı değildir.

## 77. Contact abuse

Test:

```text
invalid email
empty message
oversized message
rapid repeated submission
CRLF/header injection
arbitrary recipient attempt
```

## 78. Admin authorization

```text
normal user
→ admin route/API denied

admin
→ users visible
→ analytics visible
```

Frontend gizleme tek kanıt değildir.

## 79. Terminate user

```text
Admin A
→ User B ACTIVE
→ terminate B
→ DB state TERMINATED
→ B's active session loses protected access
→ B cannot login again
→ Admin list shows terminated
→ B's historical project/task data remains intact
```

## 80. Account isolation

```text
Admin A analytics/users cache populated
→ logout
→ normal User B login
→ no admin data flashes
→ no admin API usable
```

## 81. Analytics account switch

```text
User A consent analytics ON
→ event belongs to A

logout
User B login
→ next event must never contain A userId
```

Browser consent may remain ON if device-level preference, but identity must switch safely.

---

# TASK GRUPLANDIRMA

Yukarıdaki maddeleri 81 ayrı implementation taskına bölme.

Gerçek dependency graph'a göre mantıksal task grupları oluştur.

Örnek dependency sırası:

```text
Task 1 — Preflight / cookie / auth / admin / email / privacy audit
Task 2 — Cookie consent model + default-deny preferences + Cookie Policy foundation
Task 3 — Privacy-safe analytics event/session backend + consent-gated frontend collection
Task 4 — Public Contact form + safe SMTP delivery + operational request metric
Task 5 — Admin foundation + account list + safe account termination/session revocation
Task 6 — Admin Analytics Dashboard + operational metrics + traffic/engagement views
Task 7 — Footer/policy/preferences + complete TR/EN/DE + accessibility/responsive integration
Task 8 — Combined privacy/security/account-isolation/real PostgreSQL/browser regression
Task 9 — Full quality gate + implementation completion
```

BU SIRA SADECE ÖRNEKTİR.

Repository'nin gerçek dependency graph'ı daha doğru bir sıra gösteriyorsa onu kullan.

Ancak Consent foundation analytics collection'dan önce tamamlanmalı.

Analytics default-deny contract kurulmadan tracking açma.

---

# IMPLEMENTATION DECISION GATES

Aşağıdaki durumlarda kendi kendine büyük yeni subsystem oluşturma.

Kullanıcıya raporla ve karar iste:

### A. Admin sistemi hiç yoksa

ADMIN role mevcut fakat admin route/framework yoksa minimum admin area planlanabilir.

Ancak yeni RBAC framework uydurma.

### B. User account status yoksa

Safe termination için schema değişikliği gerekiyorsa planla ve açıkça belirt.

Hard delete yapma.

### C. Analytics provider mevcutsa

Mevcut provider kullanılıyorsa ikinci provider eklemeyi otomatik seçme.

Consent açısından uygunluğunu raporla.

### D. Analytics provider yoksa

Öncelik:

```text
first-party / privacy-safe / mevcut stack ile uyumlu
```

çözüm olsun.

Sırf kolay diye Google Analytics ekleme.

### E. Contact için SMTP yoksa

Mevcut configuration pattern'ine uyacak mail infrastructure planla.

Credential üretme veya repo'ya yazma.

### F. Hukuki metin metadata'sı eksikse

Şirket unvanı/adres/VERBİS/legal basis gibi bilgi repository'de yoksa uydurma.

Teknik Cookie Policy tamamlanabilir fakat ilgili alan `LEGAL REVIEW / BUSINESS DATA REQUIRED` olarak raporlanmalı.

---

# GİT GÜVENLİĞİ

Kullanma:

```text
git reset --hard
git checkout .
```

Kullanıcının mevcut değişikliklerini revert etme.

Commit/push/staging/pull/merge yapma.

Branch değiştirme ancak kullanıcı açıkça isterse.

---

# VALIDATION

Feature completion öncesi minimum:

```text
Backend targeted:
- cookie consent if server persistence exists
- analytics
- admin authorization
- user termination
- contact/email
- account/session revocation
- security

Backend full:
mvn clean verify

Frontend:
lint
TypeScript
production build

Targeted Playwright:
- cookie default deny
- accept/reject/withdraw
- analytics collection
- traffic source
- contact public form
- admin authorization
- account termination
- account/cache isolation
- footer/cookie policy

Full Chromium suite

Canonical:
./pre-push/pre-push.cmd
```

Repository'nin gerçek Windows command/path'lerini kullan.

Docker build/start/health canonical gate'in parçasıysa çalıştır.

---

# NORMAL SUCCESS MOCK YASAĞI

Normal success acceptance mümkün olduğunca:

```text
Browser
→ real frontend
→ real API
→ real backend
→ real PostgreSQL
```

üzerinden kanıtlanmalı.

Analytics success:

```text
frontend event
→ analytics API
→ PostgreSQL
```

olmalı.

User termination:

```text
admin UI
→ backend
→ DB
→ actual auth rejection
```

olmalı.

Contact:

```text
frontend
→ backend
→ actual EmailService
```

olmalı.

CI'da external SMTP yerine local test SMTP sink kullanılabilir fakat production code path'i mock route ile bypass edilmemeli.

---

# IMPLEMENTATION COMPLETION

Tüm tasklar bittikten sonra plan dosyasından ayrı completion dokümanı oluştur.

Final raporda şu başlıklar olsun:

## Final verdict
## Task checklist
## Cookie inventory
## Consent behavior
## Analytics architecture
## Traffic source tracking
## Session / engagement measurement
## Registration metrics
## Contact request metrics
## Public Contact form
## Email delivery / abuse protection
## Admin authorization
## User account management
## Account termination / session revocation
## Admin Analytics Dashboard
## Cookie Policy / Footer
## Privacy / KVKK-oriented safeguards
## Cache / account isolation
## Responsive / accessibility / i18n
## Database migrations
## Changed files
## Test results
## Security / dependency audit
## Remaining issues
## Pending legal/product decisions

---

# KRİTİK KURALLAR

1. Önce mevcut cookies/analytics/admin/user/email altyapısını audit et.
2. Analytics default OFF.
3. Analytics consent verilmeden behavioral tracking başlatma.
4. Necessary cookies analytics consent'e bağlanmaz.
5. Reject All gerçekten analytics'i durdurmalı.
6. Consent sonradan değiştirilebilir olmalı.
7. Withdrawal sonrası yeni analytics event gitmemeli.
8. Consent kararı okunmadan analytics race ile başlamamalı.
9. Browser fingerprinting yapma.
10. Analytics eventlerinde email/ad/soyad/contact message/token toplama.
11. Sensitive query parametrelerini analytics'e yazma.
12. Registration/account/contact totals operational backend metrics'tir.
13. Operational metrics analytics consent'e bağlı değildir.
14. Traffic analytics consent'e bağlıdır.
15. Shared-link classification'ı güvenilir UTM/campaign sinyali olmadan uydurma.
16. Session duration background tab süresini aktif kullanım gibi şişirmemeli.
17. Admin page backend ADMIN authorization ile korunmalı.
18. Normal kullanıcı Admin API'lerine erişememeli.
19. User termination varsayılan olarak hard delete değildir.
20. Terminated user tekrar login olamamalı.
21. Terminated user's existing authenticated access güvenli biçimde kesilmeli.
22. Historical project/task/audit data gereksiz yere silinmemeli.
23. Contact page public olmalı.
24. Contact mail recipient sabit `pdassistant@gmail.com` olmalı.
25. Client arbitrary email recipient belirleyememeli.
26. SMTP credentials repo'ya yazılmamalı.
27. User email `From` olarak kullanılmamalı; `Reply-To` kullanılmalı.
28. Header injection engellenmeli.
29. Public Contact endpoint rate-limited olmalı.
30. Contact message analytics'e gönderilmemeli.
31. Cookie Policy Footer'dan erişilebilir olmalı.
32. Cookie Policy gerçek cookie/storage inventory'ye dayanmalı.
33. Hukuki/şirket verisi uydurulmamalı.
34. TR/EN/DE tamamlanmalı.
35. Light/dark/mobile/a11y tamamlanmalı.
36. Private admin query/cache actor-scoped olmalı.
37. Account switch'te eski admin/private data flash etmemeli.
38. Analytics identity account switch'te eski kullanıcıya bağlı kalmamalı.
39. Mevcut infrastructure reuse edilmeli.
40. Büyük yeni provider/dependency ancak gerçekten gerekliyse eklenmeli.
41. Persistent checkbox planı oluştur.
42. Taskları dependency sırasına göre yürüt.
43. Her task sonrası targeted tests + DoD + `[x]`.
44. DoD tamamlanmadan bağımlı task'a geçme.
45. Full regression + canonical pre-push geçmeden tamamlandı sayma.
46. Commit/push/staging yapma.
