# Klasör yapısı kısa rehberi

Bu belge gezinme haritasıdır; gerçek dosya ve klasörler değişmiş olabilir. Görev sırasında ilgili yolu doğrula.

| Yol | İçerik / yerleştirme kuralı |
| --- | --- |
| `AGENTS.md` | Ajanın ilk okuyacağı kök yönerge ve belge rotası |
| `.agents/` | Güvenlik, mimari, klasör, API, auth, veri ve deployment rehberleri |
| `.agents/decisions/` | Kabul edilmiş mimari karar kayıtları; ilgili değişiklikte oku |
| `backend/src/main/java/com/pda/` | Backend modülleri ve kök `BackendApplication` giriş sınıfı |
| `backend/src/main/resources/db/migration/` | Sıralı Flyway SQL migration'ları |
| `backend/src/test/java/com/pda/` | Backend testleri; modül ve use-case'e yakın tut |
| `frontend/src/app/` | Next.js App Router sayfaları, layout ve global stil |
| `frontend/public/` | Statik frontend varlıkları |
| `docs/` | Proje ve faz belgeleri |
| `docs/compliation/` | Gerçekten tamamlanan faz/servis teslim kayıtları ve kullanıcı kontrol adımları |
| `assets/` | Repo görselleri |
| `pre-push/` | Yerel push öncesi kalite kapısı |
| `docker-compose.yml`, `.env.example` | Yerel servis düzeni ve örnek ortam sözleşmesi; değişiklikte `SECURITY.md` onay kuralı geçerli |

Backend modül iskeletleri `admin`, `auth`, `user`, `project`, `squad`, `task`, `issue`, `testreport`, `comment`, `notification`, `mail`, `activity`, `dashboard`, `search` ve `shared` altında düzenlenir. Modül içinde amaçlanan katmanlar `api` (controller/DTO), `application` (use-case/service/mapper), `domain`, `infrastructure` ve dışa açık `contract` olarak ayrılır. Yalnız mevcut klasör adına bakıp işlevin tamamlandığını varsayma; `.gitkeep` dosyaları yer tutucudur. `shared` sadece alan bağımsız ortak teknik altyapı içindir.

`user/domain/entity` içinde User ve UserSession, `user/infrastructure/repository` içinde bunların repository arayüzleri bulunur. `auth/infrastructure/config` geçici deny-all security başlangıcını içerir. Auth alanının ilk gerçek şeması kök Flyway dizinindeki `V2__auth_user_session.sql` dosyasındadır. Diğer modüllerin yer tutucu durumunu gerçek kod olarak yorumlama.

Yeni özellikte ilgili modülün gerçek kodunu ve testini kendi alanına yerleştir. Yapı değişirse bu haritayı kısa ve güncel tut; tam dosya ağacı dökümü ekleme.
