# Mimari kısa özet

**Durum:** Kabul edilmiş teknik plan ve mevcut iskeletin özeti. Bir özelliğin uygulanmış olduğunu tek başına göstermez.

- Ürün: öğrenciler ve küçük ekipler için self-hosted proje yönetimi.
- Backend: tek Spring Boot uygulaması, Spring Modulith ile modül sınırları. Modüller arası senkron iletişim hedef modülün public contract/facade katmanından geçer; başka modülün repository veya entity'sine doğrudan bağımlılık kurulmaz. Olay bildirimi Spring ApplicationEvent ile planlanmıştır. Ayrıntı: `decisions/0001-modular-monolith.md`.
- Frontend: Next.js App Router, TypeScript ve Tailwind. Özellik bazlı düzen hedeflenir; mevcut arayüz scaffold seviyesindedir.
- Veri: PostgreSQL, Spring Data JPA/Hibernate ve Flyway. Yerelde Docker PostgreSQL; production için Neon varsayılan seçenek, fakat uygulama standart PostgreSQL bağlantısı kullanır. Production şema doğrulaması `ddl-auto=validate`. Ayrıntı: `database.md`, `decisions/0002-postgresql.md`.
- API: Spring MVC REST, `/api/v1`; endpoint sözleşmesi özellik uygulanırken belirlenir. Backend input ve erişim denetiminin sahibidir. Ayrıntı: `api.md`.
- Güvenlik: Spring Security, BCrypt, HttpOnly cookie içinde access/refresh JWT, CSRF koruması, açık CORS izin listesi, proje kapsamlı RBAC. Ayrıntı: `SECURITY.md`, `authentication.md`, `decisions/0003-cookie-auth.md`.
- Çalıştırma: Docker Compose içinde frontend, backend, postgres. Production hosting ve domain topolojisi henüz kararlaştırılmadı. Ayrıntı: `deployment.md`.

**Mevcut kod durumu:** Backend giriş sınıfı `com.pda` kökündedir. V1 ortak altyapı ve Auth/User tarafında V2–V4 migration, local register/login/logout/me, HttpOnly JWT cookie, CSRF ve açık CORS izin listesi vardır. Project Service `com.pda.project` altında Organization, Project ve ilk ProjectMembership modellerini içerir; V21–V23 migration, Project/Organization ve üyelik REST API, son Project Manager koruması ve `ProjectAccess` public contract uygulanmıştır. Proje rol kümesi Auth canonical sözleşmesi gelene kadar geçicidir. Swagger/OpenAPI yalnız `API_DOCS_ENABLED=true` iken açıktır. Squad ve diğer iş modülleri henüz iskelet düzeyindedir; frontend varsayılan Next.js sayfası düzeyindedir.
