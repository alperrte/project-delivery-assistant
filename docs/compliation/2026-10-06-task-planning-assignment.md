# Görev planlama, öncelikler ve ortak havuz ataması

## Teslim ve durum

2026-10-06 — Tamamlandı. Görev oluşturma/düzenleme, öncelik gösterimleri ve basit/gelişmiş görevlerin ortak havuz ataması güncellendi. Basit görev havuzu için backend değişikliği kullanıcı tarafından açıkça onaylandı. Commit veya push yapılmadı.

## Yapılanlar

- Düşük mavi (`label-blue`), orta turuncu (`label-orange`), yüksek kırmızı (`destructive`), kritik kırmızı ünlemli `CircleAlert`. Form, önizleme, liste/pano, detay ve öncelik filtresi ortak `PriorityIndicator` kullanır. Metin etiketleri korunur; kritik yalnız renkle ayırt edilmez.
- Oturumdaki kullanıcı, atama adaylarında ve ekip/arama sonuçlarında gösterilmez. **Bana ata** ile seçilebilir; seçilenler çipinde görünür ve kaldırılabilir.
- **Kişiye ata / Havuza koy** iki görev türünde de kullanılabilir. Havuz tüm projeye veya aktif bir ekibe açılabilir. Havuz seçiliyken kişilere atama gönderilmez; kişi seçimine dönünce formdaki seçimler korunur.
- Basit projelerde sidebar **Havuz** bağlantısını gösterir. Sprint/etiket ve diğer gelişmiş alanların mevcut kısıtları sürer. Detaydan üstlenme, havuza bırakma ve yönetici tarafından havuz bilgisini temizleme çalışır.
- Havuz liste/sayaçları SIMPLE, ADVANCED ve BOTH politikalarını kapsar. Politika değiştirilince eski görevlerin havuz işlemleri kullanılabilir; tür dönüşümü havuz/ekip/üstlenme verisini veya atananları silmez.
- **Bugün / Yarın / Bu hafta sonuna kadar / Haftaya bugüne kadar** hızlı tarihleri her iki formda görünür. Hafta sonu içinde bulunulan haftanın pazar günü, haftaya aynı gün +7 takvim günü; saat yerel **23:59**. Gelişmiş formda saat sonradan değiştirilebilir. Tarihe dokunulmayan mevcut görevlerin deadline hassasiyeti korunur.
- TR/EN/DE açıklamalar güncellendi. Yeni bağımlılık, renk paleti veya migration eklenmedi; üyelik, rol, CSRF, aktif ekip ve eşzamanlı üstlenme kilitleri korunur.

## Önemli dosyalar

- [workflow.ts](../../frontend/src/features/tasks/workflow.ts), [task-badges.tsx](../../frontend/src/features/tasks/components/task-badges.tsx): ortak öncelik renkleri ve gösterimi.
- [task-form-page.tsx](../../frontend/src/features/tasks/components/task-form-page.tsx), [task-form-fields.tsx](../../frontend/src/features/tasks/components/task-form-fields.tsx), [schemas.ts](../../frontend/src/features/tasks/schemas.ts), [deadline.ts](../../frontend/src/features/tasks/deadline.ts): atama, payload ve hızlı planlama.
- [task-model.ts](../../frontend/src/features/tasks/task-model.ts), [project-sidebar-nav.tsx](../../frontend/src/components/layout/project-sidebar-nav.tsx), [pool-page.tsx](../../frontend/src/features/tasks/components/pool-page.tsx), [properties-panel.tsx](../../frontend/src/features/tasks/components/detail/properties-panel.tsx): ortak havuz erişimi.
- [TaskService.java](../../backend/src/main/java/com/pda/task/application/TaskService.java), [TaskPoolService.java](../../backend/src/main/java/com/pda/task/application/TaskPoolService.java), [TaskSupport.java](../../backend/src/main/java/com/pda/task/application/TaskSupport.java): havuzun gelişmiş özelliklerden ayrılması ve veri koruma.
- [task-planning-assignment.spec.ts](../../frontend/e2e/task-planning-assignment.spec.ts), [TaskModesApiIntegrationTest.java](../../backend/src/test/java/com/pda/task/TaskModesApiIntegrationTest.java), [TaskPoolAndMyTasksApiIntegrationTest.java](../../backend/src/test/java/com/pda/task/TaskPoolAndMyTasksApiIntegrationTest.java): davranış ve regresyon testleri.
- [SECURITY.md](../../.agents/SECURITY.md) §11, API/mimari/klasör/tasarım özetleri ve web checklist'in kapsam notu güncellendi.

## Doğrulama

Frontend dizininde:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
$env:E2E_REUSE_USERS='1'
npx.cmd playwright test e2e/task-planning-assignment.spec.ts e2e/task-date-picker.spec.ts e2e/21-task-models.spec.ts e2e/09-tasks.spec.ts --project=chromium --trace=off --output=../.local/task-planning-verified-results
```

- ESLint: 0 hata, 0 uyarı; TypeScript: exit 0.
- Chromium: **34 geçti** (7 yeni planlama/atama, 5 datepicker, 12 görev türü, 10 görev yönetimi).
- TR/EN/DE; açık/koyu tema; 320/390/768/1440 px; form taşması ve sayfa hataları kontrol edildi. Öncelik renkleri tarayıcıdaki gerçek semantic token değerleriyle karşılaştırıldı; yerel saat, tarih sınırları, kendine atama, gerçek basit havuz POST/claim/release ve eski gelişmiş veri koruma doğrulandı.
- Masaüstü öncelikler, mobil form ve basit havuz ekran görüntüleri görsel olarak incelendi. Artefaktlar `.local/task-planning-verified-results` altında, log `.local/task-planning-playwright-verified.log`. Windows/OneDrive artefakt kilidiyle karşılaşmamak için trace kapalı kullanıldı; ekran görüntüleri ve gerçek uygulama doğrulaması yapıldı.
- İlk yeni testlerde gizli radio yerine görünen label'a tıklama, kullanıcı adayının id ile bulunması ve liste satırının doğru `listitem` rolüyle seçilmesi düzeltildi. Son koşu temiz geçti.

Backend dizininde, Java 25 ile:

```powershell
mvn.cmd clean verify -B
mvn.cmd -Dtest=TaskPoolAndMyTasksApiIntegrationTest test -B
mvn.cmd verify -B
```

Son tam `mvn verify -B`: **465 test geçti; 0 failure, 0 error, 0 skipped; BUILD SUCCESS**. Son log `.local/task-planning-backend-final.log`; Surefire raporları `backend/target/surefire-reports` altında.

İlk tam koşuda yeni yetki testinin PATCH body'sinde zorunlu priority eksikti (400); alan eklenince iki görev türünde de beklenen 403 doğrulandı. Hedefli havuz paketi **7/7 geçti**. Eşzamanlı iki claim'de tek kazanan, takım üyeliği/erişim, havuz sayaçları ve SIMPLE politikası doğrulandı.

Repo kökünde `docker compose up -d --build backend` başarılı: Playwright gerçek güncel yerel backend'i kullandı. `git diff --check`: temiz.

## API sözleşmesi ve Swagger

Yeni endpoint yok; mevcut uçların havuz davranışı iki görev türüne genişletildi. Tüm API çağrıları `PDA_ACCESS` HttpOnly oturum cookie'si gerektirir; mutation'lar ayrıca `X-XSRF-TOKEN` ister. Global ADMIN üyelik veya proje rolünü aşmaz. Bilinmeyen/proje dışı görev 404; yetkisiz/CSRF mutation 403; oturumsuz okuma 401. Arşiv ve aktif ekip kontrolleri sürer.

| Yöntem / yol | Yetki ve istek | Başarı | Önemli hatalar |
| --- | --- | --- | --- |
| POST `/api/v1/projects/{projectId}/tasks` | TASK_MANAGE; `creationMode:SIMPLE` veya ADVANCED, başlık/öncelik, `assigneeIds:[]`, `pool:{open:true,teamId:null}`; tür oluşturma proje politikasına bağlı | 201 TaskView | 400 TASK_SIMPLE_FIELDS_INVALID / TASK_POOL_TEAM_INVALID; 409 PROJECT_TASK_MODE_NOT_CONFIGURED / TASK_MODE_NOT_ALLOWED / TASK_POOL_HAS_ASSIGNEE / TASK_DONE_CANNOT_POOL |
| PATCH `/api/v1/projects/{projectId}/tasks/{taskId}` | TASK_MANAGE; başlık/öncelik + değişen havuz/atama alanları; gönderilmeyen havuz korunur | 200 TaskView; ortak havuz değişir, tür dönüşümü havuz verisini korur | Aynı havuz/yetki hataları; kalan gelişmiş veriler varsa TASK_MODE_CONVERSION_BLOCKED |
| POST `.../tasks/{taskId}/claim` | TASK_WORK; body yok, hedef aktif ekibin üyeliği gerekir | 200; tek atanan kullanıcı, open=false, claimed=true | 409 TASK_NOT_IN_POOL / TASK_ALREADY_CLAIMED; 403 TASK_POOL_TEAM_ONLY |
| POST `.../tasks/{taskId}/release` | TASK_WORK + havuzdan üstlenen tek atanan kişi; body yok | 200; atamalar boş, open=true | 409 TASK_NOT_RELEASABLE (DONE dahil) |
| GET `/api/v1/projects/{projectId}/tasks?pool=true` | PROJECT_VIEW; mevcut sayfalama/filtreler ve isteğe bağlı creationMode | 200 proje havuz sayfası | 400 filtre/sayfalama; mevcut kapsam hataları |
| GET `/api/v1/tasks/pool?projectId={projectId}&page=0&size=20` | Oturum kimliği, aktif proje üyeliği + TASK_WORK ve ekip hedefi; projectId isteğe bağlı | 200; yapılandırılmış tüm politikalarda claim edilebilir görev sayfası | 400 geçersiz sayfalama |
| GET `/api/v1/tasks/mine` / `/counts` | Kimlik yalnız oturumdan, mevcut kendi görev kapsamı/filtreler | 200; poolAvailable basit proje havuzlarını da içerir | Mevcut filtre/kapsam hataları |

Güvenli POST örneği:

```json
{"title":"Test havuz görevi","priority":"LOW","creationMode":"SIMPLE","assigneeIds":[],"pool":{"open":true,"teamId":null}}
```

Swagger kontrolü: `API_DOCS_ENABLED=true` ortamında `http://localhost:8080/swagger-ui/index.html`. CSRF alıp oturum açtıktan sonra kurucuyla SIMPLE politikası seçili test projesinde yukarıdaki POST → GET pool → üye claim → aynı üye release → counts akışını uygula. Token, cookie veya parola örneklere yazılmamalı.

## Açık konular

Bu kapsamda bilinen tamamlanmamış iş yok. Proje genelindeki production/accessibility checklist kutuları, bu sınırlı doğrulamaya dayanarak tamamlandı işaretlenmedi. Gelişmiş veri koruma ve proje kurucusuna ait politika değiştirme yetkisi aynı kalır.

## Kullanıcı kontrolü

1. Basit ve gelişmiş formda dört önceliği seç; düşük mavi, orta turuncu, yüksek kırmızı, kritik kırmızı ünlemli olmalı. Önizleme ve kayıt sonrasındaki liste/detay aynı gösterimi kullanmalı.
2. Atama listesinde kendini görmemeli; **Bana ata** ile çip olarak seçebilmeli ve kaldırabilmelisin. Ekip/isim araması da kendini sunmamalı.
3. Basit formda **Havuza koy** seç; tüm proje veya ekip hedefiyle kaydet. Havuz ve detaydan **Üstlen → Havuza bırak** işlemleri çalışmalı. Ekip dışı kullanıcı ekip havuzunu üstlenememeli.
4. Basit projede sidebar'da Havuz görünmeli; sprint/etiket gibi gelişmiş girişler gizli kalmalı.
5. Hızlı tarihleri seç: hafta sonu pazar, haftaya aynı gün +7 gün ve gün sonu 23:59. Mobilde butonlar taşmamalı.
6. Eski gelişmiş havuz görevinde proje politikasını SIMPLE yapıp temel alanı düzenle: havuz/üstlenme verisi korunmalı; diğer gelişmiş alanlar salt okunur kalmalı.
