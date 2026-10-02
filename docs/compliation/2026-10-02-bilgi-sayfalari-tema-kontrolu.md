# Bilgi sayfalarında ortak tema kontrolü

## Teslim ve durum

2 Ekim 2026 — SSS, KVKK, Gizlilik Politikası ve Erişilebilirlik sayfalarının tema kontrolü login sayfasıyla aynı hale getirildi. Commit veya push yapılmadı.

## Yapılanlar

- [PublicLayout](../../frontend/src/app/(public)/layout.tsx) içindeki açılır `ThemeSwitcher`, login'in kullandığı `ThemeToggle tone="auth"` ile değiştirildi. Dört sayfa bu ortak layout'u kullanır.
- Güneş/ay ikonları, kontrol boyutları, renkler, kayan seçim göstergesi, dairesel tema geçişi ve azaltılmış hareket davranışı aynı bileşen ve tema seçim akışından gelir.
- [Tasarım kuralları](../../.agents/frontend-design-rules.md) kullanıcının bu kontrol için istediği auth token istisnasını belirtir.
- Footer arka planına dokunulmadı; görseli footer'da daha belirgin göstermeye ilişkin karar kullanıcıya bırakıldı.

## Doğrulama

Frontend dizininde:

- `node node_modules/typescript/bin/tsc --noEmit` — başarılı.
- `node node_modules/eslint/bin/eslint.js "src/app/(public)/layout.tsx"` — başarılı.
- Çalışan geliştirme sunucusunda Playwright ile `/login`, `/faq`, `/kvkk`, `/privacy`, `/accessibility` kontrol edildi. Tema kontrolünün açık temadaki ölçüleri, zemin/kenarlık renkleri, ikon boyutları ve düğme renkleri login ile eşleşti. Her sayfada koyuya ve açığa geçiş, seçili düğme durumu ve iki gerçek View Transition çağrısı doğrulandı.
- Dört bilgi sayfasında 320 ve 390 px genişliklerde koyu tema ve azaltılmış hareket kontrol edildi: yatay taşma yok; kontrol ve header bağlantıları ekran sınırında kalıyor; azaltılmış hareket altında View Transition çağrısı yapılmıyor.
- Mobil koyu tema görsel olarak incelendi. Tarayıcı sayfa hatası görülmedi.

## Açık konular

Footer arka planının görselle bütünleştirilmesi bu teslim kapsamında uygulanmadı; kullanıcı tercihi bekleniyor.

## Kullanıcı kontrolü

1. Login ve dört bilgi sayfasını aç.
2. Güneş/ay kontrolünün aynı görünümde olduğunu kontrol et.
3. Açık ve koyu tema arasında geçiş yap; kayan göstergeyi ve dairesel geçişi karşılaştır.
4. Mobil genişlikte kontrolün ve sayfanın yatay taşmadığını doğrula.
