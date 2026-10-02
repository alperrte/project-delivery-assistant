# 06 — Error & Edge States

Bu doküman kullanıcıların hata veya olağandışı durumlarda kontrolsüz teknik ekranlarla karşılaşmaması için gerekli özel sayfaları ve UI durumlarını tanımlar.

## 403 — Erişim Yok

- [ ] Özel **403** sayfası veya eşdeğer kontrollü UI bulunmalıdır.
- [ ] Kullanıcı erişim yetkisi olmadığını anlayabilmelidir.
- [ ] Kullanıcıya ana sayfa/dashboard gibi güvenli bir geri dönüş aksiyonu verilmelidir.
- [ ] Hassas teknik detay gösterilmemelidir.

## 404 — Adres Bulunamadı

- [ ] Özel **404** sayfası bulunmalıdır.
- [ ] Kullanıcı URL'nin bulunamadığını anlayabilmelidir.
- [ ] Ana sayfaya veya uygun bir bölüme CTA verilmelidir.
- [ ] 404 route yanlışlıkla 200 status ile servis edilmemelidir.

## 500 — Beklenmeyen Hata

- [ ] Özel **500** hata deneyimi bulunmalıdır.
- [ ] Kullanıcıya beklenmeyen bir hata olduğu açıkça anlatılmalıdır.
- [ ] Retry veya güvenli geri dönüş aksiyonu mümkünse sunulmalıdır.
- [ ] Stack trace veya dahili teknik bilgiler kullanıcıya gösterilmemelidir.

## 503 — Geçici Olarak Kullanılamıyor

- [ ] Özel **503** bakım/geçici erişilemezlik sayfası bulunmalıdır.
- [ ] Kullanıcı durumun geçici olduğunu anlayabilmelidir.
- [ ] Bakım durumunda mümkünse açıklayıcı mesaj sunulmalıdır.

## Loading State

- [ ] Uzun süren işlemlerde kullanıcı loading durumu görmelidir.
- [ ] Loading UI layout'u gereksiz şekilde zıplatmamalıdır.
- [ ] Buton submit/loading durumunda duplicate işlem önlenmelidir.

## Empty State

- [ ] Veri olmayan ekranlarda **Empty State** bulunmalıdır.
- [ ] Boşluğun nedeni mümkün olduğunca anlaşılır olmalıdır.
- [ ] Kullanıcı sonraki olası aksiyona yönlendirilmelidir.

## Error State

- [ ] Component seviyesinde **Error State** tanımlanmalıdır.
- [ ] Kullanıcıya anlaşılır hata mesajı verilmelidir.
- [ ] Gerekliyse tekrar deneme aksiyonu bulunmalıdır.

## Success State

- [ ] Kayıt/güncelleme/silme/gönderim gibi işlemlerde **Success State** bulunmalıdır.
- [ ] Kullanıcı işlemin başarılı olduğundan emin olabilmelidir.
- [ ] Başarı mesajı işlem gerçekte tamamlanmadan gösterilmemelidir.
