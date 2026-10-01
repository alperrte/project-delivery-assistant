# Proje oluşturma sayfası ve proje kartı yenilemesi — 2026-10-01

## Teslim ve durum

"Yeni proje" açılır penceresi `/projects/new` tam sayfasıyla değiştirildi: solda rehberli form, sağda yazdıkça güncellenen canlı proje kartı önizlemesi. Proje kartı ve liste yeniden tasarlandı. Backend'e proje türü, slogan, logo, son güncelleyen ve listede toplu ekip verisi eklendi. Commit, push ve PR yapılmadı.

## Yapılanlar

- `backend/src/main/resources/db/migration/V34__project_identity.sql`: `project_type`, `tagline`, `updated_by`, `logo_updated_at` ve ayrı `project_logos` tablosu (liste sorguları bytea'ya dokunmaz).
- `backend/src/main/java/com/pda/project/domain/entity/Project.java`, `.../enums/ProjectType.java`, `ProjectService`: tür, slogan, `updatedBy` (her değişiklikte `touch(actor)`), `techStack` ile oluşturma.
- `backend/src/main/java/com/pda/project/api/ProjectLogoController.java`, `.../ProjectLogoService.java`: logo PUT/DELETE/GET. Tür magic byte'tan belirlenir (PNG/JPEG/WebP), en fazla 512 KB, SVG/GIF reddedilir, `nosniff` ve değişmez önbellek başlıkları.
- `ProjectCardView`, `ProjectMembershipRepository`: liste yanıtında `team {memberCount, preview[5]}` ve `updatedBy`, sayfa başına sabit sorgu sayısı. Kart başına `/home` (ve GitHub) çağrısı kalktı.
- `frontend/src/app/(app)/projects/new/page.tsx`, `features/projects/components/project-create-page.tsx`, `components/create/{logo-field,type-picker,tech-picker}.tsx`: form, canlı önizleme, logo yükleme, `beforeunload` koruması.
- `features/projects/tech-catalog.ts`, `public/images/tech/` (devicon MIT + Simple Icons CC0, `LICENSES.md`): türe göre teknoloji kataloğu; npm bağımlılığı eklenmedi.
- `project-card.tsx` (logo/baş harf, slogan, tür, teknoloji logoları + tooltip, ekip avatarları, "son güncelleme · kim"), `project-list.tsx` (en fazla 3 sütun, sayfa başına 12, `?page=` numaralı sayfalama, kart şeklinde iskelet), `pagination-bar.tsx`, `entity-card.tsx`.
- `project-settings-form.tsx`: tür ve slogan düzenlenebilir. `dashboard.tsx`, `project-sidebar-nav.tsx` (slug "new" proje sayılmaz), `lib/api/client.ts` (FormData), `components/ui/{tooltip,radio-group}.tsx`.
- Silindi: `project-create-dialog.tsx`. TR/EN/DE metinleri güncellendi. `.agents/SECURITY.md` §11/§18 ve `.agents/frontend-design-rules.md` güncellendi.

## Doğrulama

- Backend: `ProjectIdentityIntegrationTest` 6 test başarılı (tür/slogan/techStack, `updatedBy`, logo geçerli/geçersiz/büyük, rol ve CSRF, liste ekip verisi). Tam çalıştırma 244 test; tek hata `UserPersistenceTest` (V33 `uk_users_email_ci` ile ilgili, bu işten bağımsız, önceden var).
- `docker compose up -d --build backend`: V34 uygulandı.
- Frontend: `npm run lint`, `npx tsc --noEmit`, `npm run build` başarılı. `e2e/project-create-page.spec.ts` 3 test başarılı (canlı önizleme, geçersiz logo ve tür zorunluluğu, logolu proje + listede `/home` çağrısı yok).
- Playwright MCP: `/projects/new` 1440 px açık/koyu ve 390 px (yatay taşma yok); liste 13 projeyle 12 + 1 kart, `?page=2` ve "13 kayıt · 1-12 arası gösteriliyor".

## Açık konular

- Teknoloji tooltip'i yalnız fareyle açılır (odaklanamaz); adlar `aria-label` ile erişilebilir.
- Slug önizlemesi yaklaşıktır, gerçek adresi sunucu üretir.
- Sahip alanına odaklanınca önizlemede ilgili bölgenin vurgulanması uygulanmadı.
- Listede arama, filtre ve sıralama ile kullanıcı profil fotoğrafı bu işe dahil değil (backend gerektirir).
- Ekip oluşturma 403 hatası eski backend imajından kaynaklanıyordu (V31-V33 uygulanmamıştı); yeniden derlemeyle giderilmesi beklenir, kullanıcı doğrulamalı.

## Kullanıcı kontrolü

1. Projeler sayfasında "Yeni proje" bağlantısı `/projects/new` sayfasını açmalı; ad, slogan, tür ve teknoloji seçtikçe sağdaki kart anında değişmeli.
2. Logo yükleyip proje oluşturun: listede ve kartta logo görünmeli. SVG veya 512 KB üstü dosya reddedilmeli. Logo yoksa adın ilk harfi görünmeli.
3. 13 veya daha fazla projeyle liste 3 sütun ve sayfa başına 12 kart göstermeli; "Sonraki" `?page=2` ekleyip geri tuşuyla dönülebilmeli.
4. Proje yöneticisi olarak Ekipler sayfasından yeni ekip oluşturmayı deneyin; artık "Bu işlem için yetkiniz yok" görünmemeli.
5. Proje ayarlarında tür ve slogan değiştirilip kartta güncellendiği kontrol edilmeli.
