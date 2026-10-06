# Task test kullanıcıları

## Teslim ve durum

2026-10-06 — Kullanıcının istediği beş test hesabı doğrudan yerel Docker PostgreSQL veritabanına INSERT edildi. İşlem öncesinde hedef e-postalar ve kullanıcı adları için kayıt bulunmadığı doğrulandı. Beş hesap tek transaction içinde oluşturuldu ve tamamıyla gerçek giriş doğrulandı.

## Hesaplar ve yapılanlar

| Kullanıcı adı | E-posta | Kullanıcı ID |
|---|---|---|
| test1 | test1@hotmail.com | 2bfc27bb-1d95-407d-9b14-7b427a824b4b |
| test2 | test2@hotmail.com | 9ffe3411-9e61-4f39-994a-0d91d15d16c1 |
| test3 | test3@hotmail.com | 9aed72ec-5a1f-40ff-8e8d-3ae16df162e3 |
| test4 | test4@hotmail.com | 386324f3-16e2-44fc-b56b-e3667a607df2 |
| test5 | test5@hotmail.com | 45d9e0ab-d5b6-41d1-b07a-8ddbabc85ab2 |

- Hesaplar `ACTIVE`, global rol `USER`, e-posta doğrulama durumu `PENDING`; zorunlu şifre değiştirme kapalıdır. Mevcut yerel kayıt akışıyla aynı alan değerleri kullanıldı.
- Kullanıcının belirttiği ortak test şifresi, mevcut backend paketindeki Spring Security `BCryptPasswordEncoder` ile bağımsız salt kullanılarak hashlenip saklandı. Düz metin şifre kaynak dosyalara veya bu belgeye yazılmadı.
- Parametreli PostgreSQL `PREPARE` / `EXECUTE` ile beş INSERT aynı transaction içinde çalıştırıldı; `COMMIT` başarılıdır. Kullanıcı oluşturmak için kayıt API'si çağrılmadı; mevcut hesaplar silinmedi veya güncellenmedi.
- Backend/frontend kaynak kodu, migration, şema ve ortam dosyaları değişmedi. Kalıcı dosya değişikliği yalnız bu teslim kaydıdır. Tek seferlik Java/PowerShell araçları ve geçici BCrypt bağımlılık kopyaları işlem sonrasında kaldırıldı.
- [Önceki teslim kaydı](2026-10-05-task-test-kullanicilari.md) biçim olarak kullanıldı; bu görevde oluşturulan gerçek UUID'ler yukarıdadır.

## Doğrulama

Çalıştırılan komut ve kontroller:

```powershell
docker compose ps --format json
& .local/insert-task-test-users.ps1 -Password $taskRequestedPassword
```

Geçici script kaldırıldı; şifre yalnız işlem belleğinde kullanıldı. PostgreSQL komutları mevcut container ortamındaki kullanıcı/veritabanı bilgileriyle, `docker compose exec -T postgres ... psql -p 5436 -v ON_ERROR_STOP=1` üzerinden çalıştırıldı.

- Gerçek `information_schema.columns` ile kullanıcı tablosu doğrulandı; hedef kullanıcı adı/e-posta sorgusu işlem öncesinde `0` kayıt döndürdü.
- Transaction sonucu: beş adet `INSERT 0 1`, ardından `COMMIT`.
- Son SQL kontrolü: `5` test hesabı, `5` farklı BCrypt hash'i; BCrypt biçimi ve ACTIVE/USER/zorunlu şifre değişimi alan kontrolleri başarılı.
- Her hesap için PowerShell `Invoke-WebRequest` ile normal CSRF cookie/header akışı kullanıldı: `POST /api/v1/auth/login` → `200`, `GET /api/v1/auth/me` → `200` ve doğru kullanıcı adı/e-posta/USER rolü, `POST /api/v1/auth/logout` → `200`.
- Çıkış sonrasında bu hesaplara ait aktif oturum sayısı `0`. Giriş doğrulamasının oluşturduğu iptal edilmiş oturum kayıtları normal uygulama davranışı olarak korunur.
- Uygulama kodu değişmediği için lint, build ve tam test paketi çalıştırılmadı. Veri kaydı ve beş hesabın gerçek giriş akışı doğrulandı.

## Açık konular ve kullanıcı kontrolü

1. Login ekranında tablodaki e-postalardan biri ve belirttiğiniz ortak test şifresiyle giriş yapın; hesabın açılması beklenir.
2. Görev atama testleri için hesapları ilgili proje/ekibe davet edip davetleri kabul edin. Bu işlemde proje veya ekip üyeliği eklenmedi.
3. Bu kayıt yerel veritabanı içindir; production veya başka bir veritabanına veri eklenmedi.
