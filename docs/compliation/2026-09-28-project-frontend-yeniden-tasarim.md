# Project Service frontend yeniden tasarımı

**Tamamlanma tarihi:** 2026-09-28  
**Durum:** Tamamlandı

## Kapsam ve yapılanlar

Project Service ve Organization arayüzü kullanıcı geri bildirimine göre yeniden düzenlendi. Proje ayrıntısında masaüstü için yedi bölümlü sol menü, küçük ekran için açılır bölüm seçici var. Proje başlığı, durum, öncelik ve özet gerçek API verilerinden gösteriliyor. Özet ekranında kriter ilerlemesi, ekip ve depo alanları ayrı yüzeylerde; ilerleme çubuğunun iki kez çizilmesine neden olan ortak bileşen hatası düzeltildi.

Proje ve organizasyon listeleri açıklama ve durum içeren, tamamı tıklanabilir tam genişlikli satırlara dönüştü. Organizasyon ayrıntısındaki proje listesi aynı tasarımı izliyor. Üst içerik alanı 1720 piksele kadar genişleyebiliyor; 1440 piksel ekranda yan boşluklar yaklaşık 48 piksel. Proje özetinde gerçek kriter ilerlemesi, ekip sayısı, proje hedefi, teknoloji, hedef tarih ve depo durumu bir çalışma alanına yerleşiyor. Kriter olmayan projede anlamlı başlangıç metni ve ilgili bölüme geçiş bulunuyor. Kriter, üye, davet, ekip, depo, ayar ve davet kabul/red ekranlarının başlık, boş durum, form ve işlem alanları yeniden düzenlendi. İkonla tek başına sunulan üye/davet/ekip eylemleri yazılı düğmelerle anlaşılır hale getirildi. Organizasyon seçicisi teknik ID yerine organizasyon adını gösteriyor. Düğme, seçici ve menü eylemlerinde `cursor: pointer` eklendi; masaüstü ve mobil kullanım için dokunma alanları büyütüldü. Mevcut renk ve yazı sistemi korundu.

Önemli dosyalar: [proje gezinmesi](../../frontend/src/features/projects/components/project-detail.tsx), [proje özeti](../../frontend/src/features/projects/components/project-overview.tsx), [proje satırı](../../frontend/src/features/projects/components/project-card.tsx), [proje listesi](../../frontend/src/features/projects/components/project-list.tsx), [organizasyon listesi](../../frontend/src/features/organizations/components/organization-list.tsx), [organizasyon ayrıntısı](../../frontend/src/features/organizations/components/organization-detail.tsx), [uygulama kabuğu](../../frontend/src/components/layout/app-shell.tsx), [boş durum](../../frontend/src/components/common/empty-state.tsx), [ortak düğme](../../frontend/src/components/ui/button.tsx), [davet yanıtı](../../frontend/src/features/invitations/components/accept-invitation-view.tsx), [mobil gezinme testi](../../frontend/e2e/03-project-navigation-responsive.spec.ts). TR/EN/DE mesaj dosyaları da güncellendi.

## Doğrulama

| Kontrol | Sonuç |
| --- | --- |
| `npm.cmd run lint` (`frontend/`) | Geçti |
| `npx.cmd tsc --noEmit` (`frontend/`) | Geçti |
| `npm.cmd run build` (`frontend/`) | Geçti |
| TR/EN/DE çeviri anahtar karşılaştırması | Üç dosyada 338/338 anahtar eşleşiyor |
| Playwright Chromium görsel ve responsive kontrol | Üretim derlemesinde proje/organizasyon listeleri, proje özeti ve organizasyon ayrıntısı 1440 piksel koyu/açık tema ve 390 piksel koyu temada incelendi. On iki ekranın hiçbirinde yatay taşma yok. Kriter olmayan projenin özet görünümü de kontrol edildi. Görsel kontrolde API yanıtları taklit edildi. Gerçek backend ile mobil açılır seçici ve bölüm geçişi E2E testinde doğrulandı. |
| `docker compose up -d --no-deps --build frontend` | Yerel `localhost:3000` frontend konteyneri güncel kodla yeniden oluşturuldu; backend ve veritabanı yeniden başlatılmadı. |
| `npm.cmd run test:e2e` (`frontend/`) | Güncel `localhost:3000` ve gerçek backend üzerinde **12/12 test geçti**. Proje yaşam döngüsü, davet/rol/ekip ve yeni mobil/masaüstü gezinme testi dahil. |
| `git diff --check` | Geçti |

## Açık konular

Auth servisinin login/register ekranları Alper'in kapsamındadır ve bu teslimde değiştirilmedi. Work Service bulunmadığı için görev/issue ekranları eklenmedi. Git commit veya push yapılmadı.

## Kullanıcı kontrolü

1. [Yerel siteyi](http://localhost:3000/projects) yenileyin. Proje satırını açın; masaüstünde sol menüyü, dar ekranda “Proje menüsü” açılır seçicisini kullanın. Geniş ekranda listenin yanlarında büyük boş sütunlar olmamalı.
2. Genel bakışta ilerleme, ekip, hedef/tarih/teknoloji ve depo alanlarını kontrol edin. “Kriterleri tanımla” ilgili bölüme götürmeli. Kriterler, üyeler, davetler, ekipler, depo ve ayarlar bölümlerinde gerçek verilerinizin ve boş durumların okunaklı göründüğünü kontrol edin.
3. Organizasyon listesini ve bir organizasyon ayrıntısını açın; proje satırlarının tamamı tıklanabilir olmalı. Organizasyon sahibi olmayan hesapta düzenleme/arşivleme düğmeleri görünmemeli.
4. Yeni proje veya kriter penceresini açın; menüleri ve düğmelerin üzerine geldiğinizde imleci kontrol edin.
