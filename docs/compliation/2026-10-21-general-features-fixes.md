# General Features: seçili proje kalıcılığı ve canlı veri senkronizasyonu — 2026-10-21

Branch: `general-features` (mevcut branch; yeni branch, push, merge veya deploy yok).

## 1. Tamamlanan kapsam

**GF-01 — Seçili proje sayfa/sekme/oturum geçişlerinde korunur.**
- Kök neden: seçim sekmeye özel `sessionStorage` içindeydi; yeni sekme ve yeniden açılış seçimi kaybediyor, ilk projeye düşüyordu.
- `useSelectedProject` önceliği: URL slug'ı → bu hesabın hatırlanan slug'ı → ilk erişilebilir proje → boş durum.
- Hatırlanan değer `localStorage` içinde `pda:last-project:<userId>` anahtarında **yalnız düz slug** olarak tutulur (kullanıcıya özel). Token, cookie, JWT, oturum sırrı veya API verisi hiçbir web storage alanına yazılmaz. Bozuk/uzun/`/?#` içeren değer yok sayılır.
- Başka sekmedeki seçim `storage` olayıyla gelir; açık sayfanın URL'si zorla değiştirilmez.
- Eski `sessionStorage` kaydı tek seferlik göç ettirilir (paylaşılan seçim varsa o kazanır, eski anahtar silinir). Okuma saftır, göç efekttedir: hydration uyuşmazlığı ve flicker yok.
- 403/404 (proje silindi / erişim kaybı): hatırlanan değer silinir, ilk erişilebilir projeye düşülür; hiç proje yoksa boş durum. İlk-proje yedek sorgusu yalnız başka kaynak yokken çalışır.

**GF-02 — F5 gerektirmeden veri senkronizasyonu (merkezi TanStack Query stratejisi).**
- `frontend/src/lib/api/live-sync.ts` + `components/providers.tsx` varsayılan sorgu seçenekleri.
- `projects`, `tasks`, `organizations` kök anahtarlı sorgular görünür sekmede 15 sn'de bir yenilenir; gizli sekmede poll yok (`refetchIntervalInBackground` kapalı). Sekmeye dönüşte `staleTime` (30 sn) dolmuşsa yenilenir. `refetchOnWindowFocus` körlemesine açılmadı; yalnız bu aileler için fonksiyonla açıldı.
- Hata yönetimi: ardışık hatada aralık 15 sn × 2^n (en çok 120 sn); kalıcı 4xx'te (408/429 hariç) durur; toast üretilmez; mevcut `shouldRetryQuery` sınırı korunur.
- Hariç tutulanlar: `repository`, `candidates`, `picker`, `sidebar-switcher` anahtar parçaları; form kaynakları (`STILL_QUERY`: takım, hatırlatıcı, kriter, organizasyon ve görev düzenleme sorguları) polling ve odak yenilemesinden muaftır, böylece açık form sıfırlanmaz.
- Arka plan yenileme hatası son iyi veriyi ekranda bırakır; sayfa hata ekranları `hasBlockingError` ile yalnız ilk yükleme hatasında veya kalıcı 4xx'te devreye girer. Arka plan başarılı yenilemede tam sayfa skeleton yok.
- Dashboard `useQueries` anahtarı `["projects", id, "home"]` olarak invalidation kapsamına alındı.
- Bildirimler, davetler, toplantılar kendi mevcut zamanlayıcılarında; sohbet kendi kanalında kaldı (dokunulmadı).
- Yeni WebSocket/SSE/Redis/harici servis/bağımlılık yok. Backend, API sözleşmesi, auth, cookie, CSRF, CORS ve ENV değişmedi.

## 2. Değişen önemli dosyalar

- Yeni: `frontend/src/lib/api/live-sync.ts`, `frontend/e2e/general-features.spec.ts`.
- Çekirdek: `frontend/src/features/projects/hooks/use-selected-project.ts`, `frontend/src/components/providers.tsx`, `frontend/src/features/tasks/hooks.ts` (`useTask(..., editing)`).
- `hasBlockingError` uygulanan sayfalar: projeler (liste/detay/genel bakış), görevler (liste, pano, havuz, Görevlerim sayfa ve kart, detay, form), kriterler, organizasyonlar (liste/detay), sprintler (liste/detay), etiketler, ekipler, dashboard.
- `STILL_QUERY`: takım, hatırlatıcı, kriter, organizasyon form sayfaları; `refetchInterval: LIVE_REFRESH_MS`: ekipler sayfası ve ekip detayı.
- Mevcut e2e: `07-reminders`, `project-delete-navigation`, `sidebar-project-switcher` (storage alanı `localStorage` oldu).
- Dokümanlar: `.agents/architecture.md`, `.agents/folder-structure.md`, `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`, bu kayıt.

## 3. Çalıştırılan doğrulama komutları

```
cd frontend
npm run lint
npx tsc --noEmit
npm run build
npm run check:bundle
E2E_REUSE_AUTH=1 npx playwright test e2e/general-features.spec.ts        # ilk koşu E2E_REUSE_AUTH olmadan (global setup)
E2E_REUSE_AUTH=1 npx playwright test <21 etkilenen spec> e2e/general-features.spec.ts
git -c core.safecrlf=false diff --check
```

Ortam: Docker Compose (backend + PostgreSQL) güncel kodla yeniden kuruldu; `docker-compose.e2e.yml` 2026-10-10'da silindiği için geçici (repo dışı) bir override ile Mailpit + yükseltilmiş rate limit eklendi; frontend `next start` ile port 3000'de production build üzerinde koşuldu. Tarayıcı: yalnız Chromium.

## 4. Test/doğrulama sonuçları

- `npm run lint`: temiz. `npx tsc --noEmit`: temiz. `npm run build`: başarılı. `npm run check:bundle`: tüm route'lar bütçe içinde. `git diff --check`: temiz.
- Not: bu makinede `livekit-client` (package.json'da tanımlı) kurulu değildi; `npm install --no-save` ile kuruldu (package.json/lock değişmedi). Aksi halde build toplantı odası importunda düşüyordu; değişikliklerle ilgisi yok.
- `general-features.spec.ts`: 10/10 PASS (3 saf politika testi, 3 GF-01, 4 GF-02 tarayıcı testi: yeni sekme/yeniden açılış/URL önceliği/yalnız slug depolanması, eski göç + erişim kaybı fallback'i, çapraz sekme senkronu, başka yerde oluşturulan görevin F5'siz listede ve Görevlerim'de görünmesi, gizli sekmede polling olmaması, 503'te liste kalıp toast/alert çıkmaması ve toparlanma, açık düzenleme formunun ezilmemesi).
- Etkilenen 21 mevcut spec + yeni spec (iki koşu):
  - 1. koşu (21 mevcut spec): 134 PASS, 2 skip, 1 FAIL — `06-calendar-page.spec.ts` ("Bugün" düğmesi 10 sn'de görünmedi). Aynı spec tek başına, `01-project-lifecycle` ile birlikte ve `--repeat-each=8` ile PASS; 2. koşuda da PASS. Kök neden **kanıtlanmadı**; tekrarlanmadığı için aralıklı (flaky) kabul edildi.
  - 2. koşu (22 spec): 144 PASS, 2 skip, 1 FAIL — benim `general-features` testim: Görevlerim, hesapta biriken 39 eski açık görev nedeniyle yeni görevi ilk sayfada göstermedi (sıralama bitiş tarihine göre). Test, `/tasks?project=<id>` ile kendi projesine filtrelenerek düzeltildi; ardından spec 10/10 PASS. Ürün kodu değişmedi.
- Backend değişmediği için backend testi koşulmadı.

## 5. Açık kalan konular ve doğrulanmayan sınırlar

- **Tam pre-push (`.\pre-push\pre-push.cmd`) çalıştırılmadı**; geçti iddiası yoktur. Tam E2E paketi (141 spec) koşulmadı, yalnız etkilenen 21 spec + yeni spec koşuldu.
- Yalnız Chromium; Safari/Firefox, gerçek mobil cihaz ve ekran okuyucu doğrulanmadı. Konsol/hydration denetimi yeni spec içindeki `pageerror`/konsol filtresiyle yapıldı; ayrıca elle tarayıcı gözlemi yapılmadı.
- `06-calendar-page` tek seferlik hatasının nedeni bilinmiyor (bkz. 4).
- Gerçek yük altında 15 sn'lik polling'in backend'e etkisi ölçülmedi (kullanıcı başına açık görünür sekme sayısıyla ölçeklenir). Gerekirse `LIVE_REFRESH_MS` tek yerden ayarlanır.
- `pda:last-project:<userId>` anahtarı (işlevsel tercih, kişisel veri değil, yalnız slug) Çerez Politikası metninde ayrıca sayılmıyor; hukuki sayfalar ertelendiği için bu, o turda ele alınacak. `legal-pages.spec.ts` bu anahtarı kod taramasıyla denetlemiyor, test etkilenmedi.
- Hesaplar arası paylaşılan tarayıcıda (ortak bilgisayar) her hesabın anahtarı ayrıdır; çıkışta anahtar silinmez (yalnız slug, hassas değil).
- Test makinesinde geçici işlemler: port 3000'de benim başlattığım `next start` ve Mailpit konteyneri açık kalmış olabilir; backend, geçici e2e override'ıyla çalışıyor olabilir (aşağıdaki manuel adımlara bakın).

## 6. Kullanıcının manuel kontrol adımları

1. İki sekme açın, birinde bir projeyi seçin; yeni sekmede uygulamayı açın: aynı proje seçili gelmeli. Tarayıcıyı kapatıp açın: yine aynı.
2. Bir proje URL'sini doğrudan açın: URL'deki proje, hatırlanan projeden önce gelmeli.
3. Seçili projeyi silin / üyelikten çıkarın: başka sekmede yenilemeden ilk erişilebilir projeye düşmeli; hiç projeniz yoksa boş durum görünmeli.
4. DevTools → Application → Local Storage: yalnız `pda:last-project:<kullanıcı-id>` = proje slug'ı olmalı; token/JWT/cookie değeri bulunmamalı.
5. İki tarayıcıda aynı projeye girin; birinde görev oluşturun/durumunu değiştirin: diğerinde F5 olmadan ~15 sn içinde (Görevler, Pano, Görevlerim, Proje genel bakış, Dashboard) güncellenmeli.
6. Görev düzenleme formunu açıp bir şey yazın, başka tarayıcıdan aynı görevi değiştirin: yazdığınız değer kaybolmamalı. Liste filtresi, scroll, açık modal korunmalı.
7. Sekmeyi gizleyin (başka sekmeye geçin) ve Network'e bakın: gizliyken istek gitmemeli; döndüğünüzde bayat veri yenilenmeli.
8. Ağ bağlantısını kesin: liste ekranda kalmalı, hata toast'ı çıkmamalı; bağlantı gelince kendiliğinden toparlanmalı.
9. Aktif sohbet ve toplantı bağlantıları yenilemelerden etkilenmemeli.
10. Test makinesi temizliği (geçici): port 3000'de `next start` çalışıyorsa ve sizin sunucunuz değilse kapatın; `docker compose -f docker-compose.yml up -d --force-recreate backend` ile backend'i normal yapılandırmaya döndürün; varsa `project-delivery-assistant-mailpit-1` konteynerini silin.
