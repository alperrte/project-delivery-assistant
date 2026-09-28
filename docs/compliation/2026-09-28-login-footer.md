# Login footer

## Teslim ve durum

2026-09-28 tarihinde login sayfasına `© 2026 PDA — Project Delivery Assistant · GitHub · Apache 2.0` metnini gösteren sade footer eklendi. GitHub bağlantısı projenin GitHub deposuna gider.

## Yapılanlar

- [Login sayfası](../../frontend/src/app/(auth)/login/page.tsx): auth kartının altında footer, GitHub bağlantısı, mini GitHub ikonu, Apache 2.0 yanında lisans belgesi ikonu, hover ve klavye odak stili. ASF logosu lisans işareti olmadığı ve üçüncü taraf ürün markası yanında kullanımı kısıtlandığı için kullanılmadı.
- [TR](../../frontend/src/i18n/messages/tr.json), [EN](../../frontend/src/i18n/messages/en.json), [DE](../../frontend/src/i18n/messages/de.json): footer metinleri mevcut `next-intl` düzenine eklendi.
- Yeni CSS token'ı veya bağımlılık eklenmedi; mevcut auth renkleri kullanıldı.

## Doğrulama

- `npm.cmd run lint -- --quiet` (frontend): başarılı.
- `git diff --check`: başarılı.
- `http://localhost:3000/login` HTTP yanıtı: `200`; footer içinde iki SVG ikon, telif metni, `Apache 2.0` ve GitHub repo bağlantısı mevcut.
- `npx.cmd tsc --noEmit`: mevcut yerel kurulumda `@playwright/test` bulunmadığı için E2E dosyalarında başarısız; footer dosyalarında hata raporlanmadı.
- Görsel tarayıcı kontrolü: bu oturumda Computer Use bağlantısı/tarayıcı bulunmadığı için yapılamadı.

## API

Yeni veya değişen API endpoint'i yok.

## Açık konular

- Footer yalnızca login sayfasında gösterilir; diğer auth sayfalarına eklenmedi.
- Yerel `@playwright/test` bağımlılığı tamamlandığında TypeScript kontrolü yeniden çalıştırılmalı.

## Kullanıcı kontrolü

1. `http://localhost:3000/login` sayfasını açın. Kartın altında GitHub yazısının solunda küçük GitHub işaretini, Apache 2.0 yanında lisans belgesi simgesini ve footer metnini kontrol edin; dar ekranda satır kırılabilir, yatay taşma olmamalıdır.
2. Açık ve koyu temada metnin okunabildiğini ve GitHub bağlantısının klavyeyle odaklanabildiğini kontrol edin.
3. GitHub bağlantısına tıklayın; `https://github.com/alperrte/project-delivery-assistant` açılmalıdır.
