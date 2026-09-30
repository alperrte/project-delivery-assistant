# Team Members sayfası — 2026-09-30

## Teslim ve durum

Teams ana ekranındaki ayrı Proje üyeleri tablosu kaldırıldı. Ekip kartındaki Üyeler aksiyonu, proje slug'ı ve ekip kimliğiyle `/projects/[slug]/teams/[teamId]/members` sayfasına gider. General Team ve custom ekipler aynı sayfayı kullanır. Backend değişmedi.

## Yapılanlar

- [ProjectDetail](../../frontend/src/features/projects/components/project-detail.tsx) ekip kartları ve proje davetlerini korur; ayrı proje üyesi tablosunu göstermez.
- [Ekip listesi](../../frontend/src/features/squads/components/squad-list.tsx) modal yerine üyeler route'una Link sunar. Eski `squad-members-dialog.tsx` ve artık kullanılmayan `member-list.tsx` kaldırıldı.
- [Üyeler route'u](<../../frontend/src/app/(app)/projects/[slug]/teams/[teamId]/members/page.tsx>) ve [ortak sayfa](../../frontend/src/features/squads/components/team-members-page.tsx) ekip adı/açıklaması, sayfalı üye listesi, baş harf avatarı, proje rolleri, katılım tarihi, responsive görünüm, yüklenme/boş/hata/tekrar dene durumları ve açık Teams geri bağlantısı sunar. Doğrudan URL ve yenileme desteklenir.
- [Üye ekleme](../../frontend/src/features/squads/components/add-team-member-dialog.tsx) yalnız mevcut proje üyelerini sayfalı listeler ve ekipte olanları devre dışı bırakır. General Team için manuel ekleme veya ekipten çıkarma gösterilmez. Yetkili kullanıcı custom ekipte ekipten çıkarma, her ekipte açıkça ayrı projeden çıkarma ve [proje rolü düzenleme](../../frontend/src/features/projects/components/members/edit-roles-dialog.tsx) yapabilir.
- [Proje sidebar'ı](../../frontend/src/components/layout/project-sidebar-nav.tsx) nested üyeler route'unda doğru projeyi ve Teams seçimini korur. Türkçe, İngilizce ve Almanca metinler güncellendi.
- [E2E senaryoları](../../frontend/e2e/02-invitation-roles-squad.spec.ts) ve [responsive senaryolar](../../frontend/e2e/03-project-navigation-responsive.spec.ts) yeni navigasyona uyarlandı.

## API kullanımı

- `GET /api/v1/projects/by-slug/{slug}`: route'un proje bağlamı.
- `GET /api/v1/projects/{projectId}/members/{userId}`: oturum sahibinin proje rolü.
- `GET /api/v1/projects/{projectId}/teams/{teamId}` ve `GET /api/v1/projects/{projectId}/teams/{teamId}/members?page=&size=`: ekip ve sayfalı üyeler.
- `GET /api/v1/projects/{projectId}/members?page=&size=`: ekibe eklenebilecek mevcut proje üyeleri. Tüm aktif kullanıcıları arayan `members/search` burada kullanılmaz.
- `POST/DELETE /api/v1/projects/{projectId}/teams/{teamId}/members`: custom ekip üyeliği.
- `PUT /api/v1/projects/{projectId}/members/{userId}/roles` ve `DELETE /api/v1/projects/{projectId}/members/{userId}`: proje rolü ve proje üyeliği.

Frontend kontrolleri yalnız arayüz içindir; yetki ve General Team kuralları backend'de uygulanır. Yeni endpoint eklenmedi.

## Doğrulama

- `npm.cmd run lint`: geçti.
- `npx.cmd tsc --noEmit`: geçti.
- `npm.cmd run build`: geçti; yeni dinamik route derlendi. Mevcut `middleware` kullanımı için Next.js deprecation uyarısı var.
- `npx.cmd playwright test e2e/02-invitation-roles-squad.spec.ts`: gerçek backend ile 7/7 geçti. İlk denemede testteki belirsiz proje linki seçicisi düzeltildi.
- Responsive test: oturumsuz API mock'u middleware tarafından login'e yönlendi; mevcut gerçek oturumla yeniden çalıştırıldığında `03-project-navigation-responsive.spec.ts` 2/2 geçti. İlk tekrar denemesinde kayıt hız sınırı görüldü; geçici test konfigürasyonu kaldırıldı.
- `git diff --check`: geçti.

## Açık konular

Frontend branch'i tek başına `/teams` endpointlerini sağlamaz; entegre ortamda güncel backend gerekir. Bu teslimde backend dosyası, `.env`, commit veya push değişikliği yapılmadı.

## Kullanıcı kontrolü

1. Projede Teams'i açın: ekip kartları ve Proje davetleri görünmeli, ayrı Proje üyeleri tablosu görünmemeli.
2. General Team veya custom ekipte Üyeler bağlantısına tıklayın; URL `/projects/{slug}/teams/{teamId}/members` olmalı. Yenileyin ve geri bağlantısını deneyin.
3. Yönetici olarak custom ekibe mevcut proje üyesi ekleyip ekipten çıkarın; kişi projede kalmalı. General Team'de manuel ekip üyeliği aksiyonu görünmemeli.
4. Üyenin proje rolünü değiştirin; General Team ve varsa diğer ekiplerde güncel rolü görün. Projeden çıkarma onayı ekipten çıkarma onayından açıkça farklı olmalı.
5. Yönetici olmayan üyeyle sayfayı açın; yönetim aksiyonları görünmemeli.
