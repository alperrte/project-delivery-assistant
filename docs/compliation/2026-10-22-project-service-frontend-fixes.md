# PSF-01 + PSF-02 — Proje grafiği ve kriter sıralaması

Tarih: 2026-10-22 (Europe/Istanbul). Branch: `project-service-frontend`.

**Durum:** İki özelliğin uygulaması ve hedefli doğrulamaları tamamlandı. Tam pre-push gate **başarısızdır**: başka projeye ait frontend 3000 portunu kullanıyor. Tüm E2E paketi ve gate'in son runtime smoke aşaması tamamlanmış sayılmaz; yayın/push onayı yoktur.

## 1. Tamamlanan kapsam

### PSF-01: kök neden ve çözüm

Sabit SVG viewBox'ı `preserveAspectRatio="none"` ile sabit yüksekliğe esnetiliyordu. Salt görsel noktalar klavye/dokunma kontrolü değildi. `dated.length` koşulu, tamamlanmamış kriterleri olan projeyi de boş gösteriyordu. Activity bileşeni geçersiz tarihle çökebiliyordu.

Grafik artık ResizeObserver ile gerçek genişliği ölçer; viewBox aynı piksel genişliğini ve 200 px yüksekliği kullanır. Yazı, çizgi ve dairesel noktalar orantısız ölçeklenmez. Dar alanda X etiketleri seyreltilir; her ayın düğmesi erişilebilir kalır. Yeni grafik kütüphanesi veya tasarım token'ı eklenmedi.

Noktalar native HTML button'dır: click, Enter/Space, Tab, görünür focus, ay/yıl/sayı/yüzde içeren erişilebilir ad, `aria-pressed`, `aria-controls` ve en az 24 px hedef. Kalıcı ayrıntı paneli ay/yıl, kümülatif sayı, oran, yalnız o ay tamamlanan kriterler ve Kriterler bölümüne geçiş sunar. Tooltip tek bilgi kaynağı değildir. Güncel ay etiketi henüz bitmemiş ay için “Şu anda tamamlanan” der.

Hesap son yedi UTC ayını kapsar. Payda bugün mevcut bütün kriterlerdir; tarihsel kriter toplamı veya durum değişikliği geçmişi iddia edilmez. Yalnız halen `completed=true` olan kriterlerin geçerli, oluşturulmadan önce olmayan, gelecekte bulunmayan tamamlanma tarihleri geçmiş aylara atanır. Eksik/geçersiz/yerel saat dilimi belirsiz tarihler geçmişe uydurulmaz; ilgili tamamlanmış kriterler açıklamayla yalnız güncel toplamda sayılır. Son nokta ve Genel Bakış sayacı aynı criteria verisinden hesaplanır. Geri alınan tamamlanmalar geçmiş projeksiyondan da çıkar; bu sınır TR/EN/DE açıklamasında yazılıdır.

Kriter yoksa gerçek boş durum; kriter olup tamamlanma yoksa yedi sıfır noktası gösterilir. Loading/error/retry ve son iyi veriyi koruyan GF-02 davranışı kullanılır. Kalıcı erişim hatasında önbellekteki activity, grafik ve snapshot ayrıntıları gizlenir.

### PSF-02: kök neden ve çözüm

Kriterler listesi API dizisini kullanırken Genel Bakış açık kriterleri öne alıyor, tamamlananları tamamlanma tarihine göre sıralıyordu. Manuel oklar ham dizide komşu takası yapıyordu.

Ortak saf algoritma `completed` azalan → `sortOrder` artan → eşit rank için özgün dizi sırasıdır. Tamamlananlar önce gösterilir. Genel Bakış aynı algoritmanın ilk beş öğesini kullanır.

Manuel taşıma, görüntülenen aynı durum grubunun komşusunu bulur ve bu iki kriterin ham manuel sıralamadaki slotlarını takas eder. Diğer grubun göreli sırası/slotları korunur. API'ye projenin bütün ID'leri tam birer kez gönderilir. Grup sınırları, arama veya durum filtresi ve devam eden mutation sırasında oklar kapalıdır. Başarısız reorder'da iyimser sıra uygulanmadığı için son onaylanmış sıra korunur; hata toast'ı gösterilir. Tamamlama/geri alma yalnız gösterimi gruplar; gereksiz reorder çağrısı yapmaz.

Mevcut merkezi GF-02 query key/defaultları korunmuştur; yeni timer/polling eklenmedi. İki kullanıcılı testte durum, sıralama ve grafik F5 olmadan güncellendi; arama, filtre, belge ve scroll konumu korundu. Proje/üyelik izolasyonu gerçek API'de doğrulandı.

## 2. Değişen önemli dosyalar

- `frontend/src/features/criteria/ordering.ts` — ortak sıralama ve grup içi taşıma.
- `frontend/src/features/criteria/components/criteria-list.tsx` — gösterim, ok sınırları ve mutation koruması.
- `frontend/src/features/projects/criteria-trend.ts` — saf UTC tarih/metrik hesabı.
- `frontend/src/features/projects/components/project-criteria-insights.tsx` — grafik, panel, activity ve query durumları.
- `frontend/src/features/projects/components/project-overview.tsx` — ortak snapshot sırası, aynı kaynaklı sayaç ve erişim hatası.
- `frontend/src/i18n/messages/{tr,en,de}.json` — yerelleştirilmiş yeni metinler.
- `frontend/e2e/project-service-logic.spec.ts` — 9 saf contract testi.
- `frontend/e2e/project-service-frontend.spec.ts` — 9 tarayıcı testi, gerçek API ve açıkça işaretli hata/tarih fixture'ları.
- `frontend/e2e/criteria-pages.spec.ts` — yeni panelde yinelenen sayaç nedeniyle mevcut beklenti snapshot'a daraltıldı.
- `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md` — yalnız etkilenen standartlar için scoped kanıt; global kutular değiştirilmedi.

Backend/API, migration, auth/yetki davranışı, `.env`/`.env.example`, bağımlılıklar ve GF-02 altyapısı değişmedi. Mevcut API yeterlidir; tam tarihsel olay grafiği bu API'den yeniden oluşturulamaz.

## 3. Çalıştırılan doğrulamalar

Başlangıçta `git status`, branch/remote ve `git fetch origin` kontrol edildi. Çalışma ağacı temizdi; `HEAD...origin/main` karşılaştırması `0 0` verdi. Entegrasyon veya yeni branch gerekmedi.

Frontend:

```powershell
cd frontend
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
npm.cmd run check:bundle
```

Hedefli Playwright:

```powershell
$env:COMPOSE_PROJECT_NAME = 'pda-psf-qa'
$env:E2E_BASE_URL = 'http://localhost:3001'
$env:E2E_MAILPIT_URL = 'http://localhost:8026'
# İlk hazırlık yeni QA hesaplarıyla global setup çalıştırdı.
# Aynı QA veritabanı ve geçerli hazırlık sonrasında:
$env:E2E_REUSE_AUTH = '1'
npx.cmd playwright test e2e/project-service-logic.spec.ts
npx.cmd playwright test e2e/project-service-frontend.spec.ts e2e/criteria-pages.spec.ts
npx.cmd playwright test e2e/project-service-frontend.spec.ts -g 'access loss'
```

Kanonik gate, Java 25 ve aynı izole Compose proje adıyla çalıştırıldı:

```powershell
.\pre-push\pre-push.cmd -QaComposeFile '.\tmp\docker-compose.e2e.yml'
git -c core.safecrlf=false diff --check
```

QA kendi yeni PostgreSQL/medya volume'lerini kullandı; gerçek kullanıcı/production verisi kullanılmadı. Mailpit yalnız yerel SMTP sink'idir; diğer projenin 8025 servisine dokunmamak için 8026 kullanıldı. Caller-owned override ignored `tmp/` altındadır; ENV dosyaları değiştirilmedi. Docker Desktop başlatıldı; başka projenin frontend'i durdurulmadı.

Doğrulama sonunda yalnız `pda-psf-qa` servisleri/network'ü kapatıldı; QA volume'leri ve test kanıtları korundu. Görevde başlatılan 3001 frontend'i de kapatıldı. Manuel deneme için uygun yerel ortamın yeniden başlatılması gerekir.

## 4. Test ve doğrulama sonuçları

| Kontrol | Sonuç |
| --- | --- |
| Saf PSF helper testleri | 9 PASS |
| PSF browser testleri | 9 farklı testin son koşuları PASS |
| Mevcut kriter sayfası regresyonları | 9 PASS |
| Toplam farklı hedefli frontend testi | 27 PASS, çözülmemiş hedefli hata yok |
| Backend Maven clean verify | BUILD SUCCESS; 1017 test: 1016 başarılı, 0 failure/error, 1 skip |
| Backend skip | `LiveKitRealSmokeTest.realSfuLifecycleAndSignedWebhook`: `pda.meeting.real-media-test` etkin değil |
| ESLint / TypeScript / production build | PASS; gate içinde de bu aşamalar geçildi |
| Strict bundle bütçesi | PASS; bütün route'lar bütçe içinde |
| Whitespace/conflict kontrolü | PASS |
| Tam pre-push | FAIL: `Frontend port 3000 is in use; stop the existing server before pre-push.` |
| Tam Playwright paketi / gate son runtime smoke | Port kontrolünden sonra oldukları için bu gate'te çalışmadı |

Son birleşik browser koşusu 17 PASS + 1 erişim-kaybı kontrolü FAIL verdi; final production derlemesi ve cross-origin 403 fixture başlıkları düzeltildikten sonra bu tek kontrol yeniden çalıştırıldı ve 1 PASS verdi. “27 PASS” tek bir kesintisiz koşu iddiası değil, farklı testlerin son doğrulanmış sonuçlarının toplamıdır.

İlk keşif koşularında yanlış uygulamaya ulaşan 3000 denemesi başarılı sayılmadı. Testlerde `%0` alt metninin `%100` ile eşleşmesi, heading ikonunun grafik SVG'si sanılması ve yeni panel yüzünden sayaç seçicisinin iki öğe bulması düzeltildi; ardından ilgili testler geçti. İlk sandbox build Google fontlarını indiremedi; ağ erişimli gerçek build başarılıdır.

Erişilebilirlik/responsive: TR/EN/DE × light/dark × 320/375/768/1024/1440 px = 30 kombinasyonda yatay taşma yok, noktalar dairesel, etiketler çakışmıyor, hedefler ≥24 px, mouse/Enter/Space/Tab/focus ve panel geçişi başarılı. Console/pageerror kayıtlarında hata/hydration sorunu bulunmadı. Mobil light ve desktop dark görüntüleri görsel olarak incelendi. 30 ekran görüntüsü ignored `tmp/psf-visual-qa/` altında saklandı.

Yerel loglar: `tmp/psf-browser-final.log`, `tmp/psf-access-final.log`, `tmp/psf-tests.log`, `tmp/psf-build-final.log`, `tmp/psf-bundle-final.log`, `tmp/psf-pre-push.log`.

## 5. Açık kalan konular ve doğrulanmayan sınırlar

- Tam gate onayı yoktur. 3000 başka projede doludur; pre-push `.env` yüklerken portu tekrar 3000 yaptığı için shell'de 3001 seçmek yeterli değildir. Bazı mevcut tüm-suite testleri de 3000 origin'ini sabit kullanır. Bu görevde ENV, gate veya ilgisiz testler port taşımak için refactor edilmedi.
- Yerel LiveKit yapılandırması olmadığı için tam meeting E2E hazırlığı ayrıca gerekir. Backend gerçek medya smoke testi atlandı; medya desteği PSF kabul kanıtı değildir.
- Fiziksel dokunmatik cihaz, gerçek ekran okuyucu, diğer tarayıcılar ve proje genelinde WCAG uyumluluğu bu dar kapsamla doğrulanmış sayılmaz.
- Tarihsel completion/undo olayları API'de tutulmadığından grafik bir audit geçmişi değildir.
- Commit, push, merge, PR veya production deployment yapılmadı.

## 6. Kullanıcının manuel kontrol adımları

1. Proje Genel Bakış'ta ay noktalarını mouse ve Tab/Enter/Space ile seçin. Ay/yıl, kümülatif sayı/oran, aylık liste ve “Kriterleri incele” geçişini kontrol edin.
2. Bir kriteri tamamlayın ve geri alın. Tamamlanan grubun üstte, sayı/yüzdenin grafik ve listede tutarlı olduğunu kontrol edin.
3. Her grubun içinde oklarla sıra değiştirin; grup sınırındaki okların kapalı olduğunu, yenilemede sıranın kaldığını ve arama/filtrede taşımanın kapandığını kontrol edin.
4. Aynı projeyi iki hesapta açın; diğer hesapta durum değiştirip görünür sekmede yaklaşık 15 saniyelik merkezi yenilemeyi, arama/filtre/scroll korunmasını gözleyin.
5. TR/EN/DE, light/dark ve dar mobil görünümde tarih/metin/focus okunabilirliğini kontrol edin. Fiziksel touch/screen-reader kabulünü ayrıca yapın.
6. Tam gate için 3000 portunu kendi uygun zamanınızda boşaltın; yerel QA SMTP/medya hazırlığını tamamlayıp kanonik komutu yeniden çalıştırın. Başarılı gate sonucu alınmadan bu kayıt full-suite/yayın onayı değildir.
