# Yerelleştirilmiş UI ve sohbet paneli — 2026-10-04

## Teslim ve durum

Tamamlandı. TR/EN/DE sayfa adresleri, organizasyon formu, proje teknolojileri görünümü ve sohbet panelinin compact konuşma seçicisi uygulandı. Backend API, WebSocket sözleşmesi ve veritabanı değiştirilmedi. Kullanıcı kararı gereği mesajlaşma seçili proje üzerindeki panel olarak kaldı.

## Yapılanlar

- `frontend/src/i18n/routing.ts`, `navigation.tsx`, `request.ts` ve `frontend/src/proxy.ts`: tek sayfa rota tablosundan yerelleştirilmiş adres üretimi/çözümlemesi, eski adresler için 308 yönlendirmesi, mevcut App Router sayfalarına rewrite ve aynı dilde oturum yönlendirmesi. Dinamik slug/ID ve API yolları çevrilmez.
- `frontend/src/components/layout/locale-switcher.tsx` ve `frontend/src/features/settings/session-preferences.ts`: dil değişiminde aynı sayfa, query ve hash korunur; tam sayfa geçişiyle URL, çeviri ve `html[lang]` eşleşir. Uygulama içi Link/router kullanımları ortak `i18n/navigation.tsx` sınırına taşındı.
- `frontend/src/features/organizations/components/organization-form-page.tsx`: ortak create/edit formunda daha açık alan ve hata hiyerarşisi, ilk hatalı alana odak, gönderim bekleme durumu ve mobil eylem çubuğu.
- `frontend/src/features/projects/components/project-overview.tsx`: mevcut teknoloji katalog/ikon bileşenleriyle logo ve tooltip; bilinmeyen teknoloji için genel ikon ve gerçek ad.
- `frontend/src/features/chat/components/{chat-dock,chat-panel,chat-root,message-list}.tsx`: compact pencerede grup ve kişiler arası seçim; mevcut tek `ChatProvider.active` durumu, taslak, unread ve WebSocket akışı korunur. Tam panelde odak ve görünüm düzeni iyileştirildi.
- Public metadata, sitemap ve robots yerelleştirilmiş canonical/hreflang adresleriyle uyumlu hale getirildi. `pre-push/pre-push.ps1` canonical `/tr` ve `localhost` üzerinden frontend smoke testi yapar. Mimari/klasör özetleri ve ilgili web checklist maddeleri güncellendi.
- `frontend/e2e/localized-routing.spec.ts` eklendi; mevcut E2E testleri yeni adreslere ve tekrar koşularda biriken test verilerine uyumlu hale getirildi. Uygulama planının durumu `PDA_LOCALIZED_UI_CHAT_PLAN.md` içindedir.

## Doğrulama

- `.\pre-push\pre-push.cmd` (`E2E_REUSE_USERS=1`): **geçti**. Git whitespace kontrolü ve Docker Compose config doğrulaması; Maven `clean verify` **404 test başarılı**; frontend ESLint, `tsc --noEmit` ve Next.js production build başarılı; Playwright **161 başarılı, 1 atlanan**; Docker PostgreSQL sağlıklı, backend `/actuator/health` ve frontend `/tr` HTTP smoke başarılı.
- Son dosya setinde ayrıca `npm run lint`, `npx tsc --noEmit` ve `npx playwright test`: başarılı; Playwright **161 başarılı, 1 atlanan**.
- Gerçek Chromium üzerinde organizasyon formu 1440 px açık ve 390 px koyu temada, sohbet tam panel ve compact pencere masaüstünde görsel olarak incelendi. Mobil sohbet ve locale geçişi ilgili Playwright testleriyle denetlendi.
- `git diff --check`: başarılı. Commit veya push yapılmadı.

## Açık konular

Engelleyici konu yok. Atlanan tek Playwright testi geliştirme sunucusundaki gerçek crash boundary davranışını ölçüyor; production build ile çalışan pre-push kapısında bilinçli olarak atlanıyor. Production alan adı üzerindeki SEO URL'leri yayın aşamasında ayrıca kontrol edilmeli.

## Kullanıcının manuel kontrolü

1. `/tr/projeler`, `/en/projects`, `/de/projekte` adreslerini açın; seçili projede dil değiştirince proje slug'ının ve `?section=` seçiminin korunduğunu kontrol edin. Eski `/projects` adresinin yerelleştirilmiş adrese yönlenmesini deneyin.
2. Organizasyon oluşturma ve düzenleme sayfasında boş ad hatasını, önizlemeyi, kaydetme ve vazgeçmeyi masaüstü/mobilde kontrol edin.
3. Proje Genel Bakış'ta bilinen teknoloji logosunun adını ve bilinmeyen teknolojinin genel ikon ile gerçek adını görün.
4. Bir projede Mesajlaşma panelini açın; küçültülmüş çubuktan compact pencereye geçip iki kişi ve proje grubu arasında seçim yapın. Taslak ve okunmamış rozetlerinin konuşmayla eşleştiğini doğrulayın.
