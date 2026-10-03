# PDA — Opus Planning + Sonnet Implementation Workflow

Bu dosya iki aşamalı çalışma için hazırlanmıştır:

1. **Claude Opus + Plan Mode** → repository'yi inceleyip taskları teknik bağımlılık sırasına göre planlayacak.
2. **Claude Sonnet** → Opus'un hazırladığı checklist'i sırayla uygulayacak ve her tamamlanan maddeyi `[x]` olarak işaretleyecek.

---

# 1) Opus Plan Mode İçin Nihai Prompt

# PDA — UI/UX Refactor, Navigation, Settings, Project Banner & Bugfix Planning

PDA (Project Delivery Assistant) projesinde birbiriyle ilişkili birden fazla frontend/UI taskı yapılacak.

Şu an senden KOD YAZMANI İSTEMİYORUM.

Bu aşamada yalnızca repository'yi detaylı şekilde incele, mevcut mimariyi ve ilgili dosyaları bul, aşağıdaki dağınık gereksinimleri mantıklı tasklara ayır ve bunları bağımlılık sırasına göre uygulanabilir bir plana dönüştür.

## En önemli çalışma kuralı

Taskları rastgele sıralama.

Önce repository'yi incele ve şu soruyu cevapla:

> Hangi değişiklik diğer değişikliklerin temelini oluşturuyor ve önce yapılmazsa sonraki tasklarda aynı dosyaları tekrar tekrar değiştirmek gerekir?

Buna göre taskları teknik bağımlılık sırasına koy.

Örneğin navigation/sidebar mimarisini etkileyen bir değişiklik, sidebar'daki tekil menü değişikliklerinden önce yapılmalıysa önce onu planla.

Benim verdiğim sıra bağlayıcı değildir.

Sen repository analizi sonucunda en mantıklı uygulama sırasını belirle.

---

# Planın Formatı

Planı mutlaka checkbox formatında oluştur:

```md
## Task 1 — ...

- [ ] 1.1 ...
- [ ] 1.2 ...
- [ ] 1.3 ...

## Task 2 — ...

- [ ] 2.1 ...
- [ ] 2.2 ...
```

Her ana task için:

- amacı
- neden bu sırada yapıldığını
- hangi mevcut dosyaların/modüllerin etkilendiğini
- backend değişikliği gerekip gerekmediğini
- frontend değişikliklerini
- önemli edge-case'leri
- test/validation adımlarını

belirt.

Taskları gereksiz yere yüzlerce küçük adıma bölme.

Ancak her task Sonnet'in tek tek tamamlayabileceği kadar açık ve somut olsun.

---

# Checklist Kalıcı Olsun

Plan tamamlandığında repository root'unda aşağıdaki dosyayı oluşturabilecek durumdaysan oluştur:

```text
PDA_UI_REFACTOR_PLAN.md
```

Plan Mode dosya oluşturmayı desteklemiyorsa aynı içeriği final cevabında eksiksiz ver.

Sonraki implementation aşamasında Sonnet bu checklist'i source of truth olarak kullanacak.

Implementation sırasında:

```md
- [ ] yapılmadı
- [x] tamamlandı
```

formatı kullanılacak.

Bir task gerçekten tamamlanmadan checkbox işaretlenmemeli.

Her ana task bittikten sonra ilgili checkbox'lar `[x]` yapılacak ve ancak bundan sonra sonraki taska geçilecek.

---

# Repository İncelemesi

Plan hazırlamadan önce özellikle şu alanları incele:

- global sidebar
- selected project sidebar
- navbar/header
- application layout
- projects page
- project detail layout
- project settings
- account settings
- organizations page
- invitations page
- home/dashboard page
- project preview/project cards
- theme provider
- dark/light mode switch
- animation utilities
- i18n / language switching
- project entity / DTO / API
- project image/banner desteği
- responsive container / max-width sistemleri
- modal/dialog componentleri
- existing settings/preferences storage
- user preferences backend'de tutuluyor mu
- frontend persistence yaklaşımı
- test yapısı

Mevcut reusable componentleri ve ortak layout sistemini özellikle bul.

Aynı şeyi ikinci kez yazma.

---

# Gereksinimler

Aşağıdaki maddeler kullanıcı tarafından dağınık şekilde verilmiştir.

Bunları aynen ayrı task kabul etme.

Önce ilişkilerini çöz, sonra mantıklı gruplara ayır.

---

## A — Organizasyon Popup'ını Kaldır

Mevcut organizasyon akışını incele.

Şu anda organization ile ilgili bir işlem veya görüntüleme popup/modal şeklinde açılıyorsa bunun kaldırılması isteniyor.

Repository'de hangi popup'ın kastedildiğini kesin olarak tespit et.

Yeni davranışın:

- dedicated page
- mevcut organization page
- inline navigation

seçeneklerinden hangisi mevcut mimariye uyuyorsa onu planla.

Tahmin ederek yanlış popup'ı kaldırma.

Önce mevcut organization UI akışını bul.

---

## B — Selected Project Sidebar'ı Düzenle

Seçili proje bulunduğunda görünen sidebar şu anda karışık hissettiriyor.

Selected Project alanının:

- hiyerarşisini
- spacing'ini
- item grouping'ini
- project-specific ve global navigation ayrımını
- active state davranışını
- responsive/collapsed davranışını

incele.

Amaç sidebar'ı daha anlaşılır ve düzenli hale getirmek.

Tamamen yeni bir navigation sistemi yazmak yerine mevcut componentleri sadeleştirmeyi tercih et.

Özellikle daha önce yapılan:

- Teams
- Tasks
- Calendar
- selected project
- global Invitations

gibi navigation davranışlarını bozma.

---

## C — Global Davetler Gelmiyor

Sidebar'daki global:

```text
Davetler
```

sayfasında kullanıcının kendisine gelen davetlerin gelmediği/eksik geldiği bir problem var.

Bunu yalnız UI bug'ı varsayma.

Plan sırasında zinciri incele:

```text
Backend invitation query
→ API client
→ query key/cache
→ authenticated user
→ pagination/filter
→ frontend render
```

Problemin gerçek kaynağını belirlemek için gerekli debug adımlarını plana ekle.

Davet sistemi daha önce implement edilen:

- registered user invitations
- external invitations
- accept/reject
- project preview
- statuses

davranışlarını bozmamalı.

Bu task bugfix olarak ele alınmalı.

---

## D — Ana Sayfadaki Tarih Başlığını Kaldır

Ana sayfada üst kısımda örneğin:

```text
2 Ekim 2026 Cuma
```

şeklinde görünen tarih başlığı kaldırılacak.

Yalnız bu heading kaldırılmalı.

Takvim veya tarih kullanan diğer business logic'i kör şekilde silme.

---

## E — Project Settings Navigation Değişikliği

Projects / project detail tarafında proje ayarlarına erişim değişecek.

Yeni davranış:

Project header'ın sağ üst tarafında bir:

```text
kalem / edit icon
```

bulunacak.

Bu icon doğrudan:

```text
Project Settings
```

sayfasına götürecek.

Bunun sonucunda selected project sidebar içindeki:

```text
Ayarlar / Project Settings
```

menü item'ı kaldırılacak.

Ancak settings route veya project settings feature kaldırılmayacak.

Yalnız navigation entry değişecek.

Project edit icon:

- yalnız yetkili kullanıcıya görünmeli
- mevcut permission sistemini kullanmalı
- frontend-only security yaratmamalı

Mevcut backend authorization source of truth olarak kalmalı.

---

## F — Sayfa İçerikleri Fazla Küçük ve Boş Görünüyor

Birçok sayfanın content alanı çok küçük kalıyor ve büyük ekranlarda gereksiz boşluk oluşuyor.

Bunu sayfa sayfa rastgele `width` büyüterek çözme.

Önce mevcut layout/container sistemini incele:

- max-width
- horizontal padding
- content wrapper
- dashboard width
- project page width
- responsive breakpoints

Sorunun global/shared layout seviyesinde çözülebilip çözülemeyeceğini belirle.

Amaç:

- büyük ekranlarda alanın daha verimli kullanılması
- içeriğin gereksiz küçücük kalmaması
- küçük ekranların bozulmaması
- bütün sayfaların devasa full-width hale gelmemesi

Tutarlı bir content width standardı oluşturmayı değerlendir.

Bu task mümkünse shared layout seviyesinde çözülmeli.

---

## G — "PDA Çalışma Alanı" Kaldırılacak

Sidebar veya alt navigation içinde bulunan:

```text
PDA
Çalışma alanı
```

benzeri workspace selector/card kaldırılacak.

Önce bunun ne işe yaradığını ve başka feature tarafından kullanılıp kullanılmadığını kontrol et.

Sadece görsel placeholder ise kaldır.

Gerçek state/context sağlıyorsa davranışı kırmadan yalnız UI surface'ini kaldır.

Dead code oluşuyorsa temizle.

---

## H — Hesap Ayarları → Ayarlar

Sidebar'ın alt kısmındaki:

```text
Hesap ayarları
```

alanı değişecek.

Yeni isim:

```text
Ayarlar
```

olacak.

Bu item sidebar'ın alt kısmına sabitlenmiş şekilde kalmalı.

Scroll veya uzun project navigation durumlarında yerleşimini incele.

Ayarlar ekranı yalnız account profile ayarı olmaktan çıkarılıp genel kullanıcı tercihleri merkezi olacak.

---

# I — Ayarlar Sayfası

Yeni/genişletilmiş Ayarlar sayfasında en az aşağıdaki kullanıcı tercihleri bulunmalı:

## Dil

Mevcut PDA i18n sistemindeki desteklenen diller seçilebilmeli.

Mevcut locale switching mekanizmasını reuse et.

Yeni i18n sistemi yazma.

## Tema

Kullanıcı:

```text
Light
Dark
System
```

veya mevcut desteklenen tema seçenekleri arasında seçim yapabilmeli.

Mevcut theme provider ile entegre et.

## Animasyon Tercihleri

Kullanıcı bazı UI animasyonlarını kapatıp açabilmeli.

Önce repository'deki mevcut animasyonları incele.

Tek tek rastgele toggle üretmek yerine anlamlı preference modelini planla.

Örneğin gerekirse:

```text
UI Animations
Theme Transition Animation
Page/Navigation Animations
```

gibi gruplar değerlendirilebilir.

Ancak uygulamada gerçekten olmayan animasyonlar için sahte setting oluşturma.

Ayrıca:

```css
prefers-reduced-motion
```

erişilebilirlik davranışını dikkate al.

Kullanıcının explicit ayarı ile OS preference arasındaki ilişkiyi planla.

---

# J — Project Banner

Projeler için banner görseli desteği eklenecek.

Bu yalnız frontend mock olmamalı.

Önce mevcut project image/thumbnail/upload modelini incele.

Banner için backend/persistence desteği gerekiyorsa bunu plana dahil et.

Banner:

- Project detail/header alanında
- Project preview'da
- davet sırasında açılan Project Preview modalında

uygun olduğu yerlerde görünmeli.

Özellikle daha önce yapılan project preview davranışıyla uyumlu olmalı.

Project banner bulunmuyorsa mevcut design system'e uygun fallback kullanılmalı.

Yeni file storage altyapısı zaten varsa reuse et.

Yoksa sırf banner için gereksiz büyük storage sistemi tasarlamadan mevcut mimariye uygun minimum çözümü planla.

Banner için şu konuları değerlendir:

- upload
- replace
- remove
- allowed mime type
- size limit
- aspect ratio/crop davranışı
- fallback
- cache/update

Security validation backend'de uygulanmalı.

---

## K — Navbar Her Sayfada Sabit Değil

Global navbar/header bazı sayfalarda sabit, bazı sayfalarda değil.

Bu davranış tutarlı hale getirilmeli.

Önce layout hierarchy'yi incele.

Amaç:

- navbar her uygun authenticated page'de aynı davranışa sahip olsun
- sticky/fixed davranış gerekiyorsa ortak layout seviyesinde çözülsün
- content navbar altında kalmasın
- z-index sorunları oluşmasın
- modal/dialog katmanları bozulmasın
- mobile davranışı korunmalı

Sayfa sayfa ayrı navbar implementasyonu yapma.

Shared layout çözümü tercih et.

---

## L — Dark / Light Theme Circular Transition

Dark/light tema geçişinde özel bir animasyon isteniyor.

Tema değiştiğinde yeni tema klasik bir anda değişim yerine:

```text
dışarıdan içeri doğru gelen dairesel / circular reveal
```

hissi vermeli.

Kullanıcının ifadesi:

> Ay dışarıdan içeri çember olarak gelsin.

Bunu mevcut UI ve browser imkanlarıyla en temiz şekilde yorumla.

Plan sırasında:

- View Transitions API
- CSS clip-path circle()
- pseudo-element overlay

gibi seçenekleri mevcut browser support ve Next.js yapısına göre değerlendir.

Animasyon:

- tüm sayfayı bozmayacak
- flash/flicker yaratmayacak
- theme hydration sorununa yol açmayacak
- SSR mismatch yaratmayacak
- erişilebilir olmalı

`prefers-reduced-motion` veya Ayarlar'daki animation preference kapalıysa animasyon kullanılmamalı ve tema doğrudan değişmeli.

Yeni ağır animation library ekleme.

Mevcut stack yeterliyse onunla çöz.

---

# Taskların Gruplandırılması

Yukarıdaki maddeleri birebir 12 ayrı task yapmak zorunda değilsin.

Repository analizine göre mantıklı gruplar oluştur.

Örneğin aynı shared layout dosyalarını etkileyen:

- Navbar consistency
- content width
- sidebar cleanup
- PDA Workspace removal

gibi işler aynı ana faz altında olabilir.

Ancak her gereksinim checklist içerisinde açıkça izlenebilir olmalı.

Hiçbir madde kaybolmamalı.

---

# Bağımlılık Sırası

Planı teknik bağımlılıklara göre sırala.

Özellikle şu ihtimalleri değerlendir:

```text
Shared layout/navigation cleanup
↓
Settings navigation
↓
Theme preferences / animations
```

ve:

```text
Project data/backend support
↓
Project banner frontend
↓
Project preview banner
```

ve:

```text
Invitation bug diagnosis
↓
Invitation UI verification
```

Ancak bu örnekleri kör şekilde kullanma.

Gerçek repository analizine göre final sıralamayı sen belirle.

---

# Her Task İçin Definition of Done

Her ana task için net bir `Definition of Done` yaz.

Örneğin:

```md
### Definition of Done
- [ ] ...
- [ ] ...
- [ ] ...
```

Sonnet implementation sırasında bu maddeleri bitirmeden ana task tamamlanmış sayılmayacak.

---

# Test Stratejisi

Planın sonunda task bazlı validation komutlarını belirle.

Mevcut repository'de olanları kullan.

Frontend için örneğin:

```text
lint
type-check
tests
production build
```

Backend değişen tasklarda:

```text
backend tests
integration tests
architecture tests
build
```

Banner gibi backend değişikliği olan işlerde migration/API testlerini dahil et.

---

# Git / Mevcut Değişiklikler

Repository'de mevcut staged/unstaged değişiklikleri incele.

Bu plan dışındaki mevcut kullanıcı değişikliklerine dokunma.

Başka tasklardan kalan kodları resetleme/revert etme.

Conflict varsa kullanıcı kodunu kaybetmeden çözülmesi gerektiğini plana not et.

---

# Plan Mode Final Çıktısı

Final cevabında şu sırayla ver:

## 1. Repository Analizi

Mevcut yapı hakkında kısa teknik özet.

## 2. Dependency / Ordering Kararı

Taskların neden bu sırada yapılacağını açıkla.

## 3. Implementation Checklist

Tüm tasklar checkbox formatında.

Örnek:

```md
## Task 1 — Shared App Shell Refactor

- [ ] 1.1 ...
- [ ] 1.2 ...

### Definition of Done
- [ ] ...
```

## 4. Etkilenecek Alanlar

Her task için tahmini dosya/modül listesi.

## 5. Backend Gerektiren Tasklar

Ayrıca belirt.

## 6. Riskler

Özellikle:

- routing regression
- project permission
- theme hydration
- responsive layout
- invitation query/cache
- banner storage

risklerini belirt.

## 7. Validation Plan

Task task hangi test/build kontrollerinin yapılacağını yaz.

---

# Kritik Kurallar

1. Bu aşamada production kodu yazma.
2. Önce repository'yi incele.
3. Kullanıcının verdiği sırayı doğrudan implementation sırası kabul etme.
4. Teknik bağımlılık sırasını kendin belirle.
5. Hiçbir gereksinimi atlama.
6. İlişkili gereksinimleri mantıklı task/fazlarda birleştir.
7. Her task checkbox formatında olmalı.
8. Her task için Definition of Done olmalı.
9. Sonnet'in sırasıyla uygulayabileceği kadar açık plan üret.
10. Mevcut kodu gereksiz yere yeniden yazmayı planlama.
11. Reusable/shared çözüm mümkünse page-specific hack planlama.
12. Backend gerektirmeyen taskta backend'e dokunma.
13. Backend gerektiren taskı yalnız frontend mock ile çözme.
14. Existing invitation/project/settings/theme davranışlarını bozma.
15. Mevcut kullanıcı değişikliklerini resetleme veya kaybetme.
16. Plan sonunda taskların kesin uygulama sırasını açıkça belirt.
17. Implementation başlamadan önce bu checklist source of truth olacak.

---

# 2) Sonnet Implementation Prompt

Repository'de hazırlanmış olan `PDA_UI_REFACTOR_PLAN.md` dosyasını oku.

Eğer plan dosyası yerine önceki Claude mesajında Markdown checklist verilmişse o checklist'i source of truth olarak kullan.

Şimdi planı IMPLEMENT ET.

## Çalışma şekli

Taskları kesinlikle sırayla yap.

Planın sıralamasını kafana göre değiştirme.

Şu modelle ilerle:

```text
Task 1
→ implement
→ test et
→ Definition of Done doğrula
→ checklist'i güncelle
→ [x]
→ Task 2
```

Bir task tamamen bitmeden sonraki ana taska geçme.

---

# Checkbox Takibi Zorunlu

Her alt task tamamlandığında plan dosyasındaki:

```md
- [ ]
```

değerini:

```md
- [x]
```

olarak güncelle.

Ben ilerlemeyi bu dosyadan takip edeceğim.

Task henüz tam bitmediyse checkbox'ı işaretleme.

Bir taskta blocker varsa:

```md
- [ ] Task ... — BLOCKED: sebep
```

şeklinde açıkça belirt.

Başarısız bir işi tamamlanmış gösterme.

---

# Her Task Sonrası

Her ana task bittikten sonra:

1. İlgili kodu tamamla.
2. O task için planda belirtilen testleri çalıştır.
3. Hataları düzelt.
4. Definition of Done maddelerini doğrula.
5. İlgili checkbox'ları `[x]` yap.
6. Kısa progress özeti ver.
7. Sonraki taska geç.

Benden her task arasında onay bekleme.

Blocker yoksa checklist bitene kadar sırayla devam et.

---

# Mevcut Kod Güvenliği

Repository'deki plan dışı staged/unstaged kullanıcı değişikliklerini kaybetme.

- resetleme
- revert etme
- silme
- üzerine kör şekilde yazma

yapma.

Conflict çıkarsa iki tarafın gerekli değişikliklerini koruyarak çöz.

---

# Scope

Yalnız Opus'un hazırladığı plandaki taskları uygula.

Yeni feature icat etme.

Plan sırasında açıkça kapsam dışı bırakılan şeyleri ekleme.

Ancak implementation sırasında gerçek bir compile/test problemi çıkarsa, görevi tamamlamak için gerekli minimum düzeltmeyi yap.

---

# Final Kontrol

Bütün checklist tamamlandığında:

- bütün checkbox'ların gerçekten tamamlanan işleri temsil ettiğini kontrol et
- frontend lint çalıştır
- type-check çalıştır
- frontend tests çalıştır
- production build çalıştır

Backend değiştiyse ayrıca:

- backend tests
- integration tests
- architecture tests
- backend build

çalıştır.

Çıkan hataları düzelt.

---

# Final Rapor

En sonda şu formatta rapor ver:

## Checklist

Planın final checkbox durumunu göster.

## Tamamlanan Tasklar

Her ana task için 1-2 cümle özet.

## Backend Değişiklikleri

Varsa belirt.

## Frontend Değişiklikleri

Önemli değişiklikleri belirt.

## Migrationlar

Varsa belirt.

## Değiştirilen Dosyalar

Önemli dosyaları listele.

## Test Sonuçları

Çalıştırılan komutları ve sonuçlarını belirt.

## Kalan Sorunlar

Yalnız gerçekten çözülmemiş bir şey varsa yaz.

Hiçbir şey kalmadıysa:

```text
Kalan blocker yok.
```

de.

---

# Kritik Kurallar

1. Opus planı source of truth.
2. Taskları sırayla yap.
3. Bir task bitmeden sonraki taska geçme.
4. Checkbox'ları gerçek zamanlı güncelle.
5. Bitmeyen taskı `[x]` yapma.
6. Definition of Done tamamlanmadan task tamamlanmış sayılmaz.
7. Plan dışı kullanıcı değişikliklerini kaybetme.
8. Mevcut çalışan özellikleri bozma.
9. Her tasktan sonra ilgili testleri çalıştır.
10. En sonda full validation yap.
11. Yarım implementation bırakma.
