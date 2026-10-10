# Test araçları

Araç seçim listesi; kurulum veya testlerin tamamlandığı anlamına gelmez.

| Alan | Araç | Ne için kullanacağız? |
| --- | --- | --- |
| Kod kalitesi | [SonarQube Community Build](https://www.sonarsource.com/open-source-editions/) | Backend ve frontend kodunda hata, bakım sorunları ve kod tekrarlarını taramak. |
| Güvenlik incelemesi | [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) | Ajan destekli kod incelemesiyle güvenlik açıklarını araştırmak ve bulguları doğrulamak. |
| Çalışan uygulama güvenliği | [OWASP ZAP](https://www.zaproxy.org/) | Test ortamındaki web/API için pasif ve aktif güvenlik taramaları yapmak. |
| Frontend statik kontrol | ESLint + TypeScript | Kod kuralları ve tip hatalarını yakalamak. |
| Frontend işlev ve görünüm | [Playwright](https://playwright.dev/) | Kritik kullanıcı akışları, formlar, hata durumları, responsive görünüm ve ekran görüntüsü regresyonlarını test etmek. |
| Frontend birim/bileşen | [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) | Yardımcı fonksiyonları ve bileşen davranışlarını izole test etmek. |
| Sayfa performansı | [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview/) + Chrome DevTools Performance | Yüklenme, layout kayması ve etkileşim darboğazlarını ölçmek. |
| Yük ve stres | [k6](https://grafana.com/oss/k6/) | Eşzamanlı kullanıcı yükünde API yanıt süreleri, hata oranı ve kapasiteyi ölçmek. |
| Otomatik erişilebilirlik | [axe-core + Playwright](https://playwright.dev/docs/accessibility-testing) | Kontrast, form etiketleri, erişilebilir isimler ve otomatik yakalanabilen WCAG sorunlarını taramak. |
| Manuel erişilebilirlik | NVDA + klavye | Ekran okuyucu, odak sırası ve yalnız klavyeyle kritik akışları doğrulamak. |
| Backend/API | JUnit + Spring Boot Test + Testcontainers | İş kuralları, gerçek PostgreSQL entegrasyonu, oturum, CSRF ve proje/hesap yetki izolasyonunu test etmek. |
| Mimari ve kapsam | Spring Modulith testleri + JaCoCo | Modül sınırlarını doğrulamak ve backend test kapsamını ölçmek. |
| Bağımlılık güvenliği | npm audit + [OWASP Dependency-Check](https://jeremylong.github.io/DependencyCheck/) | Frontend ve backend bağımlılıklarında bilinen güvenlik açıklarını taramak. |
| Secret sızıntısı | [Gitleaks](https://github.com/gitleaks/gitleaks) | Repo ve Git geçmişinde yanlışlıkla eklenmiş anahtar, token ve şifreleri yakalamak. |
| Tarayıcı/cihaz uyumu | Playwright + gerçek Chrome/Edge/Firefox/Safari ve mobil cihazlar | Tarayıcı farklarını, mobil dokunmayı, dil ve tema davranışlarını doğrulamak. |
| SEO ve kırık bağlantılar | Lighthouse + Playwright | Public sayfalarda metadata, canonical, sitemap, robots, yönlendirme ve kırık linkleri kontrol etmek. |
| Yayın öncesi genel kapı | Mevcut pre-push kontrolü + production build + Docker healthcheck | Derleme, mevcut testler, servis sağlığı ve kritik akışların smoke kontrollerini yapmak. |
| Veri ve dağıtım | Flyway + pg_dump/pg_restore + Docker Compose | Migration, yedekten geri yükleme, medya kalıcılığı ve geri dönüş prosedürünü test ortamında doğrulamak. |
| Yayın öncesi manuel kontrol | Web master checklist + SECURITY.md + gerçek tarayıcı | HTTPS, cookie/header ayarları, OAuth/e-posta akışları, hukuki sayfalar ve paylaşım önizlemelerini kontrol etmek. |
