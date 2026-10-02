# WEB_STANDARDS.md

Bu klasör, bir web projesinin geliştirme başlangıcından production sonrasına kadar uygulanacak genel web standartlarını içerir.

> Güvenlik detayları bu doküman setinin dışında tutulur. Güvenlik kontrolleri için ayrı `SECURITY.md` kullanılmalıdır.

## Doküman Yapısı

- `01_PROJECT_FOUNDATION.md` — Proje başlarken kurulması gereken temel yapı.
- `02_DEVELOPMENT_STANDARDS.md` — Geliştirme boyunca korunacak UI/UX ve teknik standartlar.
- `03_LEGAL_CORPORATE.md` — Yasal ve kurumsal sayfalar.
- `04_SEO_GEO.md` — SEO, GEO, metadata, crawler ve paylaşım standartları.
- `05_ACCESSIBILITY.md` — Erişilebilirlik standartları.
- `06_ERROR_EDGE_STATES.md` — Hata sayfaları ve edge-case davranışları.
- `07_PRE_PRODUCTION_QA.md` — Production öncesi release gate ve kalite kontrolleri.
- `08_POST_LAUNCH_CHECKS.md` — Yayın sonrası yapılacak kontroller.
- `WEB_SITE_MASTER_CHECKLIST_TR.md` — AI veya geliştirici ile proje sonunda tek tek doğrulanacak ana checkbox listesi.
- `SECURITY.md` — Bu pakette yoktur; proje güvenlik standartları ayrı tutulmalıdır.

## Kullanım Akışı

1. Proje oluşturulurken `01_PROJECT_FOUNDATION.md` uygulanır.
2. Geliştirme boyunca `02_DEVELOPMENT_STANDARDS.md` ve `05_ACCESSIBILITY.md` takip edilir.
3. Public release yaklaşırken `03_LEGAL_CORPORATE.md`, `04_SEO_GEO.md` ve `06_ERROR_EDGE_STATES.md` tamamlanır.
4. Production öncesinde `07_PRE_PRODUCTION_QA.md` release gate olarak çalıştırılır.
5. Yayından sonra `08_POST_LAUNCH_CHECKS.md` uygulanır.
6. Son kabul için `WEB_SITE_MASTER_CHECKLIST_TR.md` AI'ye veya reviewer'a verilir ve her madde tek tek doğrulanır.

## Durum Standardı

Checkbox bulunan dokümanlarda:

- `[ ]` — Kontrol edilmedi / tamamlanmadı.
- `[x]` — Kanıtla doğrulandı.
- `N/A` — Proje kapsamında uygulanabilir değil; gerekçesi yazılmalıdır.

Bir madde yalnızca kodda mevcut olduğu varsayılarak tamamlanmış sayılmamalıdır. Mümkün olduğunda route, dosya, component, config, test sonucu veya production URL ile kanıtlanmalıdır.
