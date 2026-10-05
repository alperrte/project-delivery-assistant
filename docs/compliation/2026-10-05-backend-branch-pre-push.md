# Backend worktree — pre-push doğrulaması

## Teslim ve durum

2026-10-05. Kullanıcının commit/push öncesi isteğiyle iki worktree'nin pre-push adımları tamamlandı. Commit/push/pull/merge yapılmadı; testler boyunca tracked dosyalar, index diff hash'leri ve HEAD'ler değişmedi. Bu kayıt test tamamlandıktan sonra eklendi.

## Kaynak ve çalışma yöntemi

- Backend kapısı: `project-service-backend`, `.local/backend-source`; kendi backend ve eski frontend kaynakları.
- Frontend kapısı: `project-service-frontend`, ana worktree; kendi backend Maven kaynakları ve güncel frontend. Browser ve Docker adımları yeni API'yi içeren backend worktree'sini kullandı.
- Orijinal `pre-push/pre-push.ps1` adımları özel, Git dışındaki runner kopyalarında çalıştı. Yalnız runner root ve mevcut gerçek ENV'nin okuma yolu uyarlandı; tracked betikler değiştirilmedi. Gerçek `.env` backend worktree'sine kopyalanmadı veya değiştirilmedi.
- Compose, staged backend `docker-compose.yml` içeriğinden özel QA dosyasına alındı; yalnız `build.context` ve `env_file` mutlak gerçek kaynak yollarına çevrildi. `COMPOSE_FILE`, `COMPOSE_ENV_FILES`, `COMPOSE_PROJECT_NAME` sadece test sürecinde ayarlandı. Existing service/volume ve security değerleri korundu. Böylece frontend kapısının son Docker adımı eski backend'i build etmedi.
- Çalıştırılan komutlar: `python .local/prepare-split-gates.py`; `powershell -NoProfile -ExecutionPolicy Bypass -File .local/run-split-gates.ps1`; frontend tekrarında aynı komut + `-FrontendOnly`; son `python .local/check-split-gates.py`. Bu özel runner'lar `.local/split-pre-push/` evidence ile Git dışındadır. Maven clean verify, npm ci (gerektiğinde), lint, TypeScript, production build, tüm Chromium E2E, Docker build/start ve health adımları atlanmadı.

## Doğrulama sonuçları

| Worktree kapısı | Maven | Chromium | Diğer kontroller | Sonuç |
|---|---|---|---|---|
| Backend | 415 passed, failure/error/skip=0 | 139 passed, 1 expected skip | lint, TypeScript, production build, Docker smoke | PASSED, exit 0 |
| Frontend (final tekrar) | 404 passed, failure/error/skip=0 | 182 passed, 1 expected skip | lint, TypeScript, production build, Docker smoke | PASSED, exit 0 |

Tek expected skip production'da kapalı kontrollü crash route testidir. Backend worktree'sinin eski frontend'i 139 case, güncel frontend 182 case içerir; sayılar aynı suite gibi karşılaştırılmamalı. Güncel frontend'in organization 101. picker/cache ve chat overlap unread regresyonları final suite'te çalıştı. Backend415 ve frontend404 Maven sayısı da kendi checkout'larındaki kaynak/test farkıdır.

Özel kanıtlar: `backend-gate.log`, `frontend-gate.log`, `source-before.json`, `verification.json`, `backend-prepare.log`. Son kontrolde iki worktree'nin HEAD/index/working-tree değişmemişti ve changedFiles listeleri boştu. Bu doğrulama kayıtları eklenirken yalnız dokümantasyon stage edildi; test edilen kaynaklar değiştirilmedi.

## Başarısız denemeler ve kök neden

1. İlk özel sarmalayıcı normal Docker stderr progress'ini PowerShell exception saydı; testlere geçmeden durdu. Özel wrapper exit-code kontrolüne düzeltildi; tracked script/kod değiştirilmedi.
2. İlk frontend suite: 162 passed, 1 failed, 1 expected skip, 19 did not run. `17-project-chat` beforeAll outsider registration, gerçek `POST /api/v1/auth/register`429 nedeniyle app shell'e ulaşamadı; serial kalan sohbet testleri çalıştırılmadı. Bunlar başarı sayılmadı. `first-failure-network.json` ve `first-failure-context.md` gerçek 429/UI rate-limit kanıtıdır; `frontend-gate-first.log` saklandı.
3. Arka arkaya suite'lerin auth budget'ı ortak backend'de birikti. `AuthRateLimitFilter` IP denemelerini 10 dakikalık in-memory map'te tutar. Yerel backend restart ile sayaç temizlendi; ENV/rate limit/CSRF/CORS/authorization değiştirilmedi. Frontend'in tüm kapısı yeniden çalıştırıldı ve geçti. Next test sırasında geçici durduruldu; sonunda ana frontend dev sunucusu geri açıldı. Volume/kullanıcı verileri silinmedi.

## Açık konu — npm dependency uyarıları

Her iki frontend için salt okunur `npm audit --json` 8 high, 0 critical paket uyarısı; `npm audit --omit=dev --json` 6 high bildirdi. Uyarılar değişmeyen mevcut package/lockfile'lara aittir; bu branch ayırma veya test işlemi dependency eklemedi/güncellemedi.

Paketler: `@next/eslint-plugin-next`, `eslint-config-next`, `@ts-morph/common`, `braces`, `fast-glob`, `micromatch`, `shadcn`, `ts-morph`. Omit-dev kalanlar son altı pakettir. Npm severity/package grafiği browser bundle'da kullanılabilir açık kanıtı değildir; bütünlüğüyle raporlandı. `npm audit fix`/`--force` çalıştırılmadı; paket/lockfile değiştirilmedi. Bazı otomatik öneriler major sürüm değişimi/downgrade içeriyor; ayrı dependency incelemesi gerekiyor. Kapı bu audit uyarılarını başarısızlık kriteri yapmaz; PASSED bu uyarıların kapandığı anlamına gelmez. JSON kanıtları `.local/split-pre-push/*npm-audit*.json` içindedir.

## API ve kullanıcı kontrolü

Yeni endpoint veya security policy değişikliği yok. Yeni organization API/migration gerçek backend worktree'sinden çalıştı; ayrıntılı sözleşme backend `.agents/SECURITY.md` §11 Organization profile and media içinde. Mevcut izinli Swagger yolu `/swagger-ui/index.html`, normal session/CSRF; ENV açılmadı.

Hazır staged değişiklikleri ana dizinde frontend, `.local/backend-source` içinde backend olarak commit edebilirsin; ek `git add .` gerekmiyor. Push'u kullanıcı yapar. Runtime dev ve backend sağlık kontrolü doğrulandı. Ana dizinin tracked Compose/backend'i hâlâ eski backend sürümünü içerir; çıplak ana-dizin `docker compose up --build` bu QA kaynak seçimini kullanmaz. Yeni backend kaynakları ilgili worktree'dedir; worktree/backup commit-push ve branch entegrasyonu doğrulanmadan kaldırılmamalı.
