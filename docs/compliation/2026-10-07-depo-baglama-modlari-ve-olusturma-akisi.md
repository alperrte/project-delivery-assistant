# Depo bağlama, Basit/Gelişmiş mod ve proje oluşturma akışı

## Teslim ve durum

2026-10-07. **Tamamlandı.** Backend ve frontend aynı çalışma ağacında yazıldı; dosyalar `project-service-backend` ve `project-service-frontend` branch'lerine kullanıcı tarafından ayrılacak. Commit, push, staging, merge yapılmadı.

Doğrulama özeti: backend tam paket `mvn -q test` **çıkış 0** (surefire: 540 test, 0 hata, 0 başarısızlık); Playwright **34/34** (yeni spec 6, `repository-management` 8, `01-project-lifecycle` 4 — gerçek GitHub'a gider —, `project-create-page` 8, iki organizasyon spec'i); `tsc --noEmit` ve `npm run lint` temiz. Docker backend yeniden derlendi, **V61 canlı geliştirme veritabanına uygulandı**. Açık, koyu ve 390 px ekran görüntüleri (oluşturma, ayarlar, yardım diyaloğu, genel bakış, depo sayfası) alındı; hiçbirinde yatay taşma yok.

**Denenmeyenler / başarısız olanlar:**
- `17-project-chat.spec.ts` bu çalıştırmada koşamadı: kayıtlı "outsider" test kullanıcısı veritabanında yok (giriş reddediliyor) ve yeni kayıt hız sınırına takılıyor. Depo ile ilgisi yok; `03-project-navigation-responsive` geçti. Sohbet spec'i yeni kullanıcı kaydı yapılabildiğinde ya da outsider dosyası yenilendiğinde tekrar koşulmalı.
- Tam Playwright paketi koşulmadı; yalnız etkilenen spec'ler koşuldu.
- Bildirim akışı yeni anahtarla gerçek bir GitHub deposuna commit atılarak denenmedi; `RepositoryCommitScanIntegrationTest` ile doğrulandı.
- context7 MCP yetkilendirilmediği için kullanılamadı (yetki için `/mcp`).

## Yapılanlar

1. **Oluşturma ekranında isteğe bağlı depo.** "GitHub deposu (isteğe bağlı)" bölümü; adres yazılınca Basit/Gelişmiş kartları, (i) açıklaması ve bildirim anahtarı açılır. Depo bağlanamazsa proje yine oluşur, uyarı çıkar, kullanıcı ayarlardan tekrar dener.
2. **Ekip sorusu.** "Projeyi oluştur"dan sonra "Henüz bir proje ekibiniz yok. Şimdi ekip oluşturmak ister misiniz?" → Evet `/teams/new`, Hayır proje sayfası.
3. **Basit / Gelişmiş.** Basit: depo bağlanır, ana dalın son commit'leri; depo sayfasında sekme yok. Gelişmiş: Özet + Dallar (dal bazında commit'ler, ana dala girmiş/girmemiş ayrımı, yazarlar). (i) düğmesi farkı anlatır. Yeni bağlantıların varsayılanı Basit, mevcutlar Gelişmiş.
4. **Bildirim anahtarı** "Yeni commit'lerde üyelere bildirim gönder" (varsayılan açık). Bildirim iki modda da yalnız ana dal içindir; kapalı depolar taranmaz, tekrar açılınca kapalıyken gelenler bildirilmez.
5. **Proje ayarlarında "GitHub deposu" bölümü:** bağla, modu/anahtarı değiştir (`PATCH`), depo sayfasını aç, bağlantıyı kes. Tüm Proje Yöneticileri yapabilir; üye göremez.
6. **Kenar çubuğunda "Depo" yalnız depo bağlıyken görünür.** Depo sayfasında bağlama formu kalktı; boş durumda yöneticiye "Ayarlarda bağla".
7. **Genel bakışta tek satırlık depo şeridi:** `owner/repo · dal`, son commit, yazar, göreli zaman.
8. Basit modda dal/karşılaştırma/dal commit'i/yazar süzgeci istekleri `409 REPOSITORY_ADVANCED_REQUIRED` döner.

Bilinçli değişiklik: kenar çubuğu artık proje `home` önbelleğini okur (pasif gözlemci + boşsa bir kez `ensureQueryData`). Tam sayfa yüklemede seçili proje için bir `/home` çağrısı yapılır; bu yüzden `project-create-page.spec.ts` içindeki "kart başına /home çağrılmaz" testinin eşiği `0` yerine `en fazla 1` yapıldı (kart başına çağrı hâlâ yakalanır). Aktif gözlemci kullanılsaydı organizasyon yeniden adlandırma testi ve liste sayfası gereksiz `/home` çekerdi.

## Önemli dosyalar

**Backend:** `V61__repository_tracking_mode.sql`, `RepositoryTrackingMode`, `RepositoryAdvancedRequiredException`, `UpdateRepositorySettingsRequest`, `ConnectRepositoryRequest`, `RepositoryConnectionResponse`, `ProjectRepositoryConnection`, `ProjectRepositoryConnectionRepository`, `ProjectRepositoryConnectionService`, `ProjectRepositoryController`, `ProjectApiErrorHandler`, `SecurityBaselineConfiguration`, `ProjectHomeService`, `ProjectHomeResponse`; testler: `ProjectRepositoryApiIntegrationTest`, `RepositoryCommitScanIntegrationTest`, `ProjectHomeApiIntegrationTest`.

**Frontend:** `features/repository/{schemas,types,api}.ts`, `components/{repository-options,repository-setting,repository-settings,repository-overview}.tsx`; `features/projects/components/{project-create-page,project-settings-form,project-overview}.tsx`, `features/projects/types.ts`; `components/layout/project-sidebar-nav.tsx`; `features/landing/demo/demo-data.ts`; `lib/api/error-message.ts`; `i18n/messages/{tr,en,de}.json`; e2e: `helpers.ts`, `project-repository-setup.spec.ts` (yeni), `repository-management`, `01-project-lifecycle`, `project-create-page`, `organization-project-association`, `organization-integration-regressions`.

**Belgeler:** `.agents/SECURITY.md`, `.agents/api.md`, `.agents/database.md`, `.agents/frontend-design-rules.md`.

`.env`, `.env.example`, `docker-compose.yml` değiştirilmedi; yeni ENV anahtarı, bağımlılık yoktur.

## Doğrulama

- Backend: `ProjectRepositoryApiIntegrationTest` (varsayılanlar, mod/anahtar ile bağlama, `PATCH` yönetici 200 / üye 403 / oturumsuz 401 / CSRF'siz 403 / bağlı değil 404 / geçersiz mod 400, Basit modda 409 + kod, ana dal commit'leri 200, Gelişmişte hepsi 200), `RepositoryCommitScanIntegrationTest` (anahtar kapalı → bildirim yok; kapalıyken gelenler açılınca bildirilmez), `ProjectHomeApiIntegrationTest` (`trackingMode`), `ModularityTest`; tam `mvn -q test` çıkış 0.
- Playwright (Chromium): `project-repository-setup` — oluşturma depo olmadan + Hayır, adres doğrulaması, `POST` gövdesi (`ADVANCED`, bildirim kapalı) + Evet → `/teams/new`, (i) diyaloğu iki modu anlatır, ayarlarda bağla/`PATCH`/kes ve kenar çubuğu "Depo" öğesinin gelip gitmesi, genel bakış şeridi (son commit + yazar, 390 px'te taşma yok), üyenin ayar bölümünü ve yönetim düğmelerini görmemesi. `repository-management`: yönetici/üye yetkileri ayarlara göre güncellendi, Basit modda sekme yok. `01-project-lifecycle`: depo ayarlardan **gerçek GitHub** ile bağlanır, "Depo" görünür, şerit görünür.
- GitHub uçları `page.route` ile taklit edildi (durumlu taklit: bağla/değiştir/kes); proje, üyelik, oturum ve veritabanı gerçek.
- `tsc --noEmit`, `npm run lint` temiz. Web kontrol listesinden yalnız etkilenen maddeler yeniden bakıldı: etiketli form alanları, klavye ile (i)/anahtar/radyo, odak halkası, diyalog odağı ve Esc, açık/koyu tema, 390 px, tr/en/de metinler.

## API

Swagger: `/swagger-ui/index.html` (`API_DOCS_ENABLED=true`), normal giriş + `GET /api/v1/auth/csrf`.

- `POST /api/v1/projects/{projectId}/repository` gövde `{repositoryUrl, trackingMode?, notifyOnCommits?}` → `201` (varsayılan `BASIC`, `true`).
- **Yeni:** `PATCH /api/v1/projects/{projectId}/repository` gövde `{trackingMode, notifyOnCommits}` → `200`. `REPOSITORY_MANAGE` (Proje Yöneticisi) + CSRF; `403` üye, `401` oturumsuz, `404` bağlı depo yok, `400` geçersiz mod.
- `GET .../repository` ve `GET /api/v1/projects/{projectId}/home` (`repository`) yanıtlarına `trackingMode`, `notifyOnCommits` eklendi.
- Basit modda `GET .../repository/branches`, `.../compare`, ana dal dışı veya `author` süzgeçli `.../commits` → `409` `code=REPOSITORY_ADVANCED_REQUIRED`.
- Migration: V61 (`tracking_mode`, `notify_commits`).

## Açık konular

- Sidebar "Depo" öğesi, kenar çubuğu önbelleği boşken `home` yüklenene kadar görünmez (kısa gecikme). Başka bir yönetici depoyu bağlarsa üyenin kenar çubuğu, üye proje sayfasını açıp `home` yenilenene kadar eski kalabilir.
- Oluşturmada depo bağlama ayrı bir istektir; GitHub o an erişilemezse proje depo olmadan açılır.
- `17-project-chat.spec.ts` koşulamadı (yukarıya bakın).
- Basit moda geçen projede paylaşılmış `view=branches` bağlantıları özet görünümüne düşer.
- Önceki işten kalanlar geçerli: token yokken GitHub saatlik sınırı, bildirim gecikmesi (en geç tarama aralığı), commit'i atan kişinin de bildirim alması.

## Kullanıcı kontrolü

1. Yeni proje oluştur, depo adresini boş bırak → "Projeyi oluştur" → ekip sorusu çıkar; Hayır → proje sayfası, sidebar'da **Depo yok**.
2. Yeni proje, depo adresi yaz → Basit/Gelişmiş kartları ve (i) çıkar; (i)'ye tıkla, iki modun farkı yazar. Gelişmiş seç, bildirim anahtarını kapat → oluştur → Evet → ekip oluşturma sayfası açılır.
3. Proje ayarlarında "GitHub deposu": mod değiştir → Kaydet; sidebar'dan Depo'ya gir: Basit'te sekme yok, Gelişmiş'te Özet/Dallar. "Bağlantıyı kes" → onay → sidebar'dan Depo kaybolur.
4. Genel bakışta depo şeridi: depo adı, son commit ve yazar.
5. Üye hesabıyla: ayarlarda depo bölümü yok, depo sayfasında "Depo ayarları"/"Bağlantıyı kes" yok.
6. 390 px ve koyu temada bu ekranlara bak.

Commit mesajı:

```text
Backend: feat(repository): BASIC/ADVANCED tracking mode, PATCH repository settings and commit notification switch (V61)

Frontend: feat(projects): optional GitHub repository on project creation, team prompt, repository settings section and overview strip
```
