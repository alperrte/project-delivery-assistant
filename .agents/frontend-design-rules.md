# Frontend tasarım kuralları

Bu belge PDA frontend'inin görsel dilini özetler: renk paleti (light/dark), yazı tipleri, köşe yarıçapları, ikonlar, hareket ve erişilebilirlik kuralları. Amaç, hangi ajan çalışırsa çalışsın tüm sayfaların aynı sistemle uyumlu kalmasıdır. Süreç (skill'ler, Playwright, audit) için `.agents/FRONTEND_WORKFLOW.md` geçerlidir; bu belge onun "mevcut token'ları koru" adımının içeriğidir.

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
- `next-themes`: `attribute="class"`, `defaultTheme="system"`. Dark tema `<html class="dark">` ile gelir; Tailwind'de `dark:` varyantı `@custom-variant dark (&:is(.dark *))` ile tanımlıdır.
- `motion/react` animasyonlar için, `next-intl` metinler için (`src/i18n/messages/{tr,en,de}.json`).
- Sınıf birleştirme: `cn()` (`@/lib/utils`). Varyantlar: `class-variance-authority`.

## Renk paleti

Tek vurgu rengi elektrik mavisidir (`--primary`) ve her yerde aynı şekilde kullanılır. Camgöbeği (`--live`) yalnızca gerçek bir anlamsal sinyal içindir (aktif/çevrimiçi durum), süs için kullanılmaz. Sıcak kâğıt/pirinç tonları ve mor parıltı kullanılmaz.

### Uygulama genel token'ları

| Token | Light | Dark | Kullanım |
|---|---|---|---|
| `--background` | `#f4f6f9` | `#0b0e14` | Sayfa zemini (`bg-background`) |
| `--foreground` | `#10131a` | `#e7ebf2` | Ana metin |
| `--card` | `#ffffff` | `#12161f` | Kart yüzeyi |
| `--card-foreground` | `#10131a` | `#e7ebf2` | Kart metni |
| `--popover` | `#ffffff` | `#12161f` | Menü, açılır pencere |
| `--popover-foreground` | `#10131a` | `#e7ebf2` | |
| `--primary` | `#1b5fe0` | `#4c8dff` | Tek vurgu: birincil buton, link, odak |
| `--primary-hover` | `#164fbd` | `#6fa3ff` | Birincil hover |
| `--primary-foreground` | `#ffffff` | `#071022` | Birincil üstündeki metin |
| `--secondary` | `#e8ecf2` | `#1a2029` | İkincil buton |
| `--secondary-foreground` | `#10131a` | `#e7ebf2` | |
| `--muted` | `#e8ecf2` | `#1a2029` | Sakin zemin, hover |
| `--muted-foreground` | `#5b6472` | `#8a93a6` | İkincil metin, açıklama |
| `--accent` | `#e8ecf2` | `#1a2029` | Menü öğesi vurgusu |
| `--accent-foreground` | `#10131a` | `#e7ebf2` | |
| `--surface-2` | `#e8ecf2` | `#1a2029` | İkinci seviye yüzey |
| `--destructive` | `#c8323a` | `#ff6b72` | Hata, silme |
| `--success` | `#147a52` | `#3dd598` | Başarı |
| `--warning` | `#a4660b` | `#f5b942` | Uyarı |
| `--border` | `#d8dee8` | `#262d3a` | Varsayılan kenarlık (tüm öğelerde varsayılan) |
| `--border-strong` | `#b8c2d1` | `#374152` | Belirgin kenarlık |
| `--input` | `#d8dee8` | `#262d3a` | Form alanı kenarlığı |
| `--ring` | `#1b5fe0` | `#4c8dff` | Odak halkası |
| `--live` | `#0e8f9e` | `#3ad4e6` | Yalnız aktif/çevrimiçi durumu |
| `--shadow-tint` | `220 30% 25%` | `222 60% 3%` | Gölge tonu (HSL parçaları) |

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
| Login sloganı | Exo 2 | Yalnız `features/auth/components/login-hero.tsx` | Bileşende `exo2.className` |

- Fontlar yalnızca `next/font/google` ile yüklenir; `<link>` veya `@import url(...)` ile font ekleme.
- Başlıklarda `letter-spacing: -0.01em` base katmanından gelir.
- Exo 2 bir vurgu fontudur. Başka bir yerde gerekirse o bileşende yükle; global fonta çevirme.
- Kullanılan ağırlıklar: gövde 400, etiket ve link `font-medium`, başlık `font-semibold`, auth başlıkları `font-bold`.

## Radius, gölge, boşluk

- Taban `--radius: 0.625rem`. Ölçek: `rounded-sm` ×0.6, `rounded-md` ×0.8, `rounded-lg` ×1, `rounded-xl` ×1.4, `rounded-2xl` ×1.8, `rounded-3xl` ×2.2, `rounded-4xl` ×2.6.
- Buton ve alanlar `rounded-lg`, kartlar (`ui/card.tsx`) `rounded-2xl`. Auth kartı istisna olarak `rounded-[1.25rem]`.
- Buton yükseklikleri `button.tsx` içindeki boyutlardan gelir (`h-8` varsayılan, `sm` `h-7`, `lg` `h-9`). Yeni buton boyutu uydurma; varyantları kullan.
- Sayfa başlığı için `components/common/page-header.tsx`, boş durum için `empty-state.tsx`, form alanı için `form-field.tsx` kullan.

## İkonlar

- Uygulama ikonları `@phosphor-icons/react` ile gelir; yeni ikonlar da buradan seçilir. Kalınlık için `weight` (`bold`, `fill`) kullanılır.
- `lucide-react` yalnızca shadcn'in ürettiği `components/ui/*` primitive'lerinde bulunur; uygulama kodunda yeni lucide ikonu ekleme.
- Bayraklar `country-flag-icons` ile gelir.
- Logo: `components/common/logo.tsx`. Görseller `public/images/branding/` altındadır; kullanıcının görsel dosyalarını değiştirme.

## Tema (light/dark)

- Her yeni renk token'ı **hem `:root` hem `.dark`** içinde tanımlanmalı ve genel bir renk ise `@theme inline` içinde `--color-*` olarak bağlanmalıdır.
- Bileşenlerde sabit hex, `bg-white`, `text-black` veya `bg-slate-*` gibi paletten bağımsız renkler kullanma. `bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-muted-foreground`, `bg-primary` gibi token sınıflarını kullan. Auth'a özel değerler için `bg-(--auth-card)` yazımı kullanılır.
- `dark:` varyantını yalnız token'ın karşılamadığı ince farklar için kullan; renkleri token seviyesinde çöz.
- Tema değiştirme `components/layout/theme-switcher.tsx` → `playThemeTransition` (`theme-transition.tsx`) üzerinden geçer: ortadan açılan daire ve küçük güneş/ay. Tema değişimini başka bir yoldan tetikleme.
- `layout.tsx` içindeki `themeColor` değerleri `--background` ile aynıdır (`#f4f6f9` / `#0b0e14`); zemin değişirse ikisini birlikte güncelle.
- Her değişikliği iki temada da kontrol et.

## Hareket ve erişilebilirlik

- Kolay eğri: `cubic-bezier(0.22, 1, 0.36, 1)` (motion'da `[0.22, 1, 0.36, 1]`). Kısa etkileşimler 0.2–0.5 sn.
- Giriş animasyonları `backwards` doldurmayla yazılır. Böylece bittiğinde sayfada kalıcı `transform`/`filter` kalmaz.
- `prefers-reduced-motion`: global kural tüm animasyonları kısaltır. Sürekli dönen döngüler (slogan, neon şerit) `animation: none` ile durur, logo elektronları gizlenir. Yeni bir döngü eklersen onu da bu listeye ekle; motion bileşenlerinde `useReducedMotion()` kullan.
- `forced-colors: active` modunda dekoratif katmanları gizle (slogan örneğine bak).
- Dekoratif kopyalar ekran okuyucuya okunmamalı: `aria-hidden` ya da `content: attr(...) / ""` kullan.
- Odak her zaman görünür olmalı: `focus-visible:ring-*` ile `--ring` veya auth'ta `--glow`.
- Tıklanabilir her yüzeyde imleç `pointer`, disabled öğelerde `not-allowed` olur; bu kural base katmanında hazırdır, bileşende tekrar yazma.
- Metinler `next-intl` ile üç dilde (tr, en, de) tutulur; UI'a sabit metin yazma.
- Sayfa yüksekliği için `min-h-[100dvh]`; yatay taşma olmamalı (`body` `overflow-x-hidden`).

## Yeni sayfa veya bileşen eklerken kontrol listesi

1. `globals.css` dosyasını oku; ihtiyacın olan token zaten var mı bak.
2. Önce `components/ui/` ve `components/common/` içindeki mevcut bileşenleri kullan.
3. Renkleri token sınıflarıyla ver. Yeni token gerekiyorsa `:root` + `.dark` (+ gerekiyorsa `@theme inline`) içine ekle ve bu belgeyi güncelle.
4. Uygulama içi sayfalarda `--auth-*` token'larını ve auth efektlerini kullanma.
5. Light, dark, mobil (390 px) ve reduced motion ile Playwright'ta kontrol et.
