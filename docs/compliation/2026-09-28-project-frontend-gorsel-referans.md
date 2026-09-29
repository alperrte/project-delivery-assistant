# Project Service görsel referans uyarlaması

**Tamamlanma tarihi:** 2026-09-28  
**Durum:** Tamamlandı

## Kapsam ve yapılanlar

Kullanıcının verdiği çalışma alanı görseli esas alınarak Project Service proje ayrıntısı yeniden düzenlendi: sabit sol bölüm menüsü, proje kimliği ve meta bilgileri, beş özet kartı, gerçek kriterlerin kısa listesi, proje profili ve hızlı bölüm geçişleri. Mobil ekranda bölüm menüsü açılır seçici olarak kalır; özet kartları iki sütuna iner. Kartlardaki kriter, üye, ekip, davet ve depo değerleri mevcut API'lerden gelir. Mevcut backend sözleşmesinde bulunmayan aktivite akışı ve zaman grafiği uydurulmadı.

Login sayfasındaki Inter gövde ve Exo 2 başlık fontu ortak font yüklemesine taşındı. Uygulama alanının açık/koyu renk değişkenleri login sahnesinin mürekkep, camgöbeği ve mavi paletinden türetildi; login ekranının kendi görünümü korundu. Proje kriterlerine çalışan tamamlanan/devam eden filtreleri ve arama eklendi. Üye ve davet tabloları rol/tarih bilgileriyle genişletildi; ekipler açıklamalı kartlarla, depo boş durumu merkezli panelle gösteriliyor.

Önemli dosyalar: [proje çalışma alanı](../../frontend/src/features/projects/components/project-detail.tsx), [proje özeti](../../frontend/src/features/projects/components/project-overview.tsx), [kriterler](../../frontend/src/features/criteria/components/criteria-list.tsx), [üyeler](../../frontend/src/features/projects/components/members/member-list.tsx), [davetler](../../frontend/src/features/invitations/components/invitations-panel.tsx), [ekipler](../../frontend/src/features/squads/components/squad-list.tsx), [depo](../../frontend/src/features/repository/components/repository-settings.tsx), [uygulama kabuğu](../../frontend/src/components/layout/app-shell.tsx), [renk ve tipografi](../../frontend/src/app/globals.css), [font yükleme](../../frontend/src/app/layout.tsx), [tarayıcı testi](../../frontend/e2e/03-project-navigation-responsive.spec.ts). TR/EN/DE mesaj dosyaları güncellendi.

## Doğrulama

| Kontrol | Sonuç |
| --- | --- |
| `npm.cmd run lint` (`frontend/`) | Geçti |
| `npx.cmd tsc --noEmit` (`frontend/`) | Geçti |
| `npm.cmd run build` (`frontend/`) | Ağ erişimiyle geçti; Exo 2, Inter ve JetBrains Mono derlemeye alındı |
| TR/EN/DE çeviri anahtar karşılaştırması | Üç dosyada 387 anahtar eşleşiyor |
| Playwright görsel kontrol | Proje özeti koyu tema 1440/390 ve açık tema 1440 pikselde, diğer alt bölümler masaüstünde incelendi; yatay taşma yok. Görsel kontrolde örnek API yanıtları kullanıldı. |
| `npm.cmd run test:e2e` (`frontend/`) | Güncel `localhost:3000` ve gerçek backend üzerinde **13/13 geçti**; yeni kriter arama/filtre testi dahil. |
| `git diff --check` | Geçti |

## Açık konular

Aktivite geçmişi ve tarihsel ilerleme grafiği için backend verisi yok. Bu alanlar, gerçek sözleşme sağlandığında eklenebilir. Yeni `main` durumunda Docker Compose frontend servisi bulunmadığı için önceki frontend konteyneri durduruldu; güncel üretim derlemesi yerel `npm run start` ile 3000 portunda çalışıyor. Kod için commit veya push yapılmadı.

## Kullanıcı kontrolü

1. [Yerel siteyi](http://localhost:3000/projects) açın, bir projeye girin. Referanstaki sol menü, başlık, özet kartları ve alt bilgi panellerinin düzenini kontrol edin.
2. Kriterler bölümünde “Tamamlanan”/“Devam eden” filtrelerini ve aramayı deneyin. Görünen kriterler seçime uymalı; sıralama düğmeleri filtreliyken pasif olmalı.
3. Üyeler, Davetler, Ekipler, Depo ve Ayarlar bölümlerini açın. Rolleri, tarihleri, ekip açıklamalarını ve boş durumları kontrol edin.
4. Tarayıcıyı mobil genişliğe indirin ve açık/koyu temayı değiştirin. Sayfada yatay kayma olmamalı; yazılar ve eylemler okunaklı kalmalı.
