# Tek ajan çalışma düzeni — 2026-10-24

## Tamamlanan kapsam

Kullanıcının isteğiyle otomatik scout/coder devri kaldırıldı. Çalışan alt ajan durduruldu; bundan sonraki inceleme, kodlama ve doğrulama ana oturumda yürütülür. Kullanıcı açıkça istemedikçe yeni alt ajan başlatılmaz.

## Değişen önemli dosyalar

- `AGENTS.md`: model orkestrasyonu yerine tek ajan çalışma kuralı.
- `.claude/settings.json`: yalnız Explore'u engelleyip scout'a yönlendiren eski düzenin Explore girdisi kaldırıldı; dosya okuma kısıtları korundu.
- `.claude/agents/scout.md`, `.claude/agents/coder.md`: eski özel ajan tanımları kaldırıldı.

## Çalıştırılan doğrulama komutları

- İlgili yönergelerde `rg` ile scout/coder/delegasyon referansları arandı.
- `.claude/settings.json` PowerShell `ConvertFrom-Json` ile doğrulandı.
- `git diff --check`.

## Test/doğrulama sonuçları

Otomatik delegasyon gerektiren yönergeler ve iki özel ajan tanımı kaldırıldı. Uygulama davranışı veya güvenlik dosya okuma izinleri değiştirilmedi. Bu yalnız ajan yönergesi/config değişikliğidir; uygulama testleri çalıştırılmadı.

## Açık kalan konular

Backend servis test menüsü ayrı görev olarak devam ediyor; bu kayıt o görevin tamamlandığını ifade etmez.

## Kullanıcının manuel kontrol adımları

`AGENTS.md` içindeki “Tek ajan ile çalışma” bölümünü inceleyin. Bu repo için yeni oturumlar da bu kurala uymalıdır.
