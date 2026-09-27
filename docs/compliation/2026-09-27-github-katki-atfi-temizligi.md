# GitHub katkı atfı geçmiş temizliği

## Teslim ve durum

2026-09-27 tarihinde GitHub üzerindeki beş dalın commit geçmişinden `Co-Authored-By: Claude Sonnet 5` satırları kaldırıldı. İşlem yalnızca commit mesajlarını ve bunlara bağlı commit kimliklerini değiştirdi; dal uçlarındaki dosya içerikleri aynı kaldı.

## Yapılanlar

- Ayrı `pda-temiz.git` mirror klonunda `git filter-repo --replace-message` ile ortak yazarlık satırları silindi.
- `auth-service-backend`, `auth-service-frontend`, `main`, `project-service-backend` ve `project-service-frontend` dalları kullanıcı tarafından `--force-with-lease` ile GitHub'a gönderildi.
- Uygulama kaynak dosyaları değiştirilmedi. Geçici mirror klonunun yanlışlıkla eklenmesini önlemek için kök `.gitignore` dosyasına `/pda-temiz.git/` kuralı eklendi. Bu kayıt ve `.gitignore` değişikliği henüz GitHub'a gönderilmedi.

## Doğrulama

- `git log --all --regexp-ignore-case --grep='Co-Authored-By: Claude' --oneline`: yeniden yazılmış mirror klonda, `origin` yeniden eklenmeden önce boş çıktı.
- Beş yerel dalın her birinde `git log refs/heads/<dal> --regexp-ignore-case --grep='Co-Authored-By: Claude'`: sıfır eşleşme.
- Her dal için `git diff --quiet refs/remotes/origin/<dal> refs/heads/<dal>`: dosya içeriği farkı yok.
- `./pre-push/pre-push.cmd`: kullanıcı çıktısında `PDA PRE-PUSH CHECK PASSED` ve `Safe to git push.`
- `git push --dry-run --force-with-lease origin 'refs/heads/*:refs/heads/*'`: beş dal için beklenen forced update.
- Kullanıcının gerçek push çıktısı: beş dalın tamamı forced update ile güncellendi.
- `git ls-remote --heads origin`: yeni dal uçları doğrulandı (`main` `a3491fc`, diğerleri `196fb08`, `c913b3e`, `325824e`, `e1817df`).

## Açık konular

- GitHub Contributors istatistikleri önbellekten dolayı yaklaşık 24 saat gecikmeli güncellenebilir.
- GitHub tarafından yönetilen eski pull request referansları ve ekip üyelerinin eski yerel klonları yeniden yazılmadı. Eski geçmiş tekrar merge veya push edilmemelidir.
- `pda-temiz.git/` mirror klasörü Contributors görünümü yenilenene kadar yerelde tutuluyor ve `.gitignore` ile hariç tutuluyor. Görünüm doğrulandıktan sonra klasör silinip geçici ignore kuralı kaldırılmalıdır.
- Yeni commit mesajlarına Claude ortak yazarlık satırı eklenirse atıf yeniden görünebilir.

## Kullanıcı kontrolü

1. GitHub'da `main` ve diğer dört dalın son commit kimliklerinin yukarıdaki yeni uçlarla eşleştiğini kontrol edin.
2. Yaklaşık 24 saat içinde Contributors görünümünde Claude atfının kaybolduğunu kontrol edin.
3. Yerel değişiklikleri koruduktan sonra eski klonları yeni geçmişe eşitleyin; `main` dışında kullanılan dalları da kendi uzak dallarıyla ayrı ayrı eşitleyin.
4. Bu kaydı inceleyin; Contributors görünümü yenilenince `pda-temiz.git/` klasörünü silip geçici `.gitignore` kuralını kaldırın.
