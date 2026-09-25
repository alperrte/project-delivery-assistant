# Tamamlanan faz ve servis kayıtları

Bu klasörde yalnız tamamlandığı doğrulanan teslimler için `YYYY-MM-DD-kisa-ad.md` biçiminde kayıt oluşturulur. Tarih tamamlanma tarihidir. Devam eden iş için burada “tamamlandı” kaydı açılmaz.

Her kayıtta kısa olarak şunlar bulunur:

1. **Teslim ve durum:** Faz/servis adı, tamamlanma tarihi, kapsam.
2. **Yapılanlar:** Önemli davranışlar ve değişen ana dosyalara bağlantılar.
3. **Doğrulama:** Çalıştırılan komutlar, sonuçları; çalıştırılamayan kontrolün nedeni.
4. **API (varsa):** Her endpoint için yöntem/yol, kimlik ve rol/kapsam, istek parametreleri veya body, güvenli örnek, başarı yanıtı/durumu, önemli hatalar. Swagger kontrol yolu.
5. **Açık konular:** Bilinen sınırlar ve sonraki işler.
6. **Kullanıcı kontrolü:** Kullanıcının uygulayabileceği somut kontrol adımları ve beklenen sonuç.

Ajan teslim mesajında kayda bağlantı verir ve kullanıcıdan bu kontrol adımlarını incelemesini ister. Bu README bir teslim kaydı değildir.
