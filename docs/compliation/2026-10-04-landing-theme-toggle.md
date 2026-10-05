# Landing tema kontrolü uyumu

Bu ilk teslimin yerine kullanıcı tercihiyle dashboard tasarımını tüm sayfalara taşıyan [ortak tema kontrolü teslimi](2026-10-04-shared-theme-toggle.md) uygulanmıştır. Aşağıdaki bilgiler ilk teslimin kaydıdır.

## Teslim ve durum

2026-10-04 — Tamamlandı. Landing header tema kontrolü, giriş ve public bilgi sayfalarıyla aynı ortak görünümü kullanır.

## Yapılanlar

- [landing-page.tsx](../../frontend/src/features/landing/landing-page.tsx): `ThemeToggle tone="auth"` kullanıldı; landing'e özel 44 px buton boyutu kaldırıldı.
- Ortak bileşenin ikonları, seçili durum göstergesi, renkleri ve dairesel tema geçişi kullanılır.
- Web checklist'in etkilenen responsive ve klavye maddeleri gözden geçirildi. Proje genelindeki eksikler için yeni tamamlanma işareti verilmedi.

## Doğrulama

- `cd frontend; npx.cmd eslint src/features/landing/landing-page.tsx` — geçti.
- `node tmp/theme-toggle-qa/qa.cjs` — geçti. Playwright ile `/`, `/login`, `/faq` kontrollerinin boyut, yüzey, ikon ve seçim stilleri 320/390/1440 px ve açık/koyu temada karşılaştırıldı.
- Üç rotada iki yönlü dairesel geçiş; landing'de Enter ile seçim ve reduced motion altında animasyonsuz değişim doğrulandı. Runtime hatası görülmedi.
- Mobil ekran görüntüsü görsel olarak kontrol edildi. Çıktılar `tmp/theme-toggle-qa/` altındadır.

## Açık konular

- Oturum içi uygulama header'ı mevcut kompakt `tone="app"` varyantını kullanmaya devam eder; bu teslim landing kontrolünün giriş ve public bilgi ekranlarıyla eşitlenmesini kapsar.

## Kullanıcı kontrolü

1. `/`, `/login` ve `/faq` sayfalarını açıp tema kontrolünü karşılaştırın: aynı güneş/ay ikonları, boyut ve seçim göstergesi görünmelidir.
2. Açık ve koyu temalar arasında geçiş yapın: animasyon tercihi açıksa ortak dairesel geçiş çalışmalıdır.
3. Hareket azaltma açıkken tema doğrudan değişmelidir.
