# PDA localized UI ve chat uygulama planı

Durum: **tamamlandı (2026-10-04)**. Kutular uygulama ve ilgili Definition of Done doğrulaması sonrasında işaretlendi. Sonuçlar `docs/compliation/2026-10-04-localized-ui-chat.md` dosyasındadır. Kaynak istek: `.agents/PDA_Localized_UI_Chat_Plan_and_Implementation.md`. `frontend/CLAUDE.md` yalnız `@AGENTS.md` yönlendirmesidir.

## 1. Repository analizi

- Next.js 16 App Router sayfaları `frontend/src/app/(app)`, `(auth)` ve `(public)` altında **İngilizce, locale öneksiz** dosya yollarıdır. `frontend/src/i18n/request.ts` dili `NEXT_LOCALE` çerezinden, sonra `Accept-Language` başlığından seçer. `locale-switcher.tsx` çerezi yazar ve `router.refresh()` yapar; adresi değiştirmez. `settings/session-preferences.ts` oturum başında kaydedilmiş dil tercihini uygular.
- `frontend/src/proxy.ts` yalnız İngilizce protected path'leri eşler. `app-shell.tsx`, `project-sidebar-nav.tsx`, `project-sections.ts` ve `chat-provider.tsx` İngilizce pathname veya regex kullanır. Bunlar, çok sayıdaki sabit `Link`/`router.push` çağrısı ve `e2e` URL beklentileri, merkezi routing'e taşınmalıdır. `/api/v1/**` frontend sayfa rotası değildir.
- Mesajlaşma için ayrı App Router sayfası **yoktur**. `ChatNavItem` düğmesi proje sayfası üzerinde `ChatPanel` açar. `ChatProvider` uygulama kabuğunda yaşar; `closed/full/bar/compact` kiplerini ve **tek** `active` konuşmayı tutar. `ConversationList` grup ve kişileri, mesaj özetlerini ve okunmamış sayılarını zaten sunar; yalnız `ChatPanel` içinde kullanılır. `ChatDock` compact başlık, geçmiş ve composer gösterir, seçici göstermez.
- Organization oluşturma/düzenleme zaten `OrganizationFormPage` ile **tam sayfa** ve ortak formdur; canlı `OrganizationCard` önizlemesi, Zod doğrulaması ve `PageContainer` vardır. İyileştirme mevcut düzen üzerinde hedefli UX/erişilebilirlik çalışmasıdır. Organization API iş mantığı korunur.
- Proje `techStack` alanı API'de serbest metinli tek string'dir. `parseTechStack`, `tech-catalog.ts` içindeki `resolveTech` ve `TechLogo` hazırdır. `ProjectCard` logo + tooltip gösterirken `project-overview.tsx` halen düz metin gösterir. Bilinmeyen teknoloji kartta metin çipidir; Overview için istenen genel ikon + gerçek ad fallback'i ayrıca eklenmelidir.
- `e2e/13-organizations.spec.ts`, `e2e/17-project-chat.spec.ts`, `e2e/05-settings-page.spec.ts` ilgili davranışları kapsar; localized route paketi henüz yoktur. `globals.css` mevcut Titanium açık/koyu token'ların kaynağıdır.

## 2. Dependency / ordering kararı

**Kesin uygulama sırası: 1 → 2 → 3 → 4 → 5 → 6.** Route sözleşmesi önce kurulur; ardından bütün navigasyon aynı sözleşmeye taşınır. Böylece Organization ve sohbet arayüzleri eski yollar üzerine kurulup yeniden değiştirilmez. Organization formu ve teknoloji görünümü routing tamamlandıktan sonra bağımsız olarak ilerler. Compact seçici, mevcut tek `ChatProvider.active` durumunu ve `ConversationList` bileşenini kullanacak; bunu tam ekran sohbet görsel düzenlemesinden önce yapmak, sohbet düzenini iki kez ele almayı önler.

**Kesinleşen ürün kararları (2026-10-04):** (a) Tüm dillerde görünür `/{locale}` öneki: `/tr/projeler`, `/en/projects`, `/de/projekte`; (b) Mesajlaşma mevcut proje paneli olarak kalır, sırf URL örneği için yeni `/messages` sayfası eklenmez.

## Task 1 — Merkezi localized routing sözleşmesi

**Amaç:** Tek bir mantıksal rota kimliğinden TR/EN/DE URL üretmek ve gelen URL'yi aynı kimliğe çözmek. URL'de yalnız sabit segmentler çevrilir; proje slug'ı, UUID, token ve API yolu değişmez.

**Neden şimdi:** Layout, sidebar, locale switch, proxy ve chat bağlamı bu sözleşmeye bağlıdır.

**Etkilenecek dosyalar:** Yeni `frontend/src/i18n/routing.ts` (ve gerekirse saf yardımcı/test), mevcut `i18n/config.ts`, `i18n/request.ts`, `proxy.ts`, `locale-switcher.tsx`, `settings/session-preferences.ts`; route yapısı seçilen yaklaşım gerektirirse `app` yerleşimi. Mevcut App Router ağacı ve next-intl 4.14.7 ile uyumlu **tek** yaklaşım seçilir; ikinci paralel router kurulmaz.

**Frontend ve routing/i18n:**

- [x] 1.1 Gerçek sayfa ağacını mantıksal rota tablosuna dök: public/auth/app, iç içe projeler/ekipler/görevler/takvim/davetler/organizasyonlar, özel hata ve dev yolları. `new`, `edit`, `board`, `pool` gibi sabit segmentleri dinamik parametrelerden ayır; aynı konumdaki çakışmaları önle.
- [x] 1.2 Merkezi, mümkün olduğunca tip güvenli `buildPath(routeId, params, locale)`, `matchPath(pathname)` ve `switchLocale(pathname, search, targetLocale)` sözleşmesini oluştur. Tek tablo, Link/router yardımcıları, locale switch, active state ve proxy tarafından kullanılsın. Encode/decode ve trailing slash tek yerde çözülsün.
- [x] 1.3 `/{locale}/...` dış URL'lerini mevcut gerçek sayfalara tek geçişte bağla; gerekiyorsa yeniden yazma (rewrite) kullan. URL dili çerezden önce gelsin ve sunucu renderındaki `html[lang]` ile aynı olsun. Locale değişiminde `?section=`, liste filtreleri, `next` gibi gerekli query parametreleri korunsun; hash client gezinmesinde korunsun. Session başlangıcındaki kaydedilmiş dilin URL ile ilişkisi açıkça belirlensin.
- [x] 1.4 Eski locale öneksiz ve `/tr/projects` gibi dil ile uyuşmayan bookmark'ları, aynı mantıksal sayfanın tek canonical URL'sine yönlendir; query/dinamik değerleri koru. Bilinmeyen yol için gerçek 404 bırak; sınırsız/tekrarlayan redirect üretme. `/api`, `/_next`, statik varlıklar, WebSocket ve dosya indirme yolları bu sayfa haritalamasının dışında kalsın.
- [x] 1.5 `proxy.ts` oturum ipucunu canonical **mantıksal** protected route üzerinde denetlesin; session'sız kullanıcıyı doğru dilli login'e taşısın ve güvenli iç `next` hedefini korusun. Backend yetkilendirme ve HttpOnly cookie/CSRF kuralları değişmesin.

**Backend:** Gerekmez. URL çevirisi yalnız frontend sayfa yolu içindir; `/api/v1` endpointleri ve proje slug veri modeli değişmez.

**Edge-case:** `/projects/new` gerçek proje slug'ı sanılmamalı; UUID/slug encoded biçimi korunmalı; locale URL'si ile çerez uyuşmazlığı tek bir öncelik kuralıyla çözülmeli; public metadata, sitemap ve robots canonical adreslerle tutarlı olmalı; login/OAuth dönüşündeki `next` açık yönlendirme açığına dönüşmemeli.

### Definition of Done

- [x] TR/EN/DE rota üretimi ve tersine çözümü, iç içe ve dinamik sayfalar için test edildi.
- [x] Eski URL yönlendirmesi, doğrudan yükleme/refresh, query korunması ve 404/redirect döngüsü kontrolü geçti.
- [x] Auth proxy gerçek sayfa yollarını korur; API, cookie, CSRF ve backend davranışı aynı kalır.

## Task 2 — Navigasyon ve locale switch entegrasyonu

**Amaç:** Uygulamanın bütün sayfa geçişleri ile aktif vurguları Task 1'in rota sözleşmesini kullansın.

**Neden şimdi:** Sonraki Organization ve Chat UI işleri artık kesinleşmiş URL sisteminde yapılır.

**Etkilenecek dosyalar:** `components/layout/{app-shell,app-header,project-sidebar-nav,tasks-nav-link,global-search,locale-switcher}.tsx`, `features/projects/{project-sections.ts,hooks/use-selected-project.ts}`, `features/chat/{chat-provider.tsx,components/chat-nav-item.tsx}`, organization/project/task/calendar/invitation/auth link ve router kullanımları, `app/sitemap.ts`, `app/robots.ts`, TR/EN/DE çevirilerindeki görünen URL örnekleri.

**Frontend ve routing/i18n:**

- [x] 2.1 Sabit internal `href`, `router.push/replace`, redirect, arama sonucu, hesap menüsü ve proje ayarları kalem hedeflerini merkezi helper'a taşı. Backend `api.ts` adreslerine dokunma.
- [x] 2.2 Global ve seçili proje sidebar, Teams, Calendar, Tasks, Invitations, Organization, Settings ve proje ayarları vurgusunu çözülmüş mantıksal route üzerinden hesapla; `?section=` ile çalışan Overview/Kriterler/Ekipler/Depo/Ayarlar davranışını koru.
- [x] 2.3 Dil seçici ve ayarlardaki kaydedilmiş/oturumluk dil akışını aynı mantıksal sayfaya geçir; proje slug'ı, iç içe sayfa, gerekli query ve seçili proje oturum bağlamı korunsun. `ChatProvider` proje bağlamını localized path'ten çözsün; yalnız dil değişti diye sohbetin yanlış projeye geçmemesi ve state'in sızmaması doğrulansın.
- [x] 2.4 Public/auth sayfaların link, canonical/sitemap/robots ve test URL beklentilerini seçilen kapsamla tutarlı güncelle. Özellikle davet token akışı, kayıt/giriş yönlendirmesi ve hata sayfalarını kontrol et.

**Backend:** Gerekmez. **Edge-case:** Locale değişimi sırasında açık panel, `?section=settings`, görev filtreleri, auth `next`, eski bookmark, direkt nested route, tarayıcı geri/ileri ve mobil sidebar.

### Definition of Done

- [x] TR → EN → DE geçişi aynı logical sayfada kalır; dinamik proje slug'ı ve query korunur.
- [x] Sidebar, seçili proje, proje ayarları kalemi, global arama ve chat açılışı üç dilde doğru hedef/aktif durum gösterir.
- [x] Eski URL'lerin doğrudan açılması ve sayfa yenilemesi 404 üretmez; tarayıcı geçmişi çalışır.

## Task 3 — Organization oluşturma/düzenleme UX temizliği

**Amaç:** Mevcut tam sayfa ortak formu PDA tasarım sistemiyle daha okunur ve responsive hale getirmek.

**Neden şimdi:** Organization yönlendirmeleri Task 2'de localized hale geldi; bu form tekrar route değişikliği gerektirmez.

**Etkilenecek dosyalar:** `features/organizations/components/organization-form-page.tsx`, gerekirse `organization-card.tsx`, `i18n/messages/{tr,en,de}.json`, `e2e/13-organizations.spec.ts`. `PageContainer`, `PageHeader`, mevcut input ve buton token'ları kullanılır.

- [x] 3.1 Form başlığı, alan grupları, yardım ve hata metinleri, önizleme ile eylem çubuğunun hiyerarşisini gözden geçir; create ve edit'i aynı bileşende koru. Eski popup'a bağlı kullanılmayan UI varsa yalnız gerçek dead code'u kaldır.
- [x] 3.2 Klavye/focus, etiket-hata bağı, submit bekleme durumu, mobil önizleme ve sticky eylem çubuğu ile açık/koyu tema düzenini doğrula. Mevcut Zod sınırları ve API create/update/owner davranışı korunsun.
- [x] 3.3 TR/EN/DE localized create/edit URL'lerinde form, validation, submit, cancel ve yetkisiz/hata hâllerini Playwright ile kapsa.

**Backend:** Gerekmez. **Routing/i18n:** Linkler Task 1 helper'ı üzerinden; yalnız gerekliyse üç dilde UI metni. **Edge-case:** Arşivli organizasyon, yetkisiz düzenleme, boş ad, uzun açıklama, yavaş API, dar ekran.

### Definition of Done

- [x] Create/edit akışları aynı API sözleşmesiyle çalışır; modal kalıntısı yoktur.
- [x] Masaüstü/mobil ve açık/koyu tema kontrolü ile ilgili Playwright doğrulaması geçer.

## Task 4 — Project Overview teknoloji ikonları

**Amaç:** Overview'daki düz `techStack` metnini erişilebilir ikon, tooltip ve fallback ile göstermek.

**Neden şimdi:** Veri modeli ve katalog hazır; chat düzeninden bağımsızdır. Routing tamamlandığından Overview'daki diğer linkler de son URL biçimindedir.

**Etkilenecek dosyalar:** `features/projects/components/project-overview.tsx`, mevcut `tech-catalog.ts`, `tech-stack.ts`, `components/tech-logo.tsx`; karttaki `TechStrip` gerçekten ortaklaştırılacaksa küçük paylaşılan bileşen; ilgili E2E.

- [x] 4.1 `parseTechStack → resolveTech → TechLogo` zincirini yeniden kullan. Kart ve Overview'da ikinci mapping/katalog oluşturma. Gerekirse tekrar eden logo+tooltip işaretlemesini tek bileşene çıkar.
- [x] 4.2 Katalog teknolojilerine mevcut SVG logo ve ad tooltip'i; katalogda bulunmayana **genel teknoloji ikonu** ve gerçek metnini tooltip/erişilebilir ad olarak ver. Yalnız hover'a güvenme; touch ve klavye odak erişimini doğrula. Boş liste için mevcut `notSpecified` durumunu koru.
- [x] 4.3 Çoklu/uzun değer, logo yüklenememesi, sarma, açık/koyu tema ve mobil görünümü doğrula.

**Backend:** Gerekmez; `techStack` serbest metinli string kalır. **Routing/i18n:** Yeni route yok; varsa tooltip çevresindeki sabit metinler üç dilde. **Edge-case:** Eski serbest teknoloji adları, alias, null/boş metin, uzun adlar.

### Definition of Done

- [x] React/PostgreSQL gibi bilinen değerler doğru katalog logosunu; bilinmeyen değer görünür fallback ve gerçek adını gösterir.
- [x] Tooltip, klavye/touch etiketi ve responsive/dark-light kontrolleri geçer; katalog kopyalanmaz.

## Task 5 — Compact chat konuşma seçicisi

**Amaç:** Compact pencereden tam ekrana dönmeden proje grubu ve diğer kişiler arasında geçmek.

**Neden şimdi:** `ChatProvider.active` tek kaynak olarak hazır; `ConversationList` zaten tüm hedefleri ve unread sayılarını içerir. Tam ekran görsel düzenleme bu davranışın üstüne oturur.

**Etkilenecek dosyalar:** `features/chat/components/{chat-dock,conversation-list,conversation-view}.tsx`, gerekirse `chat-provider.tsx` yalnız mevcut state akışı için; `i18n/messages/{tr,en,de}.json`, `e2e/17-project-chat.spec.ts`.

- [x] 5.1 Compact başlığa erişilebilir seçici/toggle yerleştir; mevcut `ConversationList`i aynı provider üzerinden grup ve kişileri göstermek için yeniden kullan. Popover/panelin dar ekranda taşmasını ve klavye odağını yönet.
- [x] 5.2 Seçim yalnız `chat.selectGroup/selectPeer` çağırmalı; ayrı compact `selectedConversation` tutma. Seçimden sonra aynı compact pencerede yeni konuşma, doğru composer taslağı ve okuma durumu görünmeli.
- [x] 5.3 Mevcut full → bar → compact, compact → bar/full/closed geçişleri koru. Konuşma açma yarışı, API hatası, okunmamış rozetler, başka projeye geçiş ve socket olayları sırasında yanlış konuşmaya mesaj/read yazılmamasını doğrula. Yeni subscription veya gereksiz çift history sorgusu oluşturma.
- [x] 5.4 Alper → Nisa → proje grubu örneğiyle aynı pencerede seçim, gönderme, taslak geri dönüşü, unread ve minimize/restore E2E senaryolarını ekle.

**Backend:** Gerekmez; REST, STOMP, CSRF ve üyelik kontrolleri aynen kalır. **Routing/i18n:** Yeni mesajlaşma sayfası kararı çıkmazsa route eklenmez; seçici etiketleri üç dilde. **Edge-case:** Direkt konuşma henüz yokken oluşturma, üye projeden ayrılmışken hata, 0/99+ unread, mobil tek kolon, bağlantı kopması, birden fazla sekme.

### Definition of Done

- [x] Compact pencerede grup ve farklı direct konuşmalar arasında tam ekran olmadan geçilir.
- [x] Tek `active` durum, unread/read, taslak, outbox ve WebSocket davranışı ilgili E2E ile korunur.

## Task 6 — Tam ekran/compact mesajlaşma görsel düzeni ve son regresyon

**Amaç:** Var olan çalışan sohbetin okunabilirliğini artırmak; Task 5 seçicisini tam ve kompakt düzenle tutarlı göstermek.

**Neden son:** Routing ve compact etkileşimleri netleşti; görsel düzen tek kez nihai davranış üzerinde yapılır.

**Etkilenecek dosyalar:** `features/chat/components/{chat-panel,chat-dock,conversation-list,conversation-view,message-list,message-composer,person-avatar}.tsx`, `components/ui/avatar.tsx` yalnız ortak API gerekirse, `i18n/messages/{tr,en,de}.json`, `e2e/17-project-chat.spec.ts`. `globals.css` token'ları korunur; değişirse `.agents/frontend-design-rules.md` de güncellenir.

- [x] 6.1 Konuşma listesi, seçili satır, proje grubu/kişi kimliği, zaman ve unread sıralamasını; mesaj geçmişi, composer ve bağlantı durumunu mevcut Titanium görsel diliyle düzenle. Ortak avatar/fotoğraf ve proje logosu kaynaklarını yeniden kullan.
- [x] 6.2 Desktop full, desktop compact, mobil tek kolon, klavye ve ekran okuyucu odak akışı, long message, loading/empty/error, light/dark ve reduced-motion durumlarını görsel/etkileşimli doğrula. Tam panel açıkken `inert` ve kapatınca odak geri dönüşü korunur.
- [x] 6.3 Frontend lint, `tsc --noEmit`, varsa ilgili unit testleri, Playwright organization/chat/routing/technology regresyonu ve production build çalıştır; push öncesi `.\pre-push\pre-push.cmd` kapısını ayrıca uygula. Backend'e fiilen dokunulursa ilgili backend/unit/integration/modularity testlerini de çalıştır.
- [x] 6.4 Gerçek uygulamada kritik ekranları gözden geçir; `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md` içindeki yalnız değişiklikten etkilenen URL, SEO, responsive ve erişilebilirlik maddelerini kod/test kanıtıyla yeniden değerlendir. Yalnız tamamlanan iş için `docs/compliation/YYYY-MM-DD-kisa-ad.md` teslim kaydı açıp kapsam, dosyalar, komut/sonuç, açık konular ve kullanıcı kontrol adımlarını yaz. Mimari/klasör düzeni değiştiyse kısa haritaları güncelle.

**Backend:** Planlanan yok. **Routing/i18n:** Task 1–2 sözleşmesi ve TR/EN/DE metinleri kullanılır. **Edge-case:** Mobil klavye, uzun kullanıcı adı, çok mesaj, geciken API, offline/reconnect, başka proje, reduced-motion.

### Definition of Done

- [x] Tam ve compact sohbetin erişilebilir/responsive/açık-koyu arayüzü gerçek tarayıcıda doğrulandı.
- [x] Mevcut sohbet veri akışı ve proje yetkileri değişmedi; Task 5 davranışı regresyon testinden geçti.
- [x] Tüm ilgili kalite kapıları geçti, teslim kaydı gerçek sonuçlarla yazıldı ve bu planın biten kutuları güncellendi.

## 4. Etkilenecek modüller ve backend kararı

Ana etki `frontend/src/i18n`, `frontend/src/proxy.ts`, `frontend/src/components/layout`, `frontend/src/features/{organizations,projects,chat}`, App Router sayfa girişleri, çeviri dosyaları ve Playwright testleridir. **Planlanan backend değişikliği yoktur**; Organization API, Project DTO/slug, Chat REST/STOMP ve veritabanı migration'ı değişmez. Bir backend ihtiyacı gerçekten doğarsa mevcut API ile çözülüp çözülemeyeceği yeniden değerlendirilir; güvenlik mimarisi veya `.env`/`.env.example` değişimi öncesinde `.agents/SECURITY.md` gereği kullanıcıdan açık onay alınır.

## 5. Riskler ve validation özeti

- Routing en geniş regresyon alanıdır: OAuth/login dönüşü, public SEO, davet token query'si, korunmuş sayfaların login yönlendirmesi, deep-link ve eski bookmark testleri ayrı doğrulanmalı. Dış URL ile backend API path'i karıştırılmamalı.
- Mesajlaşma UI tek bir panel sistemidir; kullanıcının kararına göre ayrı `/mesajlasma`, `/messaging` veya `/nachrichten` URL'si oluşturulmaz. Sidebar'daki etiket üç dilde yerelleşir.
- Existing `ProjectCard` bilinmeyen teknolojiyi metin çipiyle gösterir. Overview fallback'inin genel ikon olması ürün gereksinimidir; eşit katalog çözümü korunarak farklı sunum kabul edilir.
- UI görsel doğrulaması yalnız kod okumayla tamamlanmaz: desktop/mobil, açık/koyu ve erişilebilirlik kontrolü Playwright/gerçek tarayıcı ile yapılır. Önce taska özgü test, son aşamada bütün ilgili regresyon ve production build çalışır.
- Plan hazırlama aşamasında test koşturulmadı ve üretim kodu değiştirilmedi. Kullanıcının mevcut untracked `.agents/PDA_Localized_UI_Chat_Plan_and_Implementation.md` dosyasına dokunulmadı; commit/push/merge yapılmadı.

## 6. Task bazlı validation planı

| Task | Doğrulanacak davranış | Ana test yüzeyi |
| --- | --- | --- |
| 1 — Route sözleşmesi | TR/EN/DE üretim ve parse; dinamik slug/UUID korunması; query, eski URL redirect, direkt giriş, refresh, bilinmeyen yol 404; auth guard ve açık yönlendirme kontrolü | Saf helper testleri, yeni Playwright localized-routing spec'i, proxy ve public URL kontrolleri |
| 2 — Navigasyon | Aynı logical sayfada locale switch; seçili proje; global/proje sidebar active state; Teams, Calendar, Invitations, Organization, Settings, proje ayarları kalemi, arama, auth dönüşü; public canonical/sitemap/robots | Localized-routing E2E + mevcut navigasyon, settings, davet, proje ve chat testleri |
| 3 — Organization | Create/edit render; boş/uzun alan doğrulama; submit/cancel; yetkisiz/arşivli durum; mobil/desktop ve üç dil URL | `e2e/13-organizations.spec.ts`, gerçek tarayıcı görsel/klavye kontrolü |
| 4 — Technology | Katalog ikonu, tooltip, bilinmeyen fallback, boş liste, touch/klavye etiketi, açık/koyu ve mobil | Proje Overview/Kart E2E veya ilgili bileşen testi, tarayıcı görünümü |
| 5 — Compact chat | Grup → Alper → Nisa; compact içinde mesaj gönderme; unread/read, taslak, minimize/restore/full/close, proje değişimi, bağlantı kesilmesi | `e2e/17-project-chat.spec.ts`, gerektiğinde socket regresyonu |
| 6 — Son kalite | Lint, tip, ilgili testler, production build, Playwright görsel/etkileşim kontrolü; kod değişikliklerinden sonra pre-push | `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx playwright test`, `.\pre-push\pre-push.cmd` |
