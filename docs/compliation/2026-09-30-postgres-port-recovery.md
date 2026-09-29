# PostgreSQL port recovery — 2026-09-30

## Teslim ve durum

Çöken backend container'ı mevcut Compose yapılandırmasına göre yeniden başlatıldı. Git commit veya push yapılmadı.

## Kaynak ve yapılanlar

Çalışan PostgreSQL container'ı önceki Compose ayarıyla container içinde ve host üzerinde 5432 portunu kullanıyordu. Mevcut `.env` içindeki backend bağlantı adresi ve `docker-compose.yml` ise 5436 portunu bekliyordu. Compose dosyasını değiştirmek çalışan container'ın komutunu veya port eşlemesini kendiliğinden güncellemediğinden Flyway bağlantısı `Connection refused` ile kesildi; Spring uygulaması açılışta durdu.

`docker compose up -d --force-recreate postgres backend` ile iki container mevcut Compose ayarı altında yeniden oluşturuldu. `pda_postgres_data` volume'ü korunarak yeniden bağlandı. Kod, `.env` ve `.env.example` dosyaları değiştirilmedi.

## Doğrulama

- `docker compose ps`: PostgreSQL `healthy`, backend `running`; PostgreSQL port eşlemesi `5436:5436`.
- `docker compose exec -T postgres pg_isready -h localhost -p 5436`: bağlantı kabul ediliyor.
- Backend logu: Flyway veritabanına bağlandı ve V31 dahil 19 migration uyguladı; `Started BackendApplication` görüldü.
- `GET http://localhost:8080/actuator/health`: `UP`.

## API

Yeni endpoint eklenmedi. Kontrol yolu: kimlik gerektirmeyen `GET /actuator/health`, başarı `200` ve `status: UP`.

## Açık konular

Port değeri tekrar değiştirilirse PostgreSQL container'ının yeniden oluşturulması gerekir. Compose dosyasındaki 5436 değişikliği bu görevden önce çalışma ağacında mevcuttu; bu teslimde dosya içeriği değiştirilmedi.

## Kullanıcı kontrolü

`docker compose ps` ile iki servisin ayakta olduğunu ve `http://localhost:8080/actuator/health` yanıtının `UP` olduğunu doğrulayın. Uygulamadan normal giriş ve bildirim listesini açarak veritabanı erişimini uçtan uca kontrol edin.
