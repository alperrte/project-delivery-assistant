# SSF-01 + SSF-02 — Tam proje organizasyon görünümü

Takip düzeltmesi: kullanıcı geri bildirimiyle masaüstündeki bağlantılı diyagram görünümü geri getirildi. Sonraki regresyonda somut olarak bulunan eşit tarihli pagination kaybı ayrıca backend branch'inde düzeltildi; aşağıdaki ilk teslimin “backend değişmedi” değerlendirmesi ilk koşunun tarihsel durumudur. Güncel takip: `2026-10-22-squad-service-chart-diagram.md`; backend kaydı ilgili branch'te `2026-10-22-squad-service-backend.md`.

Tarih: 2026-10-22 (Europe/Istanbul). Branch: `squad-service-frontend`.

## 1. Tamamlanan kapsam

İki görev uygulandı ve hedefli kontrollerle doğrulandı. Eski şema yalnız ekip önizlemesindeki en fazla üç avatarı kullanıyordu; tam proje/ekip üyeliklerini okumuyordu. Ekip olmayan projede Şema seçeneği de görünmüyordu.

Yeni görünüm bütün aktif üyeleri, yöneticileri, gerçek ekip/alt ekip ilişkilerini ve ekipsizleri gösterir. Aynı kişi gerçek ilişkileri nedeniyle birkaç yerde görünse de toplamda `userId` ile tek sayılır. Tüm proje rolleri, nickname, profil fotoğrafı/fallback ve gerçek ekip bağlantıları sunulur. Teknik rolden sahte ekip veya kişisel raporlama ilişkisi üretilmez; e-posta/telefon gösterilmez.

Proje üyeleri `membersApi.listAll`, ekipler `squadsApi.listAll`, roster'lar `squadsApi.allMembers` ile bütün sayfalardan alınır. Aynı anda en fazla dört ekip yüklenir; kişi başına HTTP isteği yoktur. Başarısız roster kısmi başarıya çevrilip üyeler yanlış biçimde ekipsiz gösterilmez. Proje üyelik listesi kimlik/rollerin kanonik kaynağıdır; roster'da kalmış eski kimlikler dışlanır.

Saf `buildOrganization` kimlikleri tekilleştirir, başka projeye ait ekipleri dışlar, gerçek parent-child ağacını kurar. Eksik parent köke alınır; döngü/self-link durumunda bir kenar kesilerek bütün ekipler görünür tutulur.

Native disclosure/list: yönetici/ekip/ekipsiz grupları ve alt ekipler açılır/kapanır; `aria-expanded`, `aria-controls`, Enter/Space, görünür focus ve 44 px düğmeler vardır. Kapalı düğüm ID'leri veri sorgusunun üstünde state olarak korunur. Proje/hesap kapsamlı mevcut `squads` query ailesi GF-02 merkezi polling/focus/backoff kullanır; yeni timer/WebSocket yoktur. Geçici arka plan hatası son iyi veriyi korur; kalıcı erişim hatası ayrıntıları gizler.

Mobilde dikey ağaç ve “Alt ekipler” etiketi vardır; derin girintiler metin alanını daraltmaz. Masaüstünde sınırlı girinti ve kompakt üye grid'i kullanılır. Mevcut token/typography/Avatar/light-dark sistemi korunur; bağımlılık eklenmedi. TR/EN/DE desteklenir.

## 2. Backend/API analizi ve güvenlik

Backend değişikliği ve yeni endpoint gerekmedi. Kaynaktan incelenip gerçek API testinde doğrulanan mevcut sözleşmeler yeterlidir:

- `GET /api/v1/projects/{p}/members?page=&size=`: aktif üyeler, userId, nickname, fotoğraf sürümü, tüm roller. ProjectMembershipService `PROJECT_VIEW` ister; sayfa boyutu en fazla 100.
- `GET /api/v1/projects/{p}/teams?page=&size=`: ekipler, parentTeamId ve metadata; güncel proje üyeliği/`PROJECT_VIEW` kontrolü.
- `GET /api/v1/projects/{p}/teams/{t}/members?page=&size=`: tam roster; ekip aynı projede olmalıdır. Önizleme alanı bunun yerine kullanılmaz.

206 üyede proje ve roster sayfaları, bütün kimlikler ve benzersiz toplam gerçek HTTP ile doğrulandı. Üye olmayan oturumun üç endpoint'e de 403 aldığı görüldü. Modül sınırı, repository erişimi, Java/API sözleşmesi, migration, auth/cookie/CSRF/CORS veya ENV dosyası değişmedi. Backend commit'i/completion dosyası oluşturulmadı.

## 3. Önemli dosyalar

- `frontend/src/features/squads/organization.ts`: saf kimlik/ilişki/ağaç modeli.
- `frontend/src/features/squads/organization-api.ts`: sınırlı eşzamanlı ve iptal edilebilir yükleme.
- `frontend/src/features/squads/components/{team-chart,teams-page}.tsx`: tam erişilebilir şema ve ekipsiz proje görünümü.
- `frontend/src/features/squads/api.ts`: roster'a opsiyonel AbortSignal.
- `frontend/src/features/projects/members-api.ts`: bütün aktif üyelik sayfaları.
- `frontend/src/i18n/messages/{tr,en,de}.json`: yeni metinler.
- `frontend/e2e/squad-organization-logic.spec.ts` ve `squad-organization.spec.ts`: saf ve gerçek API/browser testleri.
- `frontend/e2e/teams-view-toggle.spec.ts`: roster okumasını ekip listesi refetch'iyle karıştırmayan regresyon beklentisi.
- `frontend/e2e/{helpers,global-setup}.ts`: mevcut `NEXT_PUBLIC_API_URL` değerini test HTTP çağrıları/oturum yenilemesinde kullanma; varsayılan 8080 davranışı korunur.
- `.agents/frontend-design-rules.md`: güncel kalıcı şema standardı.
- `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`: yalnız etkilenmiş maddeler için kanıt; global kutular değişmedi.

## 4. Komutlar ve sonuçlar

Frontend dizininde:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
$env:NEXT_PUBLIC_API_URL = 'http://localhost:8081/api/v1'
npm.cmd run build
npm.cmd run check:bundle
```

Hedefli test ortamı:

```powershell
$env:COMPOSE_PROJECT_NAME = 'pda-ssf-qa'
$env:NEXT_PUBLIC_API_URL = 'http://localhost:8081/api/v1'
$env:E2E_BASE_URL = 'http://localhost:3001'
$env:E2E_MAILPIT_URL = 'http://localhost:8026'
# Repo kökünde, caller-owned ignored QA override:
docker compose -f docker-compose.yml -f tmp/docker-compose.ssf.yml up -d --build
# Frontend aynı API URL ile build/start edilir. İlk browser koşusu yeni QA hesapları hazırlar.
npx.cmd playwright test e2e/squad-organization-logic.spec.ts
npx.cmd playwright test e2e/squad-organization.spec.ts e2e/teams-view-toggle.spec.ts e2e/teams-page.spec.ts
# Aynı QA veritabanında hazırlanmış geçerli oturumlarla son mobil kontrol:
$env:E2E_REUSE_AUTH = '1'
npx.cmd playwright test e2e/squad-organization.spec.ts -g 'three-level chart'
```

| Kontrol | Sonuç |
| --- | --- |
| Saf kimlik/rol/sayfalama/bozuk-ağaç | 5 PASS |
| Yeni SSF gerçek API/browser | 6 PASS |
| Mevcut ekip/vitrin seçimi regresyonları | 11 PASS |
| Toplam farklı hedefli test | 22 PASS, 0 başarısız |
| Son mobil iyileştirme sonrası matrix tekrarı | Aynı 3 test PASS; 30 kombinasyon |
| Mobil light/dark chart-scoped axe | WCAG 2/2.1/2.2 AA etiketlerinde 0 ihlal |
| Son lint / tsc / production build / strict bundle | PASS; bütün route'lar bütçe içinde |
| git diff --check | PASS |
| Backend Maven | Backend değişmediği için yeni koşu gerekmedi; API/yetki gerçek backend üzerinde test edildi |
| Tam pre-push | Kullanıcı talimatıyla planlı ertelendi; başarısızlık değildir |

Gerçek API/PostgreSQL senaryoları: 1 üyeli/ekipsiz proje, ilk ekibin F5'siz görünmesi, 206 üyede çok sayfalı proje/roster, ekipsiz üye, çoklu ekip/rol, üç seviye ve boş ekip, başka projeye erişim reddi. İki hesapla davet kabulü, rol/atama/çıkarma, rename, parent taşıma, projeden çıkarma ve ekip silme canlı güncellendi; kapalı yönetici grubu ve gerçek scroll korundu. Çıkarılan hesap eski şemayı göremedi.

Saf testler eksik parent/döngü/self-link/yabancı proje ve eski roster kimliğini kapsar. Büyük fixture'daki yeni hesap/üyelikler yalnız oluşturulan QA projesine test-only SQL ile hazırlandı; görüntüleme, pagination ve kritik mutation/yetki doğrulamaları gerçek HTTP üzerindedir. Mock yalnız saf pagination/hata contract testinde kullanılır.

TR/EN/DE × light/dark × 320/375/768/1024/1440 px: sayfa/chart yatay taşması yok; keyboard, focus, hedefler ve anlamlı etiketler başarılı. Console/pageerror kayıtlarında hata/hydration sorunu yok. Tam mobil ağaç ve desktop görsel incelendi; bulunan derin mobil girinti sorunu düzeltilip matrix tekrar geçti. 30 son görsel `tmp/ssf-visual-qa/` altında; loglar `tmp/ssf-{logic,browser,visual-final,lint-final,tsc-final,build-final,bundle-final}.log`.

## 5. Git ayrımı ve ortam

Başlangıç çalışma ağacı temizdi; önceki PSF işi commit edilmişti. Fetch sonrası iki mevcut remote squad branch'i yerel tracking branch olarak açıldı. Frontend 109, backend 140 commit gerideydi; ikisi de yalnız `--ff-only origin/main` ile `9e67edf0` tabanına getirildi ve main ile `0 0` doğrulandı. Önceki görevler korunmuştur.

Backend dosyası değişmediği için seçici stash/apply/ayrı backend commit'i uygulanamaz ve yapılmadı. Yalnız frontend, ilgili testler ve frontend belgeleri frontend commit'ine alınır. SHA final Git kontrolüyle kullanıcıya raporlanır; bu dosya kendi commit hash'ini içermez.

Çalışan PDA8080/5436 ve diğer projenin3000/8025 servislerine dokunulmadı. SSF ayrı Compose projesi ve yeni volume'lerle API8081/DB5437, frontend3001, yerel SMTP sink8026 kullandı. ENV dosyaları değiştirilmedi; secret/config dökümü alınmadı. Push, son branch merge, release, deployment ve tam pre-push yapılmadı. Başlangıçtaki açıkça istenen güncelleme yalnız fast-forward'dır.

Sonunda yalnız SSF QA servisleri/network'ü ve bu görevde başlatılan3001 frontend'i kapatıldı; volume'ler ve test kanıtları korundu. Derleme çıktısı QA API override'ı kaldırılarak projenin normal yerel ayarıyla yeniden alındı (`tmp/ssf-build-default.log`, PASS). Kaynak/ENV dosyaları bu temizlik için değiştirilmedi.

## 6. Açık sınırlar ve manuel kontrol

Hedefli kontrollerde açık uygulama hatası kalmadı. Tam kalite kapısı bütün PDA görevleri birleştirildikten sonra çalıştırılacak. Fiziksel mobil cihaz, gerçek screen reader, diğer tarayıcılar ve global WCAG/production onayı bu Chromium/axe kapsamından çıkarılamaz. Farklı sayfalı HTTP çağrıları tek atomik snapshot iddiası taşımaz; merkezi yenileme güncel veriye yakınsar.

1. Ekipler → Şema'da yöneticileri, tüm üyeleri, ekip/alt ekipleri ve ekipsizleri inceleyin; çok rollü/çok ekipli kişi toplamda tek sayılmalıdır.
2. Ağacı mouse, Tab ve Enter/Space ile açıp kapatın. Dar mobilde uzun ad/rol/ekip bağlantılarını, light/dark ve TR/EN/DE metinlerini kontrol edin.
3. İkinci hesapla davet/rol/atama/çıkarma/parent/rename/silme yapın; görünür sekmede yaklaşık15 saniyelik yenilemeyi, kapalı düğüm ve scroll korunmasını gözleyin.
4. Projeden çıkarılan hesabın eski ayrıntıları göremediğini kontrol edin.
5. Bütün görevler birleştikten sonra tam pre-push çalıştırın; bu görevde planlı ertelenmesi full-suite başarısı değildir.
