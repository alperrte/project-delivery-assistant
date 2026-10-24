# V292-05 — Görev listesi sıralaması: Son güncelleme artan varsayılan ve kalıcı tercih (frontend)

Dal: `task-service-frontend` (taban: `main` @ `73f59194`). Yalnız frontend; backend değişmedi (sıralama zaten `sort=…,asc|desc` parametresiyle sunucuda yapılıyordu). Commit SHA'sı bu dosyayı içeren commit'in kendisi olduğundan `git log` ve teslim raporunda verilir.

## Hangi ekran? (doğrulandı)
"Son güncelleme → Artan/Azalan" sıralama menüsü **yalnız proje içindeki Görevler listesinde** (`/projects/<slug>/tasks`, `tasks-page.tsx` + `task-filter-bar.tsx` + `filters.ts`) vardır. Sol menüdeki **Görevlerim** sayfasında (`/tasks`, `my-tasks-page.tsx` + `my-filters.ts`) kullanıcının seçebileceği bir sıralama yoktur: Açık sekmesi son tarihe göre artan, Tümü/Tamamlanan sekmeleri son güncellemeye göre azalan sabit sıralanır. Kullanıcı bu belirsizlik için soruldu ve **proje içi Görevler listesini** seçti; Görevlerim bilerek değiştirilmedi (testle sabitlendi).

## Kök neden
`useTaskFilters` sıralamayı yalnız URL'den okuyordu; adres `?sort=…&dir=…` içermiyorsa sabit varsayılan (`updatedAt` + `desc`) uygulanıyordu. Kenar çubuğundaki "Görevler" bağlantısı sorgusuzdur, bu yüzden başka sayfaya gidip dönünce seçim kayboluyor ve yeniden Azalan oluyordu. Hiçbir yerde saklanmıyordu.

## Çözüm
- Varsayılan: **Son güncelleme → Artan** (`DEFAULTS.dir = "asc"`; `defaultDirection`: öncelik ve oluşturulma azalan, diğerleri artan).
- Yetki sırası: 1) adresteki `sort`/`dir`, 2) kullanıcının daha önce seçtiği kayıtlı tercih, 3) varsayılan.
- Tercih, yalnız arayüzden sıralama seçilince (`update({sort|dir})`) `localStorage`'a **kullanıcıya özel** anahtarla (`pda:tasks-sort:v1:<userId>`) yazılır; filtre, sayfalama ve gruplama ona dokunmaz, "Temizle" sıralamayı sıfırlamaz. Adres parametresi tercihin üzerine yazmaz ve onu değiştirmez.
- Bozuk/eksik/geçersiz değer (`{not json`, `{"sort":"nope"}`, `null`) güvenle varsayılana düşer.
- Hydration/SSR: tercih `useSyncExternalStore` ile okunur (sunucuda "hazır değil"); liste, tercih okunmadan **istenmez** (`useTaskList(..., enabled)`), böylece yanlış sırayla bir istek atılıp sonra değişmez. Başka hesabın tercihi başka hesaba taşınmaz (anahtar kullanıcı kimliğiyle).

## Değişen dosyalar
`features/tasks/filters.ts`, `features/tasks/hooks.ts`, `features/tasks/components/tasks-page.tsx`, `e2e/task-sort-v292.spec.ts` (yeni), `e2e/task-pagination.spec.ts` (proje listesinin yeni varsayılan sırasına göre).

## TSF-04 (tamamlananlar en altta) — korunur
Bu kural backend'de yalnız **Görevlerim "Tümü"** (`/tasks/mine?scope=ALL`) için uygulanır (`TaskSpecifications.orderBy(..., doneLast)`); proje içi listede hiç yoktu. Değiştirilmedi ve testle doğrulandı: `scope=ALL` hem artan hem azalanda tamamlanan görevleri sonda döndürür; Görevlerim istekleri (`OPEN|deadlineAt|asc`, `ALL|updatedAt|desc`, `DONE|updatedAt|desc`) aynıdır.

## Testler (hedefli)
Gerçek API + PostgreSQL, üretim derlemesi, iki paylaşılan hesap:
- `task-sort-v292.spec.ts` **3/3**: varsayılan Artan (isteğe `updatedAt,asc`, menüde "Artan" işaretli, sayfa 1 ve 2 sunucu sırasıyla aynı); Azalan seçimi (adreste `dir=desc`, istek `updatedAt,desc`, depolamada kayıt); kenar çubuğundan başka sayfaya gidip dönünce Azalan korunur; yenileme, yeni sekme, Geri/İleri; adres önceliği (`?sort=priority&dir=desc`, `?dir=asc`) ve ardından kayıtlı tercihe dönüş; sayfa 2 ve filtre/temizle sıralamayı sıfırlamaz; Artan'a dönünce temiz adres; başka alan (öncelik) aynı şekilde hatırlanır; bozuk depolama varsayılana düşer; **iki hesap** aynı tarayıcıda (üye varsayılanla başlar, yönetici kendi tercihini geri bulur); TSF-04 ve Görevlerim sıralaması değişmedi.
- Regresyon: `09-tasks`, `task-list-views`, `task-pagination` (güncellendi), `my-task-cards`, `task-service-refinements`, `task-board-calendar`, `task-planning-assignment`, `task-assignment-logic`, `21-task-models`, `project-service-frontend` ile birlikte **70 test** (69 + güncellenen pagination). Lint, `tsc`, `npm run build`, `npm run check:bundle` temiz.

## Bilinen kısıtlar
- Tercih tarayıcıya ve kullanıcıya özeldir (cihazlar arası senkron yoktur; sunucuda kullanıcı ayarı eklenmedi).
- Tercih proje bazlı değil kullanıcı bazlıdır (tüm projelerin görev listesinde aynı).
- Görevlerim sayfası bilerek değişmedi; orada sıralama menüsü istenirse ayrı iş olarak eklenebilir.

## Manuel kontrol adımları
1. Bir projenin Görevler listesini aç: "Sırala: Son güncelleme" ve menüde "Artan" işaretli olmalı (en eski güncellenen ilk).
2. "Azalan" seç, sol menüden başka bir sayfaya git, sonra yine "Görevler"e dön: Azalan kalmalı. Sayfayı yenile ve yeni sekmede aç: aynı.
3. Başka bir hesapla (aynı tarayıcıda) gir: varsayılan Artan ile başlamalı; ilk hesaba dönünce onun seçimi duruyor olmalı.
4. Görevlerim'de (sol menü) davranışın aynı olduğunu kontrol et (Açık: son tarih; Tümü: tamamlananlar en altta).
