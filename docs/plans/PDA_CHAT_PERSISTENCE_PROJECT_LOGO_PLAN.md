# PDA — Persistent Chat ve Project Settings Logo Planı

Tarih: 2026-10-04. Durum: Task 1–6 tamamlandı. Tam pre-push başarılı: 404 backend testi; 170 frontend E2E passed, 1 bilinçli production skip.
Bu dosya implementation source of truth'tur. Tasklar sırayla uygulanır; doğrulanmadan checkbox işaretlenmez.

## 1. Repository analizi

İstenen `.agents/PDA_Chat_Persistence_Project_Logo_Plan_and_Implementation.md` dosyasının plan ve implementation bölümlerinin tamamı okundu. Plan hazırlanırken kullanıcının talebi yalnız plan hazırlamaktı; daha sonra uygulama onayı verildi. `frontend/CLAUDE.md`, `frontend/AGENTS.md` dosyasını referanslıyor; bu yönerge ve kurulu Next.js layout rehberi de incelendi.

### Sohbetin mevcut akışı

- `(app)/layout.tsx` → `AppShell` → `ChatProvider` ve tek `ChatRoot`. Provider zaten ortak authenticated layout seviyesinde; sayfalara ayrı ayrı bağlı değil.
- `chat-provider.tsx`, `chatRouteSlug(pathname)` ile yalnız `/projects/[slug]/**` yollarını bağlam kabul ediyor. Mantıksal pathname `@/i18n/navigation` üzerinden geliyor.
- Slug değişince reducer `context` aksiyonu mode, active ve outbox'ı sıfırlıyor. Slug `undefined` olunca da aynı reset gerçekleşiyor.
- Sidebar ve Takvim farklı olarak `useSelectedProject()` kullanıyor: URL projesi → kullanıcıya özgü `sessionStorage` seçimi → ilk proje. Genel sayfalarda seçili proje devam ediyor.
- `mode` değerleri `closed/full/bar/compact`; active conversation ve outbox reducer'da, draft provider ref'inde, history ve unread TanStack Query'de. Sohbet metni browser storage'a yazılmıyor.
- `ChatRoot`, `projectId` yoksa veya mode kapalıysa görünmüyor. `ChatNavItem` route slug eşleşmezse önce proje sayfasına giderek pending-open isteği oluşturuyor.
- `useChatSocket` yalnız `[enabled]` bağımlılığıyla çalışıyor. Hedef kullanıcıya ait `/user/queue/chat`; projeye özel broker destination yok. Provider gelen event'i `projectId` ile filtreliyor.
- Normal bağlantı yenilemesinde mevcut 3 saniyelik kontrollü socket örtüşmesi var. Mesaj ID deduplication bunu güvenli kılıyor; bu davranış korunmalı.
- Mevcut E2E yalnız proje görev rotasına navigasyonla persistence kontrol ediyor; başka test Projeler listesine çıkınca kapanmayı bekliyor. Yeni ürün kararı bu eski beklentiyi değiştirecek.

### Logonun mevcut akışı

- `ProjectController` detail/bySlug yanıtlarında `ProjectResponse.from(Project)` kullanıyor. `ProjectResponse.build` entity'deki `logoUpdatedAt` değerini `logoVersion` olarak taşıyor; liste yanıtı da aynı mapping'i kullanıyor.
- Frontend `Project` tipi `logoVersion` içeriyor. `projectLogoUrl(id, version)` tek versioned URL yardımcısı; `uploadLogo/deleteLogo` API metotları zaten var.
- `ProjectCard`, `ProjectMark` ve `projectLogoUrl` ile gerçek logoyu gösteriyor; görsel yüklenmezse ilk harfe dönüyor.
- `ProjectSettingsForm` içinde logo render/upload/remove alanı yok. Yalnız banner yönetimi mevcut. `ProjectDetail` header'ı da doğrudan ilk harfi çiziyor.
- Oluşturma sayfasında reusable `create/logo-field.tsx` var; dosya seçimi/önizleme ve 512 KB/tür ön kontrolü yapıyor. Bu bileşenin silme işlemi yalnız seçilmiş yerel dosyayı kaldırır; settings'teki server DELETE yerine doğrudan kullanılamaz.
- `BannerField` mevcut mutation/invalidation standardını gösteriyor: işlem başarılı olunca `["projects"]` invalidation ve refetch tamamlandıktan sonra success toast. Logo yanıtı 204 olduğundan güncel version refetch ile alınmalı.

## 2. Root cause ve doğrulama sınırı

1. **Koddan doğrulanan chat nedeni:** route project context ile selected project context farklı. `/calendar`, `/calendar/**` ve kişisel `/tasks` gibi yollar URL slug'ı taşımadığı için chat state resetleniyor. Provider'ı daha yukarı taşımak temel çözüm değil; mevcut sahibi doğru seviyede.
2. **Lifecycle eksiği:** A ve B proje kimliği arasında socket hook'unun `enabled=true` değeri aynı kalabilir. Bu durumda proje değişimi socket cleanup tetiklemez. Mevcut user-queue/event filtresi erişim kontrolünü korur, fakat istenen proje değişimi cleanup sözleşmesini karşılamaz.
3. **Yarış riski:** direct conversation açma callback'i yalnız peer ID ile resolve yapıyor; eski projede başlayan işlem yeni projede aynı kişiye seçilmiş konuşmayı etkileyebilir. Send/catch-up işlemlerinde proje ID kontrolleri var; hızlı A→B→A dönüşünde context generation kontrolü de gerekir.
4. **Koddan doğrulanan logo nedeni:** DTO veya URL eksikliği değil; settings'te render ve yönetim alanı eksik. Header'da da logo yerine harf sabitlenmiş.

Bu aşamada tarayıcı veya test servisi başlatılmadı; bulgular doğrudan kod akışından çıkarıldı. Uygulamadaki yeniden üretim ve test kanıtı aşağıdaki tasklara dahil.

## 3. Kabul edilen ürün kararları ve sıralama

Kullanıcı kararı: **seçili proje aynıysa sohbet, giriş yapılmış çalışma alanının tamamında korunacak**. Dashboard, Projeler listesi, Organizasyonlar, Ayarlar, Görevler ve Takvim de bu kapsama dahil.

| Olay | Beklenen sonuç |
|---|---|
| Aynı seçili proje, client-side sayfa/query navigasyonu | Mode, active conversation, draft, outbox ve unread korunur |
| X | Mode `closed`; sonraki navigasyon kendiliğinden açmaz |
| Mesajlaşma düğmesi | Mevcut seçili proje sohbetini açar |
| A→B proje seçimi (URL veya Takvim seçicisi) | A görünümü/state temizlenir, A bağlantısı kapanır; B kapalı ve temiz başlar |
| Proje kimliği aynı, refetch/loading | Geçici yükleme state reset sebebi olmaz |
| Seçili proje erişilemez/silinmiş/archived | Eski sohbet gizlenir ve cleanup yapılır; erişim hatası güvenli gösterilir |
| Logout, oturum sonu veya authenticated layout'tan çıkış | Sohbet UI/state ve socket temizlenir |
| İlk proje varsayılan seçimi | Bağlam çözülür; sohbet otomatik açılmaz |

Sayfa yenilemesi veya sekme kapatıp açma sonrası sohbeti yeniden açmak bu task kapsamında değil. Mevcut sessionStorage yalnız proje seçimini hatırlar; mesaj, taslak veya token kalıcı storage'a eklenmez.

Teknik sıra: **Task 1 bağlam/state → Task 2 lifecycle/race → Task 3 chat regresyonu → Task 4 logo UI/cache → Task 5 logo regresyonu → Task 6 final doğrulama ve teslim.** Logo kolu chat'e teknik olarak bağımsızdır; chat'in context ve lifecycle değişikliklerini kendi testleriyle kapatıp sonra logo işine geçmek, sorunların kaynağını ayırır.

## Task 1 — Chat bağlamını seçili projeyle birleştir

Amaç: aynı proje seçili kaldığında mode ve konuşmanın sayfa navigasyonunda yaşaması.
Sıra nedeni: socket ve cleanup hangi proje kimliğini izlediğini önce doğru belirlemeli.
Dosyalar: `features/chat/chat-provider.tsx`, `components/chat-nav-item.tsx`, `features/projects/hooks/use-selected-project.ts`; yalnız gerekirse `components/layout/app-shell.tsx` ve `project-sidebar-nav.tsx`.
Backend: gerekmiyor.

- [x] 1.1 Mevcut kaybolma akışını global Takvim ve kişisel Görevler üzerinden tarayıcıda yeniden üret; URL-proje/selected-project farkını kaydet.
- [x] 1.2 Provider'ın proje kaynağını mevcut `useSelectedProject(chatRouteSlug(pathname))` sözleşmesine bağla. URL'de proje varsa öncelikli, genel sayfada hatırlanan seçim geçerli olsun. Yeni paralel seçim store'u oluşturma.
- [x] 1.3 Gerçek route slug ile efektif chat context slug'ını açık isimlerle ayır. `projectId/name/logo` değerlerini aynı çözümlenmiş Project query verisinden üret; ikinci bySlug fetch mekanizması kurma.
- [x] 1.4 Reducer context resetini yalnız gerçek proje/kullanıcı değişimine veya bağlamın geçersizleşmesine bağla. Aynı proje navigasyonunda `mode/active/outbox/drafts` korunmalı; B yüklenirken A bir frame bile gösterilmemeli.
- [x] 1.5 `ChatNavItem` aynı efektif seçili projedeyken bulunduğu sayfada sohbeti açar. Sidebar tek seçili projeyi temsil ettiği için eski route yönlendirmesi/pending-open yolu kaldırıldı; açma yalnız manuel düğme aksiyonundan gelir.
- [x] 1.6 X yalnız görünümün kapalı state'ini belirlesin; navigasyon/refetch açma aksiyonu üretmesin. Mesajlaşma ile manuel tekrar açma çalışsın.
- [x] 1.7 Proje çözümleme/loading durumunu gerçek kayıp/403/404 durumundan ayır. Geçersiz seçimde UI'ı güvenli gizle; erişilemeyen proje için döngüsel refetch veya sessiz başka proje seçimi üretme.

Edge-case'ler: `/projects/new`, query section değişimi, nested team/task/sprint/label sayfaları, tarayıcı geri/ileri, seçili proje olmayan hesap, TR/EN/DE mantıksal pathname, Takvim seçicisi, mobil sidebar.
Testler: Task 3'te otomatik; bu taskta aynı proje Takvim/Görevler navigasyonu ve X/reopen smoke kontrolü.

### Definition of Done
- [x] Provider ortak AppShell seviyesinde tek instance olarak kalıyor.
- [x] Aynı proje için full/bar/compact ve active conversation tüm authenticated sayfalarda korunuyor.
- [x] X sonrası kapalı kalıyor; manuel Mesajlaşma açıyor.
- [x] Proje değişimi temiz ve kapalı yeni context veriyor; geçici query refetch state kaybettirmiyor.

## Task 2 — Socket lifecycle ve asenkron işlemleri bağlama sabitle

Amaç: navigationda gereksiz reconnect olmaması ve proje değişiminde eski bağlantı/yanıtın yeni state'e taşınmaması.
Sıra nedeni: Task 1'in efektif proje kimliğine bağlı.
Dosyalar: `features/chat/use-chat-socket.ts`, `chat-provider.tsx`, gerekirse `hooks.ts`, `cache.ts`, `components/layout/app-shell.tsx`.
Backend: gerekmiyor; kimlik doğrulama, CSRF, cookie ve STOMP destination sözleşmesi korunur.

- [x] 2.1 Socket hook'una sabit kullanıcı/proje context kimliği ver; effect cleanup gerçek context değişiminde tetiklensin, aynı context route/query/mode değişiminde tetiklenmesin.
- [x] 2.2 A→B geçişinde A'nın tüm Client instance'ları, yenileme/reconnect timer'ları ve subscription'ları cleanup edilsin. B için yeni bağlantı oluştur; eski bağlantı callbacks disposed/context guard ile etkisiz olsun.
- [x] 2.3 Mevcut token yenileme ve 3 saniyelik kontrollü make-before-break örtüşmesini koru. Normal navigation yeni socket/subscription üretmesin; yenileme örtüşmesi testsiz şekilde kaldırılmasın.
- [x] 2.4 Provider asenkron direct-open, send/retry ve reconnect catch-up işlemlerini başlatıldıkları context generation'a bağla. Eski başarı/hata A→B veya A→B→A sonrasında yeni active/outbox/cache'i değiştirmesin; eski hata toast'ı yeni context'e taşınmasın.
- [x] 2.5 Proje değişiminde drafts/view/outbox temizliği ve eski history/member query temizliği mevcut query key düzeniyle yapılsın. In-flight query/işlem geri dönüşleri cleanup'ı geçersiz kılmasın.
- [x] 2.6 Logout/session expiry/account değişiminde chat'e ait kullanıcı verisi temizlensin; yeni kullanıcı aynı proje ID'sine erişse bile eski active/draft/unread cache'ini görmesin. Tüm auth sistemini refactor etmeden ilgili chat cache sınırını düzelt.

Edge-case'ler: offline/reconnect, token refresh, hızlı A→B→A, aynı kişinin iki projede üye olması, direct-open sırasında seçim değişimi, unmount sırasında gönderim yanıtı, React development effect cleanup.
Testler: geciktirilmiş REST cevapları ve WebSocket gözlemi Task 3'te; mevcut send/dedup/session expiry testleri korunur.

### Definition of Done
- [x] Aynı context navigationı socket sayısını veya subscribe sayısını artırmıyor.
- [x] Proje değişiminden sonra A'nın bağlantıları/timer'ları kapanıyor, B temiz açılıyor.
- [x] Eski proje/user callback'i yeni UI/cache'e veri taşıyamıyor.
- [x] Token yenileme, REST catch-up, message-ID deduplication ve logout cleanup çalışıyor.

## Task 3 — Chat persistence regresyonlarını genişlet

Amaç: yeni kullanıcı beklentisini gerçek navigasyon ve iki kullanıcıyla kanıtlamak.
Sıra nedeni: Task 1 ve 2 birlikte test edilmeden logo koluna geçilmez.
Dosyalar: `frontend/e2e/17-project-chat.spec.ts`, gerektiği kadar `e2e/helpers.ts`, `e2e/06-calendar-page.spec.ts`, `e2e/08-session-expiry.spec.ts`.
Backend: production değişikliği yok; E2E mevcut backend'i kullanır.

- [x] 3.1 Eski “Projeler listesine çıkınca kapanır” testini yeni kabul edilen kapsamla güncelle; A→B temizleme beklentisini koru.
- [x] 3.2 Client-side gerçek linkler ile direct sohbet aç → taslak yaz → minimize → proje Görevler → global Takvim → Ekipler akışında bar, active isim ve draft korunmasını doğrula. Global kişisel Görevler'i ayrıca kapsa.
- [x] 3.3 Overview/Kriterler/Depo section değişimleri, nested ekip detayı/üye listesi, pano/sprint/label sayfaları ve Dashboard/Projeler/Organizasyonlar/Ayarlar navigasyonlarını aynı proje için tablo halinde kapsa.
- [x] 3.4 Minimize→compact→full ve geri geçişlerde konuşma/history/draft korunmalı. Bar ve compact halde başka kullanıcıdan mesaj gönder; unread artmalı, aynı mesaj iki kez çizilmemeli.
- [x] 3.5 Bar, compact ve full X davranışlarını kontrol et: sonraki navigationda görünüm açılmasın; Mesajlaşma ile tekrar açılabilsin.
- [x] 3.6 A→B'yi hem URL hem Takvim ProjectSwitcher üzerinden test et. B'de A'nın konuşması, taslağı, history'si veya outbox'ı görünmesin; A'ya dönünce temiz context olsun.
- [x] 3.7 Playwright WebSocket/frame gözlemiyle navigasyonda reconnect/SUBSCRIBE artmadığını, gerçek context değişiminde eski socket close geldiğini doğrula. Başlangıç Strict Mode/normal token yenilemesi ayrı tutulmalı; backend/user queue mimarisine aykırı proje-topic testi kurma.
- [x] 3.8 Geciktirilmiş direct-open/send yanıtı, hızlı A→B→A ve logout/session expiry temizliğini doğrula; yeni hesaba eski chat cache verisi taşınmasın.
- [x] 3.9 En az TR/EN/DE route smoke, mobil dock ve sticky action bar çakışması kontrolü yap. Full panelin inert/focus/Escape davranışı korunmalı.

### Definition of Done
- [x] Yeni persistence, X, unread, draft ve proje değişimi senaryoları geçiyor.
- [x] Socket sayacı ve stale-response testleri geçiyor.
- [x] Mevcut chat gerçek zamanlı mesaj, reconnect, session expiry ve yetki testleri geçiyor.

## Task 4 — Proje ayarlarında ortak logo gösterimi ve yönetimi

Amaç: mevcut logo settings/header'da görünsün ve değiştir/kaldır işlemleri aynı versioned media akışını kullansın.
Sıra nedeni: chat kolu doğrulandıktan sonra bağımsız logo koluna geçilir; logo testleri bu UI/cache değişimine bağlıdır.
Dosyalar: `features/projects/components/project-card.tsx`, `project-detail.tsx`, `project-settings-form.tsx`, yeni `project-mark.tsx` ve `project-logo-field.tsx`, `features/projects/api.ts`, gerekirse `components/create/logo-field.tsx`, `i18n/messages/{tr,en,de}.json`.
Backend: gerekmiyor; DTO ve GET/PUT/DELETE logo uçları hazır.

- [x] 4.1 Mevcut `ProjectMark` renderer'ını küçük ortak `project-mark.tsx` dosyasına taşı; kart/oluşturma/header/settings aynı renderer'ı kullansın. Authenticated görsel için normal img ve hata fallback'i korunsun.
- [x] 4.2 Null `logoVersion` kontrolünü ve versioned URL seçimini mevcut `projectLogoUrl` çevresinde küçük reusable helper'a taşı. Kartın create preview ve invitation özel kaynak önceliklerini koru; URL string'i bileşenlerde kopyalanmasın.
- [x] 4.3 `ProjectDetail` header'ındaki sabit harfi ortak logo renderer'ına geçir. Logo yok/yüklenemiyor ise aynı locale-aware ilk harf fallback'i kullanılsın.
- [x] 4.4 Settings içinde mevcut logo/fallback, “Logo değiştir/yükle”, “Logo kaldır” ve format/boyut bilgisini gösteren `ProjectLogoField` ekle. Mevcut SettingsSection ve design token'larını kullan; TR/EN/DE metinleri tamamlansın.
- [x] 4.5 Upload ve DELETE için mevcut `projectsApi` metotlarını kullan. PNG/JPEG/WebP ve 512 KB istemci ön kontrolünü mevcut logo bileşeniyle paylaş; server validation kaynak olmaya devam etsin. Silme confirmation ve işlem boyunca karşılıklı disabled kontroller olsun.
- [x] 4.6 Başarılı upload/delete sonrası mevcut `["projects"]` invalidation standardını kullan; fresh `logoVersion` ile settings/header/list/chat logo consumer'ları yenilensin. 204 cevabından sahte version üretme ve paralel media cache kurma.
- [x] 4.7 Medya işlemi ayar formunun henüz kaydedilmemiş metin alanlarını resetlemesin. Logo işlemleri ayrı API işlemidir; genel “Kaydet” düğmesi beklenmesin. Hata durumunda server'daki eski logo korunsun, anlaşılır hata gösterilsin.
- [x] 4.8 Görsel 404/hata fallback'i, kaldırma sonrası null version, aynı dosyayı tekrar seçme ve logo değişirken eski src hata state'inin yeni src'yi engellememesi kontrol edilsin.

Edge-case'ler: logosuz proje, başarısız img, geçersiz/boş/büyük dosya, upload/delete yarışı, dirty settings form, unauthorized kullanıcı, hızlı proje değiştirme.
Testler: Task 5; bu task sonunda settings/header görüntüleme ve bir upload/remove smoke kontrolü.

### Definition of Done
- [x] Mevcut logo settings ve header'da gösteriliyor; yoksa ilk harf var.
- [x] Kart, create preview ve invitation logo davranışı korunuyor; duplicate URL mantığı yok.
- [x] Upload/remove sonrası tüm ilgili consumer'lar güncel server version'ı gösteriyor.
- [x] Genel form taslağı, banner akışı ve rol kontrolleri bozulmuyor.

## Task 5 — Logo gösterimi ve cache regresyonlarını ekle

Amaç: kalemden settings'e giriş, mutation ve fallback'i browser/network kanıtıyla doğrulamak.
Sıra nedeni: Task 4 media akışına bağlı.
Dosyalar: `frontend/e2e/project-create-page.spec.ts`, gerekirse yeni `project-logo-settings.spec.ts`; mevcut `11-project-banner.spec.ts` regresyon olarak kullanılır.
Backend: production değişikliği yok.

- [x] 5.1 Logo içeren proje oluştur/upload et → Projeler kartındaki kaleme tıkla → settings'teki logonun gerçek image load olduğunu (`naturalWidth > 0`) ve header logosunu doğrula.
- [x] 5.2 Logosuz projede settings/header ilk harf fallback'i ve uygun upload/remove kontrollerini doğrula.
- [x] 5.3 Logoyu başka görselle değiştir; server'da `logoVersion` değişimi, settings/header src'si ve client-side Projeler listesine dönüşte kart logosu doğrulansın. Açık grup sohbetinin logo consumer'ı da yenilensin.
- [x] 5.4 Logo kaldırmayı onayla; settings/header/card fallback'e dönsün, logo image isteği eski version ile sürmesin.
- [x] 5.5 Geçersiz tür/boyut ve başarısız upload/delete sırasında önceki logo korunmasını; dirty metin alanlarının değişmediğini doğrula. Silme confirmation iptalini ve disabled double-submit davranışını kontrol et.
- [x] 5.6 TR/EN/DE, açık/koyu tema, mobil görünüm ve klavye erişimi smoke kontrolü yap; banner ve oluşturma preview E2E'leri de geçsin.

### Definition of Done
- [x] Kalemden girilen settings mevcut logoyu gösteriyor.
- [x] Upload/remove sonrası settings, header ve kart stale görsel göstermiyor.
- [x] Fallback, hata, dirty form, dil/tema ve banner regresyonları geçiyor.

## Task 6 — Final kalite kapısı ve teslim

Amaç: tamamlanan uygulamayı repo standartlarına göre raporlamak.
Sıra nedeni: her iki bağımsız işin DoD ve testleri tamamlanmış olmalı.
Dosyalar: bu plan, ilgili `.agents/architecture.md`, `.agents/folder-structure.md`, `.agents/frontend-design-rules.md`, gerektiğinde `.agents/SECURITY.md` chat frontend lifetime açıklaması ve `docs/compliation/YYYY-MM-DD-chat-persistence-project-logo.md`.
Backend: ancak uygulamada somut yeni backend eksikliği kanıtlanırsa ayrıca plan revizyonu; mevcut plana göre backend değişikliği yok.

- [x] 6.1 `frontend` içinde `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `npm.cmd run build` çalıştır.
- [x] 6.2 İlgili Playwright chat/logo/calendar/session/banner testlerini ve final frontend E2E regresyonunu çalıştır; gerekli backend/frontend servis durumunu önceden kontrol et.
- [x] 6.3 Backend'e dokunulmuşsa backend unit/integration/architecture testleri ve build çalıştır; migration/endpoint değişikliğini açıkça raporla. Beklenmedik backend kapsamını sessiz ekleme.
- [x] 6.4 Push hazırlığı için `.\pre-push\pre-push.cmd` kapısını çalıştır; `PDA PRE-PUSH CHECK PASSED` sonucunu kaydet. Servis/port müdahalesi gerekiyorsa mevcut yetki ve ortamı değerlendir; çalışan kullanıcı sürecini koşulsuz öldürme.
- [x] 6.5 Web checklist'in yalnız bu görevin etkilediği navigation/focus/error/image maddelerini gözden geçir. Kısmi doğrulamayı proje genelinde `[x]` yapma.
- [x] 6.6 Mimari/klasör/logo standardı ve chat lifetime metinlerini gerçek uygulanan durumla güncelle. SECURITY güncellemesi yalnız davranış açıklaması; auth/cookie/CSRF/CORS veya server yetki mekanizması değişmez.
- [x] 6.7 Gerçek tamamlanma tarihinde completion kaydı oluştur: kapsam, önemli dosyalar, komut/sonuçlar, kalan konular ve somut manuel kullanıcı kontrolleri. Bu planı implement edilmiş feature kaydı gibi sunma.
- [x] 6.8 Task/DoD checkbox'larını yalnız başarılı doğrulama kanıtıyla işaretle; final diff'te kullanıcı staged/unstaged değişikliklerinin korunduğunu kontrol et. Commit/push yapma.

### Definition of Done
- [x] Task 1–5 DoD'leri ve gerekli kalite kontrolleri tamamlandı.
- [x] Tamamlanamayan kontrol varsa nedeni ve blocker açık yazıldı; full regression geçmeden iş tamamlandı denmedi.
- [x] Completion kaydı ve manuel kontrol adımları kullanıcıya iletildi.

## 5. Etkilenecek modüller ve dosyalar

Uygulama ağırlığı frontend `features/chat`, `features/projects`, ortak workspace navigasyonu, i18n ve E2E'dir. Dosya listeleri her taskta verilmiştir. Ortak authenticated layout zaten doğru seviyede; yeni global chat provider veya page-level persistence hack planlanmıyor. Yeni bağımlılık, ENV veya migration gerekmiyor.

## 6. Backend gereken değişiklikler

Mevcut kod incelemesine göre **yok**. Logo detail/list DTO'larında version var; medya endpoint'leri ve project RBAC mevcut. Chat REST ve kullanıcı kuyruğu API sözleşmesi yeterli. Uygulama sırasında aksi kanıtlanırsa eksik somut response/endpoint kanıtı ile plan güncellenir.

## 7. Riskler

- Route ve hatırlanan seçim arasında bir frame eski A verisi: state/project identity birlikte değiştirilip eski görünüm gizlenmeli. Seçim çözülürken sayfayı da remount eden keyed provider yaklaşımı oluşturma dosyalarını sıfırladığı için kullanılmadı; reducer context reset + effect generation cleanup uygulanır.
- Gecikmiş REST yanıtı ve A→B→A: yalnız project ID kontrolü yeterli olmayabilir; generation guard gerekli.
- Proje değişiminde socket cleanup ile token refresh örtüşmesi: iki ayrı yaşam döngüsü olarak test edilmeli.
- Logout sonrası user-scoped unread cache: query key'lerde user ID yok; ilgili chat cache temizliği doğrulanmalı.
- Broad `["projects"]` invalidation aktif chat sorgularını da etkileyebilir; logo yenilemesi connection remount/duplicate subscription üretmemeli.
- Logo alanı eklenirken form taslağı resetlenmesi ve kartın invitation/preview özel src kaynaklarının bozulması.
- Full sayfa yenilemesi React state'i sıfırlar; bu planın persistence kapsamı client-side workspace navigationıdır.

## 8. Validation planı ve plan aşaması raporu

Uygulama validation'ı Task 3, 5 ve 6'da tanımlıdır. Plan aşamasında dosya/kod incelemesi, mevcut E2E kapsamı ve DTO mapping doğrulaması yapıldı; test çalıştırılmadı. Kullanıcı kodu değiştirilmedi. Plan hazırlandığı sırada git durumunda yalnız kullanıcıya ait yeni `.agents/PDA_Chat_Persistence_Project_Logo_Plan_and_Implementation.md` dosyası untracked idi; bu dosya korunur.

Kullanıcıyla açık ürün kararı kalmadı: chat tüm authenticated workspace'te korunacak. Task 1–6 uygulandı. Sonuç ve manuel kontroller: `docs/compliation/2026-10-04-chat-persistence-project-logo.md`. Son pre-push exit 0; Next dev 3000 portunda geri açıldı.

## Uygulama doğrulama özeti

- Chat bağlamı ortak seçime bağlandı; sayfayı da remount eden ilk yaklaşım oluşturma dosyalarını sıfırladığı için stable provider + reducer reset/generation cleanup kullanıldı.
- 37 hedefli test ve ek senaryolarla 20/20 chat testi geçti. Son genel kapı: 404 backend, 170 frontend passed + 1 production dev-boundary skip, lint/type-check/build ve Docker smoke başarılı.
- Mevcut GitHub lifecycle E2E yalnız geçici 503 için sınırlı retry ile güçlendirildi; gerçek başarı 201 ve commit görünümü doğrulanır. Backend/ENV değişmedi.
- Commit, staging ve push yapılmadı; başlangıçtaki kullanıcı promptu korundu.
