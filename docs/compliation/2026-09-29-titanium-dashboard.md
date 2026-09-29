# Titanium navbar, sidebar ve dashboard

## Teslim ve durum

29 Eylül 2026 — frontend teslimi tamamlandı. Kullanıcının light/dark HTML örnekleri ve `DESIGN.md` içindeki Light/Dark Mode Surfaces paleti uygulama kabuğuna uyarlandı. Auth ekranlarının görsel sistemi korunur.

## Yapılanlar

- [AppShell](../../frontend/src/components/layout/app-shell.tsx): 240 px sidebar, 56 px navbar, aktif sayfa işareti, hesap menüsü, mobil dialog çekmecesi ve içeriğe geç bağlantısı.
- [Proje araması](../../frontend/src/components/layout/project-search.tsx): Ctrl/Cmd+K, proje adı/açıklaması filtreleme, yükleme/boş/hata durumları ve proje bağlantıları.
- [Dashboard](../../frontend/src/features/dashboard/dashboard.tsx): karşılama, genel bakış/güncellemeler sekmeleri, çalışan proje oluşturma penceresi, gerçek proje tablosu, başarı kriterleri ilerlemesi, üye sayıları, hızlı işlemler ve ay/gün seçilebilir takvim.
- [Tema token'ları](../../frontend/src/app/globals.css): beyaz/karbon Titanium yüzeyleri, nötr birincil aksiyonlar, Inter başlıkları, sade panel ve butonlar. Semantik light metinler kontrast için koyu tutulur.
- `/dashboard` yeni oturum içi rota; kök adres, başarılı giriş/kayıt ve şifre değişikliği sonrasında dashboard açılır. Kimlik doğrulama ve zorunlu şifre değiştirme koşulları korunur.
- TR/EN/DE metinleri, uygulama viewport rengi ve `.agents` tasarım/mimari/klasör rehberleri güncellendi.

## Doğrulama

`frontend` dizininde:

| Komut | Sonuç |
|---|---|
| `npm.cmd run lint` | Başarılı |
| `npx.cmd tsc --noEmit` | Başarılı |
| `npm.cmd run build` | Başarılı; `/dashboard` üretim rotasına dahil |
| `node scripts/check-dashboard.cjs` | Başarılı |
| Repo kökünde `git diff --check` | Başarılı |

[Tarayıcı kontrolü](../../frontend/scripts/check-dashboard.cjs), yalnız tarayıcıda izole API fixture'ları kullanır; gerçek backend'e yazmaz. Light/dark 1440, 1024 ve 390 px; sayfa taşması, mobil menü, Ctrl+K filtreleme, klavye sekmeleri, proje oluşturma dialogu, takvim, tema menüsü, üç dil, boş/hata durumları ve konsol/runtime hataları kontrol edildi. Reduced motion etkin kullanıldı. Light masaüstü ve mobil, dark masaüstü ekran görüntüleri görsel olarak incelendi; bulunan eksik durum çeviri anahtarı düzeltildi.

Görsel çıktılar: `tmp/dashboard-review/`. Fixture ekran görüntüleri gerçek kullanıcı verisi değildir. Gerçek backend üzerinde yeni proje oluşturma veya oturum açma uçtan uca işlemi bu teslimde çalıştırılmadı; mevcut API/oturum akışları kullanıldı.

## Açık konular ve kapsam

- Dashboard ilk 6 projeyi gösterir; tüm kayıtlar Projeler bağlantısındadır. Güncellemeler ve takvim bu 6 projeyle sınırlıdır; arayüz bunu açıklar. Proje toplamı API pagination toplamıdır.
- Arama ilk 100 projeyi istemci tarafında filtreler; kapsam arama dialogunda belirtilir.
- Görev, bildirim, sprint ve genel aktivite servisleri mevcut değildir. Örnek HTML'deki sahte görev/sprint sayıları eklenmedi; görev/bildirim alanları yakında durumunda. Sağ panelde sprint yerine gerçek proje toplamı vardır.
- Başarı kriterleri görev ilerlemesi olarak adlandırılmaz. Güncellemeler proje `updatedAt` alanından gelir, genel aktivite akışı değildir.
- Yeni backend endpoint, migration, bağımlılık veya ortam değişkeni yok. Güvenlik mimarisi değişmedi. Git commit/push yapılmadı.

## Kullanıcı kontrolü

1. Frontend ve backend çalışırken giriş yapın; `/dashboard` açılmalı.
2. Tema menüsünden Açık/Koyu seçin: yüzeyler beyaz/karbon, aksiyonlar siyah/beyaz olmalı.
3. Projelerinizin durum, kriter ve üye sayılarını proje detaylarıyla karşılaştırın. Proje adına ve Tüm projeler bağlantısına tıklayın.
4. Proje oluştur düğmesini deneyin; mevcut form açılmalı. Ctrl+K ile bir proje adını arayın ve sonucu açın.
5. Takvim ayını ve gününü değiştirin; listelenen projelerin hedef bitiş tarihleri ilgili günde görünmeli.
6. 390 px genişlikte menüyü açıp Escape ile kapatın; sayfa yatay taşmamalı. Geniş proje tablosu kendi içinde kayabilir.
7. Türkçe, İngilizce ve Almanca arasında geçin; başlık ve kontrol metinlerini kontrol edin.
