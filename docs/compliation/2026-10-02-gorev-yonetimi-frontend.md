# Görev Yönetimi Frontend (Linear düzeyi)

**Tamamlanma tarihi:** 2026-10-02
**Branch:** `task-service-frontend`
**Durum:** Frontend tamamlandı ve doğrulandı. Commit/push kullanıcıdadır.

## Kapsam

Backend'deki görev servisinin (`2026-10-02-gorev-servisi-backend.md`) tüm yüzeyi arayüze bağlandı. Yeni npm bağımlılığı eklenmedi.

- **Proje içi "Görev Yönetimi" bölümü** (sidebar): Görevler, Pano, Havuz, Sprintler, Etiketler.
- **Görev listesi** (`/projects/[slug]/tasks`): filtreler sunucu tarafında ve URL'de (arama, durum, öncelik, atanan, etiket, sprint, gecikmiş, engelli), sıralama, durum/atanan/sprint gruplaması, sayfalama, satırda inline durum değiştirme (yalnız izinli geçişler).
- **Görev formu** (`tasks/new`, `tasks/[taskId]/edit`): tam sayfa, 7/5 ızgara, yapışkan canlı önizleme, `beforeunload` koruması. Başlık, açıklama (yaz/önizle), üst görev, öncelik, Fibonacci puan, süre tahmini, başlangıç, saatli deadline (hızlı seçimler), sprint, etiketler, kişiye atama veya havuza koyma, checklist.
- **Pano** (`tasks/board`): native HTML5 sürükle-bırak, yalnız izinli geçişlere bırakılır (geçersiz sütunlar soluk), klavye ve dokunmatik için kart menüsünde "Şuna taşı", optimistic güncelleme ve hatada geri alma.
- **Havuz** (`tasks/pool`): ekip hedefi rozeti, "Üstlen"; çift üstlenmede 409 toast'u ve liste yenilenir.
- **Görev detayı**: açıklama, alt görevler, checklist, ilişkiler, ekler (sürükle-bırak yükleme, görsel önizleme), birleşik aktivite akışı (Tümü / Yorumlar / Geçmiş), `@` ile üye önerisi olan yorum kutusu, yan panelde durum, engel, atananlar, havuz, öncelik, puan, etiket, sprint, tarihler, zaman takibi ve izleyiciler.
- **Sprintler** (`sprints`, `sprints/[sprintId]`): Aktif/Planlanan/Tamamlanan, oluştur/düzenle, başlat, tamamla (açık görevleri sonraki sprint'e ya da backlog'a taşı), saf SVG burndown.
- **Etiketler** (`labels`): ad ve token renk seçici, yeniden adlandır, arşivle.
- **Görevlerim** (`/tasks`): özet satırı (açık, gecikmiş, 24 saat içinde, engelli, havuzda), sekmeler (Açık, Tamamlanan, Tümü, Havuz), proje ve durum filtreleri, deadline kovalarına gruplama. Sidebar'daki "Görevler" bağlantısı açık/gecikmiş rozeti taşır, dashboard kartı aynı özeti gösterir, Ctrl+K aramasına eklendi.

## Önemli dosyalar

- `frontend/src/features/tasks/`: `api.ts`, `types.ts`, `schemas.ts`, `hooks.ts`, `workflow.ts` (backend geçiş tablosunun aynası), `deadline.ts`, `filters.ts`, `my-filters.ts`, `mentions.ts`, `permissions.ts`; `components/` (liste, pano, havuz, form, Görevlerim) ve `components/detail/` (detay).
- `frontend/src/features/sprints/`, `frontend/src/features/labels/`: aynı yapı.
- Rotalar: `frontend/src/app/(app)/projects/[slug]/{tasks,sprints,labels}/**`, `frontend/src/app/(app)/tasks/page.tsx`.
- Gezinme: `components/layout/tasks-nav-link.tsx`, `app-shell.tsx`, `project-sidebar-nav.tsx`, `features/projects/project-sections.ts`.
- `lib/api/error-message.ts` yeni hata kodlarını (`TASK_ALREADY_CLAIMED`, `TASK_INVALID_TRANSITION`, ...) kullanıcı diline çevirir; metinler `tasks.*`, `sprints.*`, `labels.*` altında tr/en/de.

## Testte bulunup düzeltilen gerçek hatalar

- **Base UI menü grubu:** `DropdownMenuLabel`, `DropdownMenuGroup` ya da `DropdownMenuRadioGroup` dışında kullanılınca çalışma anında "MenuGroupContext is missing" hatası verir ve menü hiç açılmaz. `tsc` bunu yakalamaz. Durum menüsü, pano kartı menüsü ve filtre çubuğunun sıralama/gruplama menüleri düzeltildi.
- **Uzun görev anahtarı:** Mobilde başlığı satırdan itiyordu; liste satırı, pano kartı ve havuz kartında anahtar kısaltılıp `title` ile tam hali verildi.

## Doğrulama

| Kontrol | Sonuç |
| --- | --- |
| `npx tsc --noEmit` | Temiz |
| `npm run lint` | Temiz |
| i18n anahtar denetimi (tr/en/de) | Eksik/fazla anahtar yok |
| Playwright `e2e/09-tasks.spec.ts` | 10/10 geçti (form, durum geçişleri, yetki negatifleri, havuz yarışı 200/409, üstlenme, yorum + @bahsetme bildirimi, Görevlerim sayımları, oturumsuz 401) |
| Playwright MCP, 390 ve 1440 px | 12 rotada yatay taşma yok, `role=alert` yok, konsol hatası yok; açık ve koyu tema; pano geçerli sürüklemeyi taşır, geçersiz sütunu reddeder |

## Açık konular

- Pano sürükle-bırak yalnız fareyle doğrulandı; dokunmatik ve klavye yolu "Şuna taşı" menüsüdür.
- Etiket renkleri sabit token listesidir (`--label-*`); serbest renk seçimi bilinçli olarak yoktur.

## Kullanıcı kontrolü

1. Proje yöneticisiyle bir proje aç, "Görev Yönetimi > Görevler" altında yeni görev oluştur. Beklenen: sağdaki önizleme yazdıkça güncellenir, kayıttan sonra detay sayfası açılır.
2. Görevi havuza koy, ikinci hesapla "Havuz" sayfasında "Üstlen"e bas. Beklenen: onay toast'u, görev "Görevlerim"de görünür, sidebar rozeti artar.
3. Panoda bir kartı izinli sütuna sürükle. Beklenen: kart taşınır. İzinsiz sütuna bırak. Beklenen: kart yerinde kalır.
4. Detayda `@` yaz, üye seç, yorum gönder. Beklenen: anılan üyeye bildirim gider.
5. Bir sprint oluştur, başlat, tamamla. Beklenen: açık görevler seçilen hedefe taşınır.
