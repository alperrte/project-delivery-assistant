# PDA — Notification Service: Read State, Notification History & Outlook-Style Notification Center

PDA Notification Service ve frontend Notification Center üzerinde bildirim yönetimi geliştirilecek.

Kullanıcının ürün isteğinin özü:

1. Bildirimler alanında aktif/yeni bildirimlerden ayrı bir **Geçmiş Bildirimler** bölümü olmalı.
2. Her okunmamış bildirimin yanında kullanıcı tarafından tetiklenebilen bir **Okundu olarak işaretle** aksiyonu bulunmalı.
3. Bir bildirim okundu olarak işaretlendiğinde:
   - silinmemeli,
   - Notification Service içindeki kalıcı kaydı korunmalı,
   - aktif/yeni bildirimler listesinden çıkmalı,
   - **Geçmiş Bildirimler** bölümünde görünmeye devam etmeli.
4. Bildirim panelinin uygun üst alanında **Tümünü okundu olarak işaretle** aksiyonu bulunmalı.
5. Bu aksiyon kullanıcının mevcut okunmamış bildirimlerinin tamamını okundu yapmalı ve Geçmiş Bildirimler alanına taşımalı.
6. Kullanıcı deneyimi Outlook'un mail sistemindeki “okundu / tümünü okundu yap / geçmişte erişmeye devam et” mantığına benzer, modern ve anlaşılır olmalı.

Buradaki “Geçmiş Bildirimler”:

> silinen bildirimler anlamına gelmez.

Temel ürün modeli:

```text
Okunmamış bildirim
→ kullanıcı görür
→ Okundu olarak işaretle
→ read state kalıcı olarak güncellenir
→ aktif bildirimlerden çıkar
→ Geçmiş Bildirimler'de kalır
```

Toplu akış:

```text
Birden fazla unread notification
→ Tümünü okundu olarak işaretle
→ kullanıcının unread notification'ları read olur
→ unread count 0
→ kayıtlar Geçmiş Bildirimler'de görünür
```

---

# EN ÖNEMLİ ÇALIŞMA KURALI

Bu istekleri doğrudan kodlamaya başlama.

Önce repository'yi incele ve Notification Service'in mevcut durumunu çıkar.

Özellikle mevcut sistemde zaten:

- read/unread alanı,
- `readAt`,
- mark-as-read endpoint'i,
- mark-all-as-read endpoint'i,
- unread count,
- notification pagination,
- notification query keys,
- Notification Center frontend'i

varsa bunları yeniden yazma.

Mevcut altyapıyı kullan ve yalnız eksik olan parçaları tamamla.

---

# TASK PLANLAMA KURALI

Repository root'unda:

```text
PDA_NOTIFICATION_HISTORY_AND_READ_STATE_PLAN.md
```

oluştur.

Bu dosya implementation boyunca source of truth olacak.

Taskları kullanıcının verdiği cümle sırasına göre değil, gerçek teknik dependency sırasına göre oluştur.

Örneğin:

```text
backend read-state eksik
→ önce backend/persistence

backend hazır ama frontend bağlı değil
→ önce frontend API/query katmanı

read state hazır
→ active/history ayrımı

sonra individual read action

sonra mark-all-read

sonra responsive/a11y/regression/full gate
```

Kesin sırayı repository analizinden sonra belirle.

---

# CHECKBOX ÇALIŞMA MODELİ

Her task aşağıdaki yapıda olsun:

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
- Cache:
- Security:
- i18n:
- Accessibility:
- Tests:

### Checklist
- [ ] N.1 ...
- [ ] N.2 ...
- [ ] N.3 ...

### Definition of Done
- [ ] ...
- [ ] ...
```

Her tamamlanan madde `[ ]` durumundan `[x]` durumuna getirilmeli.

Kullanıcı bu checkbox ilerlemesini plan dosyasından görebilmeli.

Zorunlu uygulama sırası:

```text
implementation
→ targeted tests
→ bulunan bugların düzeltilmesi
→ re-test
→ Definition of Done
→ checklist [x]
→ sonraki bağımlı task
```

Bir task'ın Definition of Done maddeleri tamamlanmadan sonraki bağımlı task'a geçme.

---

# 1. MEVCUT NOTIFICATION ARCHITECTURE AUDIT

Önce gerçek Notification Service'i incele.

Ara:

- Notification entity
- Notification type
- recipientUserId
- project/resource references
- createdAt
- read state
- readAt
- unread count
- NotificationRepository
- NotificationService
- NotificationController
- response DTO
- pagination
- sorting
- notification event listeners
- frontend notifications API
- TanStack Query keys
- notification owner/account isolation
- AppHeader notification menu
- Notification Center
- existing polling/realtime behavior
- session/account lifecycle
- TR / EN / DE notification translations
- existing backend/frontend tests

İsimleri tahmin etme.

Gerçek repository isimlerini kullan.

---

# 2. READ / UNREAD SOURCE OF TRUTH

Önce mevcut modelde bildirimin okunma durumunun nasıl tutulduğunu çıkar.

Örneğin gerçekte varsa:

```text
isRead
readAt
status
```

hangi alan source of truth ise onu kullan.

Frontend-only geçici state ile bu feature'ı uygulama.

Read state backend ve DB'de kalıcı olmalı.

Sayfa refresh edildiğinde okunmuş bildirim tekrar unread görünmemeli.

Logout/login sonrasında state korunmalı.

---

# 3. GEÇMİŞ BİLDİRİMLER TANIMI

Bu feature kapsamında:

```text
Aktif / Yeni Bildirimler
= unread notifications

Geçmiş Bildirimler
= read notifications
```

olarak düşün.

Ancak mevcut Notification Service farklı bir lifecycle taşıyorsa gerçek modele göre adapte et ve plan dosyasında açıkça yaz.

Geçmişe taşımak `DELETE`, `ARCHIVE` veya physical move anlamına gelmez.

Aynı notification kaydı read state üzerinden farklı presentation bölümünde görünür.

---

# 4. NOTIFICATION CENTER IA / UX

Notification UI daha anlaşılır hale getirilmeli.

Tercih edilen yapı:

```text
Bildirimler

[ Yeni ] [ Geçmiş ]
```

veya mevcut design system daha uygunsa iki bölüm şeklinde sun.

Exact component tasarımını mevcut PDA UI sistemine göre belirle.

Yeni UI/component library ekleme.

---

# 5. UNREAD / CURRENT NOTIFICATIONS

Yeni/aktif bildirim alanında yalnız okunmamış bildirimler gösterilmeli.

Her item gerçek DTO'nun sağladığı uygun verileri gösterebilir:

```text
icon
title
message
time
resource/project context
read action
```

Var olmayan backend verisini frontend'de uydurma.

---

# 6. GEÇMİŞ BİLDİRİMLER

Read olmuş bildirimler Geçmiş Bildirimler alanında gösterilmeli.

Bildirim geçmişte içeriğini, tarihini, notification type bilgisini ve varsa güvenli resource context'ini korumalı.

Read olmak bildirimin içeriğini değiştirmemeli.

---

# 7. INDIVIDUAL “OKUNDU” ACTION

Her unread notification item'ında modern ve anlaşılır bir read action bulunmalı.

Örneğin mevcut icon setinden uygun icon + tooltip:

```text
Okundu olarak işaretle
```

Yeni icon library ekleme.

Desktop'ta hover action olabilir.

Mobile/touch'ta aksiyon erişilebilir kalmalı; yalnız hover'a bağlı bırakma.

---

# 8. INDIVIDUAL READ DAVRANIŞI

Kullanıcı bir bildirimin read action'ına bastığında:

```text
unread notification
→ backend mutation
→ DB read state
→ unread list'ten çıkar
→ history list'e girer
→ unread badge/count azalır
```

Hard reload gerekmemeli.

UI optimistic update kullanacaksa rollback/error handling doğru olmalı.

Mevcut project/account isolation korunmalı.

---

# 9. “TÜMÜNÜ OKUNDU OLARAK İŞARETLE”

Notification Center'ın uygun sağ üst alanında:

```text
Tümünü okundu olarak işaretle
```

aksiyonu olmalı.

Outlook benzeri compact bir action olabilir.

Mevcut icon setinden uygun icon kullanılabilir.

---

# 10. MARK-ALL SEMANTICS

Bu butona basıldığında yalnız current authenticated user'ın current unread notifications kayıtları read olmalı.

Başka kullanıcının notification'larına hiçbir şekilde dokunulmamalı.

Request body'den `userId` veya `recipientId` gibi actor seçimi yapılmamalı.

Authenticated principal backend source of truth olmalı.

---

# 11. MARK-ALL SONRASI UI

Başarılı mutation sonrası:

```text
unread count → 0
active list → empty
history → yeni read kayıtlarını içerir
```

olmalı.

Geçmiş notification kayıtlarının sırası bozulmamalı.

Gerçek server pagination/sorting contract'ını koru.

---

# 12. MARK-ALL BUTON DURUMU

Unread notification yoksa buton disabled olabilir veya görünmeyebilir.

Mevcut PDA UX pattern'ine göre karar ver.

Ama clickable no-op action bırakma.

Loading sırasında double submit engellensin.

Error state kullanıcıya anlamlı gösterilsin.

---

# 13. READ ACTION FAILURE

Individual veya mark-all request başarısız olursa notification yanlışlıkla history'ye kalıcı taşınmış gibi görünmemeli, unread count yanlış kalmamalı, retry mümkün olmalı ve kullanıcıya uygun error feedback verilmeli.

Optimistic UI kullanılıyorsa mutation rollback test edilmeli.

---

# 14. NOTIFICATION BADGE / COUNT

AppHeader/sidebar/bell üzerinde unread count varsa gerçek backend count ile senkronize olmalı.

Individual read `5 → 4`, mark all `5 → 0` şeklinde doğru güncellenmeli.

Account switch veya login sırasında önceki kullanıcının badge'i görünmemeli.

---

# 15. HISTORY PAGINATION

Çok sayıda notification olduğunda tüm history'yi client'a bir defada yükleme.

Mevcut backend pagination varsa reuse et.

Gerekirse minimum backend filter ekle.

Client-side tüm notification datasını indirip `.filter(n => n.isRead)` şeklinde ölçeklenmeyen fake pagination yapma.

---

# 16. FILTER CONTRACT

Backend list endpoint'i read/unread filter desteklemiyorsa önce mevcut API'yi incele.

Gerekirse additive filter düşün:

```text
read=true
read=false
```

veya mevcut API standardına uygun eşdeğeri.

Yeni endpoint oluşturmadan mevcut list endpoint'inin güvenli şekilde genişletilmesi mümkünse onu tercih et.

Exact contract repository mimarisinden çıkarılmalı.

---

# 17. SORTING

Yeni ve geçmiş listelerde notification sırası deterministik olmalı.

Önerilen `createdAt DESC, id DESC` veya repository'nin mevcut stable ordering'i.

Pagination sırasında duplicate/missing item oluşmamalı.

---

# 18. ACCOUNT / RECIPIENT ISOLATION

Notification query/cache ailesi authenticated user'a göre scope edilmeli.

Senaryo:

```text
User A login
→ notifications loaded
→ logout
→ User B login
```

User B, A'nın unread notification'larını, history'sini, badge'ini veya late API response'unu görmemeli.

Previous invitation/account cache isolation fixlerini bozma.

---

# 19. AUTHORIZATION / IDOR

Individual read endpoint'i notification ID alıyorsa başka kullanıcı o ID ile mark-read yapamamalı.

Başka kullanıcının notification'ı okunamamalı, read yapılamamalı veya geçmiş durumuna geçirilememeli.

Backend principal scope zorunlu.

Frontend button visibility security değildir.

---

# 20. CSRF / SESSION

Mutation endpointleri mevcut security architecture ile uyumlu olmalı.

Kontrol et:

- authenticated session
- CSRF
- expired session
- logout sırasında inflight request
- account switch
- forced-password/state varsa

Security policy'yi feature için gevşetme.

---

# 21. REAL-TIME / POLLING

Mevcut Notification Service polling, refresh-on-focus, event veya WebSocket hangi modeli kullanıyorsa onu koru.

Read state mutation sonrası local cache hemen güncellenebilir fakat gerçek server source of truth ile reconcile edilmeli.

Yeni socket altyapısı sadece bu feature için eklenmemeli.

---

# 22. NOTIFICATION TYPES

Bu değişiklik generic Notification Center davranışıdır.

Mevcut notification type'larını bozma.

Task, invitation, team deletion, status change gibi mevcut türler aynı read/history davranışından yararlanabilmeli.

Type-specific payload kaybolmamalı.

---

# 23. TEAM-DELETION POPUP SEMANTICS

Eğer önceki Squad Service implementation'ında `SQUAD_DELETED`, `popupPresentedAt` veya `claim` gibi presentation semantics mevcutsa:

> popup gösterildi = notification read

olarak kabul etme.

Bunlar farklı kavramlar.

`popupPresentedAt != readAt` olabilir.

Read action yalnız explicit read davranışı olsun.

---

# 24. GEÇMİŞ ≠ POPUP PRESENTED

Geçmiş Bildirimler'e geçiş kriteri read state olmalı.

Popup'ın gösterilmiş olması tek başına geçmişe taşıma kriteri olmamalı.

Bu ayrımı backend/frontend/tests seviyesinde koru.

---

# 25. UI MODERNİZASYONU

Outlook'tan davranış fikri alınabilir ancak Outlook'u birebir kopyalama.

PDA design language kullan.

Beklenen his temiz, kompakt, okunabilir, modern ve hızlı aksiyonlu olmalı.

Unread item daha belirgin, read/history item daha sakin visual hierarchy kullanabilir.

Accessibility contrast düşürülmemeli.

---

# 26. RESPONSIVE

Notification Center 320 / 390 / 768 / 1024 / 1440 px viewportlarında doğrulanmalı.

Desktop'ta compact actions/hover kullanılabilir.

Mobile'da individual mark-read erişilebilir, horizontal overflow olmamalı ve mark-all kaybolmamalı.

---

# 27. ACCESSIBILITY

Kontrol et:

- read button gerçek `<button>`
- `aria-label`
- keyboard Tab
- Enter/Space
- mark-all accessible name
- unread/read state screen reader için anlaşılır
- focus mutation sonrası kaybolmamalı
- tooltip yalnız bilgi desteği olmalı
- contrast
- touch target

---

# 28. i18n

Yeni bütün user-facing metinler TR / EN / DE catalog'larında bulunmalı.

Örneğin kavramsal:

```text
Yeni Bildirimler
Geçmiş Bildirimler
Okundu olarak işaretle
Tümünü okundu olarak işaretle
Yeni bildiriminiz yok
Geçmiş bildiriminiz yok
Bildirim güncellenemedi
```

Hardcoded Türkçe production string bırakma.

---

# 29. INDIVIDUAL READ TEST

Gerçek backend + PostgreSQL ile:

```text
User A has unread N1 and N2
→ UI shows N1/N2 in unread
→ mark N1 read
→ server success
→ N1 DB read
→ N1 unread list'ten çıkar
→ N1 history'de görünür
→ N2 unread kalır
→ unread count 2→1
→ reload
→ state korunur
```

---

# 30. MARK-ALL TEST

```text
User A has unread N1 N2 N3
→ click Mark all as read
→ real mutation
→ DB all read
→ unread count 0
→ unread list empty
→ N1/N2/N3 history'de
→ reload
→ history persists
```

---

# 31. CROSS-USER TEST

```text
User A notification N1
User B notification N2
User B manually calls mark-read(N1)
```

reddedilmeli.

Mark-all yalnız B'nin notification'larını değiştirmeli.

Direct DB verification yap.

---

# 32. CONCURRENCY / IDEMPOTENCY

Aynı notification iki tabda aynı anda read yapılırsa state bozulmamalı.

İki tab aynı anda mark-all çalıştırırsa duplicate side-effect olmamalı ve final unread count doğru olmalı.

Read operation mümkünse idempotent semantics taşımalı veya repository'nin mevcut contract'ı korunmalı.

---

# 33. CACHE TESTLERİ

Warm notification list → individual read → history switch akışında hard reload gerekmemeli.

Warm unread count → mark all sonrasında badge hemen doğru olmalı.

Account switch late response testi zorunlu.

---

# 34. HISTORY EMPTY STATE

Hiç read notification yoksa modern empty state göster.

Örneğin “Henüz geçmiş bildiriminiz yok.” benzeri mevcut design/i18n pattern'ini kullan.

---

# 35. ACTIVE EMPTY STATE

Unread kalmadığında “Yeni bildiriminiz yok.” benzeri temiz state göster.

Bu durumda geçmiş sekmesine erişim devam etmeli.

---

# 36. DELETE FEATURE EKLEME

Bu task kapsamında notification silme özelliği ekleme.

İstek read, history ve mark-all-read ile sınırlıdır.

Read notification history'de tutulmalıdır.

---

# 37. UNREAD'A GERİ ALMA

Kullanıcı açıkça istemedi.

Dolayısıyla otomatik olarak “Okunmadı olarak işaretle” özelliği ekleme.

Repository'de zaten böyle bir feature varsa bozma; yoksa bu scope'ta oluşturma.

---

# 38. MOCK / FAKE YASAĞI

Normal success acceptance frontend → real backend → real PostgreSQL üzerinden doğrulanmalı.

Normal success'i `route.fulfill` / fake notification list ile kanıtlama.

Test-only error/latency injection ayrı işaretlenebilir.

---

# 39. TASK GRUPLANDIRMA

Yukarıdaki bölümleri ayrı ayrı task yapma.

Gerçek dependency graph'a göre anlamlı tasklara grupla.

Örnek sıra:

```text
Task 1 — Preflight / current Notification contracts & baseline
Task 2 — Read/history backend query and persistence contract
Task 3 — Individual mark-as-read backend + security/cache contract
Task 4 — Mark-all-as-read backend + concurrency
Task 5 — Notification Center active/history information architecture
Task 6 — Individual read & mark-all UI/cache integration
Task 7 — Account isolation, responsive, a11y, i18n and real E2E
Task 8 — Full gate + implementation completion
```

BU SIRA SADECE ÖRNEKTİR.

Eğer repository incelemesinde backend read/read-all endpointleri zaten tamamen hazırsa onları yeniden implement etme.

Bu durumda planı existing backend contract verification → frontend API/query integration → active/history UI → actions → regression şeklinde sadeleştir.

Taskları gerçek ihtiyaç belirlesin.

---

# 40. GİT GÜVENLİĞİ

Kullanıcı değişikliklerini koru.

Kullanma:

```text
git reset --hard
git checkout .
```

Plan dışı kullanıcı dosyalarını revert etme.

Commit/push/staging/pull/merge yapma.

---

# 41. FINAL VALIDATION

Implementation bittikten sonra en az:

```text
backend targeted Notification tests
backend full tests
frontend lint
TypeScript
production build
targeted Notification Playwright
account-switch/cache regression
full Chromium Playwright
```

çalıştır.

Ardından canonical `./pre-push/pre-push.cmd` veya repository'deki gerçek eşdeğerini çalıştır.

Backend gate'i atlama.

Docker build/start/health repository gate'inin parçasıysa doğrula.

---

# 42. IMPLEMENTATION COMPLETION

İş bittikten sonra plan dosyasından ayrı implementation completion kaydı oluştur.

Final rapor başlıkları:

## Final verdict
## Task checklist
## Notification read model
## Active notifications
## Notification history
## Individual mark-as-read
## Mark-all-as-read
## Unread count / badge
## Cache and account isolation
## Authorization / IDOR
## Responsive / accessibility / i18n
## Changed files
## Test results
## Remaining issues

Sadece gerçekten blocker yoksa:

```text
Kalan blocker yok.
```

yaz.

---

# KRİTİK KURALLAR

1. Önce mevcut Notification Service'i incele.
2. Var olan read/read-all endpointlerini yeniden yazma.
3. Geçmiş Bildirimler = kalıcı read notifications.
4. Okundu yapmak notification'ı silmez.
5. Read state backend/DB source of truth olmalı.
6. Individual read gerçek server mutation olmalı.
7. Mark-all yalnız current authenticated principal'ın notification'larını etkileyebilir.
8. Cross-user IDOR backend'de engellenmeli.
9. Read/unread ile popup-presented state'i birbirine karıştırma.
10. Team deletion popup gösterimi otomatik read sayılmamalı, mevcut contract aksi değilse.
11. Unread badge gerçek backend state ile senkron olmalı.
12. Hard reload cache çözümü değildir.
13. History için tüm kayıtları client'a indirip fake pagination yapma.
14. Existing server pagination/sorting korunmalı.
15. Individual read ve mark-all double click/concurrency düşünülmeli.
16. Account switch sırasında eski kullanıcının notification/history/cache'i görünmemeli.
17. Late request/mutation yeni account'u overwrite etmemeli.
18. Yeni socket/broker sadece bu feature için ekleme.
19. Outlook davranışından esinlen; Outlook UI'sini kopyalama.
20. Existing PDA design system/component/icon setini reuse et.
21. Mobile individual read action yalnız hover'a bağlı olmamalı.
22. TR/EN/DE tamamlanmalı.
23. Light/dark/responsive/a11y doğrulanmalı.
24. Notification silme özelliği ekleme.
25. Kullanıcı istemediği için yeni “okunmadı yap” feature'ı ekleme.
26. Normal success E2E gerçek backend/PostgreSQL kullanmalı.
27. Persistent checkbox planı oluştur.
28. Taskları gerçek dependency sırasına koy.
29. Her task sonrası targeted test + DoD + `[x]`.
30. Bir task bitmeden bağımlı task'a geçme.
31. Full regression + canonical pre-push geçmeden tamamlandı sayma.
32. Commit/push/staging yapma.
