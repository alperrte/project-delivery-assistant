# SSF — Bağlantılı diyagram görünümünün geri getirilmesi

2026-10-22, Europe/Istanbul. Frontend branch: `squad-service-frontend`.

## Tamamlanan kapsam

İlk SSF tesliminde bütün üyeleri göstermek için eski bağlantılı şemanın dikey disclosure listeye dönüştürülmesi gereksiz bir tasarım değişikliğiydi. Kullanıcı geri bildirimi üzerine masaüstü diyagramı geri getirildi: proje kökü, çizgilerle bağlanan rol/ekip/ekipsiz grupları, gerçek parent-child dalları ve eski kompakt14rem ekip kartı ölçeği.

Tüm üyeler/roller/profil fotoğrafı-fallback, benzersiz toplam ve aç/kapat korunur. Üyeler önizleme sayısına kırpılmaz; uzun tam listeler düğüm içinde klavyeyle kaydırılır. Büyük ağaç yalnız kendi alanında yatay kayar; ilk yüklemede kök ortalanır. GF-02 sırasında yatay pan, belge scroll'u ve kapalı düğüm state'i korunur. Mobilde çizgili dikey ağaç ve sınırlı girinti kullanılır. Yeni bağımlılık, ENV veya frontend API sözleşmesi eklenmedi.

## Dosyalar

- `frontend/src/features/squads/components/team-chart.tsx`: diyagram düğümleri, kontrollü alt dallar, kaydırma/klavye.
- `frontend/src/app/globals.css`: yalnız explicit `.org-tree` hiyerarşisine scoped bağlantı çizgileri ve responsive diagram viewport.
- `frontend/e2e/squad-organization.spec.ts`: beş ekipli üç seviyeli görünüm; gerçek CSS connector/grid ayrımı ve GF-02 pan koruması.
- Frontend tasarım kuralları, web checklist ve ilk teslim kaydının takip notu.

## Testler ve bulunan backend sorunu

İlk tekrar koşusu21 PASS +1 FAIL verdi: çok üyeli gerçek API'de206 benzersiz üyeden205'i döndü. Neden tarih alanı eşitliklerinde benzersiz ikinci sıra olmamasıydı; fixture değiştirilmedi. Mevcut proje/ekip/roster GET'lerine tarih+entity ID sırası eklendi ve29 backend entegrasyon testi geçti. Backend değişikliği seçici stash'e alınarak frontend çalışma ağacından ayrıldı; backend/API dokümanı `squad-service-backend` branch'indeki ayrı teslim kapsamındadır. Ayrıntı: backend branch'indeki `docs/compliation/2026-10-22-squad-service-backend.md`.

Son frontend komutları: `npm.cmd run lint`, `npx.cmd tsc --noEmit`, QA API8081 ile `npm.cmd run build`, `npm.cmd run check:bundle`; hedefli Playwright `squad-organization`, `squad-organization-logic`, `teams-page`, `teams-view-toggle` spec'leri. Son koşu **22 PASS, 0 FAIL** (`tmp/ssf-diagram-tests-final.log`). Lint/TypeScript/build/strict bundle başarılıdır. Bağlantı çizgileri ve grid ayrımı, TR/EN/DE × light/dark ×320/375/768/1024/1440, scoped mobil light/dark axe (0 ihlal), console/hydration (0 hata) ve gerçek iki hesaplı yenileme doğrulandı. Görseller `tmp/ssf-diagram-visual-qa/` altındadır; desktop diyagramı ve tam mobil ağaç görsel incelendi.

## Güvenlik ve manuel kontrol

Backend ikincil sıra düzeltmesi mevcut yetki/DTO/CSRF/CORS/ENV/modül sınırlarını değiştirmez. Gerçek kullanıcı verisi yerine mevcut izole SSF QA8081/5437/3001 kullanıldı. Tam pre-push planlı ertelendi; push, merge veya deployment yapılmadı. Fiziksel cihaz/ekran okuyucu ve global WCAG onayı iddia edilmez.

İzole QA servisleri testlerden sonra kapatıldı; QA volume ve logları korundu. Varsayılan API ayarlarıyla production build ve strict bundle kontrolü de geçti.

Manuel: Ekipler → Şema'da kökten ekip/alt ekiplere uzanan bağlantıları, yatay kaydırmayı, tüm üyeleri ve aç/kapatı kontrol edin. İkinci hesapla durum/üyelik değiştirirken pan ve kapalı düğümlerin kaldığını gözleyin. Büyük üyelik için backend ve frontend commit'leri birlikte entegre edilmelidir.
