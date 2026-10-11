# Hesap silme bilgilendirmesi — 2026-10-10

## Teslim ve durum

SSS cevabı ve gizlilik politikasındaki eski “hesap silme yok” bilgisi TR/EN/DE dillerinde güncellendi. Toplam altı metin değiştirildi.

## Yapılanlar

- [tr.json](../../frontend/src/i18n/messages/tr.json), [en.json](../../frontend/src/i18n/messages/en.json), [de.json](../../frontend/src/i18n/messages/de.json).
- `publicPages.faq.groups.2.questions.2.answer` ve `publicPages.privacy.sections.5.paragraphs.1`: Hesap ayarlarından silme işlemini başlatma, e-postayla gelen bağlantı üzerinden gerekli doğrulamaları tamamlama anlatılır. Diğer veri talepleri için iletişim kanalı korunur.
- Mevcut DeleteAccountPanel akışı kaynakta kontrol edildi; hesap ayarlarındaki işlem yalnız mail bağlantısı gönderir, silme doğrulaması o bağlantının açtığı sayfada tamamlanır.
- Kullanıcının dosyalarda önceden yaptığı diğer metin değişiklikleri korundu. API/mimari/şema/çeviri anahtarları veya genel web checklist durumu değiştirilmedi. Commit/push yapılmadı.

## Doğrulama

- Üç JSON dosyası `JSON.parse` ile başarıyla okundu.
- Düzenleme öncesi ve sonrası flattened anahtar/değer karşılaştırması: her dilde yalnız beklenen iki değer değişti, anahtar yapısı aynı. Eski metinler kaldırılmış, yeni karşılıkları mevcut.
- `git diff --check`: başarılı.
- Küçük içerik düzeltmesi için build/E2E veya tarayıcı testi çalıştırılmadı.

## Açık konular

Bu teslim yalnız güncel hesap silme özelliğinin açıklamasını düzeltir; nihai hukuki metin/saklama takvimi onayı kapsamda değildir.

## Kullanıcı kontrolü

SSS ve Gizlilik Politikası sayfalarını TR, EN ve DE dillerinde açın. Eski “hesap silme yok” ifadesi görünmemeli; hesap ayarları ve e-posta doğrulama bağlantısı açıklaması görünmelidir.
