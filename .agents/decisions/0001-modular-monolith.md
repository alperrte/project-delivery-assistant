# ADR 0001: Modular Monolith

- Durum: Kabul edildi (teknik plan)
- Tarih: 2026-09-25

## Bağlam

PDA, öğrenciler ve küçük ekipler için düşük kurulum ve barındırma maliyetli, self-deploy edilebilir açık kaynak bir ürün hedefler. V1'de proje, kullanıcı, task, bildirim ve mail gibi farklı iş alanları vardır. Microservices bu aşamada gereksiz operasyonel ve kaynak maliyeti getirir.

## Karar

Backend tek bir Spring Boot uygulaması ve executable JAR olarak deploy edilir. İç yetenekler açık modül sınırlarıyla düzenlenir; Spring Modulith bu sınırları ve architecture testlerini doğrulamak için kullanılır. Modüller arası senkron çağrı hedef modülün public API/contract facade'ından geçer. Modüller başka modülün repository implementasyonuna doğrudan erişmez veya persistence entity'sini ortak model olarak dolaştırmaz. `shared` yalnız domain'den bağımsız çapraz teknik altyapıyı barındırır.

“Olay gerçekleşti” bildirimleri için Spring `ApplicationEvent` ve projeye ait event contract'ları kullanılır. Örneğin task atama olayı Notification modülüne, mail etkinse Mail modülüne iletilebilir. Kafka/RabbitMQ V1 kapsamına alınmaz.

## Sonuçlar

- Tek uygulama ve basit deployment modeli, düşük maliyet hedefini destekler.
- Modül sınırlarının ihlalini Spring Modulith architecture testleriyle yakalamak gerekir.
- Event contract'ları ve işlem sınırları feature uygulamasında açıkça belirlenir; event taşıma mekanizması ayrı servis zorunluluğu doğurmaz.
- Gelecekte ölçülen ihtiyaç olursa modül ayrıştırması yeniden değerlendirilebilir; V1 mikroservis değildir.

İlgili belgeler: [database.md](../database.md), [api.md](../api.md).
