# GitHub depo yönetim sayfası ve commit bildirimleri

## Teslim ve durum

2026-10-07. **Tamamlandı.** Backend ve frontend aynı çalışma ağacında yazıldı; dosyalar branch'lere kullanıcı tarafından ayrılacak. Commit, push, staging, merge yapılmadı.

Doğrulama özeti: backend tam paket `mvn -q test` **çıkış 0**; Playwright **11/11** (yeni 7 + yaşam döngüsü 4, bağlanma testi gerçek GitHub'a gider); `tsc --noEmit` ve `npm run lint` temiz. Docker backend yeniden derlendi, V59 canlı geliştirme veritabanına uygulandı.

**Denenmeyen:** gerçek bir GitHub deposuna yeni commit atılıp canlı bildirimin oluşması denenmedi. Bildirim akışı backend `RepositoryCommitScanIntegrationTest` ve taklitli E2E ile doğrulandı.

## Yapılanlar

1. **Depo sayfası yönetim sayfası oldu.** Başlık kartı + **Özet / Dallar** görünümü. Görünüm ve dal URL'de (`?section=repository&view=branches&branch=...`), bağlantı paylaşılabilir.
2. **Dallar.** Aranabilir dal listesi (varsayılan dal başta), seçilen dalın ana dala göre durumu ("N commit ileride, M geride"), **kim ne yapmış** yazar şeridi (yazara tıklayınca sunucudan süzülür), Tümü / Ana dala girmemiş / Ana dala girmiş süzgeci ve satır rozeti, "Daha fazla yükle". Karşılaştırma 100 commit ile kesildiyse rozet/süzgeç gösterilmez, not düşülür.
3. **Durumlar:** iskelet, boş, GitHub sınırı (429), dal/depo yok (404), GitHub erişilemiyor (503, tekrar dene).
4. **Yeni commit bildirimi.** Zamanlanmış tarama (varsayılan 5 dk) yalnız varsayılan dalı izler; tek taramada gelen commit'ler tek bildirimde toplanır; alıcılar projenin tüm aktif üyeleri. Bildirim merkezinde "Depoya yeni commit geldi" + depo sayfasına "Depoyu aç" bağlantısı.
5. **Sunucu token'ı (isteğe bağlı).** `GITHUB_API_TOKEN` boş varsayılandır; doluysa GitHub sınırı saatte 60 → 5000. Yalnız sunucuda kalır, loglanmaz, yanıtta yoktur.
6. **Özel depolar bağlanamaz** (`400 REPOSITORY_PRIVATE`); entegrasyon salt okunur ve yalnız herkese açık depolar içindir.
7. **Koruma:** kullanıcı başına dakikada 60 depo okuması (429 + `Retry-After`), 60 sn GitHub önbelleği, dal/yazar doğrulaması (listede olmayan dal GitHub'a hiç gitmez).
8. Proje ana sayfasının depo özeti de aynı önbelleğe bağlandı.

## Önemli dosyalar

**Backend:** `V59__repository_commit_tracking.sql`, `ProjectRepositoryController`, `ProjectRepositoryConnectionService`, `GitHubRepositoryClient`, `GitHubRestRepositoryClient`, `GitHubReadCache`, `RepositoryReadRateLimiter`, `RepositoryCommitScanService`, `RepositoryCommitScanScheduler`, `ProjectRepositoryEvents`, `ProjectApiErrorHandler`, `NotificationType`, `RepositoryCommits`, `NotificationFactory/Writer/EventListener/Controller`, `application.properties`, `.env.example`; testler: `GitHubRestRepositoryClientTest`, `ProjectRepositoryApiIntegrationTest`, `ProjectHomeApiIntegrationTest`, `RepositoryCommitScanIntegrationTest` (yeni).

**Frontend:** `features/repository/` altında `types.ts`, `api.ts`, `links.ts`, `components/{repository-settings,repository-overview,repository-branches,branch-picker,commit-list}.tsx` (`commits-widget.tsx` silindi); `features/notifications/components/notification-center.tsx`, `types.ts`; `lib/api/error-message.ts`; `i18n/messages/{tr,en,de}.json`; e2e: `repository-management.spec.ts` (yeni), `01-project-lifecycle.spec.ts`.

**Belgeler:** `.agents/SECURITY.md`, `.agents/api.md`, `.agents/database.md`, `.agents/frontend-design-rules.md`.

`docker-compose.yml` değiştirilmedi: `env_file: .env` anahtarı zaten geçiriyor.

## Doğrulama

- Backend: `GitHubRestRepositoryClientTest` (dallar, yazara göre/sayfalı commit, compare, `private` bayrağı, token varken/yokken `Authorization`), `ProjectRepositoryApiIntegrationTest` (üye 200, üye değil 403, oturumsuz 401, geçersiz dal 400, listede olmayan dal 404, GitHub sınırı 429, özel depo reddi, bağlanınca taban çizgisi), `RepositoryCommitScanIntegrationTest` (uç aynı → bildirim yok; yeni commit'ler → her aktif üyeye tek bildirim; ikinci tarama yok; arşivli proje atlanır; çıkarılmış üye almaz; `RATE_LIMITED` turu durdurur), `ModularityTest`. Tam `mvn -q test` çıkış 0.
- Playwright (Chromium): `repository-management` 7 test (görünüm geçişi, dal seçimi + URL, ileride/geride, rozet ve süzgeçler, yazar şeridi ve süzme, daha fazla yükle → 35, yenilemede dal korunur, bilinmeyen dal notu, 429/503 + tekrar dene, yalnız yönetici bağlantıyı keser, 390 px'te yatay taşma yok, bildirim metni ve bağlantısı) + `01-project-lifecycle` 4 test. Depo uçları `page.route` ile taklit edildi; proje, üyelik ve oturum gerçek.
- `tsc --noEmit` ve `npm run lint` temiz.
- Elle bakış: açık, koyu ve 390 px ekran görüntüleri.
- Çalıştırılamayan: canlı yeni-commit bildirimi (yukarıya bakın). context7 MCP yetkilendirilmediği için kullanılamadı.

## API

Hepsi `GET`, aktif proje üyesi, çerez oturumu (CSRF gerekmez). `401` oturumsuz, `403` üye değil.

- `/api/v1/projects/{projectId}/repository/branches` → `{branches:[{name,isDefault,isProtected,headShortSha}],truncated}`; en çok 100 dal.
- `/api/v1/projects/{projectId}/repository/commits?branch=&author=&page=&limit=` → `[{sha,shortSha,message,author,authorLogin,authorAvatarUrl,committedAt,commitUrl}]`. `branch` yoksa varsayılan dal. Eski istemciyle uyumlu (iki alan eklendi).
- `/api/v1/projects/{projectId}/repository/compare?branch=` → `{base,branch,aheadBy,behindBy,unmergedCommits[],truncated}`; en çok 100 commit.
- Hatalar: `400` geçersiz dal/yazar veya `REPOSITORY_PRIVATE`; `404` dal/depo yok; `429` `REPOSITORY_READ_LIMIT` ya da GitHub sınırı (`Retry-After: 60`); `503` GitHub erişilemiyor.
- Bildirim: `type=REPOSITORY_COMMITS_PUSHED`, `repositoryCommits:{projectName,repositoryFullName,branch,commitCount,truncated,headMessage,headAuthor}`.
- Yapılandırma: `GITHUB_API_TOKEN` (boş), `GITHUB_COMMIT_SCAN_INTERVAL` (`PT5M`), `GITHUB_COMMIT_SCAN_BATCH` (`0` = otomatik: token yokken 5, varken 50), `GITHUB_CACHE_TTL` (`PT60S`), `GITHUB_READ_LIMIT_PER_MINUTE` (`60`).

Swagger: `/swagger-ui/index.html` (`API_DOCS_ENABLED=true`).

## Açık konular

- Token yokken GitHub sınırı sunucu başına saatte 60; tüm projeler paylaşır. Önbellek ve tur sınırı yumuşatır ama çok depoda bildirimler gecikir. Üretimde token önerilir.
- Bildirim en geç bir tarama aralığı (varsayılan 5 dk) gecikir; anlık değildir (webhook yok).
- Commit'i atan kişi de bildirim alır: GitHub yazarını PDA kullanıcısına eşlemek bu işin kapsamında değil.
- Dal listesi ve karşılaştırma 100 ile sınırlı; aşılırsa arayüz "kısaltıldı" der.
- `/` içeren dal adları için `compare` çağrısının kodlaması gerçek GitHub'a karşı doğrulanmadı; gerçek çok dallı bir depoyla da denenmedi.
- Varsayılan dal GitHub'da yeniden adlandırılırsa taban çizgisi sıfırlanır; o tur bildirim üretilmez.

## Kullanıcı kontrolü

1. Gerçek, herkese açık bir depo bağla → sayfa **Özet**'te açılır, son commit'ler görünür; **Dallar** sekmesinde bir dal seç: URL'de `branch=` belirir, "N ileride, M geride" ve yazar şeridi çıkar; sayfayı yenile, seçim korunur.
2. Yazar düğmesine tıkla: liste o yazara süzülür. "Ana dala girmemiş" süzgecini dene.
3. Üye (yönetici değil) hesabıyla aynı sayfaya gir: "Bağlantıyı kes" görünmez.
4. Özel bir depo bağlamayı dene: açıklayıcı hata gelmeli.
5. Bildirim için: `.env` içinde `GITHUB_COMMIT_SCAN_INTERVAL=PT1M` ile backend'i yeniden başlat, bağlı depoya yeni bir commit at, birkaç dakika bekle → bildirim merkezinde "Depoya yeni commit geldi" ve "Depoyu aç" bağlantısı.
6. 390 px ve koyu temada sayfaya bak.

Commit mesajı:

```text
Backend: feat(repository): branch/compare read endpoints, commit scan with REPOSITORY_COMMITS_PUSHED notification and V59

Frontend: feat(repository): repository management page with overview/branches views and commit notifications
```
