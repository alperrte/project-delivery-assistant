# Frontend tasarım kuralları

## Navbar scroll davranışı — 2026-10-11

`use-auto-hide.ts`: hover destekleyen cihazlarda yukarı scroll navbar'ı açmaz. Üst 24 px reveal alanı navbar'ın yatay sınırlarıyla sınırlıdır; scrollbar kenarında gezinmek tetiklemez. Dokunmatik cihazlarda scroll-up reveal korunur. Önceki bölümlerdeki genel scroll-up davranışı artık yalnız dokunmatik cihazlar için geçerlidir. 700 ms idle, hover, focus, Ctrl-K, açık popup/drawer ve mevcut layout reserve korunur.

## Invitations remediation — 2026-10-06

Invitation UI manager EXPIRED tab/empty translations mevcut status dilini kullanır; expired row resend action sunar, live pending cancel davranışı kalır. Public preview yalnız404/invalid token için expired copy;429 mevcut rate copy, network ayrı, server contextual unavailable copy. Retry state token/attempt ile bağlıdır; cancellation/abort eski response/error overwrite etmez. Navbar/current centered placement ve design tokens değiştirilmedi.

Bu belge PDA frontend'inin görsel dilini özetler: renk paleti (light/dark), yazı tipleri, köşe yarıçapları, ikonlar, hareket ve erişilebilirlik kuralları. Amaç, hangi ajan çalışırsa çalışsın tüm sayfaların aynı sistemle uyumlu kalmasıdır. Süreç (skill'ler, Playwright, audit) için `.agents/FRONTEND_WORKFLOW.md` geçerlidir; bu belge onun "mevcut token'ları koru" adımının içeriğidir.

## Organization profil formu ve ortak medya (2026-10-04)

2026-10-05 kullanıcı referansı: Organization formu `PageContainer wide` içinde 7/5 geniş iki kolondur. Soldaki tek yüzeyde ikonlu General/Identity/Contact/Details bölümleri, yan yana tile upload alanları ve kaydedilen 1000 karakter Notes bulunur. Sağda centered profil, yatay gerçek OrganizationCard ve gerçek profile header preview'si, altında yardım kartı vardır. Mavi/violet/amber mevcut `label-*` token'larından gelir; mavi CTA koyu temada okunabilir beyaz yazı için kontrollü ton kullanır. Organization cover yoksa token tabanlı dekoratif SVG gösterilir; gerçek upload bunu değiştirir, Project fallback aynı kalır. Notes gerçek detail'da düz metin olarak sunulur. Preview etkileşim/nav içermez; geniş ve mobil form/dock düzeni ortak davranışı korur.


Create/edit aynı General / Identity / Contact alanlarını, mevcut `PageContainer` 7/5 grid ve sticky action bar'ı kullanır. Preview gerçek OrganizationCard/ProfileHeader bileşenlerinden oluşur; link ve mutation içermez. Logo/cover ortak `ImagePicker`, `EntityMark`, `EntityCover` ve `lib/media` politikalarını kullanır; Project wrapper'ları aynı altyapıyı paylaşır. Kart görseli mevcut token ve okunabilir overlay ile, detail cover dekoratif olarak gösterilir. Yeni palette/token eklenmez. Kaydedilmiş metadata ile başarısız upload ayrı tutulur; retry sadece bekleyen dosyaları gönderir. Kaldırma onaydan sonra draft olarak işaretlenir, Save ile uygulanır; Vazgeç sunucu görsellerini değiştirmez. Uzun TR/EN/DE action metinleri mobilde satıra bölünür.

## Önce `globals.css` dosyasını oku

Tek doğruluk kaynağı `frontend/src/app/globals.css` dosyasıdır. Buradaki tablolar bir özettir ve kodun gerisinde kalabilir. UI'a dokunan her işten önce o dosyayı oku; çelişki varsa `globals.css` kazanır. Bir token eklediğinde, sildiğinde veya değerini değiştirdiğinde bu belgeyi de güncelle.

Dosyanın bölümleri:

| Bölüm | İçerik |
|---|---|
| `@theme inline` | Font aileleri, renk token'larının Tailwind sınıflarına bağlanması (`bg-primary`, `text-muted-foreground` …), radius ölçeği, `animate-shake` / `animate-fade-up` |
| `:root` | Light tema değerleri (genel + `--auth-*`) |
| `.dark` | Dark tema değerleri (aynı isimler) |
| `.auth-scope`, `@utility auth-cta` | Auth kartı içinde token yeniden eşleme ve birincil auth butonu |
| Auth hareketleri | Slogan parlaması, logo elektronları, neon şerit, giriş animasyonları |
| Tema geçişi | `theme-reveal` daire açılışı (view transition) |
| `@layer base` | Global font, arka plan, başlık stili, imleç kuralları |
| `prefers-reduced-motion` | Hareket azaltma kuralları |

## Teknoloji

- Next.js 16 App Router, React 19, TypeScript.
- Tailwind CSS v4. Ayrı `tailwind.config` yoktur; tema CSS içinde `@theme` ile tanımlıdır.
- shadcn (stil `base-nova`, primitive'ler `@base-ui/react`). Bileşenler `src/components/ui/` altındadır; `components.json` CSS yolu olarak `src/app/globals.css` dosyasını gösterir.
- Shadcn CLI npm bağımlılığı kaldırılmıştır (2026-10-05). Kullanılan open/closed/checked/disabled/active/horizontal/vertical varyantları MIT lisans notuyla `src/styles/shadcn-compat.css` içinde korunur; globals.css burayı import eder. Animasyon utility'leri `tw-animate-css` içindedir. Yeni üretilen bileşen eklenirken ihtiyaç duyduğu varyantları doğrula; kullanılmayan CLI zincirini veya tam upstream stylesheet'i otomatik ekleme.
- `next-themes`: `attribute="class"`, `defaultTheme="system"`. Dark tema `<html class="dark">` ile gelir; Tailwind'de `dark:` varyantı `@custom-variant dark (&:is(.dark *))` ile tanımlıdır.
- `motion/react` animasyonlar için, `next-intl` metinler için (`src/i18n/messages/{tr,en,de}.json`).
- Sınıf birleştirme: `cn()` (`@/lib/utils`). Varyantlar: `class-variance-authority`.

## Renk paleti

`frontend/src/app/globals.css` içindeki `html:has(.app-shell)` ve `html.dark:has(.app-shell)` token'ları kullanıcı tarafından verilen DESIGN.md'nin Titanium beyaz/karbon paletini kullanır. Aşağıdaki tablo bu oturum içi paleti gösterir; dashboard, proje ve organizasyon sayfalarında geçerlidir. `:root` ve `.dark` temel token'ları ise auth ekranlarında kullanılmaya devam eder. Yeşil, amber ve kırmızı yalnız durum göstergeleri içindir. Kimlik ekranlarının sahne renkleri ayrıca `--auth-*` token'ları ile tanımlanır.

### Genel token'lar

| Token | Light | Dark | Kullanım |
|---|---|---|---|
| `--background` | `#ffffff` | `#090a0b` | Sayfa zemini |
| `--foreground` | `#090a0b` | `#f4f5f6` | Ana metin |
| `--card`, `--popover` | `#ffffff` | `#18191b` | Kart, menü ve dialog yüzeyi |
| `--card-foreground`, `--popover-foreground` | `#090a0b` | `#f4f5f6` | Yüzey üstündeki metin |
| `--primary` | `#090a0b` | `#f4f5f6` | Birincil eylem ve vurgu |
| `--primary-hover` | `#303031` | `#dce0e6` | Birincil eylem hover |
| `--primary-foreground` | `#ffffff` | `#090a0b` | Birincil eylem üstündeki metin |
| `--secondary`, `--muted` | `#f4f5f6` | `#222326` | İkincil yüzey ve hover |
| `--secondary-foreground`, `--accent-foreground` | `#090a0b` | `#f4f5f6` | İkincil yüzey metni |
| `--accent` | `#eaebed` | `#222326` | Aktif menü öğesi |
| `--muted-foreground` | `#525866` | `#a1a1aa` | İkincil metin |
| `--surface-2` | `#f9fafa` | `#111214` | Sidebar ve sağ panel |
| `--border` | `#e5e7eb` | `#27282b` | İnce kenarlık |
| `--border-strong`, `--input` | `#c5c6c9` | `#45474a` | Belirgin kenarlık ve form |
| `--ring` | `#525866` | `#a1a1aa` | Klavye odak halkası |
| `--success` | `#147a52` | `#10b981` | Başarı ve aktif durum |
| `--warning` | `#a4660b` | `#f59e0b` | Uyarı |
| `--destructive` | `#ba1a1a` | `#ef4444` | Hata ve silme |
| `--live` | `#10b981` | `#10b981` | Gerçek çevrimiçi/bağlı durum |
| `--shadow-tint` | `0 0% 15%` | `0 0% 0%` | Nötr panel gölgesi (HSL parçaları) |

### Oturum içi sayfaların düzeni

Dashboard, Projeler, Organizasyonlar ve proje detayları `app-shell` ile aynı sol menüyü (240 px, `pda:sidebar-collapsed` ile 64 px'e daraltılabilir), gövdeden ayrık camsı üst çubuğu, mobil çekmeceyi ve Inter başlıkları kullanır. Dashboard içeriği `features/dashboard/dashboard.tsx` içinde kalır. Diğer sayfaların içerik sınırı 1560 px'tir; bu sınırın altındaki sayfa genişliği tek yerden, `components/common/page-container.tsx` ile seçilir (`wide`: liste/pano, `form`: ayar ve oluşturma/düzenleme sayfaları `max-w-5xl`, `narrow`: tek amaçlı kart `max-w-xl`); sayfa içinde rastgele `max-w-*` yazma. Yapışkan alt çubuklar `main`'in `px-4 sm:px-8` boşluğuna `-mx-4 px-4 sm:-mx-8 sm:px-8` ile oturur ve `main`'in alt boşluğunu `-mb-6 sm:-mb-8` ile geri alır; yoksa sayfanın en sonunda çubuk bu boşluk kadar yukarı zıplar (E2E: `project-create-page.spec.ts`). Ana "Projeler" bağlantısı tüm projelerin listesini açar ve yalnız liste ile `/projects/new`'de aktif görünür; proje içindeyken vurguyu "Seçili proje" grubu taşır. Altındaki "Seçili proje" alanı tek projenin adını ve Genel Bakış, Kriterler, Ekipler (Ekip Davetleri alt öğesiyle) ve Depo bölümlerini gösterir; proje ayarlarına sidebar'dan veya proje sayfasının header'ından değil, Projeler listesindeki proje kartının sağ üstündeki kalem ikonundan (yalnız ayarları değiştirebilen üye görür; `EntityCard` `corner` yuvası, yetki ipucu liste yanıtındaki `canEdit`) gidilir, `?section=settings` bağlantıları aynen çalışır; bu bölümler dikey çizgiyle biraz içeride hizalanır. Seçili projeyi değiştirmek için proje listesine gidilir. Proje içeriğinde ikinci sidebar bulunmaz. Son seçilen proje kullanılır, henüz seçim yoksa ilk proje kullanılır; proje yoksa bölüm adları pasif görünür. Mobilde aynı gezinme çekmecededir. Aktif öğe `nav-item.ts`'teki ortak `navItemClass` ile dolgun arka plan ve sol kenarda ince bir vurgu çizgisiyle işaretlenir (sidebar linkleri, proje bölümleri, "Ayarlar"). Sidebar gruplara ayrılır: genel bağlantılar, "Seçili proje", "Görev yönetimi" ve "Kişisel" (Görevler, Takvim); gruplar `border-t` ve aynı başlık tipografisiyle ayrılır. En altta, kaydırılan `nav`'ın dışında sabit duran "Ayarlar" (`/settings`: dil, tema, animasyon) ve daralt düğmesi bulunur; profil ve şifre sidebar'da değil, navbar'daki hesap menüsünün "Hesap ayarları" (`/account`) sayfasındadır; "PDA / Çalışma alanı" kartı yoktur. Daraltılmış sidebar yalnız amblem logo, ikon + `title`/`aria-label` ve proje harf rozetini gösterir. `html:has(.app-shell)` radius değerini `0.5rem` yapar. Proje oluşturma, kriter, üyelik, davet ve ayar bileşenleri eski sayfalarda kullanılmaya devam eder.

Projeler, Organizasyonlar ve proje Ekipler listeleri tablo yerine ortak kart ızgarası kullanır (`components/common/entity-card.tsx`: `EntityCard`, `EntityCardSection`, `EntityCardFooter`, `EntityCardLink`, `EntityStatusPill`, `EntityGrid`). Kart üstünde tonlu bir başlık bandı (durum rengi: aktif → `success`, beklemede → `warning`, diğerleri nötr), harf/ikon karosu, ad, açıklama ve durum hapı bulunur; altında ayraçlı bölümler ve tek bir alt link vardır. Alt linkin `::after` katmanı kartın tamamını kaplar, yani kart tek bir link hedefidir; kart içindeki ek kontroller (ör. ekip düzenle/arşivle) `relative z-10` almalıdır. Veri olmayan alan için sahte içerik üretme: teknoloji `techStack` metninden bölünür (katalogdaki adlar logo olarak, diğerleri metin çipi olarak), ekip sayısı ve baş harf avatarları liste yanıtındaki `team` alanından gelir; kart başına `/home` gibi ek sorgu atma. Izgara en fazla 3 sütundur (`md:2 / xl:3`) ve sayfa başına 12 kart gösterilir; 4 sütun kartın teknoloji ve avatar satırlarını sıkıştırır. Sayfalama numaralıdır (`PaginationBar` `pageSize` ile) ve sayfa URL'de `?page=` olarak tutulur.

Üst çubuk (`app-header.tsx`) fiziksel viewport merkezindeki eski konumunu korur; sidebar expanded/collapsed konumu etkilemez (2026-10-06 kullanıcı düzeltmesi); ≤small viewport iki row kullanır. Birinci row mobil menü, native history geri/ileri ve GlobalSearch; ikinci row dil/tema/bildirim/hesap; sm üstünde tek row. `--workspace-header-reserve` main ve full chat için ortak128px mobile/72px desktop değeridir; autohide reserve değiştirmez. `use-auto-hide.ts` mevcut700ms idle, top24px/scroll-up/focus/Ctrl-K davranışını korur; popup açıkken gizlenmez. PDA okları yalnız güvenilir native same-origin capability ile enabled olur; unsupported görünür disabled ve localized açıklamalıdır; browser history intercept edilmez.

### Avatar ve profil fotoğrafı

Kişi avatarı tek bileşendir: `components/ui/avatar.tsx`. `src` verilirse fotoğrafı çizer, yoksa ya da yüklenemezse baş harfleri gösterir (kırık görsel hiç görünmez); `src` her zaman `features/account/api.ts` içindeki `profilePhotoSrc(userId, profilePhotoVersion)` ile kurulur (`?v=` cache'i kırar). Navbar, ekip ve proje üyeleri, kart/ekip avatar yığınları (`AvatarStack`) ve davet gönderen aynı bileşeni kullanır; yeni bir yerde kişi avatarı gerekiyorsa `Avatar` + `profilePhotoSrc` kullan, ayrı bir baş harf kutusu çizme. Fotoğraf yükleme `/account` sayfasındaki Profil bölümündedir (`features/account/components/profile-photo-field.tsx`): dosya seçilince yalnız önizleme görünür, "Fotoğrafı kaydet" onayıyla yüklenir; yükleme sürerken düğmeler kilitlidir; kaldırma onay ister; istemci ön kontrolü (tür, 5 MB) yalnız gidiş-dönüşü kısaltır, karar sunucudadır. Görev atananları, izleyiciler, yorum yazarları ve `@` öneri listesi de aynı `Avatar` + `profilePhotoSrc` yolunu kullanır (`PersonRef.profilePhotoVersion`, yorumda `authorPhotoVersion`). Takvim/hatırlatıcı kişileri ve çalışma kaydı/ek yükleyen adları henüz fotoğraf taşımaz (ilgili DTO'lara `profilePhotoVersion` eklenince aynı yolla bağlanır). Ekip üyeleri tablosunda e-posta satırı yalnız sunucu `email` döndürdüğünde (üye yönetimi yetkisi) görünür. **Baş harf kuralı (2026-10-10):** kullanıcı adları artık boşluk, `_` ve `-` içerebildiği için `Avatar` kelimeleri `\s+` ile ayırır, harf ya da rakam içermeyen kelimeleri (yalnız `-` / `_`) baş harften sayar, tek kelimede ilk iki, birden çok kelimede ilk iki kelimenin ilk harfini alır ve bunu kod noktası bazında yapar (surrogate çifti ikiye bölünmez); büyük harfe çevirme sonda yapılır. Yeni bir baş harf kutusu çizme.

### Proje kapak görseli (banner)

Banner yalnız Projeler listesindeki proje kartında görünür (`features/projects/components/project-banner.tsx`; kartın mevcut üst bandının arka planı olarak `object-cover` çizilir, üzerine yazıların okunması için `bg-background/50` örtü gelir; ayrı bir şerit açılmaz, dekoratif `aria-hidden`). Proje sayfasının header'ında banner gösterilmez. Davet önizlemesi (`InvitationProjectPreviewDialog`) gerçek banner'ı davete özel `GET /project-invitations/{id}/banner?v=` rotasından gösterir (`invitationsApi.bannerUrl`; önizleme DTO'sundaki `bannerVersion` doluysa, `ProjectCard` `invitationPreview.bannerSrc`); banner yoksa ya da yüklenemezse (404/hata) `EntityCover` düz band yedeğine döner ve diyalog bozulmaz. Proje oluştururken kapak görseli, logo gibi (`create/banner-pick-field.tsx`, `usePickedImage`) seçilir, seçilir seçilmez canlı önizleme kartının bandında görünür ve proje oluşturulduktan sonra yüklenir (yükleme başarısız olursa uyarı verilir, proje yine oluşur). Banner yoksa band düz renkli kalır. Kalem ikonu her durumda bandın sağ üstünde durur. Yükleme, değiştirme ve kaldırma proje ayarlarında (`banner-field.tsx`) yapılır ve orada görsel önizleme yoktur, yalnız durum metni ve düğmeler bulunur; yalnız `PROJECT_UPDATE` yetkisi, PNG/JPEG/WebP, en çok 2 MB. Kaynak URL `?v=bannerVersion` ile cache'i kırar.

### Proje davetlerim (alıcı listesi)

`features/invitations/components/my-invitations-page.tsx`: süzgeç ve sayfa URL'dedir (`?status=ALL` geçmiş; varsayılan Bekleyen URL'de yazılmaz; `?page=` 1 tabanlı, süzgeç değişince sıfırlanır, sayfa sınırı aşılırsa son sayfaya kırpılır), rota `Suspense` içindedir. `xl` ve üzerinde semantik `Table`: Proje (ilk harf kutusu + ad, ikinci satırda ekip, varsa kırpılmış davet mesajı), Roller (`ProjectRoleBadge`), Davet eden (`Avatar` + `profilePhotoSrc`), Tarih (`<time dateTime>`), Durum (`InvitationStatusBadge`), İşlemler. `xl` altında (1024'te kenar çubuğu yalnız ~720 px bırakır, altı sütun + 44 px eylemler sığmaz) davet başına bir kart: aynı bilgiler, `sm` altında tam genişlik eylemler, yatay kaydırma yok. Eylemler yalnız yanıtlanabilir (PENDING, proje canlı) davette: Proje bilgileri (tabloda tooltip'li ikon düğmesi, erişilebilir ad `minePreviewNamed`; kartta etiketli), Reddet (sessiz destructive, neden diyaloğu), Kabul et (birincil); hepsi en az 44 px. Geçmiş (Tümü) satırları yalnız durum rozeti gösterir. Anahtarlar aktöre özgü, 30 sn yoklama, `staleTime: 0` ve kabul/ret sonrası `mineRoot` + `["projects"]` geçersiz kılma korunur (E2E: `my-invitations-redesign.spec.ts`).

### Proje oluşturma sayfası ve canlı önizleme deseni

`/projects/new` tam sayfa bir formdur (açılır pencere değil): solda `border-t` ile ayrılmış bölümler (Kimlik, Tür, Teknoloji, Detaylar; her birinde tek cümlelik açıklama), sağda `lg` ve üzerinde `sticky` bir önizleme paneli. Panel, listedeki gerçek `ProjectCard` bileşenini `preview` kipinde çizer; ayrı bir "sahte" kart yazılmaz. Önizleme kipinde kart pasif bir `aria-disabled` öğedir (bağlantı yok, hover kaldırması yok), ekip oturumdaki kullanıcıdan, "son güncelleme" ise `preview.now` metninden gelir. `lg` altında önizleme formun altına iner ve alt çubuktaki "Önizlemeyi göster" düğmesi oraya kaydırır; 440 px altında bu düğme yalnız ikon gösterir (yatay taşma olmaması için). Alt yapışkan çubukta İptal ve "Projeyi oluştur" bulunur. Form kirliyken sayfadan çıkış `beforeunload` ile uyarılır; başarılı oluşturmadan sonra uyarı devre dışıdır.

- **Logo:** sürükle-bırak veya tıkla; PNG, JPEG, WebP, en fazla 512 KB (istemcide de denetlenir), `URL.createObjectURL` ile anında önizleme, yoksa adın ilk harfi. Önizleme URL'leri değişimde ve unmount'ta `revokeObjectURL` ile bırakılır. Logo yüklemesi başarısız olursa proje yine oluşur, uyarı toast'ı gösterilir. SVG kabul edilmez.
- **Teknoloji logosu kuralı:** formda logo + ad birlikte, kartta yalnız logo (en fazla 6, kalanı `+N`) gösterilir; her logo `Tooltip` ve `role="img" aria-label` taşır. Tooltip yalnız fareyle açılır, odaklanabilir değildir; adlar ekran okuyucuya `aria-label` ile iletilir. Logolar `public/images/tech/` altında yereldir (lisans notu `LICENSES.md`), dış CDN kullanılmaz. Tek renkli logolar koyu temada `dark:invert` alır. Katalog dışı eski metinler logo yerine metin çipi olur.
- **Tür seçimi:** `RadioGroup` seçenek kartları (Web, Mobil, AI, Masaüstü, Diğer); varsayılan seçim yoktur, zorunludur.
- **Slug önizlemesi** yaklaşıktır ve yalnızca bilgi içindir; gerçek adresi sunucu üretir.

### Auth sayfaları token'ları

Giriş, kayıt ve şifre sıfırlama ekranları arka plan fotoğrafı üzerinde yumuşak bir camgöbeği ışıkla çalışır. Bu token'lar `--auth-*` önekiyle ayrılmıştır; uygulama içindeki tek mavi vurguyu bozmamak için **auth dışındaki sayfalarda kullanma**.

| Token | Light | Dark | Kullanım |
|---|---|---|---|
| `--glow` | `#3fd3f2` | `#2fd0f5` | Auth odak/parıltı rengi |
| `--auth-ink` | `#0d1219` | `#eef2f7` | Auth metni |
| `--auth-muted` | `#525c69` | `#a3adbb` | Auth ikincil metni |
| `--auth-link` | `#0a73a3` | `#5cd8f5` | Auth linkleri |
| `--auth-link-hover` | `#075c83` | `#8fe5f9` | |
| `--auth-accent-from` / `-to` | `#09a8cf` → `#1b74d6` | `#3fd7f5` → `#2aa6f0` | Auth gradyan vurgusu |
| `--auth-sheen` / `-core` / `-glow` | doygun camgöbeği | doygun camgöbeği, daha güçlü hale | Slogan parlaması (beyaz kullanma: açık gökyüzünde harfler kaybolur) |
| `--auth-card` | `rgb(255 255 255 / 0.52)` | `rgb(13 18 25 / 0.72)` | Buzlu cam kart (`backdrop-blur-xl` ile) |
| `--auth-card-edge` / `-ring` / `-shadow` | | | Kart kenarı, halkası, gölgesi |
| `--auth-field` / `-field-border` | | | Form alanı zemini ve kenarlığı |
| `--auth-control` / `-control-border` | | | Köşedeki dil/tema kontrolleri |
| `--auth-cta` / `-cta-top` / `-cta-ink` | mürekkep siyahı `#141b25` | ışıklı camgöbeği `#0a7fa9` | Birincil auth butonu |

- `.auth-scope` sınıfı auth kartında genel token'ları (`--foreground`, `--primary`, `--ring`, `--border` …) auth değerlerine yeniden eşler. Böylece `FormField`, `Button` ve linkler kart içinde ayrı stil yazmadan sahneye uyar. Yeni bir auth formu da bu kapsamın içine konmalı.
- Birincil auth butonu için `auth-cta` utility'sini kullan (bkz. `features/auth/components/auth-card.tsx`).

## Yazı tipleri

| Rol | Font | Nerede yüklenir | Tailwind |
|---|---|---|---|
| Gövde metni | Inter (variable) | `src/app/layout.tsx`, `next/font`, `--font-inter` | `font-sans` (varsayılan) |
| Başlıklar (`h1`–`h4`) | Inter | aynı | `font-heading` (base katmanında `h1`–`h4` için otomatik) |
| Kod, commit hash | JetBrains Mono 400/500 | `layout.tsx`, `--font-jetbrains-mono` | `font-mono` |
| Login sloganı | Exo 2 | `features/auth/components/login-hero.tsx` | Bileşende `font-(family-name:--font-exo2)` |
| Oturum içi sayfa başlığı (`h1`, `.font-heading`) | Inter | `globals.css` `.app-shell` | Dashboard, proje ve organizasyon sayfaları |

- Fontlar yalnızca `next/font/google` ile yüklenir; `<link>` veya `@import url(...)` ile font ekleme.
- Başlıklarda `letter-spacing: -0.01em` base katmanından gelir.
- Exo 2 auth sloganında kullanılır; oturum içi sayfa başlıkları Inter kalır.
- Kullanılan ağırlıklar: gövde 400, etiket ve link `font-medium`, başlık `font-semibold`, auth başlıkları `font-bold`.

## Radius, gölge, boşluk

- Genel taban `--radius: 0.625rem`, oturum içi `app-shell` kabuğunda `0.5rem`. Ölçek: `rounded-sm` ×0.6, `rounded-md` ×0.8, `rounded-lg` ×1, `rounded-xl` ×1.4, `rounded-2xl` ×1.8, `rounded-3xl` ×2.2, `rounded-4xl` ×2.6.
- Buton ve alanlar `rounded-lg`, kartlar (`ui/card.tsx`) `rounded-2xl`. Auth kartı istisna olarak `rounded-[1.25rem]`.
- Buton yükseklikleri `button.tsx` içindeki boyutlardan gelir (`h-8` varsayılan, `sm` `h-7`, `lg` `h-9`). Yeni buton boyutu uydurma; varyantları kullan.
- Sayfa başlığı için `components/common/page-header.tsx`, boş durum için `empty-state.tsx`, form alanı için `form-field.tsx` kullan.

## İkonlar

- Uygulama ikonları `@phosphor-icons/react` ile gelir; yeni ikonlar da buradan seçilir. Kalınlık için `weight` (`bold`, `fill`) kullanılır.
- `lucide-react` yalnızca shadcn'in ürettiği `components/ui/*` primitive'lerinde bulunur; uygulama kodunda yeni lucide ikonu ekleme.
- Bayraklar `country-flag-icons` ile gelir.
- Logo: `components/common/logo.tsx`. Görseller `public/images/branding/` altındadır; kullanıcının görsel dosyalarını değiştirme.

## Tema (light/dark)

Tema geçişindeki ay `--theme-moon` rengini kullanır (`#4c8dff`, iki temada da). Bu renk açık ve koyu zemin üzerinde seçilir kalır; güneş ve hale renkleri ayrıdır.

- Tek tema kontrolü `components/layout/theme-toggle.tsx` içindedir; dashboard tasarımı tüm sayfalarda aynıdır. Auth/app tone varyantı veya sayfaya özel boyut override kullanılmaz. `.theme-toggle` mevcut Titanium token bloğunu paylaşır; palet kopyalanmaz, sayfanın diğer renkleri değişmez. Seçim animasyonu her component instance için ayrı `useId` ile izole edilir.

- Her yeni renk token'ı **hem `:root` hem `.dark`** içinde tanımlanmalı ve genel bir renk ise `@theme inline` içinde `--color-*` olarak bağlanmalıdır.
- Bileşenlerde sabit hex, `bg-white`, `text-black` veya `bg-slate-*` gibi paletten bağımsız renkler kullanma. `bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-muted-foreground`, `bg-primary` gibi token sınıflarını kullan. Auth'a özel değerler için `bg-(--auth-card)` yazımı kullanılır.
- `dark:` varyantını yalnız token'ın karşılamadığı ince farklar için kullan; renkleri token seviyesinde çöz.
- Tema değiştirme `components/layout/theme-switcher.tsx` (`useThemeSelection`) → `playThemeTransition` (`theme-transition.tsx`) üzerinden geçer ve yön hedef temaya göredir: açık temaya geçişte ortadan açılan daire (`theme-reveal`), koyu temaya geçişte dışarıdan merkeze kapanan daire (`theme-close-in`); ortada küçük güneş/ay. Tema değişimini başka bir yoldan tetikleme. Geçiş yalnız Ayarlar'daki "Tema geçiş animasyonu" açık ve hareket azaltılmamışsa çalışır; yoksa tema doğrudan değişir. Üst çubuk düğmesi cihaz temasıyla aynı seçimi "sistem"e çevirir; Ayarlar'da kaydedilen seçim ise olduğu gibi saklanır.
- `layout.tsx` içindeki `themeColor` değerleri `--background` ile aynıdır (`#ffffff` / `#090a0b`); zemin değişirse ikisini birlikte güncelle.
- Her değişikliği iki temada da kontrol et.

## Kaydedilen ve geçici arayüz tercihleri

İki katman vardır. Ayarlar sayfasındaki dil, tema ve animasyon seçimleri bir taslaktır: seçerken ekranda hiçbir şey değişmez, "Kaydet" hesaba yazar (`PUT /users/me/preferences`) ve o andan itibaren varsayılan olur; "Vazgeç" taslağı atar. Kaydedilenler her girişte uygulanır (`features/settings/session-preferences.ts`, `AppShell` içinde `useApplySavedPreferences`), çıkış yapıp tekrar girince ve başka cihazda da aynı kalır. Üst çubuktaki dil ve tema düğmeleri ise yalnız o oturum için geçicidir: çıkışta (veya oturum bittiğinde) arayüz, oturumun başladığı hâle (kaydedilen varsayılan, hiç kaydedilmediyse tarayıcının o anki hâli) döner (`useRestoreSessionBaseline`). Oturum başlangıcı `sessionStorage`'daki `pda:session-baseline` ile işaretlenir; sayfa yenilemek geçici değişikliği silmez. Animasyon tercihleri yalnız Ayarlar'dan değişir. Yeni bir kalıcı tercih eklerken hem bu taslak akışına hem backend alanına eklenmelidir.

## Hareket ve erişilebilirlik

- Kolay eğri: `cubic-bezier(0.22, 1, 0.36, 1)` (motion'da `[0.22, 1, 0.36, 1]`). Kısa etkileşimler 0.2–0.5 sn.
- Giriş animasyonları `backwards` doldurmayla yazılır. Böylece bittiğinde sayfada kalıcı `transform`/`filter` kalmaz.
- Hareket tercihi tek kaynaktan gelir (`lib/preferences/motion.ts`): Ayarlar'daki "Arayüz animasyonları" Cihazı izle / Açık / Kapalı olarak hesapta saklanır ve her girişte `localStorage`'a (`pda:motion`) yazılır, `<html data-motion>` ve `MotionConfig` ile uygulanır. Cihaz ayarı (`prefers-reduced-motion`) yalnız Açık seçilmemişse geçerlidir, Kapalı her zaman kazanır. Motion bileşenlerinde `useReducedMotion()` yerine `useReducedMotionPreference()` kullan (o, cihaz ayarını canlı izler).
- `prefers-reduced-motion`: global kural tüm animasyonları kısaltır. Sürekli dönen döngüler (slogan, neon şerit) `animation: none` ile durur, logo elektronları gizlenir. Yeni bir döngü eklersen onu `globals.css`'teki iki bloğa (`prefers-reduced-motion` ve `data-motion="off"`) birlikte ekle.
- `forced-colors: active` modunda dekoratif katmanları gizle (slogan örneğine bak).
- Dekoratif kopyalar ekran okuyucuya okunmamalı: `aria-hidden` ya da `content: attr(...) / ""` kullan.
- Odak her zaman görünür olmalı: `focus-visible:ring-*` ile `--ring` veya auth'ta `--glow`.
- Tıklanabilir her yüzeyde imleç `pointer`, disabled öğelerde `not-allowed` olur; bu kural base katmanında hazırdır, bileşende tekrar yazma.
- Metinler `next-intl` ile üç dilde (tr, en, de) tutulur; UI'a sabit metin yazma.
- Sayfa yüksekliği için `min-h-[100dvh]`; yatay taşma olmamalı (`body` `overflow-x-hidden`).

## Tam sayfa form, görünüm seçici, tablo ve düzenleme modu

- Ekip oluşturma/düzenleme proje oluşturma deseniyle aynıdır: tam sayfa form, 7/5 ızgara, yapışkan canlı önizleme (`TeamCard preview`), alt aksiyon çubuğu, `beforeunload` koruması. Dialog yalnız kısa onay ve tek alanlı işlemler içindir.
- Ekipler sayfası Kart (grid) / Tablo / Şema görünümü `Tabs` ile segment olarak sunulur; üçü de aynı sorgudan beslenir (görünüm değişince ağ isteği yok), kart ve tablo aynı `?page=` dilimini gösterir. Seçim `?view=` URL'inde (`list` eski adıdır, `grid`e eşlenir) ve hesap başına `localStorage`'da (`pda:teams-view:v1:<userId>`) tutulur (storage erişimi try/catch, `useSyncExternalStore` ile okunur; eski global `pda.teams.view` ilk hesaba bir kez taşınır). Tablo (`team-table.tsx`) `md` üstünde semantik tablo (Üst ekip sütunu `xl` üstünde, altında ad altında), altında `divide-y` yığılmış liste; İşlemler yalnız yöneticiye. Org şeması saf CSS (`.org-tree`) ve gerçek linklerdir; kütüphane yok.
- Kartın tamamı tıklanabilir (stretched link); düzenle/arşivle ikon butonları `relative z-10` ile link üstünde kalır ve tooltip taşır.
- Veri tablosu: `divide-y`, zebra yok, `md` altında yığılmış liste. Filtre, sıralama ve arama durumu istemcide tutulur. Düzenleme modu tabloya "İşlemler" sütunu ekler; kilitli eylemler nedenini söyleyen tooltip'li kilit ikonu gösterir.

## Görev yönetimi arayüzü

- Linear çizgisi: sakin, yoğun; kartlar yalnız yükseklik anlam taşıyorsa (pano, havuz), liste `divide-y` satırlarıdır. Satır tek büyük tıklama hedefidir (stretched link), durum menüsü `relative z-10` ile bağımsız kalır.
- Etiket renkleri sabit `--label-*` token'larından gelir (`slate, red, orange, amber, green, teal, blue, violet, pink`; `workflow.ts` `labelDotClass`). Serbest hex, `bg-white` ya da `bg-slate-*` kullanılmaz. Durum ve öncelik göstergeleri de `workflow.ts` sınıflarından gelir; renk tek başına anlam taşımaz, her zaman metin ya da `sr-only` karşılığı vardır.
- Deadline tonu: gecikmiş `text-destructive`, 24 saat içinde `text-warning`, diğerleri sessiz.
- Base UI menülerinde `DropdownMenuLabel` her zaman `DropdownMenuGroup` ya da `DropdownMenuRadioGroup` içinde olmalıdır; aksi halde menü çalışma anında hata verir (`tsc` yakalamaz).
- Görev anahtarı uzun olabilir; `truncate` ile kısaltılır ve `title` taşır, başlığı satırdan itmez.
- Pano native HTML5 sürükle-bırak kullanır; her kartın klavye ve dokunmatik alternatifi "Şuna taşı" menüsüdür. Geçersiz sütunlar soluklaşır.
- Pano yatay kaydırılmaz: sütunlar `grid gap-3 sm:grid-cols-2 xl:grid-cols-3` ızgarasında sarılır (geniş ekranda 3×2, tablette 2, telefonda 1), sütunda `min-w-0`; uzun sütunun kart listesi `max-h-[32rem] overflow-y-auto`. Sabit sütun genişliği (`w-72 shrink-0`) ve `overflow-x-auto` pano kabında kullanılmaz.
- Yetkisiz kullanıcıya kilitli kontrol gösterilmez, salt okunur değer gösterilir: yönetici olmayan için "Atananları değiştir" düğmesi hiç çizilmez; Öncelik, Puan ve Sprint açılır liste yerine düz metin olur (öncelik göstergesi + etiketi görünür kalır); `PropertyRow` `htmlFor` yalnız gerçek bir girdi varken verilir. Sunucu kuralı (`TASK_MANAGE`) değişmez; bu yalnız görünümdür. Yönetici için gelişmiş alan proje modu yüzünden yazılamıyorsa Select devre dışı kalmaya devam eder.
- Durum adları (yalnız TR etiketi, enum aynı): BACKLOG "Bekleyen işler", TODO "Sırada", IN_PROGRESS "Yapılıyor"; sprint bağlamındaki "backlog" metinleri de "Bekleyen işler". EN/DE etiketleri değişmez.
- Takvim kullanıcıya atanan görevleri de gösterir (`features/calendar/hooks/use-calendar-tasks.ts`): seçili projede `assigneeId` ile tek sorgu, başlangıç (`startDate`) ve son tarih (`deadlineAt`, yerel gün) günlerinde. Ay ızgarasında kompakt `data-calendar-tasks` işareti (son tarih `warning`, gecikmiş `destructive`, yalnız başlangıç `muted`; ana sayfada tek nokta), gün panelinde `TaskAgenda` satırları görev detayına bağlanır.
- Filtre durumu URL'dedir (`?status=`, `?tab=`, `?page=`), böylece görünüm paylaşılır ve yenilemede korunur. Arama yazmayı bitirince (300 ms) uygulanır.
- Tarih ve saat için ortak `components/ui/date-picker.tsx` ve `components/ui/time-picker.tsx` ile hızlı seçimler kullanılır; native `date`/`time`/`datetime-local` girdisi kullanılmaz, yeni bağımlılık eklenmez (bkz. "Ortak tarih/saat seçiciler").

## Mesajlaşma paneli

Seçili proje grubunun sonunda (Görev yönetiminden sonra) "Mesajlaşma" düğmesi bulunur (`features/chat/components/chat-nav-item.tsx`; daraltılmış sidebar'da yalnız ikon, okunmamış varsa nokta). Bir bağlantı değil düğmedir: sayfanın üstünde sohbet panelini açar; seçili proje aynıysa genel çalışma alanı sayfalarında da bulunduğu sayfada açar. Rozet projenin okunmamış toplamıdır (sunucu sayar; seçili bağlamın WebSocket bağlantısıyla tüm çalışma alanında canlıdır; bağlantı yokken dakikada bir yenilenir). Bildirim zili ve davet sayacından bağımsızdır.

Panelin üç görünür durumu vardır ve geçişler tek yönlü kurallıdır: `full` → `bar` ("—" düğmesi tam paneli sağ alttaki ince çubuğa küçültür; Escape de aynı; tam paneldeki "×" ise sohbeti tamamen kapatır, sağ alta çubuk bırakmaz), `bar` → `compact` (çubuğa tıklayınca ~360×460 pencere: geçmiş + mesaj kutusu; çubukta etkin konuşmanın yüzü görünür: grup için proje logosu ya da kişiler simgesi, direkt konuşma için kişinin fotoğrafı ya da baş harfleri), `compact` → `bar` ("—") ya da `full` (tam ekran düğmesi); kapatma `full`, `bar` ve `compact` üzerindeki "×" ile yapılır. Etkin konuşma, yüklenen mesajlar, taslaklar ve okunmamış sayıları bu geçişlerde korunur; seçili proje aynıysa tüm authenticated çalışma alanı sayfaları arasında gezerken (ör. Görevler, Takvim, Projeler) küçültülmüş sohbet yerinde kalır. Farklı proje/kullanıcı seçimi, erişim kaybı veya oturum sonu state ve bağlantıyı temizler; X sonrası navigasyon kendiliğinden açmaz. Canlı bağlantı jeton bitmeden kendini yeniler: istemci oturumu bitişten 90 sn önce yeniler (`renewAccessSession`, sekmeler arası Web Locks ile), yeni bir soket açar, o bağlanınca devralır ve eskisini 3 sn sonra kapatır; kullanıcı "bağlantı koptu" göstergesi görmez (`use-chat-socket.ts`). Panel `AppShell`'in yanında (`ChatProvider` + `ChatRoot`) bağlanır, bu yüzden sayfa değişimlerinde yok olmaz.

- **Yerleşim ve z-index.** `full`: sidebar'ın sağında (`lg:left-60`, daraltılmışsa `lg:left-16`), yüzen üst çubuğun altında (`top-[4.5rem]`) `fixed`; z-30 (yapışkan alt çubuklar z-20'nin üstünde, üst çubuk z-40 ve diyaloglar z-50'nin altında). Tam panel açıkken `main` `inert` olur; sidebar çalışmaya devam eder. `bar` ve `compact` sağ altta `fixed`, z-30; telefonda genişliği doldurur (`compact` alttan açılan sayfa gibi, yükseklik 70dvh).
- **Yapışkan kaydet çubukları.** Sayfa altındaki yapışkan kaydet çubukları (görev, proje, ekip, organizasyon, ayarlar formları) `data-sticky-actions` taşır; böyle bir çubuk varken `bar` ve `compact` `[body:has([data-sticky-actions])_&]:bottom-[4.75rem]` ile çubuğun üstüne kalkar ve kaydet düğmesini örtmez. Yeni bir yapışkan eylem çubuğu eklenirse aynı özniteliği taşımalıdır.
- **Duyarlı davranış.** `md` ve üzerinde iki sütun (konuşmalar 20rem + konuşma); altında tek sütun: önce liste, bir konuşma seçilince geri düğmeli konuşma ekranı. Liste ekranındayken gizli konuşma okundu sayılmaz (konuşma bileşeni bağlanmaz).
- **Konuşma listesi.** Proje grubu her zaman ilk satırdır; adı projenin kendi adıdır, projenin logosu varsa avatarı o logodur (yoksa ya da yüklenemezse kişiler simgesi; proje henüz yüklenirken yedek ad "Proje Grubu"), ardından projenin diğer üyeleri (kendin yoktur); satırda `Avatar` + `profilePhotoSrc` (fotoğraf yoksa baş harfler), son mesaj önizlemesi, saat ve okunmamış hap vardır; okunmamış sayısı ekran okuyucuya `sr-only` metinle de verilir. Başka üye yoksa "Bu projede henüz başka üye yok." gösterilir. Satırlar `aria-current` taşıyan düğmelerdir.
- **Mesajlar.** Kendi mesajı sağda (`bg-primary`), karşı taraf solda (`bg-muted`); yalnız tema token'ları kullanılır (sabit renk yok). Saat her mesajda, gün değişince ayraç ("Bugün", "Dün", tarih) bulunur; grupta ilk mesajda gönderen adı ve avatarı görünür. İçerik her zaman düz metindir (`whitespace-pre-wrap`, `break-words`): `dangerouslySetInnerHTML` yoktur, `<script>`/`<img>` metin olarak görünür. Liste en alttayken yeni mesajı izler; yukarı kaydırılmışsa "Yeni mesajlar" düğmesi çıkar ve okuma konumu zorla bozulmaz; en üste gelince eski mesajlar imleçle yüklenir ve kaydırma konumu korunur. `role="log"` + `aria-live="polite"` ile gelen mesajlar duyurulur.
- **Mesaj kutusu.** Enter gönderir, Shift+Enter yeni satır ekler (IME birleştirmesinde göndermez; görev yorumları da Enter ile gönderir, ayrıntı "Görev yorumu klavyesi"); 2000 karakter sayacı sunucunun kuralını (kod noktası, boşluk ve kontrol karakteri) yansıtır ama karar sunucudadır. Gönderilen mesaj anında "Gönderiliyor…" olarak görünür; başarısız olursa kutuda "Gönderilemedi" + "Tekrar dene" / "Sil" çıkar. Bağlantı koptuğunda kutu devre dışı kalır ve açıklama gösterilir (çevrimdışı kuyruk yoktur). Okundu işareti yalnız konuşma görünürken (`full` ya da `compact`), sekme açıkken ve liste en alttayken, gecikmeli ve mesaj başına bir kez gönderilir.
- **Odak.** Panel açılınca odak mesaj kutusuna (telefonda panele) gider, kapatınca açan düğmeye döner, Escape paneli çubuğa indirir.

## Hata ekranları

- 404, 403, 500 ve 503 aynı `features/errors/error-content.tsx` bileşenini kullanır: PDA logo, büyük hata kodu, kısa açıklama, sonraki adım ve geri dönüş/yeniden deneme bağlantıları. Footer bulunmaz. Masaüstünde iki kolon, `md` altında tek kolon; eylem hedefleri en az 44 px'dir.
- Tam ekran `ErrorFrame` tema ve dil kontrollerini bilgi sayfalarındaki gibi sunar; site genelindeki tek `ThemeToggle` dashboard görünümünü kullanır. Uygulama içindeki `PageFailure` mevcut AppShell'i korur, ikinci header veya main eklemez.
- Kök `global-error` provider, oturum veya router istemeden çalışır; ince JSON kataloglarını kullanır, kendi CSS ve sistem fontunu taşır. Ham hata mesajı, stack trace ve API detayları kullanıcıya basılmaz.
- Taşınabilir `public/errors/503.html` kendi token tanımlarını `globals.css` içinden üretir; palet/metin değişirse `node scripts/build-maintenance-page.mjs` çalıştır. Bu belge hiçbir dış görsel/font/script istemez; Next.js kapalıyken göstermek hosting tarafının sorumluluğudur.

## Footer ve bilgi sayfaları

- `SiteFooter` auth ve herkese açık bilgi sayfalarında kullanılır; sayfa bileşenine ikinci footer ekleme. Bilgi sayfalarında copyright, bilgi bağlantıları ve e-posta sade bir alt satırda yer alır; dar ekranlarda satırlar sarılır. Footer akış içindedir, sabitlenmez; bağlantılar en az 44 px yüksekliğinde ve görünür klavye odağına sahiptir.
- Uygulama çalışma ekranlarında footer bulunmaz. Bilgi sayfaları ve iletişim bağlantıları `AppHeader` hesap menüsündeki Bilgi ve destek grubunda yer alır; masaüstünde ve mobilde aynı menü kullanılır.
- Auth footer'ı `tone="auth"` ile kompakt düzendedir: bilgi bağlantıları yatay olarak sarılır; copyright, geliştiriciler, iletişim ve kaynak kod altta yer alır. Mevcut `--auth-control`, `--auth-ink`, `--auth-muted` değerlerini kullanır. `AuthShell` esnek ana içerik ve `min-h-[100dvh]` ile footer'ı yeterli yüksekliğe sahip ekranın altına yerleştirir; kısa ekranlarda içerik doğal olarak kayar, forma örtüşen sabit footer kullanılmaz. Diğer yüzeylerde genel `bg-card`, `text-foreground`, `text-muted-foreground` token'ları geçerlidir.
- `(public)` bilgi sayfaları oturum istemez. Uzun metinlerde 16 px/7 satır yüksekliği, tek `h1`, anlamlı `h2` bölümleri, içerik bağlantıları ve `lg` üzerinde yapışkan içindekiler kullanılır. SSS native `details/summary` ile klavye ve dokunmatik kullanım sunar. Metinler üç dilde mesaj dosyalarındadır.
- Kullanıcı tercihiyle bilgi sayfaları, login, landing ve oturum içi sayfalar dashboard görünümündeki tek `ThemeToggle` bileşenini kullanır: kompakt pill, renkli dolu güneş/ay ikonları, kayan seçim göstergesi ve ortak dairesel tema geçişi. Sayfa içeriği kendi token'larıyla kalır.

## Landing page

- `/` scroll ile ilerleyen ürün hikâyesidir: sakin Welcome, gerçek PDA componentleriyle proje/ekip/görev demosu, Windows CMD kurulum akışı, teknoloji açılışı, final CTA ve kompakt landing footer. Screenshot, video veya dekoratif arka plan kullanılmaz. Demo için ikinci sidebar, topbar, form, üye tablosu veya görev kartı tasarımı üretilmez.
- `landing.module.css` yalnız mevcut semantic token’ları tüketir. Açık kaynak ve terminal yüzeyleri foreground/background üzerinden `color-mix()` ile türetilir; global theme değerleri değiştirilmez. Teknoloji ikonları yerel SVG’lerin semantic renkli maskeleridir; Next.js maskesi luminance kullanır. Marka mevcut Logo assetlerinden gelir.
- GSAP + ScrollTrigger native scroll progress’i görünür sahneye ve transform/opacity’ye bağlar. Ürün sahnesinde aynı progress gerçek React form değerlerini, üye görünürlüğünü, görev/status query cache’ini ve formun scrollTop kamerasını yönetir; CMD metin animasyonu DOM üzerinde kalır. Masaüstünde ≥1024×800 viewport için CSS sticky; mobil/kısa ekranlarda normal dikey akış. Reduced motion veya cihazdaki hareket azaltma açıkken uzun animasyonlar kurulmaz. JS veya animasyon chunk’ı olmadan içerik tamamen okunur.
- `LandingPdaDemoProvider` ayrı TanStack Query client’ında statik demo verilerini sağlar; query ve mutation fonksiyonları gerçek API’ye ulaşamaz. Demo `inert` ve aria-hidden bir gerçek uygulama görüntüsüdür; uygulama kontrolleri landing’in tab sırasına veya Ctrl+K kısayoluna katılmaz. Status kaynağı gerçek `TASK_STATUSES` enum’udur: `TODO → IN_PROGRESS → IN_REVIEW → TESTING → DONE`. Gerçek `TasksPage`, `TaskRow` ve status bileşenleri kullanılır.
- CMD komutları Windows prompt ile DOM üzerinde karakter karakter görünür; gerçek `.env` dosyası okunmaz veya değiştirilmez. Transcript örnek kurulum olarak etiketlidir; compose yalnız backend/postgres, frontend ayrı `npm ci` ve `npm run dev` adımlarıyla gösterilir.
- Demo `.workspace-preview` sınıfıyla globals.css içindeki aynı Titanium token bloğunu paylaşır; token değerleri değiştirilemez ve paralel palet kopyası oluşturulmaz. `.app-shell` sınıfı landing köküne eklenmez. CSS contain/viewport ölçeği dışında uygulama geometrisi değiştirilmez. iframe için güvenlik başlıkları gevşetilmez.
- Header logosu aynı asset ile desktop 110px, tablet 90px, mobile 70px genişlikte render edilir; navbar yüksekliği ve asset aspect ratio’su korunur. Header ortak LocaleSwitcher/ThemeToggle kullanır; landing tema kontrolü dashboard, giriş ve public bilgi sayfalarıyla aynı tek görünümdedir, özel boyut override eklenmez. Ortak dairesel tema geçişi ve hareket tercihleri korunur. `LandingFooter` mevcut bilgi rotalarını, iletişimi, README/GitHub/LICENSE hedeflerini içerir; auth ve default SiteFooter’a ek footer konmaz. Olmayan CONTRIBUTING.md veya kök SECURITY.md bağlantısı üretilmez.

## Yeni sayfa veya bileşen eklerken kontrol listesi

Proje logosu kart, oluşturma önizlemesi, detay başlığı ve ayarlarda ortak `ProjectMark` ile çizilir; görsel yoksa/yüklenemezse locale-aware ilk harf gösterilir. Server görsel kaynağı `projectLogoSource` → versioned `projectLogoUrl` akışıdır; invitation ve yerel preview kendi mevcut kaynaklarını korur. Ayarlardaki logo alanı mevcut `SettingsSection`, token'lar ve confirmation standardını kullanır; upload/remove hemen kaydedilir, genel formdaki kaydedilmemiş metinler resetlenmez. Sohbet grubu aynı logo kaynağını kullanır, görsel yoksa mevcut kişi grubu ikonunu korur.

Sohbet full/bar/compact tek provider state'idir. Seçili proje aynı kaldığında genel çalışma alanı sayfalarında da görünüm, konuşma, taslak ve unread korunur. Mesajlaşma düğmesi bulunulan sayfada açar; X sonrası navigasyon açmaz. Gerçek proje/kullanıcı değişimi ve oturum sonu temizler. Browser reload/dil değişiminin tam belge yüklemesi sonrası otomatik yeniden açılma bu persistence kapsamına dahil değildir.

1. `globals.css` dosyasını oku; ihtiyacın olan token zaten var mı bak.
2. Önce `components/ui/` ve `components/common/` içindeki mevcut bileşenleri kullan.
3. Renkleri token sınıflarıyla ver. Yeni token gerekiyorsa `:root` + `.dark` (+ gerekiyorsa `@theme inline`) içine ekle ve bu belgeyi güncelle.
4. Uygulama içi sayfalarda `--auth-*` token'larını ve auth efektlerini kullanma.
5. Light, dark, mobil (390 px) ve reduced motion ile Playwright'ta kontrol et.

### Chat reply / reaction / emoji UI (2026-10-05)

Confirmed mesajlarda Reply/React desktop hover/focus-within, mobile 44px kontrollerle eri?ilir. Quote tek seviyeli plain text; reply iptali text tasla??n? silmez. Escape ?nce picker, sonra reply context, sonra mevcut panel davran???n? t?ketir. Payla??lan Base UI popover composer24 Unicode emoji, reaction6 code sunar; native button group, token renkleri, viewport s?n?r?, focus/caret restore. Yeni paket yok. Chips count/mine/aria-pressed g?sterir; server response/WS snapshot esas, additive optimistic delta yok. Navigation eski trigger'a focus ?almaz; inert layout cleanup ile kald?r?l?r.

### Optional organization association UX (2026-10-05)

Create/settings always expose a none/standalone option using existing Select/tokens and localized labels; UI sentinel maps to omitted create or explicit-null PUT. Current non-owned association label comes from safe Project Home summary, unavailable retained FK is distinct from standalone. Home organization name is a link only with server capability; otherwise plain text. Organization project list has its own loading/error/retry and caller-visible empty copy; retry refreshes page prefixes before last-page clamp. No palette/component library redesign.

## 2026-10-06 Chat action menu / workspace history

Confirmed chat bubble tek absolute chevron taşır; kalıcı own/other gutter metni korur, hover/open ölçüleri değiştirmez. Bubble → reaction chips (mt1/4px) → timestamp; action flow row yok. Existing nonmodal Menu close-complete reply composer veya aynı chevron anchorındaki reaction picker’a focus handoff yapar; Escape önce açık layer’ı tüketir. Composer24/caret ve reaction6/version behavior değişmez. Mobil44px hit area, viewport collision, token/theme/i18n ve native text selection korunur.


## Task form date picker (2026-10-06)

Task create/edit dates use the shared `components/ui/date-picker.tsx`: existing Base UI Popover/Button/Select, Lucide icons and semantic tokens, without a new calendar dependency. TR/EN/DE use Monday-first calendars with month/year navigation, selected/today state and today/clear actions. Local date strings remain YYYY-MM-DD; instant conversion stays in tasks/deadline.ts. Preserve keyboard navigation, focus return, viewport collision/vertical scrolling, the visible footer and form validation when reusing the component.

Month/year controls also use the shared themed Select menus with selected checkmarks, bounded scrolling and named listboxes; do not reintroduce native select popups. Nested Escape dismisses the inner list first. SelectContent accepts optional listProps to label its actual List without changing other consumers.


## Task priority and planning (2026-10-06)

Shared PriorityIndicator uses existing semantic tokens: LOW label-blue, MEDIUM label-orange, HIGH destructive, CRITICAL destructive plus Lucide CircleAlert. Keep accessible localized priority text and the critical shape distinction. No new palette. People assignment excludes the signed-in user from candidate lists; Assign me adds that user explicitly. Pool assignment and calendar-day quick deadlines are common to both task models; SIMPLE sidebars show Pool while advanced-only entries stay hidden.

## Squad modernization UI - 2026-10-06

Existing centered navbar/bell/Popover, ConfirmDialog, Sonner and semantic tokens are reused. Team action is Delete with explicit retained-history/pool effects and inline children/orphan errors. Team cards use scoped newest5 avatar + real-name initials beneath + bounded +N; generic AvatarStack consumers unchanged. Scoped grid items use min-w-0; member row wraps.

Manager invitations preserve semantic desktop table/mobile cards/status/server pages and principal keys. Safe real inviter summaries and exhaustive eight-role Phosphor presenter are shared with the selector. New role badges use content height to prevent long German labels clipping; decorative icons retain accessible text labels,44px form/action targets. TR/EN/DE, light/dark,320/390/768/1024/1440 screenshots and overflow/clipping assertions verified. Error view hides stale invitation rows; dataset shrink clamps to a real server page.

## Personal task cards and status confirmations (2026-10-06)

My tasks uses semantic card/background/border tokens and a responsive square grid (one column, md two, xl three). Task title buttons open the shared detail dialog on the current page; comment actions focus its composer. Preserve localized accessible names, keyboard/Escape focus restoration, URL reload selection and pending/error/retry states. Every task status action requires shared confirmation before mutation; cancellation writes nothing. SIMPLE tasks expose Start/Complete shortcuts; ADVANCED retains review/testing. The navbar notification menu is user-scoped, localized, bounded to the viewport and disabled for the public demo. Optional statusChange snapshots drive start/completion copy; legacy notifications retain a translated type label. Do not add a second palette, detail implementation or notification backend for these surfaces.

## Squad/main notification merge integration - 2026-10-06

NotificationsMenu is a compatibility entry point delegating to the single NotificationCenter/session owner. Actor-scoped AbortSignal/cache cleanup and atomic team-deletion popup claims stay intact. Open own history polls15s; unread count/team claim use30s foreground cadence. Task notifications retain localized start/completion snapshots and relative timestamps, mark read and open the existing task/taskProject dialog URL. Task navigation suppresses old popup focus return; normal Escape restores the bell. Header placement/demo isolation are unchanged. Scoped merged validation: lint/type/build and34 Chromium PASS; existing historical delivery counts are not reused as merge proof.

## Frontend foundation UI - 2026-10-07

Account SettingsSection gains labeled own nickname input/save/cancel with dirty/busy/error associations and44px actions, existing photo/email/password kept. Backend existing alphabet/case/Unicode rules apply; all new copy TR/EN/DE. Navbar stays viewport-centered with existing128/72 reserve; touch now shares700ms idle as explicitly approved. Focus/owned menu/search/drawer prevent hide. History native disabled states expose directional localized safe-boundary/unavailable reasons.

Workspace primary remains monochrome; scrollbar thumb uses existing semantic label-blue through workspace-scrollbar alias, hover palette mix and transparent track. The document root of EVERY page opts in since 2026-10-10 (workspace, landing, login/register/password and public info pages; see "Oturumsuz sayfalar" below), plus actual sidebar/drawer boxes; body inheritance reset stops descendant leakage. Standard thin/color + WebKit fallback, forced-colors auto; no hidden scrollbar or main scroll reparent. Screenshot native viewport thumb paint, both themes/three languages and320-1440 bounds verified; Firefox real visual test not claimed.
## Proje ayarları ve kalıcı silme (2026-10-07)

- **Sayfa:** `PageContainer width="wide"`, `lg` ve üzerinde 7/5 ızgara: solda bölümler, sağda `ProjectPreviewPanel` (`project-preview-panel.tsx`; oluşturma sayfasıyla ortak, gerçek `ProjectCard` `preview` kipinde, `lg` altında formun altına iner). `<form>` ızgaranın kendisidir; sabit kaydet çubuğu (`data-sticky-actions`) tam genişlikte son çocuktur, düğme grubu `flex-wrap` ile 320 px'te taşmaz, `lg` altında "Önizleme" bağlantısı (`#project-preview`) gösterir.
- **Proje hedefi** formda yoktur; kayıtlı metin güncellemede aynen geri gönderilir, genel bakış "Proje profili" bloğu `açıklama || hedef || boş metin` gösterir.
- **Kapak önizlemesi:** `BannerField` kontrollerin üstünde `EntityCover` ile kapağı (yoksa noktalı yedek yüzey) gösterir, `data-testid="project-settings-banner"`.
- **Tarihler** ortak `components/ui/date-picker.tsx` ile seçilir (`Controller`, `YYYY-MM-DD`); başlangıç değişince bitiş sırası yeniden doğrulanır.
- **Teknolojiler:** ayarlarda logo + ad chip'leri ve "Teknolojileri düzenle" ile açılan `ProjectTechDialog` (içinde oluşturma ekranındaki `TechPicker`, seçili gelir, "Uygula" forma yazar, kalıcı kayıt kaydet çubuğuyla). Bu dialog, "Dialog yalnız kısa onay içindir" kuralına kullanıcı kararıyla verilmiş bilinçli bir istisnadır; başka uzun form dialogu için emsal değildir.
- **Silme:** tehlikeli bölge yalnız kurucuya görünür. `ConfirmDialog` `requireText` ile proje adının birebir yazılmasını ister (büyük/küçük harf duyarlı, onay düğmesi eşleşene kadar pasif, kapanınca sıfırlanır); metin neyin gideceğini ve geri alınamadığını söyler. Başarıda toast ve `/projects`.
- **Kart teknoloji şeridi:** tek satır, `size-8` kare logolar, sarma yok (`flex-nowrap overflow-hidden`), kanonik ada göre tekilleştirilir, en çok 6 + `+N`; katalog dışı etiket baş harfli kare olur, ad tooltip'te ve `aria-label`'dedir.

## Notification New/History center - 2026-10-07

Existing nonmodal bell Popover contains New(default)/History Base UI Tabs with manual keyboard activation (arrows focus, Enter/Space select), server pages20 and per-tab loading/error/retry/empty. Individual Check with tooltip/title description and44px targets; global own mark-all header action disabled for pending/unknown/zero. Server-confirmed read reconciles both lists/count; committed refresh failure has GET-only retry. Row-removal focus goes to next/previous action or named empty section only if the user did not move focus; task navigation suppresses old-trigger restore. TR/EN/DE, existing tokens and viewport-centered navbar/reserve retained. No new palette/library or hidden mobile action.

### Notification History delete - 2026-10-10

Only the History tab deletes (New has no delete action). Each read row has a 44px destructive-ghost trash button (Tooltip "Sil", `aria-label` names the notification) that opens an **inline** two-step confirmation inside the row (`role="group"`: "Silinsin mi?" / Vazgeç / Evet, sil; focus starts on Vazgeç, Escape or leaving the row cancels). A modal ConfirmDialog is not used per row because the bell is a nonmodal popover and a modal per row is heavier than a permanent but single-row action needs. The header action "Tümünü sil" (History only, disabled while loading/unknown/empty) uses the shared destructive `ConfirmDialog` ("Geçmiş bildirimleri sil" / "Geçmiş bildirimlerin tamamı silinecek. Bu işlem geri alınamaz."), success toast "{count} bildirim silindi". Deletes go through the shared notification action hook (one single-flight guard, current-account guard, abort on account change), are server-confirmed (no optimistic hiding) and reconcile lists and counts; the existing page clamp moves to the previous page when the last row of the last page is removed. Focus after a row delete goes to the next/previous row's trash button, else the first one, else the History empty section; after delete-all it goes to the History empty section (`ConfirmDialog` `finalFocus`). Failures keep the row/dialog and show `deleteFailed`. TR/EN/DE keys: `notifications.delete*`, `confirm*`, `cancel`, `deletedCount`.
## Depo sayfası (2026-10-07)

- `RepositorySettings` `PageContainer width="wide"` kullanır: başlık kartı (depo adı `safeGitHubLink` ile, varsayılan dal, "ana dala commit gelince üyelere bildirim" notu, yalnız yöneticiye "Bağlantıyı kes") ve altında **Özet / Dallar** sekmeleri. Görünüm ve dal URL'dedir (`?section=repository&view=branches&branch=...`), bağlantı paylaşılabilir ve yenilemede korunur.
- **Özet:** varsayılan dalın son 10 commit'i + dal sayısı + "Dalları incele". **Dallar:** sol/üstte aranabilir dal listesi (`lg` altında üstte), sağda seçilen dalın durumu ("N ileride, M geride"), "Kim ne yapmış" yazar şeridi (yazar düğmesi sunucudan süzer), commit listesi ve Tümü / Ana dala girmemiş / Ana dala girmiş süzgeci.
- **Commit geçmişi sayfalama:** Dallar görünümü "Daha fazla yükle" yerine sunucu tarafı sayfalama kullanır (`components/common/cursor-pagination.tsx`: Önceki · sayfa numaraları · Sonraki; GitHub toplam vermediği için `PaginationBar` kullanılamaz). Sayfa başına 30 commit, en çok 10 sayfa; `GET .../repository/commits?page=&limit=` yanıtındaki `X-Has-Next-Page` başlığı (`apiRequestWithHeaders`) sonraki sayfa var mı bilgisini verir. Sayfa URL'de `?cpage=` (1..10, geçersiz değer 1), dal/görünüm/yazar değişince 1'e döner; yüklenen sayfa eski satırları göstermez (iskelet), denetimler yüklenirken `aria-disabled` olur ve odağı korur. 10. sayfada geçmiş sınırı notu görünür. Özet şeridi/Özet sekmesi son 10 commit olarak kalır; Basit modda ayrı bir geçmiş listesi yoktur (E2E: `commit-pagination.spec.ts`).
- Rozet ve "girmiş" süzgeci yalnız karşılaştırma kesilmemişse (100 commit sınırı) gösterilir; kesildiyse not düşülür, yanlış "ana dalda" etiketi verilmez.
- Durumlar: iskelet, boş, 429 (GitHub sınırı), 404 (dal/depo yok, "ana dala dön"), 503 (tekrar dene). GitHub'a ait hata metinleri `repository.errors.*` altındadır (genel `errors` içindeki 503 e-posta metni burada yanlış olurdu).
- Metinler tr/en/de; yalnız Tailwind token'ları; 390 px'te yatay taşma yoktur (E2E ile doğrulanır). Bildirim merkezi yeni tipi çoğul ICU metniyle gösterir ve projenin depo sayfasına bağlanır (proje slug'ı önbellekteki proje sorgusundan; bulunamazsa bağlantı gizlenir).

## Depo bağlama, modlar ve oluşturma akışı (2026-10-07)

- **Oluşturma ekranı:** "GitHub deposu (isteğe bağlı)" bölümü (`#project-repository-url`); adres yazılınca `RepositoryOptions` açılır (varsayılan Basit, bildirim açık). Gönderimde proje → logo/kapak → depo sırasıyla çağrılır; depo bağlanamazsa proje yine oluşur ve `toast.warning` gösterilir. Başarıdan sonra `router.push` yerine ekip sorusu `Dialog`'u: "Henüz bir proje ekibiniz yok. Şimdi ekip oluşturmak ister misiniz?" → **Evet** `/projects/{slug}/teams/new`, **Hayır** (ve Esc/dışarı tıklama) `/projects/{slug}`; kapatma düğmesi yoktur.
- **`RepositoryOptions`** (`features/repository/components/repository-options.tsx`) oluşturma ekranı ile proje ayarlarının ortak parçasıdır: Basit/Gelişmiş radyo kartları, (i) düğmesi → iki modu anlatan `Dialog`, "Yeni commit'lerde üyelere bildirim gönder" anahtarı (yerel `input[type=checkbox][role=switch]`; base-ui'de Switch yok).
- **Proje ayarları → "GitHub deposu"** (`RepositorySetting`): bağlı değilse adres + seçenekler + "Depo bağla"; bağlıysa depo kartı, seçenekler, "Kaydet" (`PATCH`), "Depo sayfasını aç" ve `ConfirmDialog` ile "Bağlantıyı kes". Ayar formunun içinde olduğundan iç içe `<form>` yoktur, düğmeler `type="button"`, Enter ayar formunu göndermez.
- **Kenar çubuğu kuralı:** "Depo" öğesi yalnız `home.repository.connected` iken görünür. Kenar çubuğu `["projects", id, "home"]` önbelleğini pasif okur (`enabled: false`) ve boşsa bir kez `ensureQueryData` ile doldurur; aktif gözlemci olmadığı için geniş `["projects"]` geçersiz kılmaları ilgisiz sayfalarda `/home` çekmez. Bağla/kes/ayar değişince `invalidateRepository` hem depo hem `home` önbelleğini tazeler.
- **Depo sayfası:** bağlı değilken yöneticiye "Ayarlarda bağla", üyeye yalnız bilgi; bağlıyken mod rozeti, bildirim durumu ve yöneticiye "Depo ayarları" bağlantısı. **Basit:** sekme yok, yalnız ana dalın son commit'leri (dal sayısı satırı gizli, paylaşılmış `view=branches` bağlantısı özete düşer). **Gelişmiş:** Özet / Dallar.
- **Genel bakış şeridi** (`RepositoryStrip`, `aria-label` "Depo takibi"): tek satır, GitHub ikonu, `owner/repo · dal`, son commit (kırpılır, `safeGitHubLink`), yazar ve göreli zaman; GitHub erişilemezse `unavailable`, commit yoksa `noCommits`. Yan paneldeki "Depo" satırı ve hızlı işlem bağlı değilken yalnız yöneticiye görünür ve ayarlara götürür.
- Metinler tr/en/de (`repository.options.*`, `repository.setting.*`, `projects.newPage.teamPrompt.*`, `projects.overview.repositoryStrip.*`); yalnız Tailwind token'ları; 390 px'te yatay taşma yoktur (E2E ile doğrulanır).

## Scoped invitation/create surfaces - 2026-10-08

Viewport-centered navbar and shared header reserve stay unchanged. Teams parent is a native disclosure with canonical existing `?section=teams` / invitations children; collapsed sidebar uses existing Base UI Popover. Reuse semantic primary badges, exact accessible count and bounded99+, 44px touch targets and TR/EN/DE labels. Unknown/error/disabled scope has no fake0 badge. PageHeader optional titleAdornment aligns the shared count next to existing text. Create-banner errors keep the prior valid local image; narrow German320 sticky actions may wrap, preserving sticky-bottom behavior. Global checklist boxes are not inferred from these scoped surfaces.

Shared EntityGrid now declares grid-cols-1 before existing md/xl columns, bounding the implicit small-screen track. Real 320px overflow measured on populated project cards was corrected without changing card content or breakpoints.

## Ortak tarih/saat seçiciler, form doğrulama özeti, organizasyon kartı ve yorum klavyesi (2026-10-09)

- **Tarih/saat seçiciler:** `DatePicker` (`YYYY-MM-DD`) opsiyonel `min`/`max` alır; aralık dışı günler `disabled` ve aria-label'ında `datePicker.outOfRange`, odak aralıkta kalır, Bugün aralık dışıysa pasif. `TimePicker` (`HH:mm`, 24 saat, `minuteStep` varsayılan 5) aynı Popover/Button/token dilini kullanır: saat ve dakika `listbox` kolonları (ok/Home/End/Enter), Şimdi/Temizle alt çubuğu, Escape ile tetikleyiciye odak dönüşü; adım dışındaki kayıtlı dakika (ör. 23:59) listede görünür. Formlarda `Controller` ile bağlanır; hata öğesi id'si `describedBy` olarak verilir. Tam sayfa formda (sprint) ve dialog içinde (çalışma kaydı) çalışır. Hatırlatıcı tarihi/saati ayrı `LocalDate`/`LocalTime` olarak, görev deadline'ı `tasks/deadline.ts` ile Instant olarak gider; bileşen değişimi bu sözleşmeleri değiştirmez.
- **Form doğrulama özeti:** Tam sayfa oluşturma/düzenleme formları başarısız gönderimde inline hataları korur ve yapışkan çubuğun hemen üstünde `components/common/form-error-summary.tsx` (`role="alert"`, destructive token'lı panel, eksik bölüm bağlantıları, ≥44 px hedefler) gösterir. Başarısız gönderimde odak sayfa sırasındaki ilk geçersiz alana gider (ekip standardı); panel odak çalmaz, `role="alert"` ile ekran okuyucuya duyurulur ve her başarısız gönderimde `key={submitCount}` ile yeniden mount edilir, böylece her denemede tekrar okunur. Bölüm bağlantısı `focusFormSection` ile o bölümün ilk `aria-invalid` alanına (radyo grubunda ilk radyoya) kaydırıp odaklar. RHF'de `shouldFocusError: false` kalır; ilk hatalı bölümün odağı, RHF `submitCount` ile errors state'i aynı anda güncellendiğinden `useEffect([submitCount])` içinde `focusFormSection` ile verilir (yazarken odak taşınmaz). Gönder düğmesi panel görünürken `aria-describedby` ile ona bağlanır. Proje oluşturma ve organizasyon formu bu standardı kullanır; yeni çok bölümlü tam sayfa formlar da kullanmalıdır. Tek bölümlü formlar (kriter, sprint) özet paneli göstermez; inline `role="alert"` hataları ve ilk hatalı alana odak aynı ekip standardını sağlar.
- **Yapışkan eylem çubuğu:** `components/common/sticky-form-actions.tsx` (`data-sticky-actions`, safe-area alt boşluğu) ortak sarmalayıcıdır; yeni tam sayfa formlar el yazımı footer yerine bunu kullanır.
- **Kriter ve sprint formları (tam sayfa):** Dialog yoktur. Oluşturma `/projects/[slug]/criteria/new` ve `/projects/[slug]/sprints/new`, düzenleme `criteria/[criterionId]/edit` ve `sprints/[sprintId]/edit` fiziksel sayfalarıdır (TR `kriterler/yeni`, `sprintler/<id>/duzenle`; sanal `?section=criteria` bölüm adresi aynen çalışır). `PageContainer form` + ortak `StickyFormActions`, `beforeunload` koruması; liste ve sprint satırı/detayındaki düğmeler `Link`tir. Tek bölümlü formlarda (kriter: başlık + açıklama; sprint: ad, hedef, tarihler) doğrulama özeti çizilmez: özet tek girdilik bağlantı listesi olurdu; inline hatalar kalır ve RHF varsayılanı `shouldFocusError` ilk geçersiz alana odak verir (DatePicker `ref`i iletir). Kriter başarısında liste ve proje `home` (ilerleme) sorguları geçersiz kılınır; sprint `useTaskMutation` ile tüm görev görünümlerini yeniler. Sprint/kriter yönetimi yalnız proje yöneticisine, sprint ayrıca `ADVANCED`/`BOTH` modeline açıktır; doğrudan adres yetkisiz durumu gösterir (sunucu yetkisi değişmez). Sprint düzenleme başarıda/vazgeçte sprint sayfasına, oluşturma listeye döner.
- **Organizasyon kartı:** `OrganizationCard` proje kartıyla aynı `EntityCard` kabuğunu kullanır (aynı genişlik/yükseklik/başlık bandı; kapak varsa `OrganizationCover` + `bg-background/50` örtü); bölümler gerçek liste alanlarıdır (web sitesi, konum, son güncelleme; boşsa "—"). Yükleme iskeleti ortak `EntityCardSkeleton`'dır.
- **Görev yorumu klavyesi:** Masaüstünde Enter gönderir, Ctrl/Cmd+Enter imlece yeni satır ekler, Shift+Enter yeni satır olarak kalır; IME birleştirmesinde ve @mention listesi açıkken Enter göndermez; boş/bekleyen/basılı tutulan Enter göndermez. Dokunmatik birincil girişte (`hooks/use-touch-primary-input.ts`) Enter yeni satırdır, gönderim Gönder düğmesiyledir; yardım metni cihaza göre değişir ve `aria-describedby` ile bağlıdır.

## Cookie banner, preferences, contact form and admin screens (2026-10-09)

- Cookie banner (`features/consent/cookie-banner.tsx`): a non-blocking panel centred at the bottom (`z-40`; since 2026-10-10 not bottom-left, see "Cookie banner yerleşimi" below), three buttons of the same variant, size and weight (reject, manage, accept), never a dark pattern. While it is shown it publishes its height as `--cookie-banner-offset` and `body` gets that much bottom padding (globals.css), so the last control of any page can be scrolled above it. The preferences dialog uses the shared `Dialog` (focus trap, Escape) with a disabled "necessary" row and an analytics row that starts unchecked.
- Anything that reopens the choice is a real control: footer button (both tones), account-menu item, policy page button; all call `openConsentPreferences`.
- Every "contact" link goes to the contact page (`CONTACT_HREF`); no e-mail address is shown or linked anywhere.
- Contact form: `FormField` and `Textarea`, errors tied to their fields with `aria-describedby`/`role="alert"`, a counter that is hidden from assistive technology, success replaces the form with a focused `role="status"` panel.
- Admin: sidebar and account-menu links appear only for `globalRole === "ADMIN"`; the area guard redirects everybody else before rendering. Users are a `Table` from `md`, a stacked list below; status filter uses the `OptionGroup` radio rows; terminate uses `ConfirmDialog` with `requireText` and says plainly that the action is reversible. Charts are plain SVG (`charts.tsx`), described by a label with the total and a screen-reader table; colours are tokens (`fill-primary`, `bg-label-*`), and the source breakdown always carries text labels. Durations use `Intl.NumberFormat` units ("4 dk 32 sn").
- Tests start from a visitor who already decided (`e2e/consent-state.ts`) so the banner never covers other screens; consent specs start fresh.

## Üye davet et sayfası (2026-10-10)

- **Dialog yoktur.** `AddTeamMemberDialog` kaldırıldı; "Üye davet et" tam sayfa formdur: `/projects/[slug]/team-invitations/new` (TR `ekip-davetleri/yeni`, DE `team-einladungen/neu`). Sanal `?section=invitations` bölüm adresi (`ekip-davetleri`) aynen çalışır; fiziksel `new` sayfası onu yakalamaz. Kenar çubuğunda "Ekip Davetleri" aktif kalır, konum izi Projeler › Proje › Ekip Davetleri › Üye davet et'tir.
- **Girişler:** Ekip Davetleri başlığındaki düğme ve ekip ayrıntısındaki düğme `Link`tir (yalnız yönetici). Ekip ayrıntısından `?team=<teamId>` ile gelinir: ekip kilitli gösterilir (select yok), başarıda ve vazgeçte/geri bağlantısında ekip ayrıntısına dönülür. `?team` yoksa ekip seçilir ve başarı/vazgeç Ekip Davetleri listesine döner (geçmişe değil, adrese bağlı kural). `?team` UUID değilse yok sayılır; projeye ait olmayan UUID sunucuya gider ve 404 satır içi gösterilir (istemci yetkiyi taklit etmez).
- **Bölümler** (çok bölümlü form, `FormErrorSummary` standardı): Ekip, Kişi (PDA kullanıcısı arama / e-posta ile dış davet), Roller ve mesaj. Gönder düğmesi pasif olmaz; geçersiz gönderim hiçbir istek atmaz, ilk geçersiz alana odak verir ve özet gösterir. Sunucu hataları (409 yinelenen/çakışma, 404, 429) sürekli `role="alert"` satır içi kutuda kalır.
- **"Ekibe ekle"** (projede olan aday) form gönderimi değildir: anında `POST …/teams/{t}/members`, sayfada kalınır, toast ve satırın "Ekipte" olması geri bildirimdir.

## Oturumsuz sayfalar, cookie banner, kullanıcı adı metni ve tema performansı (2026-10-10)

### Oturumsuz sayfalarda scrollbar (tek standart)

- Scrollbar standardı her sayfanın **document root**'una (`html`) uygulanır: `globals.css` içindeki tek kural (`html` + `[data-workspace-scroll]`) `--workspace-scrollbar-thumb: var(--label-blue)`, hover için `color-mix`, `scrollbar-width: thin`, şeffaf track ve WebKit yedeği (8px, yuvarlak thumb) kullanır. Önceki `html:has(.app-shell)` koşulu kaldırıldı; Landing, Login/Kayıt/Şifre ve public bilgi sayfaları oturumlu sayfalarla aynı kuralı alır. İkinci palet veya sayfaya özel scrollbar yazma.
- `html > body` ve `[data-workspace-scroll] > *` `scrollbar-color/width: auto` ile miras sıfırlaması yapar; iç kaydırma alanları (textarea, `pre`, dialog, landing demo `<main>`, cookie banner, sohbet) tarayıcı varsayılanında (`auto`) kalır. `forced-colors: active` altında `auto`. Scrollbar gizlenmez.
- Doğrulama: `e2e/workspace-scrollbars.spec.ts` (oturumlu) ve `e2e/public-scrollbars.spec.ts` (Landing/Login/public × light/dark × TR/EN/DE root rengi aynı). Firefox gerçek koşusu yapılmadı; standart `scrollbar-color` kullanıldığı için uyumlu beklenir.

### Cookie banner yerleşimi

- Banner alt-ortadadır: `fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] mx-auto sm:max-w-lg`; mobilde güvenli kenar boşluğu, masaüstünde `max-w-lg` yatay ortada. Davranış (varsayılan analytics kapalı, eşit ağırlıklı düğmeler, tercih penceresi) değişmedi.
- Banner açıkken `<html>` üzerinde `--cookie-banner-offset` (banner yüksekliği + alt boşluk + 12px) ve `data-cookie-banner-open` yayınlanır; kapanınca ikisi de silinir. `body` bu değer kadar alt dolgu alır, böylece sayfanın son kontrolleri banner'ın üstüne kaydırılabilir.
- Login/Kayıt gibi `data-auth-fixed` sayfaları ≥970px yükseklikte normalde `h-dvh overflow-hidden` ile viewport'a kilitlenir (`.auth-shell:has([data-auth-fixed])` kuralı `globals.css` içinde). Banner açıkken `html[data-cookie-banner-open]` bu kilidi **kaldırır**: kolon `min-h-[calc(100dvh - var(--cookie-banner-offset))]` ile banner'ın üstünde biter, gerekirse kayar; footer ve form banner'ın altında kalmaz. Yeni auth düzenleri kilidi Tailwind sınıfıyla değil bu CSS kuralıyla kurmalıdır.
- Ölçüm (1440x1000 Login): içerik ~967px, banner offset ~276px; footer bağlantıları ve form tıklanabilir. `e2e/cookie-consent.spec.ts` Landing/Login/public × 320/390/768/1024/1440 × light/dark için yatay ortalamayı ve erişilebilirliği doğrular.

### Kullanıcı adı ipucu ve doğrulama metni

- Kural (backend `NicknameRules` ile aynı): harf, rakam, tek boşluk, `_` ve `-`; 3-32 karakter; baş/son boşluk kırpılır; art arda boşluk ayrı hatadır. Metin üç yerde aynı sözleşmeyi söyler: `register.nicknameHint`, `validation.nickname` / `validation.nicknameSpaces`, `account.nicknameEdit.hint` / `invalid` / `invalidSpaces` (TR/EN/DE). Biri değişirse üçü birlikte güncellenir; ipucu metni "yalnız harf, rakam ve alt çizgi" demez.
- Tek istemci doğrulayıcısı `features/account/nickname.ts` (`nicknameProblem` -> `"spaces" | "invalid" | null`); kayıt (`schemas.ts`), davetli kayıt ve profil alanı onu kullanır, gönderilen değer kırpılmış değerdir. Sunucu `invalidFields: ["nickname"]` dönerse kayıt formu `validation.nickname` metnini alanın yanında gösterir.
- Kullanıcı adı her yerde düz metin olarak çizilir. Yorumdaki mention chip'i `segment.value`'yu olduğu gibi gösterir (değer zaten `@` içerir; ek `@` yazılmaz, çift `@@` hatası düzeltildi). Mention önerisi tek boşluk içeren sorguyu destekler (art arda boşluk ve satır sonu mention'ı kapatır).

### Tema geçişi performansı

- Tema geçişinde Login'in sonsuz döngüleri (logo elektronları `.logo-current`, neon bandı `.auth-neon-band`, slogan parıltısı `.auth-slogan::after`) daire (`theme-reveal` / `theme-close-in`) oynarken `animation-play-state: paused` olur ve geçiş bitince kaldığı yerden sürer; giriş animasyonlarına dokunulmaz. Yeni sonsuz auth animasyonu ekleniyorsa aynı kurala eklenmelidir. `transition: all` eklenmez; reduced-motion davranışı değişmez.
- Yazılım render tespiti: `lib/rendering.ts` (`detectSoftwareRendering`, `RENDERER_BOOT_SCRIPT`) ve `components/layout/rendering-probe.tsx` (`RenderingProbe`, `AuthShell` içinde). WebGL `failIfMajorPerformanceCaveat` bağlamı reddedilirse ya da yazılım renderer adı (SwiftShader, llvmpipe, softpipe, WARP, "software", "basic render") dönerse `<html data-renderer="software">` yazılır; karar sekme başına `sessionStorage` (`pda:renderer`) içinde tutulur ve root layout'taki boot script ile ilk boyamadan önce uygulanır (flash yok). `html[data-renderer="software"] .auth-neon { display: none }` tam ekran `screen`/`multiply` neon grubunu kaldırır; fotoğraflar aynı kalır. GPU'lu kullanıcılar için görsel değişiklik yoktur. Tespit hata verirse tam sahne korunur.
- Ölçüm gerektiren her yeni tam ekran blend/filtre/backdrop yüzeyi için önce katman probu (yüzeyi tek tek kapatıp kare sayısı) ve yazılım rasterizasyonu (donanım hızlandırması kapalı) ile ölçüm yapılır; GPU'lu makinede 60 fps görmek yeterli kanıt değildir. Ölçüm örneği: `e2e/theme-switch-performance.spec.ts`.
