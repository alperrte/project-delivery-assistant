# Basit ve gelişmiş görev modeli — uygulama planı

## Durum ve kapsam

2026-10-05 — Bu dosya ilk planlama teslimini ve o anki kod taramasını korur. Kullanıcının ayrı backend/frontend branch izinleriyle iki kapsam da uygulandı: [backend teslim kaydı](2026-10-05-task-basit-gelismis-backend.md), [frontend teslim kaydı](2026-10-05-task-basit-gelismis-frontend.md). Son frontend tesliminde 12 görev modeli Chromium senaryosu ve 449 backend testi başarılıdır; genel frontend paketindeki 6 mevcut sohbet/landing hatası ve çalışmayan 13 serial test ayrı kaydedildi. Aşağıdaki ilk tarama/plan metni güncel uygulama kanıtı yerine kullanılmamalıdır.

Amaç: görev oluşturma formunu basit/gelişmiş olarak ayırmak; görev detaylarını ve filtreleri buna uyarlamak; proje kurucusunun proje genelinde basit, gelişmiş veya iki modeli birlikte seçebilmesini sağlamak.

Kullanıcıyla netleştirilen kararlar:

- Basit görev formu: başlık, açıklama, öncelik, başlangıç tarihi, bitiş tarihi ve kişilere atama.
- Yorumlar her iki görev türünde de bulunacak.
- Diğer görev özellikleri gelişmiş modelde olacak.
- Proje yalnız basite geçirilince eski gelişmiş görevler ve verileri korunacak. Temel alanlar düzenlenebilecek; gelişmiş veriler görüntülenebilecek. Yeni gelişmiş görev oluşturma kapanacak.
- Projenin görev modelini yalnız `projects.created_by` ile tanımlanan kurucu değiştirebilecek.

## Mevcut koddan doğrulanan durum

| Alan | Mevcut uygulama | Gerekli değişiklik |
|---|---|---|
| Görev formu | Tek formda temel ve bütün gelişmiş alanlar birlikte | İki form modu ve ortak alan bileşenleri |
| Görev kaydı | Basit/gelişmiş türü yok | Kalıcı görev türü |
| Görev listesi | API'de filtreleme, sıralama ve sayfalama | Tür filtresi sunucu sorgusuna eklenecek |
| Proje ayarları | `PROJECT_UPDATE` yetkili yöneticiler düzenleyebiliyor | Görev modeli için ayrıca yalnız kurucu kontrolü |
| Sidebar | Görevler, Pano, Havuz, Sprintler, Etiketler | Proje modeline göre gelişmiş bağlantılar |
| Tarihler | `startDate` takvim günü; `deadlineAt` saat içeren an | Basit form mevcut tarih sözleşmesini kullanacak |
| Görev detayı | Tüm gelişmiş bölümler çiziliyor | Kaydedilmiş görev türüne ve proje modeline göre görünüm |

Doğrulanan ana dosyalar:

- [Görev formu](../../frontend/src/features/tasks/components/task-form-page.tsx), [schema/payload](../../frontend/src/features/tasks/schemas.ts), [görev türleri](../../frontend/src/features/tasks/types.ts).
- [Görev detayı](../../frontend/src/features/tasks/components/detail/task-detail-page.tsx), [özellik paneli](../../frontend/src/features/tasks/components/detail/properties-panel.tsx), [filtreler](../../frontend/src/features/tasks/filters.ts).
- [Proje ayar formu](../../frontend/src/features/projects/components/project-settings-form.tsx), [proje türleri](../../frontend/src/features/projects/types.ts), [sidebar](../../frontend/src/components/layout/project-sidebar-nav.tsx), [bağlantı tanımları](../../frontend/src/features/projects/project-sections.ts).
- [TaskController](../../backend/src/main/java/com/pda/task/api/TaskController.java), [TaskService](../../backend/src/main/java/com/pda/task/application/TaskService.java), [TaskFilter](../../backend/src/main/java/com/pda/task/application/TaskFilter.java), [TaskCommand](../../backend/src/main/java/com/pda/task/application/TaskCommand.java).
- [ProjectService](../../backend/src/main/java/com/pda/project/application/service/ProjectService.java), [ProjectAccess](../../backend/src/main/java/com/pda/project/ProjectAccess.java), [ProjectTaskContext](../../backend/src/main/java/com/pda/project/ProjectTaskContext.java).

Bu kapsam yalnız frontend ile tamamlanamaz. Tarayıcı tercihi proje genelinde ortak ayar, güvenilir kayıt türü, doğru sayfalama veya kurucuya özel yetki sağlamaz.

## 1. Kullanıcının göreceği model

### Görev oluşturma formu

Formun üstünde erişilebilir iki seçenek ve bilgi düğmesi:

```text
[ Basit görev oluştur ] [ Gelişmiş görev oluştur ]  (i)
```

- Proje `BOTH` ise iki seçenek etkin; ilk açılışta basit seçili.
- Proje `SIMPLE` ise basit seçili; gelişmiş seçenek kullanılamaz ve neden açıklanır.
- Proje `ADVANCED` ise gelişmiş seçili; basit seçenek kullanılamaz ve neden açıklanır.
- Mod değişimi sayfayı yeniden yüklemez; ortak alanlar, atamalar ve tarihler kaybolmaz.
- Gelişmişten basite geçerken gelişmiş taslak değerleri oturumdaki form belleğinde korunur. Basit olarak kayıt yapılırsa yalnız basit alanlar gönderilir; bilgi penceresi bu durumu açıklar. Yeniden gelişmişe dönülürse taslak değerleri geri gelir.
- Basit form gelişmiş alanları veya gelişmiş bölüm verilerini yüklemek için gereksiz API istekleri atmaz.
- Mevcut canlı önizleme ve kirli formdan ayrılma koruması iki modda da çalışır.

### Bilgi penceresi

- Mod değişiminde iki modelin farklarını kısa karşılaştırmayla anlatan dialog açılır.
- “Bir daha otomatik gösterme” seçimi yalnız bu bilgilendirmenin otomatik açılışını kapatır.
- `(i)` düğmesi bu tercihe bakmaksızın her zaman aynı açıklamayı açar.
- Tercih kullanıcı ve açıklama sürümü kapsamında tutulur; proje görev modeli bu tarayıcı tercihinde saklanmaz.
- Dialog iptal edilirse mod değişimi uygulanmaz; onaylanırsa seçilen moda geçilir.
- Bilgi düğmesi klavye/dokunmayla kullanılabilir; dialog odağı yönetir, Escape ile kapanır ve odağı tetikleyiciye geri verir.
- Bilgi düğmesiyle açılan dialog yalnız açıklama gösterir; kapatılması görev modunu değiştirmez. Otomatik gösterme tercihi hesap değişiminde başka kullanıcıya uygulanmaz.

### Özellik dağılımı

| Özellik | Basit | Gelişmiş |
|---|---|---|
| Başlık, açıklama, öncelik | Evet | Evet |
| Başlangıç ve bitiş tarihi | Evet | Evet |
| Kişilere atama | Evet | Evet |
| Durum değiştirme ve görevi tamamlama | Evet | Evet |
| Yorumlar ve mevcut bahsetme davranışı | Evet | Evet |
| Düzenleme/arşivleme ve salt okunur geçmiş | Evet | Evet |
| Üst/alt görev ilişkisi | Hayır | Evet |
| Kontrol listesi | Hayır | Evet |
| Etiketler ve sprint | Hayır | Evet |
| Puan ve süre tahmini | Hayır | Evet |
| İş/zaman kayıtları | Hayır | Evet |
| Havuz, ekip hedefi, üstlenme | Hayır | Evet |
| Görevler arası ilişkiler ve yeni engel ekleme | Hayır | Evet |
| Ek dosyalar ve izleyici yönetimi | Hayır | Evet |

Basit formda ayrıca durum seçimi eklenmez; oluşturma mevcut başlangıç durumuyla yapılır. Durum, görev detayında ve listede mevcut yetkilerle değiştirilir. Basit bitiş tarihi mevcut `deadlineAt` dönüşümünü kullanır; saat alanı gelişmiş formda kalır. Tarih/zaman dilimi testleriyle gün kayması engellenir.

### Görev detayı ve düzenleme

- Basit detay: başlık/açıklama, durum, öncelik, tarihler, atananlar, yorumlar ve geçmiş. Gelişmiş boş bölümler gösterilmez.
- Gelişmiş detay: mevcut gelişmiş bölümler korunur.
- Görevin türü kayıtta saklanır; detay türü boş/dolu alanlardan tahmin edilmez.
- Düzenleme formu kaydedilmiş türle açılır. Proje izin veriyorsa basit görev gelişmişe yükseltilebilir.
- Gelişmiş görevi basite dönüştürmek, gelişmiş veriler varsa engellenir ve neden açıklanır. Otomatik silme/temizleme yapılmaz. Dönüşüm yalnız geliştirilmiş veri ve ilişkisi kalmayan görevde mümkündür.
- Üst/alt görev, sprint, havuz, ekler, izleyiciler ve zaman kaydı gibi farklı tablolardaki bilgiler de dönüşüm kontrolüne dahildir; yalnız görünen form alanlarını kontrol etmek yeterli değildir.
- Proje yalnız basite alınmışsa eski gelişmiş görevlerde temel alanlar, yorumlar ve durum akışı çalışmaya devam eder. Gelişmiş veriler salt okunur gösterilir; gelişmiş düzenleme için kurucu projeyi yeniden gelişmiş/iki modele açmalıdır.
- Eski görevin temel alanlarını kaydederken gizlenen gelişmiş alanların `null`/boş değerle silinmesi önlenecek. Mevcut PATCH sözleşmesinde bazı alanlar tam değiştirme yaptığı için bu nokta backend ve payload tarafında özellikle korunacak.
- Basit düzenlemede bitiş tarihi değişmediyse kayıtlı `deadlineAt` saati korunur. Tarih değişirse mevcut saat/tarih dönüşümü tutarlı uygulanır; formda gizli saat alanı sessizce sıfırlanmaz.
- Eski görevdeki mevcut engelin kaldırılması gibi tamamlamayı mümkün kılan ortak durum işlemleri çalışmaya devam eder; yalnız basite geçiş mevcut işi kilitlemez.

## 2. Proje genelindeki ayar

İlk görev oluşturma girişinde kurucuya şu seçim sunulur:

> Bu projede hangi görev modelini kullanmak istersiniz?
>
> Basit / Gelişmiş / Her ikisi
>
> Bu ayarı proje ayarlarından istediğiniz zaman değiştirebilirsiniz.

- Seçim proje için bir kez kaydedilir; tüm üyeler aynı yapılandırmayı alır.
- İlk seçimi ve sonraki değişiklikleri yalnız proje kurucusu yapar. Başka bir Project Manager olmak bu yetkiyi vermez; global ADMIN için örtük bypass eklenmez.
- Yeni projede seçim yapılmamışsa kurucu önce seçimi kaydeder, sonra görev formu açılır. Yetkili başka bir yönetici seçim yapılmadan gelirse kurucunun ayarı tamamlaması gerektiğini görür.
- Proje ayarlarına “Görev modeli” bölümü eklenir. Kurucu radio seçeneklerini düzenler; diğer yöneticiler mevcut tercihi ve yalnız kurucunun değiştirebildiğini görür.
- Bu ayar mevcut genel proje ayarları yetkisini değiştirmez; ayrı endpoint ve kurucu denetimi önerilir.
- Ayar değişince proje, seçili proje, görev formu, sidebar ve ilgili query cache'leri yenilenir. Eski bir sekmede artık kapalı modele ait form gönderilirse sunucu isteği reddeder, frontend güncel ayarı yükleyip draft'ı korur.

### Sidebar ve bağlantılar

| Proje modeli | Görevler | Pano | Havuz | Sprintler | Etiketler |
|---|---|---|---|---|---|
| Basit | Görünür | Görünür | Gizli | Gizli | Gizli |
| Gelişmiş | Görünür | Görünür | Görünür | Görünür | Mevcut rol yetkisine göre |
| Her ikisi | Görünür | Görünür | Görünür | Görünür | Mevcut rol yetkisine göre |

- Pano temel durum takibi görünümü olduğu için basitte kalır.
- Daraltılmış sidebar ve mobil çekmece aynı tek tanımdan süzülür.
- Genel proje bölümleri, kişisel Görevlerim ve Takvim korunur.
- Basit projede eski gelişmiş veriye ait doğrudan bağlantılar boş ekran/404 üretmez; mevcut veri salt okunur gösterilir ve model kısıtı açıklanır.
- Sidebar'da gizlemek yetkilendirme sayılmaz. Kapalı gelişmiş özelliklerde yeni oluşturma/değiştirme sunucuda da denetlenir; mevcut kaydı okuma veri koruma politikasını izler.

### Filtreleme

- Görev listesine “Tümü / Basit / Gelişmiş” tür filtresi eklenir.
- Filtre URL'de ve API sorgusunda tutulur; değişimde sayfa ilk sayfaya döner.
- Sunucu filtreyi sayfalamadan önce uygular. Toplamlar ve boş durum doğru türü yansıtır.
- Yalnız basit projede eski gelişmiş görevler kalabileceği için gelişmiş filtresi tamamen kaldırılmaz.
- Liste/pano kartında küçük tür bilgisi bulunur. Sprint, etiket ve havuz gibi gelişmiş kontroller proje modeline göre gizlenir.
- Görevlerim ve ortak görev kartları aynı tür alanını taşıyacak; eksik bir DTO yüzünden eski davranışa düşmeyecek.

## 3. İzin istenecek backend kapsamı

### Kalıcı veri ve migration

- Project: `taskManagementMode`, değerler `SIMPLE / ADVANCED / BOTH`; yeni projede ilk seçim yapılana kadar `null`.
- Task: `creationMode`, değerler `SIMPLE / ADVANCED`, null olmayan enum.
- Yeni Flyway migration; mevcut migration'lar değiştirilmez.
- Mevcut projeler `BOTH`, mevcut görevler `ADVANCED` olarak backfill edilir. Eski görevlerin boş gelişmiş alanlarından basit olduğu varsayılmaz.
- Eski proje, görev, üyelik, yorum, ek dosya, sprint veya ilişkiler silinmez.
- Yeni proje factory'si ilk seçim için boş politika oluşturur; legacy API kullanımında eksik tür, mevcut davranışı koruyan gelişmiş tür olarak ele alınır ve proje politikası denetlenir.

### API ve modül sınırları

Önerilen sözleşme, uygulama öncesi plan:

| Yol | Değişiklik / kural |
|---|---|
| `PATCH /api/v1/projects/{projectId}/task-management-mode` | `{mode: SIMPLE\|ADVANCED\|BOTH}`; oturum + CSRF + aktif kurucu; başarı `200`, yetkisiz `403`, bilinmeyen proje `404`, geçersiz değer `400`, arşivli proje conflict |
| Mevcut project GET/list yanıtları | `taskManagementMode` ve gerekli düzenleme yetki ipucu |
| Mevcut task POST/PATCH/GET/list | Kalıcı `creationMode`, modele uygun alan validation ve eski gelişmiş alanları koruma |
| Mevcut task listesi | Opsiyonel `creationMode` filtresi; enum validation ve DB seviyesinde sayfalama |
| Gelişmiş mutation endpoint'leri | Basit görev/proje politikası için ortak denetim; legacy verilerin okunması korunur |

- Project, politika ve kurucu kontrolünün sahibi olarak kalır.
- Task, Project repository/entity'sine doğrudan erişmez; `ProjectAccess` ve `ProjectTaskContext` public contract'ı genişletilir.
- Kullanıcı kimliği request body'den değil oturumdan alınır.
- Model seçimi mevcut `TASK_MANAGE` veya `TASK_WORK` yetkilerini genişletmez.
- Örnek hata kodları: `PROJECT_TASK_MODE_NOT_CONFIGURED`, `TASK_MODE_NOT_ALLOWED`, `TASK_MODE_CONVERSION_BLOCKED`. Kesin kodlar uygulamada mevcut ProblemDetail yapısına bağlanır.
- Basit göreve gelişmiş alan yazan API isteği, UI dışında da reddedilir. Üst/alt görevler gelişmiş türde olmalı; mevcut tek seviye kuralı korunur.
- Sprint/havuz toplu işlemleri ve görev ilişkilerinde etkilenen hedeflerin türü de doğrulanır; başka bir endpoint üzerinden basit göreve gizli gelişmiş veri eklenemez.
- Politika değişimi ile eşzamanlı görev oluşturma transaction/lock düzeniyle tutarlı doğrulanır; frontend cache'i güvenlik sınırı yapılmaz.
- Auth, cookie, CSRF, CORS, `.env` veya OAuth ayarlarında değişiklik planlanmıyor.

## 4. Uygulama sırası

1. Kullanıcıdan bu belgede tanımlanan backend kapsamı için izin alınması.
2. Migration, kalıcı enum alanları, Project public contract, kurucu endpoint'i ve backend validation; hedefli entegrasyon testleri.
3. Frontend API/types/hooks ve tek ortak model/özellik politikası yardımcıları.
4. İlk proje seçimi ve proje ayarları; diğer yöneticilerde salt okunur davranış.
5. Form modu seçici, bilgi dialog'u, otomatik gösterme tercihi ve draft koruma.
6. Görev detayı/düzenleme/önizleme, ortak yorumlar, güvenli tür dönüşümü ve legacy verilerin korunması.
7. Liste filtresi, kartlar, sidebar/mobil menü ve kapalı gelişmiş rotalar.
8. TR/EN/DE metinleri; açık/koyu tema, mobil ve klavye kontrolleri.
9. Tüm backend testleri, tüm Playwright testleri, ESLint, TypeScript, build ve runtime doğrulaması.
10. Gerçek sonuçlarla ayrı uygulama completion kaydı, ilgili SECURITY §11/API/veritabanı/klasör özeti ve yalnız etkilenen web checklist maddelerinin güncellenmesi.

## 5. Kabul ve test planı

### Backend

- Kurucu ayarı değiştirebilir; kurucu olmayan PM ve global ADMIN değiştiremez. Başka proje, oturumsuz istek ve eksik CSRF negatifleri.
- İlk yapılandırma, üç politika, eksik/geçersiz enum ve izin verilmeyen tür/alan validation.
- Legacy projeler `BOTH`, eski görevler `ADVANCED`; migration sonrası ilişkili veriler korunur.
- Tür filtresi sayfalama, toplamlar, mevcut filtrelerle birleşim ve projeler arası izolasyon.
- Gizli gelişmiş alanların temel PATCH sırasında kaybolmaması; dönüşümde ilişkili verinin kontrolü.
- Politika değişimi ile eşzamanlı oluşturma; eski görevlerin temel düzenleme/yorum/durum ve ortak bildirim davranışı.
- Spring Modulith sınırları ve tüm mevcut backend regresyon paketi.

### Playwright

- Üç proje modelinde ilk seçim, owner-only ayar, refresh ve ikinci kullanıcıda aynı değer.
- Basit/gelişmiş oluşturma, kayıttan sonra doğru detay ve düzenleme formu.
- Mod geçişinde ortak alan ve gelişmiş taslağı koruma; basit kayıtta gelişmiş alan gönderilmemesi.
- Dialog, “bir daha otomatik gösterme”, reload ve tercihe rağmen `(i)` ile tekrar açma.
- İki türde de yorum ekleme ve mevcut bahsetme/yetki davranışı.
- Yalnız basite geçiş sonrası eski gelişmiş görevin okunması, temel düzenleme ve veri kaybı olmaması.
- URL filtre, pagination/boş sonuç, pano ve Görevlerim regresyonları.
- Geniş/daraltılmış/mobile sidebar ve eski doğrudan bağlantılar.
- TR/EN/DE, light/dark, 320/390/768/1440 px, Tab/Escape/focus, ekran okuyucu etiketleri, konsol/API hataları.
- Yeni testler sonrasında mevcut Playwright paketi de bütünüyle çalıştırılır.
- Mevcut task test fixture'ları, yeni projelerde görev oluşturmadan önce kurucu üzerinden açıkça proje modelini seçer; ilk seçim akışının kendisi ayrıca gerçek UI ile test edilir.

### Doğrulama komutları

```powershell
# backend/
.\mvnw.cmd clean verify

# frontend/
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
npm.cmd run test:e2e

# Repo kökü: uygulama tamamlandıktan sonra uygun ayrı test sunucusuyla
.\pre-push\pre-push.cmd
```

Pre-push mevcut geliştirme sunucusunun kullandığı portu denetliyor ve backend container'ını yeniden build ediyor. Uygulama aşamasındaki tam kontrol, çalışan kullanıcı oturumlarını ve dev sunucusunu kesmeyecek şekilde ayrı test sunucusu/uygun çalışma düzeniyle yürütülecek; test sonuçları eski completion kayıtlarından alınmayacak.

## 6. Bu planlama turundaki doğrulama

- `AGENTS.md`, temel belgeler, frontend workflow/tasarım kuralları, ilgili mevcut frontend/backend dosyaları ve kabul edilmiş ADR'ler incelendi.
- `npm.cmd run lint`: başarılı.
- `npx.cmd tsc --noEmit`: başarılı.
- Mevcut Playwright paketi ilk denemede saklanan test kullanıcılarıyla oturum açamadı; testler başlamadı. Hassas bilgi yazdırmadan iki fixture hesabının login yanıtının `401` olduğu doğrulandı.
- `$env:E2E_REUSE_USERS='0'; npm.cmd run test:e2e`: 195 testlik Chromium paketi, **176 passed, 6 failed, 13 did not run**, toplam 7,6 dakika. Atlanan 13 test seri sohbet grubunda önceki test başarısız olduğu için çalışmadı. Exit code `1`; tam paket başarılı değildir.
- Task yönetimi `09-tasks.spec.ts`: **10/10 başarılı**. Task avatarları `16-task-avatars.spec.ts`: **3/3 başarılı**.
- Başlangıç bulgusu: sohbet gezinme testi `17-project-chat.spec.ts:193`, geliştirme sunucusunun `nextjs-portal` overlay'i “Kapat” düğmesinin tıklamasını engellediği için zaman aşımına uğradı; seri gruptaki sonraki testler otomatik atlandı. Bu kanıt sohbet verisi kaybı olduğunu göstermez.
- Başlangıç bulgusu: landing light/dark koreografi testleri (`landing-page.spec.ts:44`) geri kaydırmada `DONE` durumunun `TODO`'ya dönmesini bekliyor. Mevcut animasyonun tekrar oynatılmaması davranışıyla bu beklenti çelişiyor; test `DONE` değerinde başarısız oluyor. Task modelinin uygulanmasıyla oluşmuş bir regresyon değildir.
- Başlangıç bulgusu: semantic palette testi (`landing-page.spec.ts:197`) tam RGB eşitliğinde `rgb(52, 97, 61)` beklerken `rgb(52, 97, 62)` aldı. Gerçek UI karşılaştırma testleri (`landing-real-ui.spec.ts:53`, light/dark) proje demo formunun `#project-name` alanını bulamadı. Bu bulgular uygulama öncesi mevcut test sonuçlarıdır; kök nedenleri yeni task kapsamından ayrı değerlendirilmelidir.
- Backend testleri ve yeni özellik testleri henüz çalıştırılmadı; backend uygulama izni ve uygulama sonrası doğrulama aşamasında çalıştırılacak. Bu belge yeni özelliğin testlerden geçtiğini iddia etmez.
- Plan dosyasındaki 17 yerel kaynak bağlantısı doğrulandı; eksik hedef veya satır sonu boşluğu yok. `git diff --check` başarılı. Bu turda tek yeni teslim dosyası bu plandır; önceki test kullanıcıları kaydı korunmuştur.

## Kullanıcı kontrolü ve açık karar

Bu planı inceleyin. Özellikle özellik dağılımı, Pano'nun basitte kalması, ilk seçim akışı ve eski gelişmiş görevlerde veri koruma davranışını kontrol edin.

Başlamadan gereken onay: Project/Task kalıcı alanları, Flyway migration, kurucuya özel proje ayarı API'si, sunucu filtreleri ve modele göre mutation validation içeren backend kapsamı.
