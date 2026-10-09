# Auth backend / frontend branch ayrımı

## Teslim ve durum

2026-10-09: Mevcut commit edilmemiş cookie consent, analytics, admin ve contact değişiklikleri iki yerel branch çalışma ağacına ayrıldı. Commit, push, merge, stash veya staging yapılmadı. Uzak branch'ler değiştirilmedi.

İki çalışma ağacı da mevcut `32babb4` commit'ini temel alır:

- Backend: repo ana klasörü, `auth-service-backend`.
- Frontend: `.branch-worktrees/auth-service-frontend`, `auth-service-frontend`; upstream `origin/auth-service-frontend`.

Yerel frontend branch'i, uzak frontend branch'inin zaten atası olduğu mevcut commit'ten oluşturuldu. Başlangıçta backend upstream'inden 138, frontend upstream'inden 168 commit ilerideydi. Önceden commit edilmiş ortak geçmiş korunmuştur; bu teslim yalnız bekleyen dosya değişikliklerini ayırır. Geçmişteki commitler yeniden yazılmadı veya backend/frontend olarak yeniden sınıflandırılmadı.

## Yapılanlar ve önemli dosyalar

- Backend'e özel 52 dosya: `backend/**` ve `.agents/database.md`; analytics/contact modülleri, admin API/service, auth filtreleri, V62/V63 migration ve testleri.
- Frontend'e özel 274 dosya: `frontend/**`, `.agents/skills/**`, `.agents/frontend-design-rules.md` ve web checklist'i. Yerel skill kaynakları da frontend grubundadır.
- Ortak 10 dosya iki çalışma ağacında aynı içerikle tutuldu: `.agents/SECURITY.md`, `.agents/api.md`, `.agents/folder-structure.md`, `.agents/deployment.md`, `.agents/PDA_Cookie_Analytics_Admin_Contact_Plan_and_Implementation.md`, `PDA_COOKIE_ANALYTICS_ADMIN_CONTACT_PLAN.md`, `.env.example`, `docker-compose.yml`, `docker-compose.e2e.yml`, `docs/compliation/2026-10-09-cookie-analytics-admin-contact.md`.
- Bu ayrım kaydı da iki çalışma ağacına eklendi. Ortak belgelerdeki uygulama/test anlatımı birleşik özellik teslimine aittir; tek başına her branch'in yeni özelliğin tamamını içerdiğini göstermez.
- Gerçek `.env` okunmadı, kopyalanmadı veya değiştirilmedi. Mevcut `.env.example` değişikliği içerik değiştirilmeden korundu.
- Orijinal 336 dosya `.branch-worktrees/.split-backup/files/` altında yedeklendi; `manifest.json` dosyası sahiplik, tracked durumu ve SHA-256 değerlerini içerir.
- `.git/info/exclude` içine `/.branch-worktrees/` eklendi. Yedekler ve iç içe worktree ana repo commit'ine girmez. Bu yerel exclude ayarı başka makinelere aktarılmaz.

## Doğrulama

Çalıştırılan kontroller:

- `git status --short`, `git branch -vv`, `git worktree list`.
- `git rev-list --left-right --count HEAD...origin/auth-service-frontend`: `168 0`; uzak frontend geçmişi mevcut HEAD'in atasıdır. Karşılaştırma mevcut yerel remote-tracking refs ile yapıldı; fetch yapılmadı.
- `git diff --check`: iki çalışma ağacında PASS.
- `git diff --cached --name-only`: iki çalışma ağacında boş.
- Manifest üzerinden Python SHA-256/sahiplik doğrulaması: 336 orijinal dosyanın tamamı korundu; ortak kopyalar birebir aynı; karşı branch'e özel dosyalar commit tabanına döndü veya yalnız doğru grupta kaldı; iki HEAD aynı ve branch adları doğru. PASS.

Kaynak kod değiştirilmediği için bu dosya ayrımında Maven, lint, TypeScript, build, Playwright ve pre-push kapısı yeniden çalıştırılmadı. Önceki birleşik uygulama testleri [özellik teslim kaydında](2026-10-09-cookie-analytics-admin-contact.md) yer alır; bu ayrım için yeni test sonucu sayılmaz.

## Açık konular

- Yeni frontend, backend grubundaki analytics/contact/admin API değişikliklerine bağımlıdır. İki grubun birleşik hali entegrasyon testleri için gereklidir. Frontend worktree'sinin kendi backend dizininde bu yeni API uygulamaları bulunmaz.
- Kullanıcı commitleri sonrasında backend değişiklikleri frontend'e entegre edilerek veya ortak bir entegrasyon branch'inde birleştirilerek tam kalite kapısı çalıştırılmalıdır. Merge ve push bu görev kapsamında yapılmadı.
- Önceden commit edilmiş ve uzak branch'lerde henüz bulunmayan 138/168 commit de olası push kapsamındadır; yalnız bu görevin değişiklikleri değildir.
- Kalite kapısı push öncesinde zorunludur: `.\pre-push\pre-push.cmd`; beklenen çıktı `PDA PRE-PUSH CHECK PASSED` ve `Safe to git push.`.
- Ürün/hukuki açık kararlar, API endpoint detayları ve Swagger kontrol yolu önceki özellik teslim kaydında korunmuştur; bu ayrım yeni endpoint veya güvenlik davranışı eklemedi.

## Kullanıcının manuel kontrol adımları

1. Ana repo klasöründe `git branch --show-current` çalıştır: `auth-service-backend`. `git status --short` içinde yeni backend ve ortak dosyalar görünür; frontend'e özel değişiklik bulunmaz.
2. `.branch-worktrees/auth-service-frontend` klasörüne ayrı terminal/IDE penceresi aç. `git branch --show-current`: `auth-service-frontend`. `git status --short` içinde frontend ve ortak dosyalar görünür; backend'e özel değişiklik bulunmaz.
3. İki tarafta `git diff` ve untracked dosyaları incele. Staging/commit işlemlerini ilgili çalışma klasöründe kendin yap. Ana klasörde frontend branch'ine checkout yapmaya çalışma; o branch ayrı worktree'de açıktır.
4. Commitlerden sonra iki değişiklik grubunun entegrasyonunu ve zorunlu pre-push kapısını tamamla; push işlemlerini kendin yap.
5. Yedek ve manifesti commitlerin doğruluğunu kontrol edene kadar tut. Worktree'yi kaldırman gerekirse Git worktree komutlarıyla yönet; `.branch-worktrees` klasörünü doğrudan silme.
