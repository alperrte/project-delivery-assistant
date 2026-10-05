# Basit / gelişmiş görev modeli — frontend teslimi

## Teslim ve durum

2026-10-05, `task-service-frontend` branch'i. Planlanan görev modeli frontend kapsamı tamamlandı ve gerçek yerel backend ile doğrulandı. Yeni görev modelinin son 12 Chromium senaryosu başarılıdır. Genel frontend E2E kapısı, aşağıda ayrı kaydedilen mevcut sohbet/landing hataları nedeniyle tamamen yeşil değildir.

Backend kaynakları, migration, bağımlılıklar ve `.env` değiştirilmedi. Git add, commit, push veya branch değişikliği yapılmadı.

Önceki sözleşme ve kararlar: [plan](2026-10-05-task-basit-gelismis-plan.md), [backend teslimi](2026-10-05-task-basit-gelismis-backend.md).

## Tamamlanan kapsam

- Oluşturma ve düzenlemede ortak **Basit görev / Gelişmiş görev** seçici ve `(i)` bilgi penceresi. Otomatik geçiş açıklaması iptal edilebilir; “bir daha gösterme” tercihi yalnız onayla, kullanıcıya ve açıklama sürümüne özgü kaydedilir. `(i)` her zaman açıklamayı açar.
- Basit form: başlık, açıklama, öncelik, başlangıç/bitiş tarihi ve kişi ataması. Gelişmiş form ek olarak üst görev, sprint, etiket, puan/süre tahmini, havuz ve kontrol listesi sunar. Geçişlerde ortak alanlar ve gelişmiş taslak korunur; basit gönderimde gizli gelişmiş alanlar veya kontrol listesi oluşturma istekleri gönderilmez.
- Yeni projede ilk görev öncesi **yalnız basit / yalnız gelişmiş / her ikisi** tercihi. Aynı ortak ayar proje ayarlarında da kullanılır; kaydetme yalnız projeyi kuran kişiye açıktır. Co-manager ilk seçim yapılmamışsa açıklama görür. Nihai yetki kontrolü backend'dedir.
- BOTH politikasında varsayılan basit; ADVANCED politikasında varsayılan gelişmiş. Üst görev/sprint bağlamıyla açılan gelişmiş oluşturma bağlantıları dikkate alınır. Hızlı alt görev oluşturma da açıkça ADVANCED gönderir; üst görev/ilişki seçicileri SIMPLE görevleri sunmaz.
- Basit detayda temel alanlar, durum, atama, yorum/mention ve geçmiş bulunur. Gelişmiş detayda ek bölümler görünür. **Yorumlar iki türde de kullanılabilir.**
- Proje SIMPLE yapıldığında eski gelişmiş görevler ve verileri korunur: temel düzenleme, durum, yorum ve mevcut engeli kaldırma devam eder; gelişmiş alanlar, takip, checklist/ilişki/ek/zaman kaydı mutation'ları salt okunur olur. Eski içerik ve indirme erişimi korunur.
- Sidebar'ın açık, daraltılmış ve mobil halinde SIMPLE/null politikası havuz, sprint ve etiket girişlerini gizler; görevler/pano kalır. Doğrudan açılan gelişmiş sayfalar açıklamayla mevcut veriyi gösterir ve gelişmiş mutation eylemlerini kapatır.
- Görev türü filtresi URL'de `creationMode` olarak tutulur, değişince sayfalamayı sıfırlar ve backend'in sayfalama öncesi filtresini kullanır. Liste, pano ve detay/önizlemede tür rozeti bulunur.
- Basit düzenlemeler ve inline değişiklikler gizli gelişmiş alanları temizlemez. Değişmeyen atama/havuz metadata'sı gönderilmez; üstlenme bilgisi korunur. Deadline'ın tarihi/saati değişmediyse özgün ISO değeri saniye hassasiyetiyle korunur.
- Veri bulunan gelişmiş görevi basite çevirme backend tarafından engellendiğinde açıklayıcı mesaj gösterilir; hiçbir veri otomatik silinmez. Gelişmiş yetki açıkken havuz metadata'sı ayrı onayla temizlenebilir; atanan kişiler korunur.
- Eski politika ile gönderilen form 409 aldığında proje tercihi yenilenir, taslak korunur. Dirty formun Vazgeç eylemi onay ister; refresh/tab kapatma koruması da devam eder.
- TR/EN/DE metinleri, mevcut semantik renkler, ortak UI primitive'leri, responsive yerleşim ve mevcut motion tercihleri kullanılır. Landing demo fixture'ları yeni DTO/form sözleşmesine uyarlanmıştır; landing animasyon davranışı değiştirilmemiştir.

## Önemli dosyalar

| Dosya | Değişiklik |
| --- | --- |
| `frontend/src/features/tasks/task-model.ts` | Ortak proje politikası ve varsayılan tür kuralları |
| `frontend/src/features/tasks/components/task-mode-picker.tsx` | Seçici, bilgi dialogu, tür rozeti, salt okunur açıklama |
| `frontend/src/features/projects/components/task-model-setting.tsx` | İlk kurucu seçimi ve proje ayarındaki ortak tercih |
| `frontend/src/features/tasks/components/task-form-page.tsx` | İki form, taslak/politika çatışması, preview ve ayrılma koruması |
| `frontend/src/features/tasks/schemas.ts` | Türe göre validation, güvenli payload, deadline/atama/havuz koruma |
| `frontend/src/features/tasks/components/detail/` | Türe ve proje politikasına göre detay/eylem görünürlüğü |
| `frontend/src/features/tasks/{types,filters,hooks}.ts` | Kalıcı tür, URL filtresi ve cache yenileme |
| `frontend/src/components/layout/project-sidebar-nav.tsx` | Üç sidebar sunumunda ortak politika filtresi |
| `frontend/src/features/{projects,sprints,labels}/` | API sözleşmesi, proje ayarı ve gelişmiş sayfaların salt okunur hali |
| `frontend/src/i18n/messages/{tr,en,de}.json`, `frontend/src/lib/api/error-message.ts` | UI ve yeni backend hata kodları |
| `frontend/e2e/21-task-models.spec.ts` | Son kaynak üzerinde 12 görev modeli senaryosu |
| `frontend/e2e/{helpers,09-tasks.spec}.ts` | Mevcut fixture'ların açık BOTH tercihi ve gelişmiş form seçimi |
| `.agents/{architecture,folder-structure}.md` | Kalıcı frontend sözleşmesinin kısa özeti |

## Doğrulama

PowerShell'de `npm.cmd` / `npx.cmd`, backend için Java 25 ve Maven wrapper kullanıldı.

| Komut | Sonuç |
| --- | --- |
| `cd frontend; npm.cmd run lint` | Başarılı, ESLint hata/uyarı yok |
| `cd frontend; npx.cmd tsc --noEmit` | Başarılı |
| `cd frontend; npm.cmd run build` | Son UI kaynaklarıyla başarılı production build; 30 statik sayfa üretildi |
| `cd frontend; npx.cmd playwright test --reporter=list,json` | **207 senaryo: 188 passed, 6 failed, 13 did not run**, 8,5 dakika. Yeni görev modeli ve mevcut görev/avatar testleri başarılı |
| `cd frontend; npx.cmd playwright test e2e/21-task-models.spec.ts --output=../.local/task-model-final-browser-results --reporter=list,json` | Son test kaynaklarıyla **12 passed, 0 failed, 0 skipped**, 42,9 saniye. Hızlı alt görev, açık havuz temizleme ve 390/768/1024/1440 px proje ayarı kontrolleri dahil |
| `cd backend; .\mvnw.cmd clean verify -Dlogging.level.org.hibernate.SQL=INFO` | **449 test, 0 failure, 0 error, 0 skip; BUILD SUCCESS**, gerçek PostgreSQL Testcontainers, migration ve modül testleri dahil |
| `git diff --check` | Başarılı |

Son hedefli koşum form/detay API entegrasyonu, comment, ilk tercih/kurucu/co-PM, taslak + açıklama tercihi, filtre/paging/reload, dönüşüm/veri koruma, kesin deadline, claimed havuz, hızlı alt görev, keyboard Enter/Escape/focus, validation/ayrılma onayı, TR/EN/DE ve responsive davranışları kapsar. 390 px light/dark basit ve gelişmiş form ekranları ile 1440 px gelişmiş form ekranları incelendi; yatay taşma ve form runtime hatası görülmedi. Proje ayarı DE'de 390/768/1024/1440 px doğrulandı.

Tam ve hedefli koşum sayıları birbirine eklenmez; hedefli koşum aynı özelliğin son ek kontrollerini tekrarlar. Yerel JSON/komut kayıtları `.local/task-model-{full,final}-report.json`, `.local/task-model-{full,final}.log`, `.local/task-model-build.log`, `.local/task-model-backend-verify.log` içindedir; Git'e dahil edilmez. Son hedefli browser trace dizini `.local/task-model-final-browser-results`, görseller `frontend/test-results/task-model-*.png` içindedir. E2E yalnız standart test fixture hesap/projelerini kullanır.

Tam koşum standart global setup ile yeni test fixture oturumları açtı. Son hedefli koşumda `$env:E2E_REUSE_USERS='1'` ile aynı fixture kullanıcılarına yeniden giriş yapıldı. JSON raporları `PLAYWRIGHT_JSON_OUTPUT_NAME` değişkeniyle yukarıdaki `.local` yollarına yönlendirildi. Önceden saklanan test oturumları geçersiz olduğunda yapılan giriş hazırlığı denemeleri başarılı test olarak sayılmadı.

Backend verify sonunda önceki teslimde de görülen Surefire test JVM kapanış gecikmesi tekrarlandı: `System.exit(0)` sonrası 30 saniye kapanmayınca fork kapatıldı. Komut exit 0 ve BUILD SUCCESS döndü; 449 testin failure/error/skip değeri sıfırdır. Bu kapanış gecikmesinin kök nedeni bu frontend kapsamında çözülmedi.

## Kullanılan API ve Swagger kontrolü

Yeni endpoint/migration bu frontend tesliminde eklenmedi. Ayrıntılı backend endpoint, yetki ve hata sözleşmesi [backend tesliminin API bölümünde](2026-10-05-task-basit-gelismis-backend.md) bulunur; SECURITY bölüm 11 ile uyumludur.

| İşlem | Kimlik / kapsam | İstek / yanıt |
| --- | --- | --- |
| `GET /api/v1/projects/by-slug/{slug}` | Oturum + proje görünürlüğü | Project içinde `taskManagementMode`, `createdBy` |
| `PATCH /api/v1/projects/{id}/task-management-mode` | Cookie oturumu + CSRF; aktif projenin kurucusu | `{ "mode": "BOTH" }`; 200 Project. 400 invalid, 401 unauthenticated, 403 co-PM/non-founder veya CSRF, 404 görünmez/yok, 409 archived |
| `GET /api/v1/projects/{id}/tasks` | Oturum + proje erişimi | `creationMode=SIMPLE` veya ADVANCED, `page`, `size`; 200 sayfalı TaskView |
| `POST /api/v1/projects/{id}/tasks` | Oturum + CSRF + TASK_MANAGE | Örn. `{ "title": "Test görevi", "priority": "MEDIUM", "creationMode": "SIMPLE" }`; 201 TaskView |
| `PATCH /api/v1/projects/{id}/tasks/{taskId}` | Oturum + CSRF + TASK_MANAGE | Başlık/öncelik + ortak alanlar; gizli gelişmiş alanlar gönderilmez. 200 TaskView |
| `GET /api/v1/projects/{id}/tasks/{taskId}` ve yorum/activity okumaları | Oturum + proje erişimi | Kalıcı `creationMode` ve mevcut içerik; iki türde de yorum UI'si |

Önemli hata kodları UI'de çevrilir: `PROJECT_TASK_MODE_NOT_CONFIGURED`, `TASK_MODE_NOT_ALLOWED`, `TASK_SIMPLE_FIELDS_INVALID`, `TASK_MODE_CONVERSION_BLOCKED`. UI gizleme yetki güvenliği yerine geçmez.

Yerel Swagger: `http://localhost:8080/swagger-ui/index.html`, OpenAPI: `http://localhost:8080/v3/api-docs`. PATCH politika ve task create/update/list sözleşmeleri kontrol edilebilir; mutation'lar geçerli oturum ve CSRF gerektirir. Kullanıcı/token bilgisi bu kayıtta bulunmaz.

## Açık kalan kapsam dışı konular

Tam E2E koşumundaki 6 hata, planlama sırasında da kaydedilen aynı konulardır:

1. `17-project-chat.spec.ts:193`: geliştirme ortamındaki `nextjs-portal` katmanı `chat-close` tıklamasını engelliyor; 60 saniye timeout. Serial gruptaki sonraki **13 test çalışmadı**.
2. `landing-page.spec.ts:44`, light ve dark: test geri kaydırırken TODO bekliyor; mevcut, kullanıcı tarafından istenen tek seferlik animasyon DONE'da kalıyor.
3. `landing-page.spec.ts:197`: CSS renk dönüşümünde test `rgb(52, 97, 61)` bekliyor, tarayıcı `rgb(52, 97, 62)` veriyor.
4. `landing-real-ui.spec.ts:53`, light ve dark: scroll aşamasında beklenen `#project-name` formu bulunamıyor.

Bu nedenle **tüm projenin testleri başarılı** iddiası yoktur. Görev modeli kapsamındaki açık implementasyon işi yok; sohbet/landing testlerinin ayrı ele alınması gerekiyor. Global web checklist maddeleri sınırlı görev testleriyle `[x]` yapılmadı. Yeni bir güvenlik mimarisi, library veya tasarım paleti eklenmedi; mevcut primitive/token'lar üzerinden görsel ve keyboard kontrolü yapıldı.

## Kullanıcının manuel kontrolü

1. Yeni proje açıp Görev oluştur'a girin. İlk tercih görünmeli; kurucu Her ikisi'ni kaydedince form açılmalı.
2. Basit görevde yalnız ortak alanları görün. Gelişmişe geçin, taslak yazın, geri dönün; ortak taslak ve gelişmişe tekrar dönüldüğünde ek taslak korunmalı. Açıklama iptal edildiğinde tür değişmemeli.
3. “Bir daha gösterme” seçip geçişi onaylayın. Sonraki geçiş otomatik pencere açmamalı; `(i)` yine açıklamayı açmalı.
4. Her iki türde görev oluşturup yorum/mention ve izin verilen durum değişikliklerini deneyin. Gelişmişte üst görev, hızlı alt görev ve checklist ekleyin.
5. Proje ayarından Yalnız basit seçin. Sidebar havuz/sprint/etiketleri gizlemeli; eski gelişmiş görev temel düzenlemeye ve yorumlara açık, ek bölümler salt okunur kalmalı. Verileri silinmemeli.
6. Başka bir PROJECT_MANAGER hesabıyla ayarı açın. Tercih görülebilmeli, değiştirilememeli; ilk seçim yapılmamış projede kurucunun seçimi gerektiği anlatılmalı.
7. Görev türü filtresini seçin ve refresh yapın. URL filtresi korunmalı; tür değiştirince ilk sayfaya dönülmeli.
8. Gelişmiş veri bulunan görevi basite çevirmeyi deneyin: açıklayıcı engel görünmeli, veri silinmemeli. Boş gelişmiş görev dönüştürülebilmeli. Havuz bilgisini temizleme yalnız gelişmiş araçlar açıkken ayrı onayla çalışmalı.
9. Task formunda kaydedilmemiş değişiklik yapıp Vazgeç'e basın. Düzenlemeye devam seçimi taslağı korumalı. Açık/koyu tema, telefon genişliği ve EN/DE'de form/proje tercihini kontrol edin.

Önerilen İngilizce commit mesajı:

```text
feat(tasks): add simple and advanced task workflows
```
