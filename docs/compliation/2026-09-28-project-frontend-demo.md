# Project Service dolu veri önizlemesi

**Tamamlanma tarihi:** 2026-09-28  
**Durum:** Tamamlandı

## Kapsam ve yapılanlar

Kullanıcının görsel referansıyla karşılaştırma yapabilmesi için gerçek Project Service ekranlarını örnek API yanıtlarıyla açan bir Chromium önizlemesi eklendi. Demo projede 20 başarı kriteri (7 tamamlandı), 5 üye, 2 davet, 2 ekip, proje hedefi/tarihleri/teknolojisi ve bağlı olmayan GitHub deposu bulunur. Proje, organizasyon ve yedi proje bölümü aynı pencerede gezilebilir. Demo verisi yalnız bu tarayıcı penceresinde yaşar; veritabanına yazılmaz ve tüm API yazma istekleri engellenir.

Genel bakışa mevcut kriterlerin `createdAt` ve `completedAt` alanlarından türetilen son kriter hareketleri ve aylık tamamlanma eğilimi eklendi. Grafik, mevcut kriterlerin tamamlanma tarihlerinden hesaplanır; geçmişte silinmiş kriterleri veya başka servislerin olaylarını temsil etmez. Proje profili mobilde okunabilir biçimde alt alta yerleşir.

Önemli dosyalar: [demo başlatıcısı ve örnek yanıtlar](../../frontend/scripts/preview-project.cjs), [npm komutu](../../frontend/package.json), [aktivite ve grafik](../../frontend/src/features/projects/components/project-criteria-insights.tsx), [genel bakış](../../frontend/src/features/projects/components/project-overview.tsx), TR/EN/DE çeviri dosyaları.

## Doğrulama

| Kontrol | Sonuç |
| --- | --- |
| `npm.cmd run lint` (`frontend/`) | Geçti |
| `npx.cmd tsc --noEmit` (`frontend/`) | Geçti |
| `npm.cmd run build` (`frontend/`) | Geçti |
| TR/EN/DE anahtar karşılaştırması | Üç dosyada 396 anahtar eşleşiyor |
| `npm.cmd run preview:project` (`frontend/`) | Demo Chromium penceresi açıldı; genel bakış ve altı bölümün ekran görüntüsü `tmp/project-preview/` içine alındı. Mobil genel bakış da incelendi. |
| `npm.cmd run test:e2e` (`frontend/`) | Güncel üretim frontend ve gerçek backend üzerinde **13/13 geçti**. |
| `git diff --check` | Geçti |

## Açık konular

Önizleme penceresi Playwright yanıt yakalama ile çalışır: aynı URL normal tarayıcı sekmesinde açılırsa demo verisi gelmez. Tam kapsamlı aktivite geçmişi ve tarihsel proje ilerlemesi için backend sözleşmesi henüz yok. Git commit veya push yapılmadı.

## Kullanıcı kontrolü

1. Açılan Chromium demo penceresindeki “PDA Öğrenci Platformu” genel bakışını verdiğiniz görselle karşılaştırın: 35% ilerleme, 20 kriter, 5 üye, 2 davet ve aktivite/grafik alanları görünür.
2. Sol menüden Kriterler, Üyeler, Davetler, Ekipler, Depo ve Ayarlar bölümlerini açın. Gerçek UI bileşenleri örnek içerikle dolmalıdır. Form açılabilir, ancak değişiklik kaydedilemez.
3. Pencereyi yeniden açmak için frontend klasöründe `npm.cmd run preview:project` çalıştırın. Önce uygulamanın `localhost:3000` üzerinde açık olması gerekir. Yerel ekran görüntüleri `tmp/project-preview/` altındadır.
