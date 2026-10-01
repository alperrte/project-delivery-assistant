# PDA Frontend — Global Invitations Page Redesign & Project Preview Modal

PDA (**Project Delivery Assistant**) projesindeki mevcut global **Davetler / Invitations** sayfasını yeniden tasarla.

Bu görev ağırlıklı olarak frontend refactorudur.

Önce repository'deki mevcut implementasyonu incele:

- Sidebar'daki global `Davetler` sayfası
- Kullanıcının kendisine gelen proje davetlerini listeleyen mevcut component/page
- Project-specific invitations page
- Invitation API response modelleri
- accept / reject akışları
- rejection message alanı
- invitation status gösterimi
- Project card componentleri
- Projects page
- Project preview/card frontend yapısı
- Teams / team bilgileri
- project metadata
- project technologies
- project member count
- project updatedAt bilgisi
- modal/dialog componentleri
- responsive table/list componentleri
- mevcut i18n yapısı
- loading / empty / error state standartları

Mevcut çalışan invitation davranışlarını bozma.

Bu task'ın ana amacı:

1. Global Davetler sayfasının görünümünü değiştirmek
2. Davet bilgilerini daha düzenli göstermek
3. Kullanıcının proje bilgilerini daveti kabul etmeden önce ayrı bir popup/modal içerisinde inceleyebilmesini sağlamak

---

# 1. Global Davetler Sayfası Değişecek

Sidebar'daki:

```text
Davetler
```

sayfası global invitation sayfası olarak kalmalıdır.

Bu sayfa:

- seçili project'e bağlı değildir
- kullanıcının hesabına gelen bütün proje davetlerini gösterir

Project-specific invitation management sayfasıyla karıştırma.

---

# 2. Mevcut Büyük Invitation Card Görünümünü Kaldır

Şu anda global Invitations ekranında invitation yaklaşık olarak büyük card şeklinde gösteriliyor:

```text
Project name

Davet eden: ...
Tarih

Role

Invitation message

Reject reason textarea

[Reddet] [Kabul et]
```

Bu tasarımı kaldır.

Yeni görünüm, mevcut **Project Invitations** sayfasındaki table/list tasarımına yakın olmalıdır.

---

# 3. Yeni Global Invitation List Tasarımı

Global Invitations page'de davetler düzenli bir tablo/list yapısında gösterilmelidir.

Önerilen kolonlar:

```text
PROJE
EKİP
DAVET
AÇIKLAMA
DAVET EDEN
DAVET TARİHİ
DURUM
İŞLEMLER
```

Mevcut PDA design system'e ve ikinci ekran görüntüsündeki Project Invitations table tasarımına uy.

Tam kolon isimlerini mevcut i18n standardına göre düzenle.

---

# 4. Gösterilecek Invitation Bilgileri

Her invitation için mümkün olan şu bilgiler gösterilmelidir:

## Proje adı

Örneğin:

```text
PDA
```

veya:

```text
Project Delivery Assistant
```

## Ekip adı

Invitation belirli bir ekibe bağlıysa ekip adı göster.

Örneğin:

```text
Backend
Frontend
General Team
```

Invitation custom team'e bağlı değilse mevcut backend/domain davranışına göre:

```text
General Team
```

veya uygun placeholder göster.

Olmayan team bilgisini uydurma.

## Davet adı

Invitation domain/modelinde davet için title/name alanı mevcutsa onu göster.

Örneğin:

```text
Backend ekibine katılım
```

Eğer mevcut backend'de invitation için ayrı title alanı yoksa repository'yi incele.

Sırf UI için gereksiz duplicate field oluşturma.

Gerçek requirement için eksikse minimum backend değişikliği yap.

## Davet açıklaması / mesajı

Invitation gönderilirken yazılan mevcut invitation message gösterilmelidir.

Örneğin:

```text
Projede frontend tarafında bizimle çalışmanı istiyoruz.
```

Mevcut 100 karakter invitation message özelliğini kullan.

Uzun text table layout'u bozuyorsa uygun truncate/ellipsis kullan.

Hover veya mevcut UI standardına göre full text görüntülenebilir.

## Davet eden

Invitation sender'ın anlaşılır kullanıcı bilgisi gösterilmelidir.

Örneğin:

```text
Hamza_Taşbay
```

UUID gösterme.

Mevcut user summary contractını kullan.

## Davet tarihi

Mevcut PDA tarih formatını kullan.

Örneğin:

```text
1 Eki 2026
```

veya mevcut localization standardı.

## Durum

Mevcut invitation status kullanılmalıdır.

Örneğin:

```text
Bekliyor
Kabul edildi
Reddedildi
İptal edildi
Süresi doldu
```

Gerçek backend enumlarını incele ve mevcut olanları map et.

UI'da status badge kullan.

---

# 5. "Proje Bilgilerini Görüntüle" Aksiyonu

Her invitation row'unun en sağ tarafında proje bilgilerini incelemek için bir aksiyon olmalıdır.

Buton metni örneğin:

```text
Proje bilgilerini görüntüle
```

veya UI alanına daha iyi oturuyorsa:

```text
Proje bilgileri
```

kullanılabilir.

Ancak kullanıcı ne yaptığını net anlamalıdır.

Bu butona basıldığında yeni sayfaya gitme.

**Popup / modal aç.**

---

# 6. Project Preview Modal

`Proje bilgilerini görüntüle` butonuna basıldığında project preview modal açılmalıdır.

Modal tasarımı mevcut **Projects page project card** görünümünü temel almalıdır.

Yani üçüncü referans ekran görüntüsündeki proje kartı görsel dili kullanılmalıdır.

Sıfırdan farklı bir project preview tasarımı üretme.

Mümkünse mevcut Project Card componentindeki presentation parçalarını reuse/refactor et.

---

# 7. Project Preview Modal İçeriği

Modal içerisinde mümkün olan mevcut proje bilgilerini göster.

Referans yapı:

```text
[Project image / placeholder]

Project Name
Project slogan / short description

[Phase badge] [Project type badge]

────────────────

Teknoloji

[Next.js] [React] [Node] [Docker] ...

────────────────

Ekip

[avatar initial]  X üye

────────────────

Son güncelleme

1 Eki 2026 · Hamza_Taşbay
```

Gerçek alanları mevcut backend/project DTO'larından al.

Olmayan bilgileri uydurma.

---

# 8. Project Image / Thumbnail

Project card'da image/thumbnail desteği mevcutsa aynı davranışı modalda reuse et.

Project image yoksa mevcut project card fallback davranışını kullan.

Yeni image storage veya upload sistemi oluşturma.

---

# 9. Project Name

Project adı modalın en belirgin alanlarından biri olmalıdır.

Örneğin:

```text
PDA
```

Project title mevcut Projects page kartıyla görsel olarak tutarlı olmalıdır.

---

# 10. Project Description / Slogan

Project'in:

- slogan
- short description
- description

alanlarından mevcut Project Card hangisini kullanıyorsa aynı bilgiyi kullan.

Yeni duplicate description field oluşturma.

---

# 11. Project Phase / Status

Project Card üzerinde mevcut:

```text
Planlama
```

gibi phase/status badge varsa modalda da göster.

Mevcut enum/label mapping'i reuse et.

---

# 12. Project Type

Project card'da:

```text
Web
Mobile
Desktop
...
```

gibi project type gösteriliyorsa modalda da göster.

Mevcut icon ve label mapping'i reuse et.

---

# 13. Technologies

Project'in technology bilgileri mevcutsa Projects page'deki gibi icon/badge formatında göster.

Örneğin:

```text
Next.js
React
Node
Docker
```

Mevcut technology config/icon sistemini reuse et.

Yeni duplicate teknoloji mapping'i oluşturma.

---

# 14. Team / Member Count

Project card'daki:

```text
Ekip
H  1 üye
```

benzeri bölüm modalda bulunmalıdır.

Minimum:

```text
project member count
```

göster.

Mevcut API user summary döndürüyorsa avatar initial gösterilebilir.

Ancak invitation alan kullanıcı henüz project member değilse tüm üyelerin kişisel bilgilerini expose etme.

Project preview için member count yeterliyse yalnız count kullan.

Security/privacy açısından mevcut project visibility standardına uy.

---

# 15. Last Update

Project card'da mevcutsa:

```text
Son güncelleme

1 Eki 2026 · Hamza_Taşbay
```

bilgisini modalda da göster.

Mevcut project DTO bunu desteklemiyorsa sırf görsel eşleşme için yeni audit sistemi oluşturma.

Gerçek mevcut datayı kullan.

---

# 16. "Projeyi Aç" Butonu Kullanma

Projects page card'ında:

```text
Projeyi aç
```

aksiyonu bulunabilir.

Ancak invitation alan kullanıcı henüz project member olmayabilir.

Bu nedenle Project Preview modal içerisinde:

```text
Projeyi aç
```

butonunu doğrudan göstermemelisin.

Invitation kabul edilmeden project erişimi verilmemelidir.

Modal yalnız **preview / bilgi görüntüleme** amacı taşır.

---

# 17. Modal Close

Modal standart PDA dialog davranışına sahip olmalı.

Örneğin:

```text
X
```

ile kapanabilmeli.

Ayrıca mevcut dialog component destekliyorsa:

- ESC
- overlay click

gibi standart davranışları koru.

Yeni modal sistemi oluşturma.

---

# 18. Accept / Reject İşlevleri Kaybolmamalı

Mevcut global invitation page'deki:

```text
Kabul et
Reddet
```

işlevlerini kaldırma.

Yeni tasarımda da invitation pending ise kullanıcı invitation'a cevap verebilmelidir.

Bunları row'un `İşlemler` alanında veya mevcut layout'a en temiz oturan şekilde göster.

Örneğin:

```text
[Proje bilgileri] [Kabul et] [Reddet]
```

veya kompakt dropdown/action group kullanılabilir.

Ama kullanıcı daveti kabul/red edebilme yeteneğini kaybetmemelidir.

---

# 19. Reject Reason

Mevcut reject akışında opsiyonel rejection message desteği varsa bunu koru.

Ancak textarea'yı her pending invitation row'unda sürekli açık göstermeye gerek yok.

Daha temiz UX tercih et.

Örneğin:

```text
Reddet
↓
small modal/dialog
↓
Reddetme nedeni (opsiyonel)
```

şeklinde olabilir.

Mevcut PDA dialog standardını kullan.

Bu task kapsamında rejection backend davranışını değiştirme.

---

# 20. Accepted / Rejected Invitation Actions

Invitation status artık `PENDING` değilse:

```text
Kabul et
Reddet
```

aksiyonlarını gösterme.

Örneğin:

```text
ACCEPTED
→ status badge

REJECTED
→ status badge

CANCELLED
→ status badge
```

yeterli olabilir.

Ancak `Proje bilgilerini görüntüle` davranışı mevcut permission/security kurallarına göre geçmiş invitationlarda da çalışabilir.

---

# 21. Invitation Filtering

Mevcut global Invitations page'de filter/tab yapısı varsa koru veya Project Invitations sayfasıyla tutarlı hale getir.

Örneğin:

```text
Bekliyor
Kabul edildi
Reddedildi
İptal edildi
```

tabları uygun olabilir.

Ancak mevcut backend query desteği yoksa sırf UI için gereksiz büyük refactor yapma.

---

# 22. Project Invitations Page ile Görsel Tutarlılık

Global Invitations page görünümü özellikle ikinci referans ekranındaki project-specific invitations page ile aynı tasarım ailesinde olmalıdır.

Yani:

- aynı table/card yüzeyi
- aynı border
- aynı typography
- aynı status badge yapısı
- aynı pagination
- aynı button hierarchy

kullanılmalıdır.

Ancak içerik global invitations ihtiyacına göre farklı olacaktır.

---

# 23. Projects Card ile Görsel Tutarlılık

Project Preview modal ise üçüncü ekran görüntüsündeki Project Card görünümünü temel almalıdır.

Yani iki referans farklı amaçlar için kullanılmalıdır:

```text
Global Invitations Page
→ Project Invitations table görünümü

Project Preview Modal
→ Projects page Project Card görünümü
```

Bu ayrımı koru.

---

# 24. API Kullanımı

Önce mevcut invitation API response'unu incele.

Yeni global invitation view için gereken:

```text
project name
team name
invitation name/title
message
inviter
createdAt
status
```

bilgileri zaten geliyorsa yeni endpoint oluşturma.

Project preview için mevcut project summary/details endpoint'i kullanılabiliyorsa reuse et.

Sırf frontend tasarımı değişti diye duplicate API oluşturma.

---

# 25. Project Preview Security

Kullanıcı invitation aldığı için project preview görebilir.

Ancak bu preview:

```text
full authenticated project access
```

anlamına gelmemelidir.

Backend'de mevcut project detail endpoint yalnız project member'lara açıksa onu frontend'den bypass etmeye çalışma.

Gerekirse invitation recipient'a özel minimum:

```text
ProjectInvitationPreview
```

contract/endpoint oluştur.

Bu endpoint yalnızca:

- invitation gerçekten authenticated user'a aitse
- invitation ilgili project'e aitse

minimum project preview datasını döndürmelidir.

---

# 26. Sensitive Project Data Gösterme

Project preview içerisinde:

- secrets
- repository credentials
- internal settings
- private member details
- task details
- issue details
- admin metadata

gösterme.

Preview yalnız Projects Card'da zaten public/summary seviyesinde gösterilen bilgileri içermelidir.

---

# 27. Invitation Ownership

Global Invitations page yalnız authenticated kullanıcının kendi invitation'larını göstermelidir.

Bir kullanıcı başka user'ın invitation ID'sini URL/API manipulation ile görememelidir.

Frontend filtering security değildir.

Backend ownership validation korunmalıdır.

---

# 28. Responsive Tasarım

Desktop:

table yapısı kullanılabilir.

Mobile/tablet:

geniş tabloyu yatay scroll cehennemine çevirmek yerine mevcut PDA responsive standardına göre:

- stacked rows
- compact cards
- responsive columns

kullan.

Project preview modal da küçük ekranlarda düzgün çalışmalıdır.

---

# 29. Loading State

Global invitations yüklenirken mevcut skeleton/loading standardını kullan.

Project preview modal açıldığında project data ayrıca yükleniyorsa:

- modal skeleton
veya
- existing loading indicator

kullan.

Boş modal gösterme.

---

# 30. Error State

Invitation list API başarısız olursa mevcut error componentini kullan.

Project preview yüklenemezse modal içerisinde kullanıcıya anlaşılır hata göster.

Örneğin:

```text
Proje bilgileri yüklenemedi.
```

gerekirse retry ekle.

Sayfanın tamamını crash ettirme.

---

# 31. Empty State

Kullanıcının invitation'ı yoksa mevcut PDA empty-state standardını kullan.

Örneğin:

```text
Henüz proje davetiniz yok.
```

Devasa boş tablo gösterme.

---

# 32. Pagination

Global invitations endpoint pagination destekliyorsa mevcut pagination yapısını kullan.

İkinci ekran görüntüsündeki pagination stiline uy.

Bütün invitation history'yi tek seferde client'a çekip client-side paginate etme.

---

# 33. Project Preview Data Reuse

Project preview modal için mevcut Project Card componentini direkt kullanmak mantıklıysa reuse et.

Ancak Project Card içinde:

```text
Projeyi aç
```

gibi invitation context'inde yanlış davranışlar varsa componenti kör şekilde reuse etme.

Gerekirse:

```text
ProjectSummaryCard
```

gibi presentation kısmını reusable hale getir.

Örneğin:

```text
ProjectSummaryContent
```

hem:

```text
Projects Page Card
```

hem:

```text
Invitation Project Preview Modal
```

tarafından kullanılabilir.

Gereksiz component duplication oluşturma.

---

# 34. Invitation Row Layout

Desktop için kavramsal örnek:

```text
PROJE      EKİP       DAVET                AÇIKLAMA            DAVET EDEN     TARİH        DURUM       İŞLEMLER

PDA        Backend    Backend katılımı      Bizimle çalış...    Hamza          1 Eki 2026   Bekliyor    [Proje bilgileri] [Kabul] [Reddet]
```

Bu birebir pixel-level tasarım değildir.

Mevcut PDA spacing ve component standardını kullan.

---

# 35. Invitation Name / Title Gerçekten Yoksa

Repository analizi sonucunda invitation domain'inde ayrı:

```text
invitation title
```

alanı olmadığı ortaya çıkarsa şu iki şeyi birbirine karıştırma:

```text
project name
invitation message
```

Requirement gerçekten ayrı bir "davet ismi" gerektiriyorsa bunu açık bir field olarak ekle.

Ancak aynı bilgiyi farklı isimlerle duplicate etme.

Minimum backend/domain değişikliği yap.

---

# 36. Team Name Gerçekten Yoksa

Invitation belirli bir custom team'e bağlı değilse custom team uydurma.

Mevcut flow:

```text
Project Invitation
→ ProjectMembership
→ General Team
```

şeklindeyse team alanında mevcut business rule'a göre:

```text
General Team
```

gösterilebilir.

Invitation gerçekten custom team hedefi destekliyorsa doğru team'i göster.

Repository'deki gerçek domain davranışını source of truth kabul et.

---

# 37. Status Translation

Backend enumlarını kullanıcıya direkt:

```text
PENDING
ACCEPTED
REJECTED
CANCELLED
```

şeklinde basma.

Mevcut i18n mapping'i kullan:

```text
Bekliyor
Kabul edildi
Reddedildi
İptal edildi
```

İngilizce locale için mevcut translation standardına göre karşılıklarını ekle.

---

# 38. Accessibility

Project preview button:

```text
Proje bilgilerini görüntüle
```

anlaşılır aria-label içermeli.

Modal:

- focus trap
- close semantics
- ESC davranışı

mevcut dialog component üzerinden çalışmalı.

Status yalnız renkle ifade edilmemeli; text label da bulunmalı.

---

# 39. Mevcut Accept Akışını Bozma

User invitation kabul ettiğinde mevcut davranış aynen korunmalıdır.

Örneğin mevcut sistem:

```text
Invitation ACCEPTED
→ ProjectMembership
→ invited roles
→ General Team membership
```

yapıyorsa bu frontend redesign sırasında değişmemelidir.

Bu görev invitation business logic refactoru değildir.

---

# 40. Mevcut Reject Akışını Bozma

Reject:

```text
optional rejection message
→ invitation REJECTED
```

davranışını koru.

Frontend yalnız presentation/interaction bakımından daha temiz hale getirilebilir.

---

# 41. Notification Davranışına Dokunma

Invitation create/accept/reject Notification Service ile zaten entegreyse bu task sırasında notification logic'i değiştirme.

UI refactor nedeniyle yeni notification eventleri oluşturma.

---

# 42. Testler

Mevcut frontend test altyapısına göre kritik senaryoları test et.

## Global Invitations

- authenticated kullanıcının invitation'ları render edilir
- project name görünür
- team name görünür
- invitation title görünür
- invitation message görünür
- inviter görünür
- date görünür
- status badge görünür

## Project Preview

```text
Proje bilgileri
→ modal açılır
```

Modal:

- project name
- project description/slogan
- status/phase
- project type
- technologies
- member count
- last update

mevcut data kadar doğru gösterir.

## Membership Security

Invitation recipient olmayan kullanıcı preview alamaz.

## Accept

Pending invitation accept edilebilir.

Başarılı response sonrası list/query güncellenir.

## Reject

Pending invitation reject edilebilir.

Optional rejection reason korunur.

## Non-Pending

Accepted/rejected invitation için accept/reject actions görünmez.

## Loading/Error

- invitation loading
- invitation error
- preview loading
- preview error

durumlarını doğrula.

## Responsive

Desktop/table ve küçük ekran layout'unun kırılmadığını doğrula.

---

# 43. Gereksiz Backend Refactor Yapma

Bu task frontend ağırlıklıdır.

Mevcut endpointler gerekli datayı sağlıyorsa backend'i değiştirme.

Yalnız gerçekten eksik olan:

- invitation title
- team summary
- project preview summary

gibi alanlar için minimum backend contract değişikliği yap.

Project domain veya invitation lifecycle'ı baştan yazma.

---

# 44. Görev Sonunda Rapor

Implementasyon tamamlandığında kısa teknik rapor ver.

## Global Invitations Page

Eski görünümden yeni görünüme nelerin değiştiğini açıkla.

## Invitation Fields

Yeni listede hangi bilgilerin gösterildiğini belirt.

## Project Preview

Modal içerisindeki project bilgilerini listele.

## Existing Functionality

Accept/reject/rejection-message davranışlarının korunduğunu belirt.

## Component Reuse

Project Card veya Project Invitations table componentlerinden neyin reuse/refactor edildiğini belirt.

## Backend Changes

Backend değiştiyse neden gerektiğini açıkla.

## API Usage

Kullanılan endpointleri belirt.

## Changed Files

Önemli değiştirilen/oluşturulan dosyaları listele.

## Tests

Çalıştırılan frontend/backend testlerini belirt.

## Build

Frontend:

- lint
- type-check
- tests
- build

sonuçlarını yaz.

Backend değiştiyse ilgili backend test/build sonuçlarını da ekle.

---

# Kritik Kurallar

1. Sidebar'daki global `Davetler` sayfasını koru.
2. Global Invitations sayfası selected project context'ine bağlanmamalı.
3. Mevcut büyük invitation card tasarımını kaldır.
4. Yeni görünümü Project Invitations table tasarımına yaklaştır.
5. Project name göster.
6. Team name göster.
7. Invitation name/title göster.
8. Invitation description/message göster.
9. Inviter göster.
10. Invitation date göster.
11. Invitation status göster.
12. En sağda project preview aksiyonu bulunsun.
13. Project preview yeni sayfa değil modal/popup olarak açılmalı.
14. Project preview tasarımı Projects page'deki Project Card'ı temel almalı.
15. Modalda project summary bilgilerini göster.
16. Invitation kabul edilmeden `Projeyi aç` erişimi verme.
17. Existing accept davranışını kaldırma.
18. Existing reject davranışını kaldırma.
19. Optional rejection message özelliğini koru.
20. Status PENDING değilse accept/reject göstermemeye dikkat et.
21. Project preview sensitive project datası expose etmemeli.
22. Invitation ownership backend'de korunmalı.
23. Existing API yeterliyse yeni endpoint oluşturma.
24. Eksik preview datası varsa minimum backend contract değişikliği yap.
25. Existing Project Card presentation logic'ini mümkün olduğunca reuse et.
26. Component duplication oluşturma.
27. Existing Project Invitations visual language'i reuse et.
28. Loading/error/empty states ekle veya mevcut olanları koru.
29. Responsive tasarımı bozma.
30. i18n standardına uy.
31. Notification lifecycle'a dokunma.
32. ProjectMembership/invitation business logic'i değiştirme.
33. Lint/type-check/test/build sonuçlarını doğrula.
34. Yarım frontend refactor bırakma; yeni global invitation page ve project preview modalını tamamla.
