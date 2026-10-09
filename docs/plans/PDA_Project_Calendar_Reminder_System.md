# PDA — Project Calendar Reminder System

PDA (**Project Delivery Assistant**) projesindeki mevcut **Takvim / Calendar** yapısını genişleterek proje bazlı bir **Anımsatıcı / Reminder** sistemi geliştir.

Bu görevde yalnızca frontend üzerinde sahte/local reminder oluşturma. Reminder verileri backend'de kalıcı olarak saklanmalı, authorization kuralları backend tarafından uygulanmalı ve mevcut proje/membership/role mimarisiyle entegre çalışmalıdır.

Önce repository'deki mevcut implementasyonu incele:

- Calendar / Takvim sayfası
- Ana sayfadaki calendar widget/component
- Project Service
- ProjectMembership
- project role modeli
- PROJECT_MANAGER authorization yapısı
- Auth/User entegrasyonu
- Task Service
- Notification Service
- mevcut DTO / Mapper / Service / Repository standartları
- mevcut API response standardı
- mevcut pagination/query yaklaşımı
- mevcut frontend data-fetching yapısı
- mevcut date/time utility'leri
- mevcut localization/i18n yapısı
- mevcut icon/component library
- Flyway migration standardı
- Spring Modulith sınırları
- test altyapısı

Ardından mevcut mimariye uygun şekilde aşağıdaki reminder sistemini uçtan uca implement et.

---

# 1. Temel Amaç

Bir proje içerisinde kullanıcılar kendileri için önemli tarihleri takvim üzerinde anımsatıcı olarak oluşturabilmelidir.

Reminder iki farklı scope'a sahip olacaktır:

```text
PERSONAL
PROJECT
```

## PERSONAL

Yalnız reminder'ı oluşturan kullanıcı tarafından görülür. Normal proje üyeleri yalnızca bu tip reminder oluşturabilir.

## PROJECT

Projede bulunan bütün üyeler tarafından görülür. Bu reminder türünü yalnızca `PROJECT_MANAGER` yetkisine sahip kullanıcı oluşturabilir.

---

# 2. Kullanıcı Davranışı

Normal bir proje üyesi:

```text
Takvim
→ Anımsatıcı oluştur
→ Ad
→ Açıklama (opsiyonel)
→ Tür
→ Tarih
→ Oluştur
```

akışıyla yalnızca kendisi için reminder oluşturabilir.

Normal kullanıcıya `Herkes için / Kendim için` seçimi gösterme. Scope otomatik `PERSONAL` olmalıdır. Backend de request manipülasyonu ile `PROJECT` reminder oluşturulmasını engellemelidir.

---

# 3. Project Manager Davranışı

`PROJECT_MANAGER` diğer kullanıcılar gibi kendi kişisel reminder'larını oluşturabilmelidir. Ek olarak proje genelinde bütün üyelerin görebileceği reminder oluşturabilmelidir.

Create formunda Project Manager'a scope seçimi göster:

```text
Anımsatıcı kimin için?

○ Kendim için
○ Projedeki herkes için
```

Mantık:

```text
Kendim için → PERSONAL
Projedeki herkes için → PROJECT
```

İki seçeneğin aynı anda seçilemediği radio/select benzeri bir kontrol tercih et.

---

# 4. Project Scope

Her reminder mutlaka bir projeye bağlı olmalıdır. Reminder global account reminder değildir.

```text
Project
   ↓
Reminder
   ↓
Creator User
```

Reminder oluşturmak için authenticated kullanıcının ilgili projenin üyesi olması gerekir. `ProjectMembership` membership doğrulamasında source of truth olarak kalmalıdır.

Başka project'in reminder'ını URL veya request manipülasyonuyla görmeye/oluşturmaya izin verme.

---

# 5. Reminder Domain Model

Mevcut mimariye uyacak temiz bir Reminder modeli oluştur.

Kavramsal alanlar:

```text
Reminder

id
projectId
creatorUserId

title
description

type
scope

reminderDate
reminderTime

createdAt
updatedAt
```

Gerçek entity tasarımını mevcut ID/auditing standardına göre belirle.

`reminderTime` opsiyonel olabilir. Date-only kullanım mutlaka desteklenmelidir.

---

# 6. Reminder Title

Reminder adı zorunlu olmalıdır.

Örnekler:

```text
Sprint Toplantısı
Backend Demo
Sunum
Proje Teslimi
Security Review
```

Frontend ve backend validation uygula. Makul maksimum uzunluk belirle; mevcut standarda uygunsa 100 karakter kullanılabilir. Blank/whitespace-only title kabul etme.

---

# 7. Reminder Description

Açıklama opsiyonel olmalıdır. Whitespace-only değerleri normalize et. Makul bir maksimum uzunluk belirle; örneğin 500 karakter uygunsa kullanılabilir.

Rich-text sistemi ekleme.

---

# 8. Reminder Types

Reminder oluştururken kullanıcı bir **Anımsatıcı Türü** seçmelidir. Dropdown/select olarak göster.

V1 için anlamlı ve sınırlı bir enum listesi kullan. Örneğin:

```text
MEETING
DEADLINE
PRESENTATION
REVIEW
DELIVERY
WORK
OTHER
```

Mevcut ürün terminolojisine daha uygun bir liste varsa repository analizi sonucunda adapte et. Gereksiz enum üretme.

---

# 9. Reminder Type Backend Enum

Reminder type yalnız frontend string'i olmamalıdır. Backend'de kontrollü enum/value olarak tutulmalıdır.

```java
ReminderType
```

Client'ın arbitrary string göndermesine izin verme.

---

# 10. Reminder Type İkonları

Her reminder türü frontend'de kendi ikonuyla temsil edilmelidir.

Örnek mapping:

```text
MEETING      → meeting/users icon
DEADLINE     → clock/alarm icon
PRESENTATION → presentation/screen icon
REVIEW       → clipboard/search icon
DELIVERY     → package/upload icon
WORK         → briefcase/tool icon
OTHER        → bookmark/bell icon
```

Mevcut icon library'yi kullan. Sırf bu feature için yeni icon paketi ekleme.

Backend icon/SVG saklamamalıdır. Backend yalnız `type` döndürür; icon mapping frontend'de yapılır.

---

# 11. Icon Mapping Merkezi Olsun

Reminder type label + icon mapping'ini merkezi/reusable bir config içinde tut.

Örneğin:

```text
reminderTypeConfig
```

Bu config:

- create dropdown
- Calendar Page
- Home Calendar
- reminder detail/popover

gibi yerlerde reuse edilebilmelidir.

Mevcut i18n standardı varsa label'ları hardcode etme.

---

# 12. Calendar Üzerinde Gösterim

Reminder'ın bulunduğu tarihin üzerinde ilgili reminder type ikonu görünmelidir.

```text
3 Ekim
[meeting icon]
```

Calendar cell'i title metinleriyle doldurma. Temel gösterim `date + compact icon indicator` olmalıdır.

---

# 13. Hover Davranışı

Desktop'ta icon üzerine gelindiğinde reminder adı tooltip ile gösterilmelidir.

```text
[Meeting Icon]
hover
↓
Sprint Toplantısı
```

Mevcut tooltip component'ini kullan. Minimum içerik title olsun.

---

# 14. Mobile / Touch

Hover mobilde olmadığı için icon tap davranışını destekle. Mevcut popover/detail standardını kullan. Sırf bunun için karmaşık modal sistemi oluşturma.

Accessibility korunmalı.

---

# 15. Aynı Günde Birden Fazla Reminder

Bir tarihte birden fazla reminder olabilir.

```text
[meeting] [deadline] [presentation]
```

Çok fazla reminder varsa `+2` benzeri overflow indicator kullanılabilir. Calendar cell'in kontrolsüz büyümesine izin verme.

---

# 16. PERSONAL Reminder Görünürlüğü

`PERSONAL` reminder yalnız `creatorUserId` tarafından görülmelidir.

Backend query zaten görünürlüğü filtrelemeli; yalnız frontend filter'a güvenme.

Örnek:

```text
Hamza → PERSONAL: Backend API'yi bitir
Alper → göremez
```

---

# 17. PROJECT Reminder Görünürlüğü

`PROJECT` reminder ilgili projenin bütün aktif üyeleri tarafından görülebilmelidir. Başka project kullanıcıları görememelidir.

---

# 18. PROJECT Reminder Oluşturma Yetkisi

Yalnız `PROJECT_MANAGER` project-wide reminder oluşturabilmelidir.

Normal kullanıcı request body'yi değiştirip:

```json
{ "scope": "PROJECT" }
```

gönderirse backend reddetmelidir.

Frontend'de seçeneği gizlemek authorization değildir.

---

# 19. PERSONAL Reminder Oluşturma Yetkisi

İlgili projenin aktif her üyesi PERSONAL reminder oluşturabilir. Project Manager da buna dahildir.

Manager her reminder'ı PROJECT olmak zorunda değildir.

---

# 20. Reminder Ownership

Personal reminder sahibi authenticated user olmalıdır. Client'tan başka kullanıcı adına `recipientUserId` kabul etme.

---

# 21. Project Reminder Creator

PROJECT reminder için de `creatorUserId` saklanmalıdır. İleride audit/detail için kullanılabilir.

---

# 22. Reminder Edit

Reminder düzenleme desteği sağla.

## PERSONAL

Yalnız owner düzenleyebilir.

## PROJECT

Project management yetkisine sahip kullanıcı düzenleyebilir. Normal member project reminder'ı değiştiremez.

Düzenlenebilir alanlar:

- title
- description
- type
- date/time

---

# 23. Scope Değiştirme

V1'i sade tutmak için reminder scope creation sonrası immutable olsun.

Normal user hiçbir şekilde `PERSONAL → PROJECT` yapamamalıdır.

---

# 24. Reminder Delete

## PERSONAL

Yalnız owner silebilir.

## PROJECT

Yalnız project management yetkisine sahip kullanıcı silebilir.

Silme öncesi mevcut PDA confirmation dialog standardını kullan.

---

# 25. Calendar API ve Date Range

Takvim sorguları date range desteklemelidir.

Örneğin:

```http
GET /api/v1/projects/{projectId}/reminders?from=2026-10-01&to=2026-10-31
```

Response yalnız authenticated kullanıcının görebildiği kayıtları içermelidir:

```text
(projectId = selectedProject)
AND
(
    scope = PROJECT
    OR
    (scope = PERSONAL AND creatorUserId = currentUserId)
)
```

Query'yi verimli implement et.

---

# 26. Gereksiz Tüm Reminder'ları Çekme

Calendar aylık görünümdeyse bütün reminder kayıtlarını çekme. Görüntülenen tarih aralığını sorgula. Ay değişince yeni range fetch yapılabilir.

Mevcut frontend cache/data-fetching standardına uy.

---

# 27. Reminder API'leri

Mevcut REST convention'a göre aşağıdaki use-case'leri destekle:

```text
GET    project reminders by date range
GET    reminder detail
POST   create reminder
PATCH  update reminder
DELETE delete reminder
```

Kavramsal route örneği:

```http
GET    /api/v1/projects/{projectId}/reminders
POST   /api/v1/projects/{projectId}/reminders
GET    /api/v1/projects/{projectId}/reminders/{reminderId}
PATCH  /api/v1/projects/{projectId}/reminders/{reminderId}
DELETE /api/v1/projects/{projectId}/reminders/{reminderId}
```

Tam naming'i mevcut repository standardına göre adapte et.

---

# 28. Create Reminder Request

Kavramsal örnek:

```json
{
  "title": "Sprint Toplantısı",
  "description": "Sprint 4 sonuçlarını konuşacağız.",
  "type": "MEETING",
  "scope": "PROJECT",
  "date": "2026-10-03",
  "time": "14:00"
}
```

Normal user için scope PERSONAL default olabilir; ancak client PROJECT gönderirse yine backend authorization kontrolü yap.

---

# 29. Response Model

Calendar için minimum yeterli response üret:

```text
id
title
description
type
scope
date
time
creator
```

Gereksiz User entity expose etme. Creator gerekiyorsa minimum summary kullan.

---

# 30. Ana Sayfadaki Takvim ile Entegrasyon

PDA ana sayfasındaki calendar widget da aynı reminder datasını göstermelidir.

```text
Calendar Page
        ↘
         Reminder API
        ↗
Home Calendar
```

İki ayrı reminder sistemi oluşturma.

Home Calendar da:

- doğru gün
- doğru type icon
- hover/tap title

davranışlarını desteklemelidir.

---

# 31. Home Calendar Project Context

Ana sayfadaki calendar mevcut selected project context'i ile çalışıyorsa yalnız seçili project reminder'larını göster.

Dashboard çoklu proje mantığında çalışıyorsa mevcut architecture'ı incele; kendi varsayımınla farklı projelerin reminder'larını karıştırma.

---

# 32. Reminder Detail Interaction

Minimum ihtiyaç:

```text
hover/tap → reminder title
```

Mevcut UX'e uygunsa küçük popover/detail kullanılabilir. Gereksiz büyük reminder detail feature'ı oluşturma.

---

# 33. Takvim Sayfasında “Anımsatıcı Oluştur” Butonu

Calendar page üzerinde:

```text
+ Anımsatıcı oluştur
```

aksiyonu ekle.

İlgili project context'inde çalışmalıdır. Global reminder oluşturma.

---

# 34. Create Reminder Form

Minimum alanlar:

```text
Anımsatıcı adı *
Açıklama
Anımsatıcı türü *
Tarih *
Saat (opsiyonel)
```

Project Manager için ayrıca:

```text
Kendim için
Projedeki herkes için
```

scope seçimi göster.

Normal member için bu seçim görünmemeli ve reminder PERSONAL oluşturulmalıdır.

---

# 35. Form Defaults

Kullanıcı calendar'da belirli güne tıklayıp create flow açtıysa tarih pre-filled olabilir.

Reminder type için kontrollü default seç veya kullanıcıyı seçim yapmaya zorla. Gereksiz varsayım yapma.

---

# 36. Reminder Type Dropdown UX

Kullanıcı teknik enum değil label görmelidir:

```text
MEETING → Toplantı
DEADLINE → Son tarih
PRESENTATION → Sunum
```

Mümkünse dropdown'da ikon + label kullan.

Mevcut Türkçe/İngilizce i18n yapısını kullan.

---

# 37. Date / Timezone

Date-only reminder'larda timezone kaynaklı gün kayması oluşturma.

```text
3 Ekim → 2 Ekim
```

gibi bug'lar olmamalıdır.

Date-only değer gerçekten date olarak ele alınmalıdır. Saat varsa mevcut timezone standardını kullan.

---

# 38. Past Date Reminder

Varsayılan öneri: yeni reminder geçmiş tarihte oluşturulmasın.

Ancak mevcut calendar davranışı farklıysa repository standardıyla tutarlı karar ver.

---

# 39. Reminder ile Task'ı Karıştırma

Reminder bir Task değildir.

Reminder'a şunları ekleme:

- task status workflow
- assignee
- priority
- checklist
- task lifecycle

Kullanıcı kendi task'ı için reminder oluşturabilir fakat reminder bağımsız bir calendar öğesi olmalıdır.

---

# 40. Optional Task Relation

Mevcut Task Service ile doğal ve küçük bir ilişki varsa ileride opsiyonel `relatedTaskId` düşünülebilir. Ancak bu task'ın zorunlu parçası değildir.

Reminder oluştururken task seçimini zorunlu yapma.

---

# 41. Notification Service Konusunda Feature Creep Yapma

PDA'da Notification Service mevcut olsa da bu feature'ın ana ihtiyacı:

```text
calendar reminder
+
calendar icon
+
hover/tap title
```

Eğer mevcut sistem scheduled/future notification desteklemiyorsa sırf reminder için şunları ekleme:

- Quartz
- cron scheduler
- Redis
- Kafka
- delayed queue
- yeni background scheduling infrastructure

V1 reminder sistemi takvim tabanlıdır. İleride gerçek bildirim (`10 dakika önce bildir`) ayrı feature olabilir.

---

# 42. Database

Flyway ile reminder tablosunu oluştur.

Kavramsal alanlar:

```text
id
project_id
creator_user_id
title
description
type
scope
reminder_date
reminder_time
created_at
updated_at
```

Mevcut schema naming standardına uy. Hibernate `create/update` ile schema değiştirme.

---

# 43. Database Indexleri

Calendar sorgularını düşün:

```text
project_id
reminder_date
scope
creator_user_id
```

Gerçek query patternine göre uygun index ekle. Örneğin `(project_id, reminder_date)` anlamlı olabilir.

Gereksiz index yağmuru oluşturma.

---

# 44. Security

Backend mutlaka şunları doğrulamalıdır:

- kullanıcı project member mı?
- reminder ilgili project'e mi ait?
- PERSONAL reminder current user'a mı ait?
- PROJECT reminder oluşturmak için Project Manager mı?
- edit yetkisi var mı?
- delete yetkisi var mı?
- başka project reminder ID'si manipulate edilmiş mi?

Frontend action gizleme authorization değildir.

---

# 45. Cross-Project Data Leak Engeli

Örneğin Project A'daki Reminder X'e Project B route'u üzerinden erişilememelidir:

```text
/projects/B/reminders/X
```

Backend `projectId + reminderId` ilişkisini doğrulamalıdır.

---

# 46. Spring Modulith Boundaries

Mevcut modüler yapıyı koru. Reminder'ın hangi module/package altında olması gerektiğine repository mimarisini inceleyerek karar ver.

Şunları yapma:

```text
Reminder → Auth Repository
Reminder → Task Repository
Reminder → Notification Repository
```

Gerekli cross-module erişimlerde public contract kullan. Persistence entity'lerini modüller arasında taşıma.

---

# 47. Frontend Architecture

Mevcut feature-based frontend yapısını kullan.

Reminder ile ilgili:

- API client
- types
- form
- calendar mapping
- type configuration

kodlarını uygun feature yapısında tut.

Calendar page içine yüzlerce satırlık business logic gömme. Home Calendar tarafından da reuse edilebilecek yapılar oluştur.

---

# 48. Loading / Error State

Reminder query yüklenirken tüm calendar'ı gereksiz bloke etme. Mevcut loading standardını kullan.

API hatasında calendar crash olmamalı; mevcut error handling standardına göre feedback ve gerekiyorsa retry sağla.

---

# 49. Empty State

Reminder yokken calendar normal çalışmalıdır. Her güne “Anımsatıcı yok” yazma.

---

# 50. Accessibility

Reminder icon yalnız görsel bilgiye dayanmamalıdır.

Uygun:

```text
aria-label
title
tooltip
```

kullan.

Örneğin screen reader için:

```text
Toplantı: Sprint Toplantısı
```

anlaşılır olmalıdır. Sadece renk farkına güvenme.

---

# 51. Testler

## Personal Reminder

- normal project member PERSONAL reminder oluşturabilir
- reminder yalnız creator'a görünür
- başka project member göremez
- owner edit edebilir
- owner delete edebilir
- başka kullanıcı edit/delete edemez

## Project Reminder

- Project Manager PROJECT reminder oluşturabilir
- bütün project member'lar görebilir
- başka project üyeleri göremez
- normal member PROJECT reminder oluşturamaz
- normal member request manipüle ederek scope değiştiremez
- project manager edit/delete yapabilir

## Manager Personal Reminder

Özellikle test et:

```text
PROJECT_MANAGER
→ PERSONAL reminder oluşturabilir
```

Manager'ın her reminder'ının yanlışlıkla PROJECT olmamasını doğrula.

## Reminder Type

- geçerli enum kabul edilir
- invalid type reddedilir
- response'ta doğru type döner

## Validation

- title zorunlu
- blank title reject
- description opsiyonel
- date zorunlu
- invalid date reject
- past-date rule varsa doğrulanır

## Visibility Query

Date-range sorgusu yalnız:

```text
PERSONAL(current user)
+
PROJECT
```

döndürmelidir.

Başka kullanıcıların personal reminder'ları dönmemeli.

## Cross Project

Project A reminder'ına Project B context'i ile erişilememeli.

## Calendar UI

- reminder doğru günde görünür
- doğru type icon görünür
- hover title gösterir
- aynı günde birden fazla icon desteklenir

## Manager UI

Project Manager scope seçimini görür; normal member görmez.

## Home Calendar

Calendar Page ve Home Calendar aynı reminder verisini doğru gösterir.

---

# 52. E2E Senaryoları

## Normal Member

```text
Login
→ Project
→ Calendar
→ Anımsatıcı oluştur
→ Meeting
→ tarih seç
→ oluştur
→ calendar icon
→ hover
→ title
```

Reminder yalnız kendisine görünmeli.

## Project Manager — Personal

```text
Login
→ Calendar
→ Anımsatıcı oluştur
→ Kendim için
→ oluştur
```

Diğer üyeler görmemeli.

## Project Manager — Project

```text
Login
→ Calendar
→ Anımsatıcı oluştur
→ Projedeki herkes için
→ Meeting
→ 3 Ekim
→ Sprint Toplantısı
→ oluştur
```

Başka project member login olduğunda:

```text
3 Ekim
→ meeting icon
→ hover
→ Sprint Toplantısı
```

görmelidir.

---

# 53. Build ve Kalite Kontrolü

Görev sonunda mevcut projedeki ilgili komutları çalıştır.

Backend:

- build
- unit tests
- integration tests
- security tests
- architecture tests

Frontend:

- lint
- type-check
- tests
- production build

Ortaya çıkan hataları düzelt. Yalnız plan veya yarım implementation bırakma.

---

# 54. Görev Sonunda Teknik Rapor

Implementasyon tamamlandıktan sonra şu başlıklarla kısa teknik rapor ver.

## Reminder Domain

Entity/model yapısını açıkla.

## Scope Model

```text
PERSONAL
→ yalnız creator

PROJECT
→ bütün project members
→ yalnız PROJECT_MANAGER oluşturabilir
```

## Reminder Types

Eklenen type'ları ve frontend icon mappinglerini listele.

## Calendar Integration

Calendar Page üzerindeki gösterimi açıkla.

## Home Calendar Integration

Ana sayfa calendar bağlantısını açıkla.

## Authorization

Normal member ile Project Manager farkını belirt.

## API Endpoints

Eklenen/değiştirilen endpointleri listele.

## Database

Flyway migration ve indexleri belirt.

## Frontend

Yeni component/form/config değişikliklerini özetle.

## Tests

Eklenen önemli testleri listele.

## Changed Files

Önemli oluşturulan/değiştirilen dosyaları listele.

## Build Result

Backend/frontend build ve test sonuçlarını yaz.

---

# Kritik Kurallar

1. Reminder verisini yalnız frontend/local state'te tutma; backend'de kalıcı sakla.
2. Her reminder bir project'e ait olmalı.
3. Normal project member yalnız PERSONAL reminder oluşturabilmeli.
4. Project Manager hem PERSONAL hem PROJECT reminder oluşturabilmeli.
5. PROJECT reminder'ı yalnız PROJECT_MANAGER oluşturabilmeli.
6. Project Manager'a create formunda `Kendim için / Projedeki herkes için` seçimi göster.
7. Normal kullanıcıya project-wide scope seçimi gösterme.
8. Backend request manipulation ile normal kullanıcının PROJECT reminder oluşturmasını engelle.
9. PERSONAL reminder yalnız creator tarafından görülebilmeli.
10. PROJECT reminder bütün ilgili project üyeleri tarafından görülebilmeli.
11. Başka project kullanıcılarına reminder data sızdırma.
12. Reminder title zorunlu olmalı.
13. Description opsiyonel olmalı.
14. Reminder type kontrollü enum olmalı.
15. Her reminder type frontend'de kendine ait ikonla temsil edilmeli.
16. Icon mapping'i merkezi/reusable tut.
17. Calendar Page ve Home Calendar aynı reminder sistemini kullanmalı.
18. Reminder ilgili gün üzerinde icon olarak görünmeli.
19. Desktop hover'da reminder title gösterilmeli.
20. Touch/mobile için erişilebilir alternatif davranış sağla.
21. Aynı günde birden fazla reminder destekle.
22. Personal reminder'ı başka kullanıcı adına oluşturma özelliği ekleme.
23. Reminder'ı Task entity'sine dönüştürme.
24. Task assignment/status/priority gibi task özelliklerini reminder'a ekleme.
25. Project Manager personal reminder oluşturma hakkını kaybetmemeli.
26. Scope mümkünse creation sonrası immutable olsun.
27. Reminder edit/delete authorization backend'de uygulanmalı.
28. Calendar queries date-range üzerinden çalışmalı.
29. Bütün reminder kayıtlarını her calendar request'inde çekme.
30. Date-only reminder'larda timezone nedeniyle gün kayması oluşturma.
31. Backend'de icon/SVG saklama.
32. Yeni icon library ekleme; mevcut icon sistemini kullan.
33. Mevcut Notification Service scheduled notification desteklemiyorsa yeni scheduler/Kafka/Redis/Quartz altyapısı ekleme.
34. Bu task'ın ana kapsamı calendar-based reminder sistemidir.
35. Schema değişikliklerini yalnız Flyway ile yap.
36. Mevcut ProjectMembership ve role modelini reuse et.
37. Başka modül repository'sine doğrudan erişme.
38. Spring Modulith sınırlarını koru.
39. Frontend ve backend'de dead/duplicate code bırakma.
40. Görev sonunda testleri, type-check, lint ve build'i geçirerek implementation'ı tamamla.
