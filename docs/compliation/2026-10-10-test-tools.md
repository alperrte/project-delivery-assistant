# Test araçları listesi — 2026-10-10

## Teslim ve durum

Tamamlandı: kısa araç ve kullanım amacı listesi. Araç kurulumu veya audit/test koşumu bu teslimin kapsamında değildir.

## Yapılanlar

- [test-tools.md](../../test-tools.md) oluşturuldu; kod kalitesi, güvenlik, frontend, performans, erişilebilirlik ve yayın öncesi kontroller eklendi.
- Mevcut frontend/package.json, backend/pom.xml ve Playwright yapılandırması incelendi; önerilen araçların resmî kaynakları kontrol edildi.

## Doğrulama

- `Get-Content .agents/SECURITY.md`: shell altyapısı süreç başlatamadığı için çalışmadı; rehberler Node.js fs.readFile ile okundu.
- Node.js fs.writeFile/fs.readFile: araç listesi yazıldı ve içerik birebir doğrulandı.
- Dokümantasyon teslimi olduğundan uygulama testleri çalıştırılmadı; web checklist kutuları değiştirilmedi.

## Açık konular

SonarQube, Cloudflare skill ve diğer yeni araçların kurulumu/entegrasyonu sonraki iştir. Playwright yapılandırması şu anda yalnız Chromium içeriyor; çok tarayıcı kontrolü ayrıca hazırlanmalı.

## Kullanıcı kontrolü

[test-tools.md](../../test-tools.md) içindeki araç ve amaçları inceleyin. Beklenen sonuç: her araç için kısa kullanım açıklaması; yapılmamış taramaların başarılı gösterilmemesi.
