# Kalıcı proje menüsü — 2026-09-29

## Teslim ve durum

Tamamlandı. Ortak sidebar'daki proje bölüm bağlantıları dashboard, proje listesi ve diğer oturum içi sayfalarda kalıcıdır. Proje sayfasından ayrılınca bağlantılar kaybolmaz.

## Yapılanlar

- `frontend/src/components/layout/app-shell.tsx`: proje menüsünün yalnız proje detayı URL'sinde oluşturulması koşulu kaldırıldı.
- `frontend/src/components/layout/project-sidebar-nav.tsx`: son açılan projenin slug'ı kullanıcıya özgü olarak `sessionStorage` içinde tutulur. İlk seçimden önce listedeki ilk proje kullanılır; hiç proje yoksa bölüm adları pasif görünür. Bölüm bağlantıları seçili projeye gider; proje değişirse hedefleri güncellenir. Yöneticiye özgü bağlantılar yetkiye göre görünür.
- Ana "Projeler" bağlantısı listeyi açar. Altındaki "Seçili proje" alanında yalnız çalışılan projenin adı ve içeriye hizalanmış bölüm bağlantıları bulunur. "Değiştir" proje listesine götürür; liste açıkken bu bağlantı gösterilmez. Proje detayında yalnız ilgili bölüm seçili görünür.
- `frontend/scripts/check-project-sidebar.cjs`: dashboard ve proje listesi arasında geçiş, yenileme ve proje değiştirme kontrolleri eklendi.
- `.agents/architecture.md`, `.agents/folder-structure.md`, `.agents/frontend-design-rules.md`: kalıcı menü davranışı işlendi.

## Doğrulama

- `npm.cmd run lint` — geçti.
- `npx.cmd tsc --noEmit` — geçti.
- `npm.cmd run build` — geçti.
- `node scripts/check-project-sidebar.cjs` — geçti. Masaüstü/mobil ve light/dark görünüm; sayfa geçişi, yenileme, son proje seçimi, yetki görünürlüğü, taşma ve tarayıcı hataları kontrol edildi.
- Dark tema proje detayı ve proje listesi ile light tema mobil çekmece ekran görüntüleri görsel olarak incelendi.
- Tam E2E paketi gerçek backend/test verisi gerektirdiği için çalıştırılmadı.

## Açık konular

Bilinen engel yok. Son proje seçimi tarayıcı sekmesinin oturumu boyunca korunur.

## Kullanıcı kontrolü

1. Dashboard'dan bir proje açın, sonra Ana Sayfa ve Projeler arasında geçin. Sol menüde proje bölümleri görünmeye devam etmeli.
2. Dashboard'da sayfayı yenileyin ve Kriterler'e tıklayın. Son açtığınız projenin Kriterler sayfası açılmalı.
3. Başka bir projeyi açıp tekrar dashboard'a dönün. Menü bağlantıları yeni projeye gitmeli.
4. Dar ekranda mobil menüyü açın. Aynı bölüm bağlantıları çekmecede bulunmalı.
5. Proje listesinde ana "Projeler" öğesinin, proje detayında ise yalnız açık bölümün seçili göründüğünü kontrol edin. "Seçili proje" alanı tek projenin adını göstermeli; "Değiştir" bağlantısı başka proje seçmek için listeye götürmeli.
