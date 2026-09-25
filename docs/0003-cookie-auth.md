# ADR 0003: HttpOnly cookie ile JWT kimlik doğrulama

- Durum: Kabul edildi (teknik plan)
- Tarih: 2026-09-25

## Bağlam

PDA farklı ekipler tarafından self-deploy edilebilir ve tarayıcı tabanlı bir Next.js arayüzü sunar. Kimlik ve yetki güvenliği frontend kontrolüne bırakılamaz; tarayıcı token saklama, CSRF, CORS ve domain yerleşimi birlikte ele alınmalıdır.

## Karar

Spring Security kimlik ve yetki kontrolünü backend'de uygular. Şifreler BCrypt ile hashlenir. JWT access ve refresh tokenları `HttpOnly` cookie'de taşınır; auth tokenları/verileri `localStorage` veya `sessionStorage` içinde tutulmaz. Access token varsayılan süresi 15 dakika, refresh token varsayılan süresi 7 gündür; ikisi de ENV ile değiştirilebilir. Refresh rotation ve revocation desteklenir; persist edilen refresh token plaintext olmaz. JWT signing key yalnız backend secret ortamındadır.

Production cookie için `Secure=true` zorunludur. `SameSite` değeri frontend/backend domain topolojisi belirlendiğinde seçilir. Cookie auth nedeniyle CSRF koruması körlemesine devre dışı bırakılmaz; uygulama topolojisine uygun koruma kurulur. Production CORS izinli origin listesiyle sınırlanır. Hassas auth endpoint'lerinde rate limit/throttling uygulanır.

## Sonuçlar

- Tarayıcı istekleri cookie'leri ve CSRF mekanizmasını doğru taşımalıdır; bu akış E2E ve security testlerinde doğrulanır.
- Domain, cookie kapsamı ve CSRF taşıma ayrıntıları deployment kararı sonrasında kesinleştirilir.
- Logout, rotation ve revocation davranışı feature tasarımında açıkça belgelenip test edilir.
- Loglar ve hata yanıtları password, cookie, JWT veya secret içermez.

İlgili belgeler: [authentication.md](../authentication.md), [deployment.md](../deployment.md).
