# Project Service frontend iyileştirmesi

**Tarih:** 2026-09-28  
**Durum:** Tamamlandı

## Kapsam ve yapılanlar

Mevcut Project Service arayüzü korundu. Proje ve organizasyon listelerinde API durum/öncelik kodları yerine TR/EN/DE çevirileri gösteriliyor. Organizasyon ayrıntısındaki düzenleme ve arşivleme eylemleri yalnız organizasyon sahibine gösteriliyor; sunucudaki yetki kontrolü geçerliliğini sürdürüyor. Proje sekmeleri dar ekranda kendi alanında kaydırılıyor. Uygulama üst çubuğu mobilde iki satıra yerleşiyor ve uzun kullanıcı adı kısaltılıyor. Proje ayarları kaydedilirken düğme işlem tamamlanana kadar pasif kalıyor; başarılı yanıttan sonra formun kirli durumu sıfırlanıyor.

Önemli dosyalar: [app-shell.tsx](../../frontend/src/components/layout/app-shell.tsx), [project-detail.tsx](../../frontend/src/features/projects/components/project-detail.tsx), [project-list.tsx](../../frontend/src/features/projects/components/project-list.tsx), [project-settings-form.tsx](../../frontend/src/features/projects/components/project-settings-form.tsx), [organization-detail.tsx](../../frontend/src/features/organizations/components/organization-detail.tsx), [organization-list.tsx](../../frontend/src/features/organizations/components/organization-list.tsx), [TR mesajları](../../frontend/src/i18n/messages/tr.json), [EN mesajları](../../frontend/src/i18n/messages/en.json), [DE mesajları](../../frontend/src/i18n/messages/de.json).

## Doğrulama

| Kontrol | Sonuç |
| --- | --- |
| `npm.cmd run lint` (`frontend/`) | Geçti |
| `npx.cmd tsc --noEmit` (`frontend/`) | Geçti |
| `npm.cmd run build` (`frontend/`) | Geçti; 9 statik/dinamik uygulama yolu derlendi |
| `npm.cmd run test:e2e` (`frontend/`) | Çalışan yerel stack üzerinde 11/11 geçti |
| Playwright Chromium, yeni üretim derlemesi | API yanıtları tarayıcıda taklit edilerek `/projects`, `/organizations` ve proje ayrıntısı 390 pikselde; proje listesi ve ayrıntısı 320 pikselde denetlendi. Sayfa yatay taşması yok. Yöneticiye görünen yedi sekme, sayfa taşmadan kendi kaydırma alanına yerleşiyor. |
| `git diff --check` | Geçti |

## Açık konular

Yerel `localhost:3000` sunucusu önceki frontend derlemesini servis ediyordu; 11 gerçek API uçtan uca testi bu çalışan sunucuda geçti. Bu teslimin yeni görünümünü doğrulamak için üretim derlemesi `localhost:3001` üzerinde açıldı ve tarayıcı kontrolünde API yanıtları taklit edildi. Bu nedenle yeni görünümün gerçek API ile tam uçtan uca koşusu, geliştirme sunucusu güncel kaynakla yeniden başlatıldığında tekrar yapılmalıdır.

**Sonraki teslimle çözüldü (2026-09-28):** [Project frontend yeniden tasarımında](2026-09-28-project-frontend-yeniden-tasarim.md) `localhost:3000` frontend konteyneri güncellendi ve yeni kod gerçek backend ile 12/12 E2E testinden geçti.

Auth servisinin login/register ekranları ile henüz bulunmayan Work Service bu iyileştirmenin kapsamına girmedi. Git commit/push yapılmadı.

## Kullanıcı kontrolü

1. Güncel frontend'i ve backend'i yeniden başlatın. `/projects` ve `/organizations` listelerinde durumların `ACTIVE` gibi kodlar yerine seçili dilde gösterildiğini kontrol edin.
2. Organizasyon sahibi olmayan hesapla organizasyon ayrıntısını açın; düzenleme ve arşivleme eylemleri görünmemeli. Sahip hesapta görünmeli.
3. Tarayıcıyı yaklaşık 320–390 piksel genişliğe daraltın. Üst gezinmede sayfa yatay taşmamalı; proje ayrıntısındaki sekmeler kendi içinde kaydırılmalı.
4. Proje ayarını kaydedin. İstek sürerken kayıt düğmesi pasif kalmalı; başarılı yanıttan sonra değişiklik yapılmadıkça tekrar etkinleşmemeli.
