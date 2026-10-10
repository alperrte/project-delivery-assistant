# Web checklist yeniden denetimi — 2026-10-10

## Teslim ve durum

**Denetim raporu tamamlandı; web standartlarının tamamlandığı iddia edilmiyor.** Kullanıcının isteğiyle [.agents/faz-md/Web_Sitesi_Master_Checklist.md](../../.agents/faz-md/Web_Sitesi_Master_Checklist.md) içindeki **258/258** madde, 1–12 bölüm sırasıyla, onaylı ve Eklenmeyecek maddeler dahil yeniden değerlendirildi. Mevcut working tree kaynak refi: `228abda9b128b2f6e6448b7d2211b774d2978d4b`.

## Yapılanlar ve değişen dosyalar

- [Ayrıntılı rapor](../reports/2026-10-10-web-sitesi-master-checklist-denetimi.md): Her madde için önceki işaret, yeni sonuç, gerçek dosya kanıtı, sınır ve kalan doğrulama. **101 KOD, 108 KISMİ, 17 EKSİK, 17 DOĞRULAMA BEKLİYOR, 15 N/A.**
- Bu teslim kaydı. Kod/config/checklist güncellenmedi; commit/push/merge/deploy yapılmadı.
- Başlangıçtaki `.claude/settings.json` ve `.gitleaksignore` kullanıcı değişikliklerine dokunulmadı.

## Doğrulama

Güvenilir üst süreç Node REPL filesystem/execFile üzerinden read-only doğrulama yaptı:

- `git status --short`, `git rev-parse HEAD`, `git tag --list`, ilgili `git ls-files` kontrolleri.
- `rg --files --hidden` (node_modules/.git/.local/.next/backend target ve test çıktıları dışarıda) kaynak envanteri; ardından gerçek source/config/test içeriği okuma.
- Checklist ID/adet/sıra kontrolü: **258 satır, eksik 0, tekrar 0, 12 bölüm özgün sırası aynı**. Kanıt referanslarının bütün dosyaları mevcut.
- SHA-256 metin karşılaştırması: **1408 okunmuş dosya değişmedi**; görev checklisti hashı aynı.
- Literal href statik doğrulaması: 76 örnek / 23 farklı yerel hedef / **0 unresolved**; dinamik ve dış URLleri kapsamaz.
- 55 fiziksel page metadata kaynağı incelemesi: 53 içerik sayfasında helper/export, 2 redirect.
- Locale JSON flattened anahtar kontrolü: EN messages 27 legacy squads.membersPage eksik / 3 fazla, aktif kullanım yok; DE ve landing/errors yapısal eşit. Bu aktif UI bugı kanıtı değildir.
- Dosya/PNG başlık kontrolü: OG 1200×630; manifest 192/512; app 256; apple 180; favicon ve CVler mevcut.
- Test/migration kaynak sayımı: 103 backend Test.java, 113 frontend spec.ts, 56 SQL migration; tekrar eden migration sürümü yok.

**Çalıştırılmayanlar:** Uygulama, build/lint/typecheck, unit/integration/E2E test, audit scanner, Lighthouse, browser/manuel AT, production/TLS/social crawler ve mail teslimi. [security-audit skill](<C:/Users/alper/.agents/skills/security-audit/SKILL.md>) “If every control cannot be enforced, do not execute target code” der. Gerekli OS-enforced ağ/loopback/environment/read-only/scratch/resource izolasyonu bu oturumda kurulmadı. Bu sınır raporda açıkça belirtilir; eski PASS kayıtları güncel başarı kabul edilmedi. Bazı mail E2Eleri artık olmayan docker-compose.e2e.yml/Mailpit kurulumuna bağlı.

## API

Yeni veya değiştirilmiş API teslimi yoktur; endpoint uygulanmadı ve Swagger ile yeni API doğrulaması yapılmadı. Backend auth/authorization/CSRF/CORS/contact/analytics kaynakları checklist kanıtı olarak incelendi. Bu kayıt API tamamlanma kaydı değildir.

## Açık konular

Kullanım koşulları, nihai hukuki metin ve veri sorumlusu/retention/aktarım, genel CSP, backup/restore/incident/audit işletimi, CI/monitoring, production env/TLS/smoke, a11y kapsamı/OS reduced-motion uyumsuzluğu ve performans ölçümleri açık. İsteğe bağlı PWA service worker/offline/cache eksikleri ürün kapsamı kararı gerektirir. Tam liste ve tek tek gerekçeler ayrıntılı raporda.

## Kullanıcı kontrolü

1. Ayrıntılı raporun öncelikli bulgularını ve 1.1–12.17 satırlarını inceleyin. KOD sonucu kaynak varlığını doğrular; runtime/production PASS saymayın.
2. Hukuki işletmeci/sağlayıcı bilgilerini, yayın domainini ve yayın kapsamını kesinleştirin. Mevcut hesap silme özelliğini yok sayan privacy/FAQ ve OS hareket tercihi beyanını kodla karşılaştırın.
3. Rapordaki izole, dummy hesaplı ve gerçek mail yerine SMTP sinkli doğrulama planını uygun ortamda uygulayın; mevcut build/test/AT/CWV/TLS/crawler sonuçlarını o source ref için kaydedin.
4. Backup + media restore ve rollback/migration uyumu tatbikatının başarılı sonucunu; alarm/incident sahipliği ve bakım takvimini ayrıca doğrulayın.
