# Frontend servis düzeltmeleri — 2026-10-28

## Tamamlanan kapsam

Kullanıcının frontend düzenleme talebi tek ajanla uygulandı. Önceki kapak/logo değişiklikleri korundu; bütün değişiklikler manuel kullanıcı kontrolü için mevcut çalışma ağacındadır. Kullanıcı “hepsi olmuş” demeden commit veya push yapılmaması istendi; bu teslimde Git index/branch/remote değiştirilmedi. Aktif branch `project-service-frontend`.

- Toplantılarım, oluşturma/planlama/kaydetme, planlanmış toplantıyı başlatma, katılma/geri dönme, davet ve oda birincil aksiyonları çalışma alanının ortak primary/default butonlarını kullanır. Seçili ikon ortak primary paletindedir. Destructive aksiyonlar ve bilgilendirici semantik rozetler korunur.
- Toplantı tür seçimi, proje seçimi ve bağımsız/proje formu ortalı 1024 px sınırından çıkarılıp liste sayfalarının başlangıcına/full içerik genişliğine hizalandı. Yeni gereksiz panel veya sahte veri eklenmedi.
- Mini toplantı kartının geri dönüş aksiyonu ayrı, tam genişlikte bir satırda; dar ve sürüklenmiş kartta yazı gizlenmez/kesilmez. Ayrılma ve medya kontrolleri ayrı üst satırda; Picture-in-Picture sunumu da aynı düzeni kullanır.
- Görevlerim'e masaüstünde 224 px genişliğinde, 32 px yükseklikte (dar ekranda 36 px) arama eklendi. Mevcut iki karakter eşiği ve 300 ms bekleme korunur. URL/reload, temizleme, proje/durum filtreleri, görev anahtarı/başlık/açıklama araması ve yerel sonuç sayfalaması birlikte çalışır.
- Mine API'si `q` kabul etmediğinden backend değişmeden yalnız arama sırasında mevcut kapsamın 100'lük tüm sayfaları okunur, sonuçlar frontend'de süzülür. Aynı kapsamdaki farklı arama terimleri ortak sorgu verisini kullanır. Arama yokken normal sunucu sayfalaması sürer. İstekler iptal sinyaline uyar; eksik veri sessizce bütün sonuç sayılmaz.
- Yeni görev oluşturmadaki breadcrumb kaldırıldı; diğer görev detay/düzenleme rotalarının breadcrumb'ları değiştirilmedi.
- Ortak `APP_VERSION` `2.9.9` oldu. Landing/site footer ile sidebar Ayarlar altı, daraltılmış sidebar ve mobil menü bu tek değeri gösterir. Package/API sürümü değiştirilmedi.

## Değişen önemli dosyalar

- `frontend/src/features/meetings/`: liste, kart, create/form/detail, ikon seçici, oda invite/panel/participant kontrollerindeki buton varyantları ve `session/meeting-mini-bar.tsx` düzeni.
- `frontend/src/features/tasks/{my-filters,hooks,api}.ts`: arama URL'si, kapsamın sayfalarının okunması ve AbortSignal.
- `frontend/src/features/tasks/components/{my-tasks-page,task-filter-bar}.tsx`: kompakt ortak arama alanı; dışarıdan değişen/temizlenen URL değerinin input'a yansıması.
- `frontend/src/components/layout/app-breadcrumb.tsx`: yalnız yeni görev rotasında gizleme.
- `frontend/src/components/layout/app-shell.tsx`, `frontend/src/features/public-info/site-info.ts`: ortak sürüm gösterimi.
- `.agents/frontend-design-rules.md`, `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`: ilgili kalıcı standart ve sınırlı doğrulama notları.

Önceki teslim kayıtları: `2026-10-28-kart-kapak-tema-kontrasti.md`, `2026-10-28-seffaf-logo-zemini.md`, `2026-10-28-proje-onizleme-tema-dogrulamasi.md`.

## Sürüm grupları ve kullanıcı onayı sonrası branch planı

Bu tablo düzeltme gruplarını 2.9.3–2.9.9 aralığında takip eder; ayrı production yayınları yapıldığı anlamına gelmez. Ekrandaki güncel değer 2.9.9'dur.

| Sürüm | Kapsam | Hedef branch |
| --- | --- | --- |
| 2.9.3 | Proje/organizasyon kapağı kontrastı ve yeni proje önizlemesi | project-service-frontend |
| 2.9.4 | Şeffaf logo zemini ve harf fallback korunumu | project-service-frontend |
| 2.9.5 | Toplantı butonları ve seçili ikonun ortak renkleri | meeting-system-frontend |
| 2.9.6 | Mini toplantı kartının okunaklı geri dönüş aksiyonu | meeting-system-frontend |
| 2.9.7 | Görevlerim kompakt araması | task-service-frontend |
| 2.9.8 | Toplantı oluşturma hizası / yeni görev breadcrumb'ı | İlgili parçalar meeting-system-frontend / task-service-frontend |
| 2.9.9 | Ortak landing/sidebar sürümü | general-features |

Onaydan sonra branch tabanları yeniden karşılaştırılacak; değişiklikler dosya/hunk sahipliğine göre ayrılacak. Ortak CSS/doküman değişiklikleri yanlış branch'e topluca alınmayacak. Yerelde bulunmayan `meeting-system-frontend` için `origin/meeting-system-frontend` mevcut. Bu kayıt commit/push yapılmış olduğu iddiasını taşımaz.

Commit başlığı kullanıcı biçiminde olacak, örneğin `feature-fix/project-service-frontend : projelerin kapak ve logo sorunları düzeltildi`; gövdede değişiklikler ve doğrulamalar madde madde yer alacak. Mevcut Git kullanıcı kimliği korunacak; ajan imzası, `Authored-by` veya `Co-authored-by` eklenmeyecek.

## Çalıştırılan doğrulama komutları

```powershell
# frontend içinde
node node_modules/typescript/bin/tsc --noEmit --incremental false
# repo kökünde; geçici Playwright config/spec Git dışında
node frontend/node_modules/@playwright/test/cli.js test --config=tmp/frontend-fixes/playwright.config.cjs --grep 'meeting actions' --output=tmp/frontend-fixes/meeting-results
node frontend/node_modules/@playwright/test/cli.js test --config=tmp/frontend-fixes/playwright.config.cjs --grep 'mini return'
node frontend/node_modules/@playwright/test/cli.js test --config=tmp/frontend-fixes/playwright.config.cjs --grep 'my tasks search|shared version' --output=tmp/frontend-fixes/version-task-results
node frontend/node_modules/@playwright/test/cli.js test --config=tmp/frontend-fixes/playwright.config.cjs --grep 'shared version' --output=tmp/frontend-fixes/version-results
git -c core.safecrlf=false diff --check
```

## Test/doğrulama sonuçları

- Son hedefli koşuların birleşiminde **10 benzersiz Playwright senaryosu PASS**: toplantı aksiyon/ikon/hiza TR/EN/DE 3; mini gerçek oturum/navigasyon/sürükleme TR/EN/DE 3; görev arama/filtre/reload/yeni görev breadcrumb 1; sürüm/sidebar/daraltılmış/mobil/landing TR/EN/DE 3.
- Toplantı formlarında bağımsız/proje × açık/koyu × 320/390/1440 px; mini ve görevler de iki tema/üç genişlikte kontrol edildi. Başlık başlangıcı listeyle 2 px altında farkla aynı; seçili ikon ve aksiyon renkleri mevcut primary token'larıyla eşit.
- 130 sentetik görev içinde ilk 100'lük sayfanın dışında bulunan eşleşme aramada bulundu. Yenileme, temizleme, proje/durum filtreleri ve `QA-130` görev anahtarı başarılı. Yeni görev formu breadcrumb olmadan açıldı.
- Mini testlerinde gerçek tarayıcı ile geçici yerel LiveKit kullanıldı; REST/WebSocket PDA fixture'ları sentetikti. Uzak production'a veya gerçek kullanıcı/proje verisine yazılmadı. Aynı toplantıya dönme ve ayrılma başarılı; TR/DE mini görüntüleri ayrıca incelendi.
- Yerelde LiveKit başlangıçta yoktu. Repodaki pinli `livekit/livekit-server:v1.13.10` imajıyla yalnız 127.0.0.1 portlarına açılan, rastgele process ortamı kimlik bilgileri kullanan, kalıcı volumesüz test container'ı oluşturuldu. Sonunda kendi container kimliği doğrulanarak stop edildi ve `--rm` ile kaldırıldığı kontrol edildi. Uygulama backend/postgres container'ları değiştirilmedi.
- İlk test başarısızlıkları hover rengiyle temel rengin karıştırılması, açık filtre menüsünün kapatılmaması, testin JSON yükleme biçimi ve oturumlu ziyaretçinin landing yerine dashboard'a yönlenmesiydi. Test fixture/akışı düzeltildi; geçmeyen koşular geçmişten silinmedi. Son sürüm kontrolleri oturumsuz landing üzerinden 3/3 geçti.
- Türkçe bağımsız masaüstü formu, mobil proje formu, görev araması ve TR/DE mini ekran görüntüleri görsel olarak incelendi. Kanıtlar `tmp/frontend-fixes/{meeting-results,mini-results,version-task-results,version-results}/` altında; eski başarısız koşu kanıtları ayrıca durabilir.
- TypeScript ve son whitespace/diff kontrolü PASS. Backend/ENV/package/lockfile değişmedi. Kullanıcı isteğiyle pre-push, backend testleri ve production build çalıştırılmadı.

## Açık kalan konular ve doğrulanmayan sınırlar

- Bu yerel geliştirme teslimidir; canlı sitede görünmesi için daha sonra yetkili yayın gerekir. Commit ve push kullanıcı manuel kontrol onayını bekliyor.
- Görev araması küçük/orta kapsamlarda frontend çözümüdür; çok büyük görev kümelerinde tüm kapsamın okunması ek istek maliyeti taşır. Backend arama sözleşmesi bu talepte değiştirilmedi.
- Picture-in-Picture kontrol düzeni kaynakta güncellendi; ayrı OS penceresi bu koşuda açılmadı. Asıl diğer sayfaya geçiş mini kartı ve sürükleme gerçek oturumla doğrulandı.
- Chrome dışında tarayıcılar, fiziksel cihaz ve tam site audit'i yapılmadı. Global checklist tamamlandı sayılmadı.
- Landing sayfasının yeni içerik/tasarım işi sonraki aşamadır; bu teslim yalnız mevcut footer sürümünü günceller.

## Kullanıcının manuel kontrol adımları

Takip düzenlemesi: kullanıcının isteğiyle açık sidebar ve mobil menüde sürüm satırı `PDA Version : v2.9.9` oldu. Daraltılmış sidebar `v2.9.9` gösterir; title tam etiketi içerir. Footer aynı sürümü kullanır. `--grep 'tr: shared version' --output=tmp/frontend-fixes/version-label-results` hedefli Playwright kontrolü 1/1 PASS; geniş/dar sidebar, mobil menü ve landing footer doğrulandı. Commit/push yapılmadı.

1. Projeler/Organizasyonlar açık-koyu tema kapakları, logo zemini ve yeni proje dosya seçimi önizlemesi.
2. Toplantılarım oluşturma butonu; proje/bağımsız form planlama ve ikon seçimi; tür/proje seçici ve formun listeyle hizası.
3. Planlı toplantıda Hemen başlat; açık toplantıda Katıl ve oda içindeki Davet et.
4. Toplantı sürerken başka sayfaya geçiş: mini geri dönüş düğmesinin tam yazısı, sürükleme ve geri dönme.
5. Görevlerim araması, filtrelerle birlikte kullanım ve temizleme; yeni görev formunda breadcrumb olmaması.
6. Ayarlar altındaki `v2.9.9`, sidebar daraltma/mobil menü ve oturumsuz landing footer sürümü.
7. Sonuçları chatte bildirin. Onaydan sonra yukarıdaki branch ayrımı ve ayrıntılı imzasız commit/push adımı yapılacak; landing tasarım güncellemesi sonra ele alınacak.
