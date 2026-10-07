# Frontend tasarım kuralları

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

Kişi avatarı tek bileşendir: `components/ui/avatar.tsx`. `src` verilirse fotoğrafı çizer, yoksa ya da yüklenemezse baş harfleri gösterir (kırık görsel hiç görünmez); `src` her zaman `features/account/api.ts` içindeki `profilePhotoSrc(userId, profilePhotoVersion)` ile kurulur (`?v=` cache'i kırar). Navbar, ekip ve proje üyeleri, kart/ekip avatar yığınları (`AvatarStack`) ve davet gönderen aynı bileşeni kullanır; yeni bir yerde kişi avatarı gerekiyorsa `Avatar` + `profilePhotoSrc` kullan, ayrı bir baş harf kutusu çizme. Fotoğraf yükleme `/account` sayfasındaki Profil bölümündedir (`features/account/components/profile-photo-field.tsx`): dosya seçilince yalnız önizleme görünür, "Fotoğrafı kaydet" onayıyla yüklenir; yükleme sürerken düğmeler kilitlidir; kaldırma onay ister; istemci ön kontrolü (tür, 5 MB) yalnız gidiş-dönüşü kısaltır, karar sunucudadır. Görev atananları, izleyiciler, yorum yazarları ve `@` öneri listesi de aynı `Avatar` + `profilePhotoSrc` yolunu kullanır (`PersonRef.profilePhotoVersion`, yorumda `authorPhotoVersion`). Takvim/hatırlatıcı kişileri ve çalışma kaydı/ek yükleyen adları henüz fotoğraf taşımaz (ilgili DTO'lara `profilePhotoVersion` eklenince aynı yolla bağlanır). Ekip üyeleri tablosunda e-posta satırı yalnız sunucu `email` döndürdüğünde (üye yönetimi yetkisi) görünür.

### Proje kapak görseli (banner)

Banner yalnız Projeler listesindeki proje kartında görünür (`features/projects/components/project-banner.tsx`; kartın mevcut üst bandının arka planı olarak `object-cover` çizilir, üzerine yazıların okunması için `bg-background/50` örtü gelir; ayrı bir şerit açılmaz, dekoratif `aria-hidden`). Proje sayfasının header'ında, ayarlarda ve davet önizlemesinde banner gösterilmez. Proje oluştururken kapak görseli, logo gibi (`create/banner-pick-field.tsx`, `usePickedImage`) seçilir, seçilir seçilmez canlı önizleme kartının bandında görünür ve proje oluşturulduktan sonra yüklenir (yükleme başarısız olursa uyarı verilir, proje yine oluşur). Banner yoksa band düz renkli kalır. Kalem ikonu her durumda bandın sağ üstünde durur. Yükleme, değiştirme ve kaldırma proje ayarlarında (`banner-field.tsx`) yapılır ve orada görsel önizleme yoktur, yalnız durum metni ve düğmeler bulunur; yalnız `PROJECT_UPDATE` yetkisi, PNG/JPEG/WebP, en çok 2 MB. Kaynak URL `?v=bannerVersion` ile cache'i kırar.

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
- Liste/şema görünümü `Tabs` ile segment olarak sunulur, seçim `?view=` URL'inde ve `localStorage`'da tutulur (storage erişimi try/catch, `useSyncExternalStore` ile okunur). Org şeması saf CSS (`.org-tree`) ve gerçek linklerdir; kütüphane yok.
- Kartın tamamı tıklanabilir (stretched link); düzenle/arşivle ikon butonları `relative z-10` ile link üstünde kalır ve tooltip taşır.
- Veri tablosu: `divide-y`, zebra yok, `md` altında yığılmış liste. Filtre, sıralama ve arama durumu istemcide tutulur. Düzenleme modu tabloya "İşlemler" sütunu ekler; kilitli eylemler nedenini söyleyen tooltip'li kilit ikonu gösterir.

## Görev yönetimi arayüzü

- Linear çizgisi: sakin, yoğun; kartlar yalnız yükseklik anlam taşıyorsa (pano, havuz), liste `divide-y` satırlarıdır. Satır tek büyük tıklama hedefidir (stretched link), durum menüsü `relative z-10` ile bağımsız kalır.
- Etiket renkleri sabit `--label-*` token'larından gelir (`slate, red, orange, amber, green, teal, blue, violet, pink`; `workflow.ts` `labelDotClass`). Serbest hex, `bg-white` ya da `bg-slate-*` kullanılmaz. Durum ve öncelik göstergeleri de `workflow.ts` sınıflarından gelir; renk tek başına anlam taşımaz, her zaman metin ya da `sr-only` karşılığı vardır.
- Deadline tonu: gecikmiş `text-destructive`, 24 saat içinde `text-warning`, diğerleri sessiz.
- Base UI menülerinde `DropdownMenuLabel` her zaman `DropdownMenuGroup` ya da `DropdownMenuRadioGroup` içinde olmalıdır; aksi halde menü çalışma anında hata verir (`tsc` yakalamaz).
- Görev anahtarı uzun olabilir; `truncate` ile kısaltılır ve `title` taşır, başlığı satırdan itmez.
- Pano native HTML5 sürükle-bırak kullanır; her kartın klavye ve dokunmatik alternatifi "Şuna taşı" menüsüdür. Geçersiz sütunlar soluklaşır.
- Filtre durumu URL'dedir (`?status=`, `?tab=`, `?page=`), böylece görünüm paylaşılır ve yenilemede korunur. Arama yazmayı bitirince (300 ms) uygulanır.
- Tarih ve saat için native `date`/`time` girdileri ve hızlı seçimler kullanılır; yeni bağımlılık eklenmez.

## Mesajlaşma paneli

Seçili proje grubunun sonunda (Görev yönetiminden sonra) "Mesajlaşma" düğmesi bulunur (`features/chat/components/chat-nav-item.tsx`; daraltılmış sidebar'da yalnız ikon, okunmamış varsa nokta). Bir bağlantı değil düğmedir: sayfanın üstünde sohbet panelini açar; seçili proje aynıysa genel çalışma alanı sayfalarında da bulunduğu sayfada açar. Rozet projenin okunmamış toplamıdır (sunucu sayar; seçili bağlamın WebSocket bağlantısıyla tüm çalışma alanında canlıdır; bağlantı yokken dakikada bir yenilenir). Bildirim zili ve davet sayacından bağımsızdır.

Panelin üç görünür durumu vardır ve geçişler tek yönlü kurallıdır: `full` → `bar` ("—" düğmesi tam paneli sağ alttaki ince çubuğa küçültür; Escape de aynı; tam paneldeki "×" ise sohbeti tamamen kapatır, sağ alta çubuk bırakmaz), `bar` → `compact` (çubuğa tıklayınca ~360×460 pencere: geçmiş + mesaj kutusu; çubukta etkin konuşmanın yüzü görünür: grup için proje logosu ya da kişiler simgesi, direkt konuşma için kişinin fotoğrafı ya da baş harfleri), `compact` → `bar` ("—") ya da `full` (tam ekran düğmesi); kapatma `full`, `bar` ve `compact` üzerindeki "×" ile yapılır. Etkin konuşma, yüklenen mesajlar, taslaklar ve okunmamış sayıları bu geçişlerde korunur; seçili proje aynıysa tüm authenticated çalışma alanı sayfaları arasında gezerken (ör. Görevler, Takvim, Projeler) küçültülmüş sohbet yerinde kalır. Farklı proje/kullanıcı seçimi, erişim kaybı veya oturum sonu state ve bağlantıyı temizler; X sonrası navigasyon kendiliğinden açmaz. Canlı bağlantı jeton bitmeden kendini yeniler: istemci oturumu bitişten 90 sn önce yeniler (`renewAccessSession`, sekmeler arası Web Locks ile), yeni bir soket açar, o bağlanınca devralır ve eskisini 3 sn sonra kapatır; kullanıcı "bağlantı koptu" göstergesi görmez (`use-chat-socket.ts`). Panel `AppShell`'in yanında (`ChatProvider` + `ChatRoot`) bağlanır, bu yüzden sayfa değişimlerinde yok olmaz.

- **Yerleşim ve z-index.** `full`: sidebar'ın sağında (`lg:left-60`, daraltılmışsa `lg:left-16`), yüzen üst çubuğun altında (`top-[4.5rem]`) `fixed`; z-30 (yapışkan alt çubuklar z-20'nin üstünde, üst çubuk z-40 ve diyaloglar z-50'nin altında). Tam panel açıkken `main` `inert` olur; sidebar çalışmaya devam eder. `bar` ve `compact` sağ altta `fixed`, z-30; telefonda genişliği doldurur (`compact` alttan açılan sayfa gibi, yükseklik 70dvh).
- **Yapışkan kaydet çubukları.** Sayfa altındaki yapışkan kaydet çubukları (görev, proje, ekip, organizasyon, ayarlar formları) `data-sticky-actions` taşır; böyle bir çubuk varken `bar` ve `compact` `[body:has([data-sticky-actions])_&]:bottom-[4.75rem]` ile çubuğun üstüne kalkar ve kaydet düğmesini örtmez. Yeni bir yapışkan eylem çubuğu eklenirse aynı özniteliği taşımalıdır.
- **Duyarlı davranış.** `md` ve üzerinde iki sütun (konuşmalar 20rem + konuşma); altında tek sütun: önce liste, bir konuşma seçilince geri düğmeli konuşma ekranı. Liste ekranındayken gizli konuşma okundu sayılmaz (konuşma bileşeni bağlanmaz).
- **Konuşma listesi.** Proje grubu her zaman ilk satırdır; adı projenin kendi adıdır, projenin logosu varsa avatarı o logodur (yoksa ya da yüklenemezse kişiler simgesi; proje henüz yüklenirken yedek ad "Proje Grubu"), ardından projenin diğer üyeleri (kendin yoktur); satırda `Avatar` + `profilePhotoSrc` (fotoğraf yoksa baş harfler), son mesaj önizlemesi, saat ve okunmamış hap vardır; okunmamış sayısı ekran okuyucuya `sr-only` metinle de verilir. Başka üye yoksa "Bu projede henüz başka üye yok." gösterilir. Satırlar `aria-current` taşıyan düğmelerdir.
- **Mesajlar.** Kendi mesajı sağda (`bg-primary`), karşı taraf solda (`bg-muted`); yalnız tema token'ları kullanılır (sabit renk yok). Saat her mesajda, gün değişince ayraç ("Bugün", "Dün", tarih) bulunur; grupta ilk mesajda gönderen adı ve avatarı görünür. İçerik her zaman düz metindir (`whitespace-pre-wrap`, `break-words`): `dangerouslySetInnerHTML` yoktur, `<script>`/`<img>` metin olarak görünür. Liste en alttayken yeni mesajı izler; yukarı kaydırılmışsa "Yeni mesajlar" düğmesi çıkar ve okuma konumu zorla bozulmaz; en üste gelince eski mesajlar imleçle yüklenir ve kaydırma konumu korunur. `role="log"` + `aria-live="polite"` ile gelen mesajlar duyurulur.
- **Mesaj kutusu.** Enter gönderir, Shift+Enter yeni satır ekler (IME birleştirmesinde göndermez); 2000 karakter sayacı sunucunun kuralını (kod noktası, boşluk ve kontrol karakteri) yansıtır ama karar sunucudadır. Gönderilen mesaj anında "Gönderiliyor…" olarak görünür; başarısız olursa kutuda "Gönderilemedi" + "Tekrar dene" / "Sil" çıkar. Bağlantı koptuğunda kutu devre dışı kalır ve açıklama gösterilir (çevrimdışı kuyruk yoktur). Okundu işareti yalnız konuşma görünürken (`full` ya da `compact`), sekme açıkken ve liste en alttayken, gecikmeli ve mesaj başına bir kez gönderilir.
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

## Proje ayarları ve kalıcı silme (2026-10-07)

- **Sayfa:** `PageContainer width="wide"`, `lg` ve üzerinde 7/5 ızgara: solda bölümler, sağda `ProjectPreviewPanel` (`project-preview-panel.tsx`; oluşturma sayfasıyla ortak, gerçek `ProjectCard` `preview` kipinde, `lg` altında formun altına iner). `<form>` ızgaranın kendisidir; sabit kaydet çubuğu (`data-sticky-actions`) tam genişlikte son çocuktur, düğme grubu `flex-wrap` ile 320 px'te taşmaz, `lg` altında "Önizleme" bağlantısı (`#project-preview`) gösterir.
- **Proje hedefi** formda yoktur; kayıtlı metin güncellemede aynen geri gönderilir, genel bakış "Proje profili" bloğu `açıklama || hedef || boş metin` gösterir.
- **Kapak önizlemesi:** `BannerField` kontrollerin üstünde `EntityCover` ile kapağı (yoksa noktalı yedek yüzey) gösterir, `data-testid="project-settings-banner"`.
- **Tarihler** ortak `components/ui/date-picker.tsx` ile seçilir (`Controller`, `YYYY-MM-DD`); başlangıç değişince bitiş sırası yeniden doğrulanır.
- **Teknolojiler:** ayarlarda logo + ad chip'leri ve "Teknolojileri düzenle" ile açılan `ProjectTechDialog` (içinde oluşturma ekranındaki `TechPicker`, seçili gelir, "Uygula" forma yazar, kalıcı kayıt kaydet çubuğuyla). Bu dialog, "Dialog yalnız kısa onay içindir" kuralına kullanıcı kararıyla verilmiş bilinçli bir istisnadır; başka uzun form dialogu için emsal değildir.
- **Silme:** tehlikeli bölge yalnız kurucuya görünür. `ConfirmDialog` `requireText` ile proje adının birebir yazılmasını ister (büyük/küçük harf duyarlı, onay düğmesi eşleşene kadar pasif, kapanınca sıfırlanır); metin neyin gideceğini ve geri alınamadığını söyler. Başarıda toast ve `/projects`.
- **Kart teknoloji şeridi:** tek satır, `size-8` kare logolar, sarma yok (`flex-nowrap overflow-hidden`), kanonik ada göre tekilleştirilir, en çok 6 + `+N`; katalog dışı etiket baş harfli kare olur, ad tooltip'te ve `aria-label`'dedir.
