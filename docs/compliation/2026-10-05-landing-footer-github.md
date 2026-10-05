# Landing footer GitHub bağlantıları

## Teslim ve durum

2026-10-05 — Tamamlandı. Landing footer'ına login'deki geliştirici profilleri ve kaynak kod sunumu eklendi.

## Yapılanlar

- [landing-footer.tsx](../../frontend/src/features/landing/landing-footer.tsx): ortak `CONTRIBUTORS` listesinden Alper Temiz ve Hamza Taşbay GitHub bağlantıları, login ile aynı GitHub ikonları ve erişilebilir profil etiketleri kullanılır.
- Önceki genel GitHub bağlantısı login'deki gibi “Kaynak kod”, GitHub ikonu, yön oku ve Apache 2.0 etiketiyle sunulur; hedef ortak `REPOSITORY_URL` değeridir.
- [landing.module.css](../../frontend/src/features/landing/landing.module.css): geliştirici bağlantıları dar ekranlarda sarılır. Mevcut doküman, lisans, bilgi ve iletişim bağlantıları korunur.
- Footer checklist notu güncellendi; genel açık maddeler tamamlanmış sayılmadı.

## Doğrulama

- `cd frontend; npx.cmd eslint src/features/landing/landing-footer.tsx` — geçti.
- `node tmp/landing-footer-qa/qa.cjs` — 10 senaryo geçti. Login ve landing bağlantılarının hedefleri, metinleri, erişilebilir isimleri ve ikonları karşılaştırıldı.
- TR için 320/390/1440 px light/dark; EN/DE için 390 px light/dark kontrol edildi. Link hedefleri en az 44 px, klavye odağı görünür, yatay taşma ve runtime hatası yok.
- Mobil koyu tema footer ekran görüntüsü görsel olarak incelendi. Çıktılar `tmp/landing-footer-qa/` altında.
- `git diff --check` — değişen kaynak dosyalarında geçti.

## Açık konular

Bu kapsamda açık konu yok.

## Kullanıcı kontrolü

1. Landing'in en altına kaydırın; Alper Temiz ve Hamza Taşbay bağlantıları GitHub ikonlarıyla görünmelidir.
2. Kaynak kod bağlantısı PDA deposuna, kişi bağlantıları login ile aynı GitHub profillerine gitmelidir.
3. Dar ekranda bağlantılar taşmadan sarılmalıdır.
