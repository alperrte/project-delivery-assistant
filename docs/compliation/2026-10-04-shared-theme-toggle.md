# Dashboard tema kontrolünün site genelinde paylaşılması

## Teslim ve durum

2026-10-04 — Tamamlandı. Dashboard'daki tema kontrolü tek component olarak login, landing, public bilgi, hata ve oturum içi sayfalarda kullanılır.

## Yapılanlar

- [theme-toggle.tsx](../../frontend/src/components/layout/theme-toggle.tsx): auth/app varyantları kaldırıldı. Dashboard'daki kompakt boyut, renkli dolu güneş/ay ikonları ve seçim göstergesi ortak tasarım oldu.
- [globals.css](../../frontend/src/app/globals.css): `.theme-toggle` mevcut Titanium token bloğunu paylaşır; sayfanın paleti kontrolün renklerini değiştirmez. Token değerleri kopyalanmadı/değiştirilmedi. Klavye odağı da tüm yüzeylerde aynı görünür.
- AppHeader, AuthShell, PublicLayout, ErrorFrame ve LandingPage aynı `<ThemeToggle />` kullanır. Yeni bir tasarım değişikliği tek component üzerinden uygulanır.
- Her kontrolün seçim animasyonu `useId` ile izole edildi; landing içindeki inert demo kontrolleri ana kontrolün animasyonunu paylaşmaz.
- Ortak `useThemeSelection` / `playThemeTransition`, sistem tercihi ve reduced motion akışı korunur.
- Tasarım rehberi ve web checklist'in etkilenen klavye notu güncellendi. Proje genelindeki açık checklist maddeleri tamamlandı sayılmadı.

## Doğrulama

- Değişen beş TSX dosyası için `npx.cmd eslint` — geçti.
- `cd frontend; npx.cmd tsc --noEmit` — geçti.
- `node tmp/theme-toggle-qa/qa.cjs` — geçti. Dashboard referans alınarak `/login`, `/faq`, `/`, `/errors/404`, `/settings` kontrolleri 320/390/1440 px ve light/dark temada computed style ile karşılaştırıldı. Route URL'leri doğrulandı; API çağrıları salt okunur fixture ile karşılandı.
- Dashboard, login, FAQ ve landing üzerinde açık/koyu geçişlerinin iki yönü doğrulandı. Landing'de reduced motion altında Enter ile seçim ve animasyonsuz tema değişimi geçti; runtime hatası görülmedi.
- Landing ve dashboard mobil ekran görüntüleri görsel olarak incelendi. QA sırasında Next.js geliştirme araç çubuğu gizlendi; bu ürün arayüzünün parçası değildir.
- `git diff --check` — değişen kaynak/doküman dosyalarında geçti.

## Açık konular

- Tema kontrolü kapsamında açık konu yoktur. Tüm uygulama ekranlarının genel responsive/erişilebilirlik denetimi bu teslimin kapsamı değildir.

## Kullanıcı kontrolü

1. Dashboard, login ve landing sayfalarında tema düğmesini karşılaştırın: aynı boyut, sarı güneş, mavi ay ve seçim göstergesi görünmelidir.
2. Açık/koyu temalar arasında geçiş yapın: animasyon tercihi açıksa aynı dairesel geçiş çalışmalıdır.
3. Hareket azaltma açıkken klavyeyle seçim yapın: tema animasyonsuz değişmelidir.
