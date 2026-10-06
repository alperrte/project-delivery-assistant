# Görevlerim kartları ve bildirim arayüzü — frontend

## Teslim ve durum

Tarih: 2026-10-06. Branch: `task-service-frontend`. Frontend teslimi tamamlandı ve aşağıdaki kontrollerle doğrulandı. Bu aşamada backend kaynakları, migration, cookie/CSRF/CORS, `.env` veya bağımlılıklar değiştirilmedi. Commit/push yapılmadı.

Önceki backend teslimi: [Görev ilerleme ve yönetici bildirimleri](2026-10-06-gorevlerim-durum-bildirim-backend.md). Bu arayüz onun SIMPLE geçişlerini ve V56 bildirim snapshot sözleşmesini kullanır.

## Yapılanlar

- Atanan kişisel görevler, açık/tamamlanan/tümü sekmelerinde kare kartlarla gösterilir. Kartta proje, görev anahtarı, başlık, açıklama, durum, öncelik, görev türü, son tarih, atanan kişiler ve yorum sayısı bulunur.
- Başlığa tıklama veya klavye ile açma, aynı Görevlerim sayfasında ortak görev detayını açar. Yorum düğmesi yorum alanına odaklanır; yorum, geçmiş ve mevcut detay özellikleri yeniden kullanılır. URL seçimi refresh sonrası korunur. Escape/kapatma odağı açan düğmeye döndürür.
- Basit görevde `BACKLOG → IN_PROGRESS → DONE` kısa akışı Başla/Tamamla ile sunulur. Gelişmiş görevde inceleme/test aşamaları korunur; tamamlamaya yalnız izin verilen aşamadan geçilir. Durum menüsünden geri dönüşler de mevcut backend kurallarına uyar.
- Kart, liste, detay ve panodaki durum değişiklikleri ortak onay penceresini kullanır. Sürükle-bırak da onay ister. İptal herhangi bir değişiklik göndermez; istek beklerken tekrar gönderme kapatılır. Hata mesajı gösterilir ve onay penceresinden yeniden denenebilir.
- Tamamlama sonrası kartlar, sayılar ve diğer görev görünümleri yenilenir. Son kartın tamamlanmasıyla mevcut sonuç sayfası boşalırsa önceki sayfaya dönülür; açık görev detayı korunur. Proje filtresi bütün görünür proje sayfalarını okur.
- Navbar bildirim menüsü gerçek kullanıcı bildirimlerini okur: okunmamış sayı, liste, sayfalama, tekli/toplu okundu işareti, yüklenme/hata/yeniden deneme. Sorgu anahtarları kullanıcıya göre ayrılır. Public landing demo bildirim isteği göndermez.
- Yöneticiye gelen başlangıç/tamamlanma bildirimi actor, görev anahtarı ve başlığı ile TR/EN/DE gösterilir. Görev bildirimi aynı global detay penceresine açılır. Snapshot taşımayan eski kayıtlarda çevrilmiş bildirim türü gösterilir.
- Navigasyon adı TR `Görevlerim`, EN `My tasks`, DE `Meine Aufgaben` oldu. Yeni aksiyonlar/onay/bildirim metinleri üç dilde yerelleştirildi.
- Mevcut semantic token, Button, Dialog, DropdownMenu ve görev bileşenleri korundu. Uzun proje adı ve atanan kişi metinleri mobilde taşmaz; dar özellik panelinde alanlar alt alta yerleşir.

## Önemli dosyalar

- `frontend/src/features/tasks/components/my-tasks-page.tsx`, `my-task-card.tsx`, `my-task-dialog.tsx`: kare kart listesi ve sayfa içi detay.
- `frontend/src/features/tasks/components/status-confirmation.tsx`, `status-menu.tsx`, `board-page.tsx`, `board-card.tsx`, `frontend/src/features/tasks/workflow.ts`: ortak onay ve görev türüne göre geçişler.
- `frontend/src/features/tasks/components/detail/{task-detail-page,activity-section,detail-section,properties-panel}.tsx`: ortak detay, yorum odağı ve mobil yerleşim.
- `frontend/src/features/tasks/my-filters.ts`, `components/task-filter-bar.tsx`: açık seçim koruması ve uzun filtre adları.
- `frontend/src/features/notifications/api.ts`, `notifications-menu.tsx` ve `frontend/src/components/layout/app-header.tsx`: gerçek bildirim menüsü.
- `frontend/src/i18n/messages/{tr,en,de}.json`: yerelleştirme.
- `frontend/e2e/my-task-cards.spec.ts`, `frontend/e2e/09-tasks.spec.ts`: yeni kabul testleri ve mevcut regresyon uyarlaması. `native-history.spec.ts` hydration/URL bekler; `workspace-history.spec.ts` çakışma ölçümünde bütün düğme koordinatlarını aynı frame'de okur, mevcut çakışma eşiği korunur.
- `.agents/architecture.md`, `.agents/folder-structure.md`, `.agents/frontend-design-rules.md`, `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`: kalıcı kısa özetler ve yalnız etkilenen kapsamın doğrulama kaydı.

## Doğrulama

Frontend dizininde:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
$env:E2E_REUSE_AUTH='0'
$env:E2E_REUSE_USERS='0'
$env:E2E_BASE_URL='http://localhost:3000'
npx.cmd playwright test --project=chromium --trace=off
```

- ESLint, TypeScript ve Next.js Turbopack production build: başarılı.
- Hedefli kart/onay/bildirim/pano/sayfalama/responsive senaryoları: 8 başarılı.
- Production tam Chromium koşumu: 266 başarılı, 2 geçmiş testi başarısız, production'da kapalı kontrollü crash route için 1 beklenen skip. Bu ilk tam koşum tek başına yeşil kapı sayılmaz.
- İki geçmiş testindeki yarış düzeltildi: manuel history kayıtlarından önce hydration beklenir, native URL değişimi web-first assertion ile beklenir ve navbar koordinatları tek frame'de okunur. Son kaynak üzerinde görevler + kartlar + native geçmiş + workspace geçmişini içeren 24 testlik production kabul/regresyon koşumu: 24 başarılı, failure/skip yok. Tam 269 testlik paket bu son test düzeltmesinden sonra yeniden çalıştırılmadı.
- Yeni senaryolar gerçek API üzerinde yorum kaydı, iptal sonrası değişmeyen durum/geçmiş, onaylı başlangıç/tamamlama, hata sonrası tekrar deneme, takipçi olmayan eş yöneticinin bildirimi ve okundu kaydı, gelişmiş inceleme adımı, pano menüsü/sürükleme ve son sayfa korumasını doğrular.
- TR/EN/DE × açık/koyu × 320/390/768/1440 px: kare oranı, sayfa/dialog yatay taşma, çeviri ve runtime error kontrolleri. TR 390/1440 px kart/detay ekran görüntüleri görsel olarak incelendi. Klavye Enter, Escape, odak dönüşü ve yorum odağı kontrol edildi.
- `git diff --check`: başarılı. Backend kaynak diff'i boş. Önceki backend tesliminin 480 Maven testi bu frontend aşamasında yeniden çalıştırılmadı.
- İlk development koşumları eski saklanan oturum/giriş fixture'ları ve bir sohbet etkileşimi zaman aşımı nedeniyle final doğrulama sayılmadı. Tam production koşumu yeni fixture hesaplarıyla yapıldı; final hedefli koşum mevcut test hesaplarına normal yeniden giriş yapar. Logout testinden sonra eski cookie snapshot'ları yeniden kullanılmadı. Uygulama auth/CORS güvenliği gevşetilmedi.
- Yerel dev sunucusu test sonrası `localhost:3000` adresinde geri açıldı. Test logları/ekran görüntüleri `.local/` ve Playwright'ın ignored çıktı dizinlerinde tutulur.

## Kullanılan mevcut API

Yeni endpoint eklenmedi. Sözleşme ve hata kapsamları `.agents/SECURITY.md` §11'de bulunur. Bütün işlemler oturumun `PDA_ACCESS` cookie kimliğini kullanır; mutasyonlarda ortak API client `X-XSRF-TOKEN` gönderir. Client yetki kontrolü yalnız UX içindir; sunucu proje/rol/atanan kişi kapsamını doğrular.

| Yöntem / yol (`/api/v1` altında) | Kapsam ve istek | Başarı / önemli hata |
| --- | --- | --- |
| `GET /tasks/mine` | Oturum sahibine atanmış aktif görevler; `scope=OPEN\|DONE\|ALL`, `projectId`, `status`, `overdue`, sıralama/sayfa | `200` görev sayfası + counts; `400` geçersiz filtre, `401` |
| `GET /projects/{projectId}` ve `GET /projects/{projectId}/members/{userId}` | Görünür proje ve kendi aktif üyeliği; dialogun mevcut proje bağlamı | `200`; `401`, `403/404` kapsam |
| `GET /projects/{projectId}/tasks/{taskId}` | Mevcut görev okuma yetkisi | `200` TaskView; `401`, `403`, `404` |
| `PATCH /projects/{projectId}/tasks/{taskId}/status` | PM veya atanmış TASK_WORK sahibi, CSRF; örnek `{"status":"IN_PROGRESS"}` | `200` güncel görev; `403`, `404`, `409 TASK_INVALID_TRANSITION`/archive/politika |
| `POST /projects/{projectId}/tasks/{taskId}/comments` | Proje üyesi, CSRF; örnek `{"body":"Göreve başladım."}`; mevcut detay GET/activity de kullanılır | `201` yorum; `400`, `401`, `403`, `404`, `409` |
| `GET /notifications?page=0&size=20` | Yalnız kendi bildirimleri | `200` sayfa, nullable `statusChange`; `400`, `401` |
| `GET /notifications/unread-count` | Yalnız kendi bildirimleri | `200 {"count":5}`; `401` |
| `PATCH /notifications/{notificationId}/read` | Yalnız kendi kayıt + CSRF, body yok | `200` güncel kayıt; `400`, `401`, `403` CSRF, `404` eksik/başkasının kaydı |
| `PATCH /notifications/read-all` | Yalnız kendi kayıtları + CSRF, body yok | `200 {"count":2}` değişen kayıt sayısı; `401`, `403` |

Swagger: local backend `http://localhost:8080/swagger-ui/index.html`, OpenAPI `http://localhost:8080/v3/api-docs`. Önce normal uygulama login'i ile oturum aç; Swagger mutasyonlarında CSRF header gerekir. İki ayrı tarayıcı oturumuyla görevde atanmış kişi ve eş yönetici bildirim alıcısını kontrol et. Token veya cookie değerlerini paylaşma.

## Açık konular / sınırlar

- Bu frontend kapsamındaki zorunlu geliştirme tamamlandı. Bildirimler yeni bir WebSocket hattı yerine mevcut REST API'den, açık sekmede 15 saniyelik polling ile yenilenir.
- Gelişmiş görevlerin inceleme/test akışı korunur. Havuz sekmesinin mevcut üstlenme akışı bu teslimin kare atanmış görev kartları kapsamından ayrıdır.
- Chromium doğrulandı; bu sonuç tüm tarayıcıları veya proje geneli erişilebilirlik/production checklist maddelerini tamamlanmış saymaz. Remote push yapılmadı; push öncesi repo standardındaki `pre-push\pre-push.cmd` kapısını kullanıcı çalıştırmalıdır.

## Kullanıcının manuel kontrolü

1. Görevlerim'e gir: kare kartlar, açık/tamamlanan/tümü sekmeleri ve proje/durum filtreleri görünsün.
2. Bir kartı aç: URL global Görevlerim'de kalsın, görev detayı popup içinde açılsın. Refresh sonrasında aynı görev açık kalsın; Escape/kapatma kartına geri dönsün.
3. Kartın yorum düğmesine bas: yorum alanı odaklansın. Bir yorum gönderip tekrar açtığında yorum ve kart sayısı güncellensin.
4. Basit görevi Başla ile açılan onayda iptal et: durum değişmesin. Onayla: Devam ediyor olsun. Tamamla'yı onayla: Tamamlanan sekmesine geçsin.
5. Aynı projedeki diğer yönetici hesabında bildirim menüsünü aç: kimin hangi göreve başladığı/tamamladığı görünsün. Bildirime basınca aynı global görev detayı açılsın ve bildirim okundu işaretlensin.
6. Gelişmiş görevde İncelemede/Test ediliyor aşamalarının korunduğunu ve panoda menü/sürüklemenin onay istediğini kontrol et.
7. TR/EN/DE ve açık/koyu temada mobil görünümü kontrol et; özellikle uzun proje/görev adları ile yorum alanı taşmamalı.

## Önerilen commit mesajı

```text
feat(tasks): add personal task cards and manager notification UI
```
