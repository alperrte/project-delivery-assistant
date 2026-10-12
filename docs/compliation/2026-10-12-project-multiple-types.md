# Çoklu proje türleri

2026-10-12 — Proje oluşturma ve düzenlemede Web/Mobil/AI/Masaüstü/Diğer birden fazla seçilebilir.

## Tamamlanan kapsam

- Create ve edit aynı checkbox kartlarını kullanır. Tüm türler birlikte seçilebilir; en az bir seçim gerekir. Klavye Space, hata/focus ve hata açıklamasına erişilebilir bağlantı bulunur.
- Create/edit önizlemesi, proje kartı/tablo satırı ve davet önizlemesi tam seçimi gösterir. Düzenlemede Vazgeç kayıtlı seçime döner; Kaydet ve yenileme çoklu seçimi korur.
- Teknoloji önerileri seçili türlerin birleşimidir; tekrarlar tekilleşir. Tür kaldırmak mevcut teknoloji seçimini silmez. Diğer tüm kataloğu sunar.
- Backend `projectTypes` enum listesi kalıcıdır; V48 mevcut `project_type` değerlerini tek elemanlı diziye taşır. Yeni ARRAY kolonu temel alan olduğundan listelere ek ilişki sorgusu/N+1 eklenmez. Eski scalar alan projection olarak korunur.
- POST/PUT yeni diziyi öncelikli kullanır. Eksik/null dizi + eksik/aynı scalar, düzenlemede mevcut çoklu seçimi korur. Eski istemcinin scaları açıkça farklı değere değiştirmesi tekli seçim olarak uygulanır. Dizide tekrarlar tekilleştirilir; boş/yabancı/null elemanlı/5'ten uzun dizi reddedilir.
- Eski frontend testleri proje türünü radio yerine checkbox olarak seçer; diğer gerçek radio grupları korunur. Landing demo aynı gerçek create formunu yeni array alanıyla kullanır.

## Önemli dosyalar

- Backend Project controller, create/update DTO, ProjectResponse, ProjectService/Project entity ve invitation preview DTO.
- `backend/src/main/resources/db/migration/V48__project_multiple_types.sql`, `ProjectTypesMigrationTest`, `ProjectIdentityIntegrationTest`.
- Frontend `features/projects/{types,schemas,api,tech-catalog}.ts`; `components/{project-create-page,project-settings-form,project-card,project-tech-dialog}.tsx`; `components/create/{type-picker,tech-picker}.tsx`.
- Invitation preview tip/component, landing demo ve TR/EN/DE metinleri.
- `frontend/e2e/project-multiple-types.spec.ts`, public Playwright config ve mevcut E2E selector/helper uyarlamaları.
- SECURITY §11, mimari/API/veritabanı/klasör/tasarım notları, migration README ve web checklist kapsam notu.

## Komutlar ve doğrulama sonuçları

`backend` içinde, önceki görevde yalnız ignored tmp dizinine indirilmiş resmi Temurin Java 25 ile:

```powershell
$env:JAVA_HOME=(Resolve-Path '../tmp/navbar-test-jdk25/jdk-25.0.4.1+1').Path
.\mvnw.cmd '-Dtest=ProjectIdentityIntegrationTest,ProjectTypesMigrationTest,ProjectApiIntegrationTest' clean test -B
.\mvnw.cmd -DskipTests package -B
```

**30 başarılı, failure/error/skip 0**: gerçek PostgreSQL 17/18 Testcontainers üzerinde çoklu create/edit/read/list, tekrarların normalize edilmesi, aynı scalar ile legacy save koruması, invalid/empty/null/oversized dizi, non-member/auth/CSRF ve mevcut proje API/identity regresyonları. V47→V48 migration beş eski türün değerlerini ve adlarını korur; DB boş/tekrar/yabancı/null diziyi engeller. Hibernate validate başarılı. Son OpenAPI açıklamalarından sonra package başarılı.

`frontend` içinde:

```powershell
npx.cmd tsc --noEmit
$projectTypesE2E = @(git diff --name-only --relative -- e2e)
npx.cmd eslint src/features/projects src/features/invitations/components/invitation-project-preview-dialog.tsx src/features/invitations/types.ts src/features/landing/demo/pda-demo-workspace.tsx e2e/project-multiple-types.spec.ts $projectTypesE2E
npm.cmd run build
$env:E2E_BASE_URL='http://localhost:3004'
npx.cmd playwright test -c playwright.public.config.ts project-multiple-types.spec.ts --trace off --output ../tmp/project-types-ui-final-results
$env:PLAYWRIGHT_BROWSERS_PATH=(Join-Path (Resolve-Path ../tmp) 'playwright-browsers')
$env:E2E_CROSS_BROWSER='1'
npx.cmd playwright test -c playwright.public.config.ts project-multiple-types.spec.ts --project mobile-safari --trace off --output ../tmp/project-types-safari-final-results
```

- **4 Chromium + 4 mobil WebKit başarılı**, son production build üzerinde: TR/EN/DE create/edit, keyboard Space/boş seçim focus ve error association, draft/discard, save/reload, eski scalar response fallback, failed-save/retry, kart rozetleri ve teknoloji union/dedup/selection retention.
- 320/390/768/1440 px, light/dark yatay taşma yok; tüm label dokunma hedefleri en az 44 px. TR light ve DE dark mobil görüntüleri incelendi.
- UI testleri açıkça TEST-ONLY REST/WS fixture kullanır; gerçek kalıcılık/yetki kanıtı yukarıdaki PostgreSQL testleridir. Bu browser paketi actual production account/deployment testi değildir.
- ESLint, TypeScript, frontend production build, backend package ve `git diff --check` başarılı.

## API / Swagger kontrol yolu

POST `/api/v1/projects`: `{"name":"Example","projectTypes":["WEB","MOBILE"]}` → 201. PUT `/api/v1/projects/{id}`: `{"name":"Example","priority":"MEDIUM","status":"PLANNING","projectTypes":["WEB","MOBILE","OTHER"]}` → 200. Read/list yanıtları tam diziyi ve eski scalar projection'ı verir. Geçersiz dizi 400, oturumsuz 401, CSRF/Project update yetkisi yoksa 403; mevcut 404 politikası değişmez.

Swagger zaten açıksa `/swagger-ui/index.html` veya `/v3/api-docs`; normal cookie login, GET `/api/v1/auth/csrf`, mutasyonlarda `X-XSRF-TOKEN`. Asıl sözleşme `.agents/SECURITY.md` bölüm 11'de güncellendi. ENV/auth/cookie/CSRF/CORS veya permission politikası değişmedi.

## Açık konular / kullanıcının manuel kontrolü

Genel pre-push/full E2E gate ve production deployment yapılmadı. Eski gerçek hesaplı frontend E2E paketindeki selector uyarlamaları lint/type ile doğrulandı; bu geniş paket yeniden koşulmadı. Yeni özellik için frontend ve backend birlikte güncellenmeli; backend başlangıcında V48 uygulanmalıdır. Mevcut veri tabanı sıfırlanmaz ve eski migration'lar değiştirilmez.

1. Yeni proje oluştururken Web + Mobil (+ Diğer) seçin; önizlemede rozetleri ve Web/Mobil teknoloji önerilerini kontrol edin.
2. Kaydedip projeyi yeniden açın. Düzenlemede bir tür ekleyin, birini kaldırın, Kaydet ve yenileme sonrası değerleri kontrol edin.
3. Eski bir projenin türünün seçili geldiğini ve değişmeden kaydedildiğinde korunduğunu kontrol edin.
4. Tüm türleri kaldırıp kaydetmeyi deneyin; en az bir seçim isteyen hata görünmelidir. Mobilde etiketlere dokunarak, klavyede Tab/Space ile seçin.
