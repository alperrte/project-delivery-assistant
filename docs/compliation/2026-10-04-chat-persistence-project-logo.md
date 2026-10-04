# Persistent chat ve proje ayarlarında logo

## Teslim ve durum

2026-10-04 tarihinde tamamlandı. Branch: `project-service-frontend`.
Kapsam: seçili proje aynı kaldığında sohbetin authenticated çalışma alanında korunması ve proje ayarlarında mevcut logonun gösterilmesi/yönetimi.
Commit, staging veya push yapılmadı. Başlangıçtaki kullanıcı prompt dosyası korundu.

## Yapılanlar ve nedenleri

- Sohbet sağlayıcısı zaten ortak AppShell'deydi; sorun yalnız URL'deki proje slug'ını bağlam kabul etmesiydi. Genel Takvim/Görevler gibi sayfalarda slug kaybolunca reducer sohbeti kapatıyordu. Provider şimdi sidebar ve Takvim ile aynı `useSelectedProject` kaynağını kullanıyor.
- Aynı seçili projede full/bar/compact, etkin konuşma, geçmiş, taslak ve unread korunuyor. Mesajlaşma düğmesi bulunulan sayfada açıyor. Üç görünümde de X kapatıyor; sonraki navigasyon otomatik açmıyor.
- Gerçek proje/kullanıcı değişimi veya 403/404 erişim kaybı sohbet state'ini sıfırlıyor. Sayfa bileşenleri seçim çözülürken remount edilmediği için oluşturma dosyaları/form taslakları korunuyor. İlk keyed-provider denemesinde bulunan oluşturma regresyonu bu sınırla giderildi.
- Socket ömrü kullanıcı/proje kimliğine bağlı. Aynı proje navigasyonu yeni socket/SUBSCRIBE oluşturmuyor; değişimde tüm eski bağlantılar/timer'lar kapanıyor. Token yenilemesindeki mevcut 3 saniyelik kontrollü örtüşme korunuyor.
- Direct-open/send/catch-up ve read hata callbacks generation guard kullanıyor. A→B→A'da gecikmiş yanıt yeni state/cache'e taşınmıyor. Chat sorguları AbortSignal ile iptal edilip ilgili proje cache'i temizleniyor. Logout ve aynı QueryClient üzerinde başka hesapla giriş doğrulandı. Landing demosu gerçek chat bağlantısını devre dışı bırakıyor.
- Logo DTO'da mevcuttu; settings'te logo alanı yoktu ve header yalnız harf çiziyordu. Ortak `ProjectMark` ve `projectLogoSource` kart, oluşturma, settings, header ve chat'in aynı versioned media bilgisini kullanmasını sağlıyor. Mevcut invitation/yerel preview kaynak öncelikleri korunuyor.
- Ayarlara upload/replace/remove, silme onayı ve PNG/JPEG/WebP–512 KB–boş dosya ön kontrolü eklendi. Başarılı işlemler mevcut `["projects"]` invalidation ile gerçek server version'ını alıyor; genel ayar formundaki kaydedilmemiş metinleri resetlemiyor. Hatalarda eski logo korunuyor, inline hata/toast gösteriliyor; işlem boyunca logo kontrolleri karşılıklı pasif.
- TR/EN/DE metinleri tamamlandı. Görsel yüklenmezse ilk harf, chat grubunda mevcut kişiler ikonu kullanılıyor. Yeni version hata fallback'inden tekrar görsele geçebiliyor.
- Genel kalite kapısında rastlanan gerçek GitHub ağ timeout'u için mevcut lifecycle E2E, yalnız HTTP 503'ü en fazla üç kez yeniden deniyor; gerçek `201 Created`, depo ve commit görünümü doğrulanıyor. Yetki/validation/rate-limit/uygulama hataları yeniden denenmiyor ve dış yanıt mock edilmedi.

## Önemli dosyalar

| Alan | Dosyalar |
| --- | --- |
| Chat sahibi/lifetime | [chat-provider.tsx](../../frontend/src/features/chat/chat-provider.tsx), [use-chat-socket.ts](../../frontend/src/features/chat/use-chat-socket.ts), chat API/hooks, chat-nav-item |
| Seçim ve iptal | [use-selected-project.ts](../../frontend/src/features/projects/hooks/use-selected-project.ts), [client.ts](../../frontend/src/lib/api/client.ts), project-sidebar-nav |
| Logo | [project-logo-field.tsx](../../frontend/src/features/projects/components/project-logo-field.tsx), [project-mark.tsx](../../frontend/src/features/projects/components/project-mark.tsx), [logo-validation.ts](../../frontend/src/features/projects/logo-validation.ts), projects API/detail/settings/card/create logo-field |
| Paylaşılan renderer tüketicileri | Squad team-card, team-chart ve team-detail-page importları |
| Dil ve demo | `frontend/src/i18n/messages/{tr,en,de}.json`, landing demo workspace |
| Regresyon | [17-project-chat.spec.ts](../../frontend/e2e/17-project-chat.spec.ts), [project-logo-settings.spec.ts](../../frontend/e2e/project-logo-settings.spec.ts), banner ve lifecycle E2E |
| Belgeler | [Uygulama planı](../../PDA_CHAT_PERSISTENCE_PROJECT_LOGO_PLAN.md), architecture, folder-structure, frontend-design-rules, SECURITY chat lifetime açıklaması, ilgili web checklist doğrulama notu |

Backend kodu, migration, dependency veya ENV değişikliği yok. Yeni API teslimi yok; mevcut logo GET/PUT/DELETE ve chat REST/user-queue sözleşmesi kullanıldı. Auth/cookie/CSRF/CORS/yetki mekanizması değiştirilmedi.

## Doğrulama

| Komut / kontrol | Sonuç |
| --- | --- |
| `npm.cmd run lint` | Başarılı, son koşuda hata/uyarı yok |
| `npx.cmd tsc --noEmit` | Başarılı |
| `npm.cmd run build` | Next.js production build başarılı |
| `E2E_REUSE_USERS=1` ile chat + logo + banner + create Playwright paketleri | 37/37 başarılı; iki ek chat testi sonrası chat paketi ayrıca 20/20 başarılı |
| `.\pre-push\pre-push.cmd` (`E2E_REUSE_USERS=1`) | Son koşu exit 0: **PDA PRE-PUSH CHECK PASSED** |
| Kapıdaki `backend\mvnw.cmd clean verify` | 404 test, 0 failure/error/skip; Testcontainers ve mimari kontrolleri dahil, BUILD SUCCESS |
| Kapıdaki tüm frontend Playwright testleri | 171 toplam: **170 passed, 1 skipped**; production'da dev crash boundary testi bilerek atlandı |
| Docker Compose config/build/up ve smoke | Başarılı; postgres healthy, backend health HTTP 200 |
| Test sonrası Next dev geri açılması | Aynı `next dev` komutu, 3000 portu; frontend `/tr` HTTP 200, backend health HTTP 200 |
| `git diff --check`, staged diff kontrolü | Temiz; staged değişiklik yok |

Chat E2E: gerçek client-side global/section/nested ekip navigasyonu, üç mode, üç X, draft/history/unread, iki kullanıcıyla canlı/deduplicated teslim, URL ve Takvim üzerinden proje değişimi, socket/SUBSCRIBE sayacı, gecikmiş send/direct-open, hesap değişimi, token yenileme, revoked session, dış kullanıcı reddi ve TR/EN/DE/mobil akışlar.

Logo E2E: kalemle settings'e giriş, gerçek image load (`naturalWidth > 0`), header/card/chat version yenilenmesi, kaldırma/iptal, dirty form, invalid/empty/oversize dosya, upload/delete başarısızlığı, disabled kontroller, image 404 sonrası yeni version ve TR/EN/DE açık/koyu mobil yerleşim/klavye. Ekran görüntüleri görsel olarak incelendi. Banner ve oluşturma dosya önizleme akışları da geçti.

İlk koşulardaki test selector/status beklentileri düzeltildi; yukarıdaki sonuç son başarılı kapıya aittir. Maven/Surefire test JVM'i kapanırken 30 saniyelik fork shutdown uyarısı yazdı; 404 test başarılı ve Maven çıkışı 0. Ayrıntılı yerel kapı çıktısı `.local/qa/chat-logo-pre-push.log` dosyasında; bu geçici log gitignore kapsamındadır.

## Açık konular / sınırlar

Kalan blocker yok. Persistence client-side authenticated navigasyonu kapsar; browser reload, dil değişiminin tam belge yüklemesi veya app layout'tan çıkış sonrasında sohbet otomatik açılmaz. Mesaj/taslak browser storage'a eklenmedi. Tarayıcı doğrulaması Chromium ile sınırlı; web checklist'in proje geneli/tüm tarayıcılar/production maddeleri bu kapsamla tamamlandı sayılmadı.

## Kullanıcının manuel kontrolü

1. Aynı projede direkt sohbet aç, taslak yaz, küçült; Görevler → Takvim → Ekipler → Projeler → Ayarlar'a git. Bar, etkin kişi ve taslak korunmalı; başka kullanıcıdan gelen mesaj unread'i artırmalı.
2. Barı compact/full aç; geçmiş/taslak korunmalı. Her görünümde X ile kapatıp başka sayfaya geç; yeniden açılmamalı. Mesajlaşma düğmesi mevcut sayfada tekrar açmalı.
3. Takvim seçicisinden veya proje kartından B'ye geç. A'nın sohbeti kapanmalı; B açıldığında A'nın taslağı/konuşması görünmemeli. Logout sonrasında chat kalmamalı.
4. Logolu projenin kartındaki kalemle settings'e gir. Logo ayarlarda ve başlıkta görünmeli. Slogan alanına kaydedilmemiş metin yazıp logoyu değiştir; metin korunmalı, kart/header/chat yeni logoyu göstermeli.
5. Logo kaldırmayı önce iptal, sonra onayla. Onaydan sonra settings/header/card ilk harfe ve chat grubu kişiler ikonuna dönmeli. Genel form Kaydet düğmesi logo işlemi için gerekmemeli.
6. TR/EN/DE, light/dark ve mobilde logo alanı, düğmeler ve chat dock'u kontrol et. Geçersiz/büyük/boş dosya açık hata göstermeli ve mevcut logo korunmalı.
