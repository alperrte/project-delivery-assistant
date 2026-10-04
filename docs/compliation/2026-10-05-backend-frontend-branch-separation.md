# Backend / Frontend branch ayrımı

## Teslim ve durum

2026-10-05. Kullanıcının isteğiyle mevcut organization profile/media/notes geliştirmesi ve integration audit düzeltmeleri iki worktree'de commit için hazırlandı. Commit, push, pull, merge ve branch fast-forward yapılmadı. Ana worktree `project-service-frontend`, `.local/backend-source` worktree `project-service-backend` üzerindedir.

## Yapılanlar

- Backend: `backend/**`, `docker-compose.yml`, `.env.example`, `.agents/{SECURITY,api,database,deployment}.md` değişiklikleri backend worktree'sine aktarıldı ve stage edildi. Ana frontend worktree'sindeki bu dosyalar kendi HEAD sürümüne döndürüldü.
- Frontend: `frontend/**`, E2E regresyonları, frontend tasarım/checklist belgeleri ve ortak task/audit planları/raporları ana worktree'de stage edildi. Audit'in unstaged düzeltmeleri de dahil edildi.
- Ortak: `.gitignore` içindeki `.local/` kuralı ve organization mimari/klasör özeti iki branch'e eklendi. Backend klasör dokümanındaki context çakışması mevcut branch metni ve yeni organization bölümü korunarak çözüldü; 9 frontend commit'i backend branch'ine taşınmadı.
- Tüm 77 başlangıç değişikliğinin içeriği, staged/unstaged patch'ler ve original index `.local/branch-split/2026-10-05-020849/` altında yedeklendi. Yedek ve worktree Git dışında tutulur; gerçek `.env`, credentials ve test auth dosyaları stage edilmedi.

## Doğrulama

- Backend kaynak/config aktarımı yedekle içerik bazında karşılaştırıldı; frontend/common dosyalarının SHA256'ları aynı kaldı. Branch HEAD'leri değişmedi.
- İlk aktarım doğrulamasından sonra `git diff --cached --check` iki mevcut biçim uyarısı buldu: frontend EntityMark EOF boş satırı kaldırıldı; backend V53 CRLF satır sonu LF oldu. Yalnız bu iki dosyada biçim değişti; kod/SQL semantiği korunur. Son staged whitespace kontrolü iki worktree'de de temiz.
- Frontend index'inde backend kod/config değişikliği yok; backend index'inde frontend kodu yok. Unmerged kayıt bulunmuyor. Staged/working-tree içerikleri eşleşiyor.
- Bu işlem kaynakları değiştirmediği için testler tekrar çalıştırılmadı. Önceki [birleşik kaynak audit'i](2026-10-05-backend-integration-mock-audit.md) 415 backend + 182 Chromium ve 1 expected skip ile geçti; bu sonuç ayrılmış branch'lerin tek başına aynı entegrasyon kapsamını içerdiği iddiası değildir.

## Açık konular

İki branch birbirinin yeni dosyalarını içermez. Yeni frontend organization alanları yeni backend API/migration'larına ihtiyaç duyar. Çalışan Docker/Next servisleri durdurulmadı veya yeniden oluşturulmadı. Ana dizindeki backend kaynakları eski HEAD'e döndü; bu dizinden `docker compose up --build` çalıştırmak yeni backend geliştirmesini kullanmaz. İlgili branch'ler birleşmeden ana dizin build'ini güncel backend sanma. Backend'in yeni kaynakları `.local/backend-source/backend` içindedir.

Backend worktree'si ayrı eski frontend kaynaklarını içerir; önceki tam gate birleşik kaynak üzerinde çalışmıştır. Her push öncesindeki gate'in doğru frontend/backend kaynaklarıyla çalıştığı ayrıca doğrulanmalıdır. Bu ayırma işleminde gate atlama veya hook değişikliği yapılmadı.

## Kullanıcı kontrolü

Sonraki kullanıcı isteğiyle iki kapı yeniden çalıştırıldı ve PASSED oldu. Tam kaynak seçimi, ilk 429 engeli, final sonuçlar ve mevcut npm uyarıları: [pre-push doğrulama kaydı](2026-10-05-split-branches-pre-push.md). Yukarıdaki "testler tekrar çalıştırılmadı" yalnız ayırma işleminin ilk teslim anını anlatır.

1. Ana dizinde `git branch --show-current` → `project-service-frontend`; `git diff --cached --name-only` frontend ve ortak belgeleri göstermeli.
2. `.local/backend-source` dizininde aynı komut → `project-service-backend`; staged liste backend/storage/config ve ilgili belgeleri göstermeli.
3. Her terminalde hazır staged dosyaları `git commit -m "..."` ile commit et; ek `git add .` gerekmiyor. Push işlemleri kullanıcıya bırakıldı.
4. Worktree, commit/push doğrulanmadan kaldırılmamalı. Ayrı worktree açık olduğu sürece ana dizinde backend branch'ini checkout etmek yerine bu dizini kullan.
