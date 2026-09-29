# Navbar + sidebar yenilemesi

## Teslim ve durum

29 Eylül 2026 — frontend teslimi tamamlandı. Sidebar logosunun kırpılma/hizalama sorunu giderildi; navbar cam görünümlü, viewport'a göre ortalanan, otomatik gizlenen küçük bir hap yapıya taşındı; genel arama modalsız hale getirildi; tema geçişi tek tıkla animasyonlu oldu; bildirim ikonu sidebar'dan navbar'a taşındı; daraltılabilir sidebar ve aktif öğe vurgusu eklendi. Auth/login ekranları ve hesap menüsü dokunulmadan korundu.

## Yapılanlar

- [Logo](../../frontend/src/components/common/logo.tsx): `compact` modda wordmark `clip-path` ile alt taglinei kutu sınırında kesiyor; sidebar logo bağlantısı ortalanmış (`app-shell.tsx`), daraltılmış sidebar'da emblem ortada.
- [AppHeader](../../frontend/src/components/layout/app-header.tsx): `position: fixed` ile tarayıcının gerçek viewport'una göre ortalanan, breakpoint'e göre daralan (`sm` 560 px · `lg` 440 px · `xl` 620 px · `2xl` 760 px, en geniş — açık — sidebar durumuna göre boşluk bırakacak şekilde) küçük bir cam hap; `bg-background/70` + `backdrop-blur-xl`, `supports-[backdrop-filter]` düşüş desteği; [useAutoHide](../../frontend/src/components/layout/use-auto-hide.ts) ile 2.5 sn boşta / aşağı scroll'da gizlenme, üst 24 px bölge / yukarı scroll / odak / Ctrl-Cmd+K ile geri gelme; dokunmatikte yalnız scroll davranışı; gizliyken üstte ince tutamak. Açılış/kapanış `translate`+`scale`+`opacity` üzerinden 500 ms `ease-out` ile birlikte yumuşakça geçiyor (Tailwind v4'te `translate-y-*`/`scale-*` yerel `translate`/`scale` özelliklerini kullandığından, `transition` listesinde bunların da adı geçmesi gerekiyor — yalnız `transform,opacity` yazmak konum/boyutu geçişsiz bırakıyordu). Mobilde arama-ikon/dil/bölücü daraltılarak 390 px'te üst üste binme giderildi.
- [GlobalSearch](../../frontend/src/components/layout/global-search.tsx): eski `project-search.tsx` (modal) kaldırıldı; navbar'a gömülü, ARIA combobox deseniyle (`role="combobox"`, `aria-activedescendant`, `role="listbox"`) Sayfalar/Projeler/Organizasyonlar gruplu sonuç paneli; Ctrl/Cmd+K odaklıyor, ok tuşları/Enter/Escape (iki aşamalı: önce temizle, sonra kapat) çalışıyor, dışarı tıklama kapatıyor; mobilde büyüteç ikonu ile açılan tam genişlik input.
- [ThemeToggle](../../frontend/src/components/layout/theme-toggle.tsx): `tone="app"` eklendi (auth ekranındaki `tone="auth"` değişmedi); [theme-switcher.tsx](../../frontend/src/components/layout/theme-switcher.tsx)'teki `selectTheme` seçilen tema işletim sistemi tercihiyle aynıysa `localStorage.theme` değerini `"system"` yapıyor, farklıysa sabitleyip `playThemeTransition` daire-açılış animasyonunu oynatıyor.
- Bildirimler: sidebar'daki "Bildirimler" satırı kaldırıldı; navbar'a `Bell` ikonlu menü eklendi (boş durum: "Henüz bildirim yok."), backend bağlanana kadar sabit.
- [AppShell](../../frontend/src/components/layout/app-shell.tsx) + [ProjectSidebarNav](../../frontend/src/components/layout/project-sidebar-nav.tsx): masaüstünde daraltılabilir sidebar (`w-60` ↔ `w-16`), tercih `localStorage` (`pda:sidebar-collapsed`) ile korunuyor; daraltılmışken ikon+`aria-label`, proje harf avatarı kalıyor; [nav-item.ts](../../frontend/src/components/layout/nav-item.ts) ortak `navItemClass` ile aktif öğede sol aksan çizgisi.
- Erişilebilirlik: saf dekoratif ikonlara (`List`, `Bell`, `SignOut`, tema `Sun`/`Moon`, dil oku `CaretDown`) `aria-hidden="true"` eklendi; sidebar ikonlarındaki mevcut örüntüyle tutarlı hale getirildi.
- TR/EN/DE `workspace` anahtarları: `searchPlaceholder`, `searchGroups.*`, `clearSearch`, `retry`, `loadError`, `noNotifications`, `collapseSidebar`/`expandSidebar` eklendi; eski `searchHint` kaldırıldı.
- `.agents/frontend-design-rules.md` "Oturum içi sayfaların düzeni" bölümü yeni navbar/sidebar davranışını yansıtacak şekilde güncellendi.

## Doğrulama

`frontend` dizininde:

| Komut | Sonuç |
|---|---|
| `npx eslint src` | Başarılı |
| `npx tsc --noEmit` | Başarılı |

Docker compose ile backend ve `npm run dev` ile frontend çalışırken, giriş yapılmış Playwright oturumuyla 1440 px ve 390 px, light + dark temada:

- Sidebar logosu ortalı, tagline görünmüyor; daraltılmış sidebar'da emblem ortalı.
- Header ~2.5 sn boşta kaldıktan sonra yukarı kapanıyor; imleç üst 24 px bölgeye gelince veya yukarı scroll'da geri geliyor; arama/dropdown açıkken kapanmıyor; odaklanınca görünüyor; mobilde scroll-only davranış.
- Ctrl/Cmd+K arama input'una odaklanıyor; yazınca gruplu sonuçlar geliyor; ok tuşları/Enter/Escape (iki aşamalı) çalışıyor; hiçbir noktada modal/dialog açılmıyor.
- Tema pill'ine tek tık: OS tercihinden farklı seçimde daire-açılış geçiş animasyonu oynuyor; OS ile eşleşen seçimde `localStorage.theme === "system"` oluyor.
- Bildirim zili yalnız navbar'da, sidebar'da yok; sidebar'ı daralt → sayfayı yenile → tercih korunuyor; aktif menü öğesinde sol aksan çizgisi var.
- 1920×1080'de header'ın gerçek viewport'a göre ortalandığı `getBoundingClientRect()` ile doğrulandı (kaydırma çubuğunun birkaç piksellik payı dışında merkezde, açık sidebar'dan 330 px+ boşluklu); 1440 px (`xl` kırılımı) ve 390 px'te de sidebar çakışması/taşma yok.
- `prefers-reduced-motion` emülasyonunda geçişler anlık; konsol hatası yok, yatay taşma yok (`globals.css` içindeki site geneli `@media (prefers-reduced-motion: reduce)` kuralı tüm animasyon/transition sürelerini sıfırlıyor).
- 390 px'te navbar'daki arama ikonu/dil seçici/ayraç arasında görülen üst üste binme (flex `min-w-0` kaynaklı) giderildi; `getBoundingClientRect()` ile ölçülüp doğrulandı.
- `web-design-guidelines` denetimi (Vercel web-interface-guidelines listesine göre) yapıldı: dekoratif ikonlarda eksik `aria-hidden="true"` bulundu ve düzeltildi (`app-header.tsx`, `theme-toggle.tsx`, `locale-switcher.tsx`); form/odak/hover/i18n/hydration kontrollerinde başka anlamlı bulgu çıkmadı.

## Açık konular

- Next.js 16, `middleware.ts` dosyasını `proxy.ts` olarak yeniden adlandırdı; önceki güvenlik teslimindeki `frontend/src/middleware.ts` ayrı bir işte taşınmalı (bu teslimin kapsamı dışında).
- Hesap menüsü tasarımı bu teslimde değiştirilmedi (kullanıcı tarafından onaylanmadı).
- Yeni backend endpoint, migration veya ortam değişkeni yok. Git commit/push yapılmadı.

## Kullanıcı kontrolü

1. Giriş yapın; sidebar logosunun ortalı ve tagline'ın kırpılmadan taşmadığını kontrol edin (açık ve daraltılmış sidebar'da).
2. Sayfada birkaç saniye hareketsiz kalın; navbar'ın yukarı kapandığını, imleci üst kenara götürünce geri geldiğini gözlemleyin.
3. Ctrl/Cmd+K'ye basıp bir proje/organizasyon adı yazın; gruplu sonuçların göründüğünü ve ok tuşlarıyla gezilip Enter ile açılabildiğini doğrulayın.
4. Navbar'daki tema düğmesine tıklayın; animasyonun oynadığını ve seçili durumun net göründüğünü kontrol edin.
5. Navbar'daki zil ikonuna tıklayın (sidebar'da artık yok).
6. Sidebar'ı daraltın, sayfayı yenileyin; daraltılmış halin korunduğunu doğrulayın. Aktif menü öğesinde sol çizgiyi kontrol edin.
7. 390 px genişlikte navbar'daki arama/dil/tema/bildirim ikonlarının üst üste binmeden yan yana durduğunu kontrol edin.
