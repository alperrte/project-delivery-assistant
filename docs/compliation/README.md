# Teslim kayıtları

Tamamlanan faz, servis veya bağımsız teslim için `YYYY-MM-DD-kisa-ad.md` oluşturulur. Kısmi çalışma tamamlanmış olarak kaydedilmez. Tarih kullanıcı zaman diliminden alınır.

Her kayıtta şu başlıklar bulunur:

1. Tamamlanan kapsam.
2. Değişen önemli dosyalar.
3. Çalıştırılan doğrulama komutları.
4. Test/doğrulama sonuçları.
5. Açık kalan konular ve doğrulanmayan sınırlar.
6. Kullanıcının manuel kontrol adımları.

API tesliminde gerçek endpoint/metot, kimlik/yetki, girdi/yanıt/hata sözleşmesi veya bunları içeren devir belgesi bağlantısı ve `.agents/SECURITY.md` bölüm 11 uyarınca Swagger kontrol yolu yazılır. Yeni ENV ve güvenlik kararları, alınan kullanıcı onayları ve migration'lar belirtilir. Sırlar, gerçek token'lar ve kişisel bilgiler kayda eklenmez.

Başarısız ilk koşular ve ardından yapılan düzeltmeler gerektiğinde özetlenir; son başarılı doğrulamanın kapsamı açıkça ayrılır. Testcontainers, unit fake ve gerçek harici servis kontrolleri birbirine karıştırılmaz. Production deployment veya tam pre-push gate koşulmadıysa geçtiği iddia edilmez.
