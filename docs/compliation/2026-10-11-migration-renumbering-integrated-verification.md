# Migration numaralandırma ve kalan entegre doğrulama — cleanup

Tarih: 2026-10-11 (Europe/Istanbul). Başlangıç commit'i `0b38a75`; branch `cleanup`. Kullanıcının son kararı doğrultusunda push/merge öncesinde testlere kaldığı yerden devam edildi. Tam pre-push baştan tekrar çalıştırılmadı; kesintisiz canonical script PASS veya main üzerinde test koşumu iddia edilmez.

## Tamamlanan kapsam

- Runtime migration dosyaları kullanıcı isteğiyle **V1–V40** olarak kesintisiz numaralandırıldı. 37 dosya yeniden adlandırıldı; 40 SQL dosyasının byte içerikleri, sırası ve son şema değişmedi. Sonraki migration V41 olmalıdır.
- Legacy ZIP arşivinin özgün 59 SQL dosyası/numaraları değişmedi. Eski DB ve production history rewrite sınırı aynıdır: yalnız disposable DB için boş kurulum; eski history'ye repair/baseline yok.
- PG17/18 schema equality, fresh migrate/validate ve version dizisi 1..40 test edildi. JAR tam 40 SQL içerir; legacy fixture içermez.
- Başarılı 92 backend test sınıfının raporları ve JaCoCo verisi korundu; yalnız kalan 21 sınıf + yeniden numaralandırma testi çalıştırıldı. Paketleme/verify tamamlandı. Sınıf bazında birleştirilmiş sonuç **113 sınıf, 894 test, 0 failure/error/skip**; aynı migration sınıfı iki kez sayılmadı.
- Frontend lint, TypeScript ve production build geçti. Dört değişen E2E dosyasının lint'i ve TypeScript tekrar geçti; application UI kaynakları değişmedi.
- Full Chromium ilk koşum: **984 passed / 8 failed / 19 skipped** (1011 senaryo). Hata görülen altı paket düzeltme sonrası **33 passed / 1 expected skip** (34 senaryo). Güncel `--list` ile bütün case isimleri eşleştirildi: **1012/1012 accounted, 992 passed / 0 failed / 20 expected skips / 0 missing**.
- Kalan canonical Docker build/start/health adımı ayrı QA stack üzerinde geçti; backend health UP, frontend canonical route HTTP200, PostgreSQL/Mailpit healthy. QA yeniden açılışında Flyway validated40, V40, no pending migration ve JPA startup başarılı.

## Düzeltmeler ve kapsam

1. `pre-push/pre-push.ps1`: Maven generic integration testleri operatör SMTP ayarını devralıp bağlantı bekliyordu. Yalnız Maven sırasında MAIL_ENABLED false; mail testleri kendi GreenMail ayarlarını sağlar. Docker öncesi özgün değer geri yüklenir. ENV dosyası veya runtime mail davranışı değişmez. Checklist kısa notu güncellendi.
2. `admin-behavior.spec.ts`: kayıtlı TR oturum tercihi hazır olmadan DE cookie yazılması yarışıyordu. Test session-baseline hazır olmasını bekler; dil/rapor beklentileri aynıdır.
3. `analytics-events.spec.ts`: production'da kapalı development crash düğmesine bağımlılık ayrıldı. No-consent/rejected/withdrawn testinde production browser network/resource listeners kontrol edilir; chunk/unhandled-rejection/network çeşitleri gerçek frontend→API→DB üzerinden dedupe ve kind-only payload ile doğrulanır. Development render-crash ayrı testtir ve production'da gerekçeli skip olur. Production crash route açılmadı.
4. `invitations-errors.spec.ts`: hardcoded220 probe QA'daki1000 sensitive quota'yı tüketmiyordu. Probe sınırı mevcut AUTH_RATE_LIMIT_SENSITIVE_MAX_REQUESTS değeriyle uyumludur; gerçek backend429 ve retry/expired ayrımı korunur, response mock değildir.
5. `public-scrollbars.spec.ts`: html.dark manuel toggle hydration ile yarışıyordu. Test gerçek translated theme UI düğmesini kullanır, active state ve html class'ı bekler; scrollbar/palette/inner-scroller/forced-colors beklentileri korunur.
6. QA sender yalnız yerel Mailpit için pda-e2e@example.test oldu; contact-delivery gerçek SMTP testi geçti. Normal .env/mail settings değişmedi.
7. Navbar testinin bir bağlantı reddi temiz hedefli koşumda tekrar edilmedi; application veya navbar testi değiştirilmedi.

## Skip ve test sonucu sınırları

20 skip beklenen ve açık gerekçelidir: **18 mevcut opt-in theme performance/re-render ölçümü** (THEME_PERF / THEME_PERF_RENDERS default kapalı) ve **2 development-only controlled-render-crash testi** (production route404). Bunlar executed/pass sayılmaz. Güncel default Chromium suite'in diğer bütün case'leri başarılıdır. Tek bir yeni full-green koşum iddia edilmez; full koşum + ilgili paket tekrarları case isimleriyle birleştirildi.

## Değişen önemli dosyalar

- `backend/src/main/resources/db/migration/`: V1–V40 ardışık dosyalar; README nextV41 ve forward FK V9/V24 bilgisini içerir.
- `backend/src/test/java/com/pda/migration/MigrationConsolidationTest.java`: applied SQL version sırasının tam1..40 assertion'ı.
- `frontend/e2e/{admin-behavior,analytics-events,invitations-errors,public-scrollbars}.spec.ts`: yalnız test hazırlığı/production applicability/configured quota düzeltmeleri.
- `pre-push/{pre-push.ps1,PRE_PUSH_CHECKLIST.md}`: Maven mail izolasyonu.
- `.agents/{database,folder-structure,deployment}.md`, root persistent plan, root completion raporu ve bu kayıt.

Production entity/controller/service/repository/DTO/API, frontend application kaynakları, dependencies, auth/authorization/CSRF/CORS, .env/.env.example ve normal Compose değişmedi. Web checklist'in etkilenmeyen global kutuları değiştirilmedi.

## Komutlar ve kanıtlar

- Canonical `pre-push/pre-push.cmd` başlatıldı; önce SMTP izolasyonu için, sonra kullanıcının renumber isteği için durduruldu. Kullanıcı tekrarını istemeyip kaldığı yerden devamı onayladı.
- `.local/migration-consolidation/resume_backend.ps1`: temiz compile, retained JaCoCo, kalan sınıflar için `mvnw.cmd -Dtest=<22 classes> verify`; BUILD SUCCESS. Önceki92 sınıf raporlarıyla birleşik894/0/0/0.
- Canonical frontend bölümünden alınan kalan komutlar: `npm run lint`, `npx tsc --noEmit`, `npm run build`, seçkisiz `npm run test:e2e`. Lint0error/2pre-existing unused-variable warning.
- Hedefli tekrar: `npx playwright test --project=chromium admin-behavior.spec.ts analytics-events.spec.ts contact-delivery.spec.ts invitations-errors.spec.ts navbar-auto-hide.spec.ts public-scrollbars.spec.ts`; 33pass/1expectedskip.
- Read-only current collection: `npx.cmd playwright test --project=chromium --list`; combined coverage verifier1012/1012, 992pass/20expectedskip.
- `docker compose up -d --build` QA COMPOSE_FILE/project ile; canonical health smoke backend UP + frontend200.
- `git diff --check`: PASS. Staging/commit/push/merge/branch switch yapılmadı.

Tüm kayıtlar `.local/migration-consolidation/` içindedir: phase2-pre-push*.log (interrupted), phase2-backend-completed/, phase2-backend-resume.log, phase2-frontend-resume.log, phase2-e2e-resume.log, phase2-final-resume.log, phase2-current-test-list.log, phase2-combined-backend.json, phase2-browser-coverage.json, renumber-map.json, phase2-qa-data.json. Global setup'ın ilk devam denemesinde yanlış Mailpit adresi kullanılması tüm case'ler başlamadan düzeltildi; QA hedefleri devam betiğinde açıkça sabitlendi.

## Açık kalan konular

- `main` branch veya merge sonrası tree eşleşmesi henüz kontrol edilmedi; bütün bu sonuçlar cleanup içindir.
- Kullanıcının talimatıyla **kesintisiz full canonical pre-push.cmd tekrar koşulmadı**. Başarılı sonuç `PDA RESUMED PRE-PUSH CHECK PASSED` olup aynı adımların devamıdır. Gerçek push öncesi repo SECURITY/AGENTS zorunlu canonical pre-push kuralı ayrıca geçerlidir; eski normal DB yerine doğru boş/uyumlu QA DB seçilmelidir.
- Normal eski PostgreSQL/media volume korundu; yeni migration seti eski history'ye doğrudan uygulanamaz. Normal backend eski imajıyla geri açılır. Audit referans DB pda_migration_reference_20261011 korunur; QA test container/network kapatılır.
- Yeni numaralandırma, test hazırlığı, pre-push ve rapor değişiklikleri henüz commit edilmedi.

## Kullanıcının manuel kontrol adımları

1. Bu completion kaydını ve `PDA_MIGRATION_CONSOLIDATION_COMPLETION.md` dosyasını incele; root planındaki old→new mapping'i kontrol et.
2. V1–V40 dosyalarının ve test/pre-push diff'inin review'unu yapıp yeni değişiklikleri commit et.
3. Push öncesi uygun QA/boş DB ile canonical gate kuralını uygula; normal eski DB'ye repair/baseline veya otomatik volume reset yapma.
4. Push/merge'ü kendin yap; main'e geçildiğinde tree/commit parity kontrolünü tamamla. Agent push/merge yapmadı.
