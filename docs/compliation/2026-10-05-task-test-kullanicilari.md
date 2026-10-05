# Task frontend test kullanıcıları

## Teslim ve durum

2026-10-05 — Kullanıcının istediği beş test hesabı doğrudan yerel PostgreSQL veritabanına eklendi. Önceki rastgele adlı beş hesap kaldırıldı. Yeni hesapların tamamıyla giriş doğrulandı.

## Hesaplar

| Kullanıcı adı | E-posta | Kullanıcı ID |
|---|---|---|
| test1 | test1@hotmail.com | 50482e56-48bc-4a7f-bab0-4960518f46e7 |
| test2 | test2@hotmail.com | 297723ee-fa0e-4ebd-8f93-eb0718ab66f8 |
| test3 | test3@hotmail.com | aa97e481-7934-432d-824c-b278e6678755 |
| test4 | test4@hotmail.com | 6f001104-b0fc-429c-8639-a8c638d60350 |
| test5 | test5@hotmail.com | 5a18349b-5572-46eb-aa11-ba12077e1905 |

- Tüm hesaplar `ACTIVE`, global rol `USER`, e-posta durumu `PENDING`; zorunlu şifre değiştirme kapalıdır. Mevcut yerel kayıt akışıyla aynı alan değerleri kullanıldı.
- Beş hesapta kullanıcının belirttiği ortak test şifresi kullanıldı. Şifreler Spring Security BCrypt ile ayrı salt kullanılarak hashlenip saklandı; düz metin şifre bu belgeye veya kaynak dosyalara eklenmedi.
- Önceki beş hesap, beş oturum, bir bildirim ve bir bekleyen proje daveti aynı transaction içinde silindi. Davetin rol satırları mevcut FK cascade ile temizlendi.
- Eski hesapların proje üyeliği veya görev verisi olmadığı UUID referans taramasıyla kontrol edildi. Diğer hesaplara ait veriler korunarak yalnız belirlenen test hesapları değiştirildi.
- Önceki şifreli erişim dosyası ve oluşturma/parola kopyalama scriptleri kaldırıldı. Tek seferlik SQL/BCrypt araçları işlem sonrasında silindi; backend kaynak kodu veya migration eklenmedi.

## Doğrulama

Yerel PostgreSQL container'ında `docker compose exec -T postgres ... psql` ile kayıt ve UUID referans kontrolleri yapıldı. Tek seferlik transaction çalıştırıldı:

```powershell
& .local/replace-task-test-users.ps1 -Password $testSeedPassword
```

Bu geçici script işlem tamamlandıktan sonra kaldırıldı. Sonuç: beş eski hesap silindi, beş yeni hesap eklendi, eski hesaplardan kalan kayıt sayısı `0`, transaction `COMMIT` ile tamamlandı.

Her yeni hesap için normal CSRF cookie/header akışıyla `POST /api/v1/auth/login`: `200`; `GET /api/v1/auth/me`: `200`, doğru ID/kullanıcı adı ve `USER` rolü; `POST /api/v1/auth/logout`: `200`. Beş hesabın tamamı başarılıdır.

Uygulama kaynak kodu değişmediği için ESLint/build/tam test paketi çalıştırılmadı. Veri kaydı ve gerçek giriş akışı doğrulandı.

## Açık konular ve kullanıcı kontrolü

1. Login ekranında yukarıdaki e-postalardan biri ve belirttiğiniz ortak test şifresiyle giriş yapın.
2. Görev atama testleri için hesapları ilgili proje/ekibe davet edip davetleri kabul edin. Yeni hesaplar henüz herhangi bir projeye veya ekibe eklenmedi.
3. Eski rastgele adlı hesaba gönderilen davet kaldırıldı; gerekiyorsa daveti yeni `test1` hesabına yeniden gönderin.
