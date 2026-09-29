# Tek proje sidebar'ı — 2026-09-29

## Teslim ve durum

Tamamlandı. Proje detayındaki ikinci sidebar kaldırıldı. Genel Bakış, Kriterler, Üyeler, Davetler, Ekipler, Depo ve Ayarlar bağlantıları ortak uygulama sidebar'ına taşındı. Dashboard içeriği değiştirilmedi.

## Yapılanlar

- `frontend/src/components/layout/app-shell.tsx`: ortak navbar, masaüstü sidebar ve mobil çekmece içinde proje bölümlerini gösterir.
- `frontend/src/components/layout/project-sidebar-nav.tsx`: proje bağlamına göre bölüm bağlantıları, seçili bölüm ve yönetici yetkisine bağlı bağlantıları gösterir.
- `frontend/src/features/projects/project-sections.ts`: bölüm listesi, erişim filtresi ve `?section=` adres eşlemesini paylaşır.
- `frontend/src/features/projects/components/project-detail.tsx`: ayrı sidebar ve mobil bölüm seçicisi çıkarıldı; bölüm içeriği URL seçimine bağlandı.
- `frontend/e2e/01-project-lifecycle.spec.ts`, `02-invitation-roles-squad.spec.ts`, `03-project-navigation-responsive.spec.ts`, `helpers.ts`: gezinme seçicileri ortak sidebar'a uyarlandı.
- `.agents/architecture.md`, `.agents/folder-structure.md`, `.agents/frontend-design-rules.md`: tek kabuk ve proje gezinme konumları güncellendi.

## Doğrulama

- `npm.cmd run lint` — geçti.
- `npx.cmd tsc --noEmit` — geçti.
- `npm.cmd run build` — geçti; `/projects/[slug]` dahil üretim sayfaları derlendi.
- `node scripts/check-project-sidebar.cjs` — geçti; masaüstü ve mobil gezinme, light/dark görünüm, adres yenileme, yönetici bağlantıları, yatay taşma ve tarayıcı hataları kontrol edildi. Görseller `tmp/project-sidebar-review/` altındadır.
- `git diff --check` — geçti.
- Tam Playwright E2E paketi çalıştırılmadı; gerçek backend ve test verisi gerektiriyor.

## Açık konular

Bilinen uygulama engeli yok. Tam E2E paketi backend hazır olduğunda ayrıca çalıştırılabilir.

## Kullanıcı kontrolü

1. Bir proje detayını açın. Solda tek sidebar içinde proje bölümlerini görün; içerik alanında ikinci sidebar olmamalı.
2. Kriterler veya Üyeler'i seçip sayfayı yenileyin. Aynı bölüm açık kalmalı.
3. Dar ekranda üstteki menü düğmesini açın. Aynı proje bölümleri mobil çekmecede görünmeli.
4. Light ve dark temalarda sidebar ile içerik renklerini kontrol edin.
