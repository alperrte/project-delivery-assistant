# TSF-01 / TSF-02 / TSF-03 / TSF-04 — Görev yüzeyleri

2026-10-22, Europe/Istanbul. Frontend teslim branch'i: `task-service-frontend`.

## Tamamlanan kapsam

- **TSF-01:** Kendine ve havuzdan gerçek atama, aktör/alıcı taraflarında aynı kullanıcıyı gösterebilir. Oluşturan veya son düzenleyen atayan yerine konmaz. Farklı zamanlarda farklı kişilerce yapılan mevcut atamalar `assignmentDetails` çiftlerinden gruplanır; eski aktivite atama listesine dönüştürülmez. Null/bilinmeyen aktör uydurulmaz; pasif aktör gerçek ID ve yerelleştirilmiş fallback ile açıklanır.
- **TSF-02:** Tablo, mobil satır, Görevlerim kartı, liste satırı ve detay ortak AssignmentFlow kullanır. Avatar/fotoğraf-fallback, görünür isim, en fazla üç alıcı avatarı ve +N, tam isimli yerelleştirilmiş tooltip ve ekran okuyucu metni vardır. Hover, klavye/Enter/Escape ve doğal tek dokunma desteklenir. Tooltip rolü/açıklama bağlantısı ve kontrollü trigger ID açıktır; genişletilmiş kart linkiyle etkileşimli kontrol katmanları çakışmaz. Alt görev linkinin içinde iç içe button oluşturulmaz. Eski sunucunun yalnız toplu assigners yanıtı gerçek kişi çiftleriymiş gibi yorumlanmaz.
- **TSF-03:** Kanban'ın gerçek sütun listeleri mevcut `data-workspace-scroll` seçicisine bağlandı; global CSS, token ve WebKit stilleri kopyalanmadı. Light/dark thin scrollbar, otomatik overflow, overscroll-y-contain, odak halkası ve klavyeyle kaydırma kullanılır. Pano düzeni ve drag/drop işlemleri korunur.
- **TSF-04:** ALL sıralaması frontend'de content.sort ile yapılmadı. Backend bütün filtreli sonuç kümesinde DONE'u sona alır, sonra sayfalar. Kart ve tablo sunucu sırasını korur. OPEN deadline grupları, DONE sırası, URL filtreleri, sayaçlar, dokuzluk sayfalama, page-clamp, açık detay ve yorum taslağı korunur.

GF-02 merkezi polling/invalidation altyapısı değişmedi. İkinci hesaptaki gerçek atama/durum değişiklikleri F5 olmadan görünür; açık dialog, URL ve yazılmamış yorum korunur. Kanban'da gerçek arka plan başlık güncellemesi görünürken sütun scroll'u korunur.

## Önemli dosyalar ve API

- `frontend/src/features/tasks/assignment.ts`: tekilleştirme ve yalnız gerçek mevcut satırlardan aktör/alıcı grupları.
- `frontend/src/features/tasks/{types.ts,components/task-badges.tsx}`: ek alanın geriye uyumlu tipi ve ortak gösterim.
- `components/{task-table,task-row,my-task-card,board-page}.tsx`, `components/detail/{properties-panel,subtasks-section}.tsx`.
- `frontend/src/i18n/messages/{tr,en,de}.json`: alıcı/aktör/bilinmeyen kullanıcı metinleri.
- `frontend/e2e/{task-assignment-logic,task-service-refinements}.spec.ts` ve frontend tasarım/checklist notları.

Backend ayrıca geliştirilmiştir. TaskView'ın mevcut alanları korunup `assignmentDetails:[{userId,assignedBy,assignedAt}]` eklenir; assigners gerçek kendine atamayı içerir. `GET /api/v1/tasks/mine?scope=ALL` SQL'de DONE-last sıralanır. Yeni endpoint, bağımlılık, migration veya ENV yoktur. Tam API/Swagger/yetki ve PostgreSQL kanıtı backend branch'indeki `docs/compliation/2026-10-22-task-service-backend.md` kaydındadır. İki teslim birlikte entegre edilmelidir.

## Doğrulama komutları ve kanıt

Frontend: `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `npm.cmd run build`, `npm.cmd run check:bundle`. Browser QA production build'i API8081'e bağlandı; mevcut geliştirme servisleri yerine ayrı `pda-tsf-qa` API8081/PostgreSQL5437/Mailpit8026/frontend3001 kullanıldı. Gerçek uygulama auth/CSRF/refresh kuralları değiştirilmedi.

Playwright ilgili spec'leri:

```powershell
npx.cmd playwright test e2e/task-service-refinements.spec.ts e2e/task-assignment-logic.spec.ts e2e/16-task-avatars.spec.ts e2e/task-pagination.spec.ts e2e/my-task-cards.spec.ts e2e/task-list-views.spec.ts e2e/task-board-calendar.spec.ts
```

Yeni üç saf grouping kontrolü; gerçek iki hesaplı atama/durum yenilemesi; fotoğraf/fallback; yorum/durum onayı/hata tekrar deneme; kart/tablo/URL/dokuzluk sayfalama ve son sayfada clamp; Kanban menu/native drag/keyboard/wheel/touch/regresyon kontrolleri kapsanır. Normal başarılar gerçek API ve PostgreSQL üzerindedir. Mevcut hata/tekrar deneme spec'inin HTTP failure probe'u TEST-ONLY'dir.

**Son birleşik koşu: 33 PASS, 0 FAIL, 0 SKIP (2.6 dakika)** — 30 gerçek Chromium kontrolü + 3 saf grouping kontrolü. Log `tmp/tsf-acceptance.log`, görsel/trace çıktı dizini `tmp/tsf-acceptance-results/`. Önceki koşu sayıları bu sonuca eklenmez. Son kaynakta lint, bağımsız TypeScript, QA production build ve strict bundle kontrolü başarılıdır (`tmp/tsf-lint-final.log`, `tmp/tsf-tsc-final.log`, `tmp/tsf-build-qa-final.log`, `tmp/tsf-bundle.log`).

Testlerden sonra yalnız bu görevin QA servisleri ve frontend3001 kapatıldı; volume/loglar korundu. Varsayılan API ayarlarıyla production build ve strict bundle kontrolü de PASS (`tmp/tsf-build-default.log`, `tmp/tsf-bundle-default.log`). Mevcut geliştirme servisleri değiştirilmedi.

Atama ve pano için ayrı ayrı TR/EN/DE × light/dark × 320/375/768/1024/1440 kontrol edildi. Atama yüzeyinde 320 px light/dark scoped axe: 0 ihlal; console/hydration: 0 hata. Mobil atama light/dark, mobil dokunma ve masaüstü pano görüntüleri incelendi. Mouse wheel ve klavye scrollend sonrası ölçülür; native CDP touchStart/Move/End gerçek offset hareketiyle doğrulanır. Dokunmada önce tooltip açılışı, sonra kaydırma ayrı kontrol edilir: hareket sırasında ilk tap'in atalet kaydırmasını durdurması tarayıcı davranışıdır.

İlk birleşik koşu 31 PASS / 2 FAIL verdi. Tooltip görünürken semantik rolün eksikliği ve testin eski Türkçe sütun adı düzeltildi. Sonraki geliştirme koşularında tekrarlanan QA nickname'i, dil cookie'sinden sonra yanlış selector, sürmekte olan native kaydırmada erken ölçüm, paylaşılan artifact dizininde iki runner'ın çakışması ve eski QA storage oturumunun 401'i giderildi; bunlar başarılı diye kaydedilmez. Son harness tek koşu/ayrı output dizini, normal QA login ve kaydırma bitişiyle çalışır. Loglar `tmp/tsf-*.log` altında korunur.

Backend son kontrolü 20/20 PASS (19 PostgreSQL entegrasyon örneği + 1 unit); 128 kendi görevi + 64 başka kullanıcı göreviyle bütün sayfalarda altı sort/yön, filtreler, tamamla/geri aç ve deterministik eşitlikler doğrulanmıştır. Backend testi frontend mock dizisine dayanmaz.

## Git, sınırlar ve manuel kontrol

Mevcut iki branch başlangıçta temizken `origin/main` `a33f909` üzerine ff-only güncellendi; yeni branch yoktur. Kullanıcı bu görev için mevcut `alperrte` kimliğiyle yerel commit hazırlanmasına açıkça izin verdi; Codex/OpenAI/Co-authored-by eklenmez. Backend/test/API-güvenlik belgeleri seçici stash/apply ile ayrı branch'e taşınır; pop kullanılmaz. Frontend commit'i bu dosya üzerinden `git log -1 --format='%h %s' -- docs/compliation/2026-10-22-task-service-frontend.md` ile bulunur; kesin SHA'lar final raporda verilir.

Tam pre-push kullanıcı talimatıyla final aşamaya ertelendi; push, PR merge, release/deployment yapılmadı. Fiziksel cihaz, gerçek ekran okuyucu, diğer tarayıcılar veya proje geneli WCAG onayı iddia edilmez. Yeni scrollbar paleti veya GF-02 altyapısı yoktur.

Manuel kontrol:

1. Kendine, başka kişiye ve birden çok kişiye ata; aktör/alıcı adları ve fotoğrafı, +N içindeki bütün isimleri kontrol et. İkinci yöneticiyle bir kişi ekleyip eski alıcının atayanının değişmediğini gör. Atamayı kaldır, boş durumda Atanmamış metnini kontrol et.
2. Uzun Kanban sütununda iki temada mouse/klavye/dokunma ile kaydır; başka hesapla görev güncellenirken konumun kalmasını, menu/native drag sonrası durum onayını kontrol et.
3. Görevlerim → Tümü'nde sayfalar arasında DONE'dan sonra açık görev gelmediğini gör. Proje/durum/gecikmiş filtreleri ve OPEN/DONE sekmeleri, kart/tablo, açık detay ve yazılmamış yorum korunurken tamamla/geri aç işlemini ikinci hesapla dene.
