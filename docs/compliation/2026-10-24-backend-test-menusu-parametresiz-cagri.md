# Backend test menüsü — parametresiz çağrı düzeltmesi

## Tamamlanan kapsam

Kullanıcının `pre-push` dizininden `.\backend-tests.cmd` çağrısında menünün açılmadan “Select at least one service or -All” hatasına düşmesi giderildi.

## Değişen önemli dosyalar

- `pre-push/backend-tests.ps1`: `[string[]]$Service` parametresinin varsayılanı açıkça `@()` yapıldı. PowerShell 5.1'de `@($null).Count` bir olduğundan eski başlangıç koşulu verilmemiş parametreyi seçim varmış gibi değerlendiriyordu.
- `pre-push/tests/backend-tests.tests.ps1`: gerçek giriş dosyası `pre-push` çalışma dizininde parametresiz alt süreç olarak çağrılıp menü dalına girdiğini doğrulayan üç kontrol eklendi. Redirect edilmiş stdin'de güvenli yönlendirme mesajı beklenir; servis seçimi hatası kabul edilmez.
- Önceki menü teslim kaydına bu takip doğrulamasının bağlantısı eklendi.

## Çalıştırılan doğrulama komutları

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File pre-push/tests/backend-tests.tests.ps1
# Gerçek etkileşimli terminalde, çalışma dizini pre-push:
.\backend-tests.cmd
# Menüde 0 ile çıkış
.\backend-tests.cmd -DryRun
# Menüde 1,3 ile çoklu seçim
git diff --check
```

## Test/doğrulama sonuçları

- **40 runner kontrolü PASS.**
- Parametresiz `.cmd` gerçek PTY terminalinde 16 servis, tüm backend ve çıkış seçeneklerini gösterdi; `0` exit 0 verdi.
- Etkileşimli kuru koşumda `1,3` seçimi task+squad kapsamını açtı: 16 kendi + 9 ilişkili + 2 ortak = 27 sınıf, exit 0.
- PowerShell parser ve whitespace kontrolü başarılı.
- Bu giriş/menü düzeltmesinde Maven, Docker, uygulama testleri veya tam pre-push çalıştırılmadı. ENV dosyalarına dokunulmadı.

## Açık kalan konular

Bu hata için açık konu yok. Diğer servislerin gerçek test süreleri önceki teslimdeki doğrulama sınırlarıyla aynıdır.

## Kullanıcının manuel kontrol adımları

Aynı `pre-push` terminalinde `.\backend-tests.cmd` komutunu yeniden çalıştırın. Önce yalnız seçim listesini denemek için `.\backend-tests.cmd -DryRun` kullanabilirsiniz.
