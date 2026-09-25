# PDA ajan giriş rehberi

Bu dosya repo kökünden çalışan her ajan için ilk okuma noktasıdır. İşe başlamadan önce sırasıyla `.agents/SECURITY.md`, `.agents/architecture.md` ve `.agents/folder-structure.md` dosyalarını oku. Bu üç dosya temel bağlamdır; `.agents` içindeki diğer belgeleri yalnız görevle ilişkiliyse oku. Kodun mevcut durumunu dosyalardan doğrula; plan belgelerini uygulanmış özellik sayma.

## Belge rotası

- API işi: `.agents/api.md`
- Kimlik, oturum veya yetki: `.agents/authentication.md` ve `.agents/decisions/0003-cookie-auth.md`
- Veri modeli veya migration: `.agents/database.md`, gerekirse `.agents/er-diagram.md` ve `.agents/decisions/0002-postgresql.md`
- Modül sınırları: `.agents/decisions/0001-modular-monolith.md`
- Kurulum veya dağıtım: `.agents/deployment.md`
- Fazın önceki teslimleri: `docs/compliation/` içindeki ilgili kayıt

Belgeler çelişirse önce mevcut kodu ve kabul edilmiş ADR'leri karşılaştır; güvenlik kuralını sessizce gevşetme. Kararı etkileyen belirsizliği kullanıcıya bildir. Mimari veya klasör düzeni değiştiğinde ilgili kısa özeti de güncelle.

## Tamamlama ve kullanıcı kontrolü

Bir faz, servis veya bağımsız teslim gerçekten tamamlandığında `docs/compliation/YYYY-MM-DD-kisa-ad.md` dosyası oluştur. İçine kapsamı, değişen önemli dosyaları, doğrulama komutları ve sonuçlarını, açık kalan konuları ve kullanıcı kontrol adımlarını yaz. Kısmi ilerlemeyi tamamlandı diye kaydetme. API tamamlandıysa `.agents/SECURITY.md` bölüm 11'deki endpoint bilgilerini ve Swagger ile kontrol yolunu ekle. Son mesajda kullanıcıya bu kaydı incelemesini açıkça söyle ve bağlantısını ver. Kayıt biçimi için `docs/compliation/README.md` dosyasını kullan.

`.agents/SECURITY.md` içindeki `.env`/`.env.example` ve güvenlik mimarisi onay kurallarına uy. Git push, merge, yayın veya repo ayarı işlemlerini yalnız o işlem için açık yetki varsa yap.
