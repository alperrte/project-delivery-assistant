# BRANCH COMPLETE — cleanup — Migration consolidation

Tarih: 2026-10-11 (Europe/Istanbul). Bu kayıt tamamlanan **Phase 1 / cleanup branch teslimi** içindir. Global/main completion değildir; Phase 2 ve tam canonical pre-push kullanıcı merge/main teyidinden sonra yapılacaktır.

## Tamamlanan kapsam

- [x] Phase 0: 59 migration dosyası, CREATE/ALTER/data/constraint/index envanteri ve tablo bağımlılık grafiği.
- [x] Kullanıcı kararı: general-features yerine cleanup; yalnız disposable development/test DB, historical rewrite onaylı.
- [x] Production migration sayısı **59 → 40**; 19 tarihsel dosya runtime'dan kaldırıldı. Final şema **55 tablo / 473 kolon** olarak korundu.
- [x] Final kolon/type/default/nullability/PK/FK/UNIQUE/CHECK/index/cascade tanımları CREATE owner'larına taşındı. Versionlar yeniden numaralandırılmadı.
- [x] V25 invitation→squad ve V45 task→sprint forward FK'leri dışında ALTER yok. Sibling/self-reference NO ACTION ve ownership CASCADE davranışı aynıdır.
- [x] Eski 59 SQL'in özgün byte'ları test-only ZIP fixture'da korundu ve kaynak commit 148d2f1 ile line-ending normalizasyonu dışında eşleşti. V4/V32/V34/V36/V37/V40/V54/V68 veri dönüşümleri arşivde korunur; boş DB için runtime'da çalıştırılmaz. Yeni policy/default değerleri legacy backfill değerleriyle karıştırılmadı.
- [x] PostgreSQL 17 ve 18 üzerinde bağımsız old/new schema diff ve checksum incompatibility testi.
- [x] Entity/JPA/API/frontend sözleşmeleri korunarak backend/browser/Docker regresyonu.

## Şema ve deployment sonucu

Fresh migrate: **PASS**. Flyway validate: **PASS**. Şema diff: **PASS**. Karşılaştırılanlar: tablo/live kolon sırası/tip/nullability/default, 55 PK, 62 FK, 89 CHECK, 24 UNIQUE, 69 bağımsız index + constraint backing index'leri; sequence seti (yok), relation türleri, constraint validation/deferrability ve index validity. PostgreSQL 18 NOT NULL constraint kayıtları da karşılaştırıldı.

**Eski DB → yeni history upgrade: N/A; desteklenmiyor.** Kullanıcı bütün DB'lerin disposable olduğunu doğruladı. Yerel DB'de uygulanmış 59 migration olduğu doğrudan okundu; bu DB ve medya volume silinmedi. Yeni history bu eski DB'ye bağlanırsa Flyway validation fail etmelidir; test bunu doğrular. `repair`, baseline, validation bypass veya ENV değişikliği yapılmadı. Eski V66/V68→V71 veri koruma testleri arşiv history üzerinde geçer; bunlar yeni sete upgrade desteği anlamına gelmez.

## Değişen önemli dosyalar

- `backend/src/main/resources/db/migration/`: 40 CREATE-owner SQL + README; kaldırılan 19 dosya ve tüm ownership zincirleri root planda listelidir.
- `backend/src/test/java/com/pda/migration/MigrationConsolidationTest.java`: PG17/18 schema equality, migrate/validate/restart idempotence, old-history rejection.
- `backend/src/test/java/com/pda/migration/LegacyMigrations.java` ve `backend/src/test/resources/migration-reference/`: immutable legacy fixture ve temporary extraction.
- `AdminAuthMigrationTest.java`, `SupportAuditAnalyticsMigrationTest.java`: özgün history üzerinden tarihsel upgrade testleri korunur.
- `PDA_MIGRATION_CONSOLIDATION_PLAN.md`: kalıcı durum, envanter, data treatment, ownership/dependency ve Phase 2 gate.
- `.agents/PDA_Migration_Consolidation_Plan_and_Implementation.md`: onaylanan cleanup branch/disposable DB kararı.
- `.agents/{database,folder-structure,deployment}.md`: yeni history/fresh-install sınırı ve test fixture yolları.

Production Java entity/controller/service/repository/DTO, frontend kaynakları, dependency/config/ENV/Compose sözleşmeleri değişmedi. Endpoint eklenmedi; Swagger/auth/authorization/CSRF/CORS değişmedi. Web checklist'in etkilenmeyen maddeleri yeniden audit edilmedi veya işaretlenmedi.

## Çalıştırılan doğrulama komutları ve sonuçları

- `backend/mvnw.cmd clean verify` (backend dizininde): **894 test**, 0 failure/error/skip; BUILD SUCCESS.
- `backend/mvnw.cmd -f backend/pom.xml -Dtest=MigrationConsolidationTest test`: **2 test PASS**, PostgreSQL 17/18. İki tarihsel upgrade sınıfının 3 testi full verify içinde PASS.
- `npm run lint`: PASS, 0 error / önceden mevcut 2 unused-variable warning (`ui-ux-app.spec.ts:154`, `ui-ux-public.spec.ts:245`).
- `npx tsc --noEmit`: PASS. `npm run build`: PASS.
- `npx playwright test --project=chromium auth-email-codes.spec.ts 01-project-lifecycle.spec.ts 09-tasks.spec.ts 13-organizations.spec.ts teams-page.spec.ts notification-history-delete.spec.ts`: **42 PASS**.
- `npx playwright test --project=chromium 02-invitation-roles-squad.spec.ts 07-reminders.spec.ts 17-project-chat.spec.ts admin-login.spec.ts`: **56 PASS**.
- `docker compose --env-file .env -p pda-migration-qa -f .local/migration-consolidation/compose.qa.yml build backend` ve `up -d`: PASS. QA PostgreSQL18 tmpfs üzerinde tamamen boş başlar. Mail yalnız ayrı Mailpit sink'e gider; test rate-limit override'ları yalnız QA'dadır, ENV dosyası değişmez.
- QA `/actuator/health`: UP; frontend `/tr/ana-sayfa`: HTTP200; PostgreSQL/Mailpit healthy. QA backend restart: validated40, no pending migrations, health UP.
- Smoke kayıt toplamları restart öncesi/sonrası aynı: 23 user, 3 admin, 4 organization, 16 project, 19 team, 51 task, 66 notification, 10 chat message, 1 reminder. Flyway40/V71/success.
- JAR inspect: tam 40 runtime SQL; legacy ZIP/helper yok.
- `git diff --check`: PASS; staged dosya yok, branch cleanup. Commit/push/merge yapılmadı.

Yerel kanıtlar Git dışında `.local/migration-consolidation/` içindedir: backend-verify.log, schema-retest.log, frontend-*.log, chromium*.log, Docker logları ve QA count JSON'ları. QA stack kapatıldı; özgün backend eski imajla tekrar başlatıldı ve health UP. Özgün PostgreSQL/media volume korundu. Yalnız referans audit için oluşturulan boş `pda_migration_reference_20261011` DB incelemeye açık bırakıldı.

## Açık kalan konular

- Phase 2 `main` entegre doğrulaması, full Chromium, **tam** canonical `pre-push/pre-push.cmd` ve global `PDA_MIGRATION_CONSOLIDATION_COMPLETION.md` kullanıcı merge/main teyidini bekler. Bunlar PASS sayılmadı.
- Eski history'ye sahip DB'ler yeni imajla doğrudan kullanılamaz. Yeni uygulama çalıştırmak için ayrı boş geliştirme/test DB seçilmelidir. Kalıcı/shared/deployed DB ortaya çıkarsa strateji yeniden değerlendirilmeli, bu migration seti ona uygulanmamalıdır.
- Lint'teki iki mevcut test-file warning bu migration tesliminin kapsamı dışında kaldı.
- Repo'da `docs/compliation/README.md` yoktu; kayıt AGENTS.md'nin zorunlu kapsam/dosya/komut/sonuç/açık konu/manuel kontrol bölümlerini kullanır.

## Kullanıcının manuel kontrol adımları

1. Bu completion kaydını, root persistent planı, SQL diff'i ve legacy fixture README'sini incele.
2. Yeni Docker build/start öncesi **boş DB** seçimini planla; mevcut local DB/volume otomatik resetlenmedi. Eski DB'ye karşı repair/baseline kullanma.
3. cleanup değişikliklerini kendin commit/push/merge et. Push öncesinde zorunlu pre-push kuralını uygula; tamamlanan branch testleri canonical full pre-push yerine geçmez.
4. main'e geçip merge'in tamamlandığını açıkça bildir ve devam et de; Phase 2 o zaman başlayacak.

Agent Phase 1 sonunda durur. Staging/commit/push/merge/branch switch yapılmadı.
