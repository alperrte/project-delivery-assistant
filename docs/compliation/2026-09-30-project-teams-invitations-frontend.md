# Project Teams ve Invitations frontend teslimi — 2026-09-30

## Teslim ve durum

Frontend proje navigasyonundaki Members/Invitations/Squads bölümleri Teams altında birleştirildi. Kullanıcının kendi proje davetlerini gördüğü ayrı Invitations sayfası eklendi. Backend kodu bu teslimde değiştirilmedi.

## Yapılanlar

- [ProjectDetail](../../frontend/src/features/projects/components/project-detail.tsx) Teams altında ekipleri, proje üyelerini ve yönetici için davet geçmişini gösterir. Eski bölüm URL'leri Teams'e yönlenir.
- [Squad API istemcisi](../../frontend/src/features/squads/api.ts) yeni /teams sözleşmesini çağırır. General Team üye listesi görünür; düzenleme, arşivleme ve manuel üye değişikliği için kontrol gösterilmez.
- [Kendi davetlerim](<../../frontend/src/app/(app)/invitations/page.tsx>) ekranı yalnız oturum sahibinin davetlerini sayfalı listeler, kabul ve isteğe bağlı en çok 500 karakter ret gerekçesi sunar.
- [AppShell](../../frontend/src/components/layout/app-shell.tsx) global Invitations bağlantısını, proje sidebar'ı yalnız proje seçiliyken Teams bağlantısını gösterir. İngilizce, Türkçe ve Almanca çeviriler eklendi.

## Doğrulama

- `npm.cmd run build`: frontend kodu aktarılmadan önce geçti; /invitations rotası derlendi.
- Frontend dosyaları ayrı worktree'ye patch ile aktarıldı; kaynak değişikliklerle karşılaştırıldı.
- `git diff --cached --check`: stage sonrasında doğrulanır.

## Açık konular

Custom ekip parent bilgisi API'den alınır, ancak mevcut kart görünümü ekipleri ağaç olarak çizmez. Taşıma işlemi API üzerinden yapılabilir. Frontend branch'i tek başına yeni endpointleri sağlamaz; backend değişiklikleri entegrasyon için gereklidir.

## Kullanıcı kontrolü

1. Proje seçin; sidebar'da Teams açılmalı. Eski Members/Invitations/Squads bölüm URL'leri Teams içeriğini göstermeli.
2. General Team'de tüm aktif proje üyelerini ve rollerini görün. Yönetici olarak custom ekip ve davet listesine erişin.
3. Global Invitations sayfasında gelen daveti kabul edin veya isteğe bağlı gerekçeyle reddedin; durum güncellenmeli.
