# Görevlerim araması ve yeni görev breadcrumb — 2026-10-28

## Tamamlanan kapsam

Görevlerim'e kompakt arama eklendi. Görev anahtarı/başlık/açıklama araması, URL/reload, temizleme, proje/durum filtreleri ve sayfalama birlikte çalışır. Backend mine endpoint'inde q olmadığı için yalnız arama sırasında mevcut filtre kapsamının 100'lük tüm sayfaları iptal edilebilir isteklerle okunur; eşleşmeler frontend'de süzülür. Arama boşken normal sunucu sayfalaması korunur. Yeni görev oluşturma rotasındaki breadcrumb kaldırıldı.

## Değişen önemli dosyalar

`frontend/src/features/tasks/{api,hooks,my-filters}.ts`, `components/{my-tasks-page,task-filter-bar}.tsx` ve `frontend/src/components/layout/app-breadcrumb.tsx`. Ortak sürüm ve toplu standart belgeleri ayrı `general-features` commitindedir.

## Çalıştırılan doğrulama komutları

```powershell
node frontend/node_modules/@playwright/test/cli.js test --config=tmp/frontend-fixes/playwright.config.cjs --grep 'my tasks search' --output=tmp/frontend-fixes/version-task-results
```

Birleşik yerel değişiklikler üzerinde TypeScript ve diff kontrolü de geçti.

## Test/doğrulama sonuçları

130 sentetik görevde ilk 100 kayıttan sonraki eşleşme bulundu. Reload, temizleme, proje/durum filtreleri ve QA-130 görev anahtarı PASS. Türkçe arama ekranı açık/koyu temada 320/390/1440 px'de taşmadan görüntülendi. Yeni görev formu breadcrumb olmadan açıldı. REST fixture'ları kullanıldı; gerçek proje/görev verisi değiştirilmedi.

## Açık kalan konular ve doğrulanmayan sınırlar

Backend/ENV sözleşmesi değişmedi. Çok büyük görev kümelerinde frontend araması kapsamın tüm sayfalarını okumak zorundadır. Kullanıcı isteğiyle pre-push/backend testleri çalıştırılmadı. Bu çalışma 2.9.7 ve 2.9.8'in görev kısmıdır; ortak APP_VERSION ayrı committe 2.9.9 olur. Bu kayıt production yayını anlamına gelmez.

## Kullanıcının manuel kontrol adımları

Görevlerim'de anahtar/başlık arayın; proje ve durum filtrelerini birlikte kullanıp temizleyin. Yeni görev formunda breadcrumb olmadığını kontrol edin. Commitlerin hedefi `task-service-frontend`; push ve main merge kullanıcı tarafından yapılacak.
