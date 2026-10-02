# PDA ajan giriş rehberi

Bu dosya repo kökünden çalışan her ajan için ilk okuma noktasıdır.

İşe başlamadan önce sırasıyla aşağıdaki temel belgeleri oku:

1. `.agents/SECURITY.md`
2. `.agents/architecture.md`
3. `.agents/folder-structure.md`
4. `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`

Bu dört dosya temel bağlamdır.

`.agents` içindeki diğer belgeleri yalnız görevle ilişkiliyse oku. Kodun mevcut durumunu doğrudan dosyalardan doğrula; plan belgelerini, eski completion kayıtlarını veya checklist maddelerini uygulanmış özellik sayma.

---

## Belge rotası

- API işi: `.agents/api.md`
- Kimlik, oturum veya yetki: `.agents/authentication.md` ve `.agents/decisions/0003-cookie-auth.md`
- Veri modeli veya migration: `.agents/database.md`, gerekirse `.agents/er-diagram.md` ve `.agents/decisions/0002-postgresql.md`
- Modül sınırları: `.agents/decisions/0001-modular-monolith.md`
- Kurulum veya dağıtım: `.agents/deployment.md`
- Frontend standardı: `.agents/FRONTEND_WORKFLOW.md`
- Görsel tasarım kuralları: `.agents/frontend-design-rules.md`
- Web standartları: `.agents/web-rules/`
- Ana web kontrol listesi: `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`
- Fazın önceki teslimleri: `docs/compliation/` içindeki ilgili kayıt

Belgeler çelişirse önce mevcut kodu ve kabul edilmiş ADR'leri karşılaştır.

Güvenlik kuralını sessizce gevşetme. Kararı etkileyen belirsizliği kullanıcıya bildir.

Mimari, klasör düzeni veya kalıcı proje standardı değiştiğinde ilgili kısa özeti de güncelle.

---

# Web standartları ve kalıcı checklist

`.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`, projenin web standartları için **kalıcı kontrol durumu** olarak kullanılmalıdır.

Bu dosya yalnız dokümantasyon değildir; ajanların tamamlanmış ve eksik web standartlarını takip ettiği ortak checklist'tir.

## İlk tarama

Projede bu checklist henüz doldurulmamışsa veya ilgili maddeler `[ ]` durumundaysa:

1. Mevcut frontend ve gerekli backend/config dosyalarını incele.
2. Checklist maddelerini koddan ve config'den doğrula.
3. Gerçekten mevcut ve doğru uygulanmış maddeleri `[x]` olarak işaretle.
4. Eksik maddeleri `[ ]` bırak.
5. Projeye uygulanamayacak maddeleri checklist'in tanımladığı şekilde `N/A` ve kısa gerekçe ile işaretle.
6. Bir maddeyi yalnız dosya adı, yorum, TODO veya plan belgesine bakarak tamamlanmış sayma.

Checklist ilk kez değerlendirildiğinde mümkün olduğunca mevcut projenin gerçek durumunu yansıtmalıdır.

## Sonraki ajanlar

Daha önce `[x]` olarak doğrulanmış bir checklist maddesini **her görev başlangıcında tekrar kontrol etme**.

Örneğin:

```md
- [x] Footer
- [x] Favicon
- [ ] JSON-LD / Structured Data
```

Yeni ajan normal şartlarda `Footer` ve `Favicon` için tekrar audit yapmaz; `[ ]` durumundaki `JSON-LD / Structured Data` gibi eksik maddelere odaklanır.

Bu yaklaşım gereksiz tekrar taramalarını ve token kullanımını önlemek içindir.

## Ne zaman `[x]` madde tekrar kontrol edilir?

Bir `[x]` madde yalnız şu durumlarda yeniden doğrulanmalıdır:

- Mevcut görev doğrudan o maddeyi etkiliyorsa.
- İlgili component, route, layout veya config değiştirildiyse.
- Refactor ilgili davranışı bozabilecek kapsama sahipse.
- Kullanıcı açıkça yeniden audit yapılmasını istediyse.
- Önceki `[x]` işaretinin artık doğru olmayabileceğine dair somut kanıt varsa.

Örneğin global `layout.tsx`, metadata yapısı veya routing sistemi değiştirildiyse ilgili SEO maddeleri yeniden kontrol edilebilir.

Ancak bağımsız bir backend task'ında daha önce doğrulanmış `Favicon`, `OpenGraph` veya responsive tasarımı yeniden kontrol etme.

## Checklist güncelleme kuralı

Görev sırasında bir web standardı uygulanır veya değişirse ilgili checklist maddesini aynı görev içinde güncelle.

Örnek:

```md
- [ ] Empty State
```

Görev kapsamında tüm gerekli Empty State'ler uygulanıp doğrulanırsa:

```md
- [x] Empty State
```

Ancak uygulama kısmi ise `[x]` yapma.

Bir özellik yalnız tek sayfada uygulanmış fakat checklist maddesi proje genelinde bir standardı ifade ediyorsa tamamlanmış sayma.

## İlgili detay belgeleri

Checklist'teki bir madde üzerinde çalışırken gerekirse `.agents/web-rules/` altındaki ilgili detay dokümanını oku.

Örnek yapı:

```text
.agents/web-rules/
├── WEB_STANDARDS.md
├── 01_PROJECT_FOUNDATION.md
├── 02_DEVELOPMENT_STANDARDS.md
├── 03_LEGAL_CORPORATE.md
├── 04_SEO_GEO.md
├── 05_ACCESSIBILITY.md
├── 06_ERROR_EDGE_STATES.md
├── 07_PRE_PRODUCTION_QA.md
├── 08_POST_LAUNCH_CHECKS.md
└── WEB_SITE_MASTER_CHECKLIST_TR.md
```

Her görevde bu dosyaların tamamını okumak zorunlu değildir.

Yalnız görevle ilgili olanları kullan.

---

## Tamamlama ve kullanıcı kontrolü

Bir faz, servis veya bağımsız teslim gerçekten tamamlandığında:

`docs/compliation/YYYY-MM-DD-kisa-ad.md`

dosyası oluştur.

İçine şunları yaz:

- Tamamlanan kapsam
- Değişen önemli dosyalar
- Çalıştırılan doğrulama komutları
- Test/doğrulama sonuçları
- Açık kalan konular
- Kullanıcının manuel kontrol etmesi gereken adımlar

Kısmi ilerlemeyi tamamlandı diye kaydetme.

API tamamlandıysa `.agents/SECURITY.md` bölüm 11'deki endpoint bilgilerini ve Swagger ile kontrol yolunu completion kaydına ekle.

Kayıt biçimi için:

`docs/compliation/README.md`

dosyasını kullan.

Son mesajda kullanıcıya completion kaydını incelemesini açıkça söyle ve dosya yolunu ver.

---

## Güvenlik

`.agents/SECURITY.md` içindeki kurallar her zaman geçerlidir.

Özellikle:

- `.env`
- `.env.example`
- Secret yönetimi
- Authentication
- Authorization
- Cookie yapısı
- CSRF
- CORS
- API güvenliği
- Güvenlik mimarisi değişiklikleri

ile ilgili kuralları uygulamadan önce ilgili SECURITY bölümlerini oku.

Web checklist içindeki HTTPS gibi güvenlikle kesişen maddeler genel doğrulama amacı taşır; güvenlik detaylarının asıl kaynağı `.agents/SECURITY.md` dosyasıdır.

Güvenlik mimarisini kullanıcı onayı gereken bir noktada sessizce değiştirme.

---

## Frontend işleri

Frontend, UI veya UX ile ilgili anlamlı bir geliştirme başlamadan önce:

`.agents/FRONTEND_WORKFLOW.md`

dosyasını oku ve oradaki workflow'u uygula.

Görsel bir değişiklikten önce:

- Renk
- Font
- Component
- Sayfa
- Layout
- Spacing
- Responsive davranış
- Navigasyon yapısı

için şu dosyaları oku:

`.agents/frontend-design-rules.md`

ve

`frontend/src/app/globals.css`

Tüm sayfalar mevcut design token'larına uymalıdır.

İlgili global Claude Code skill ve plugin'lerini görev gerektiriyorsa kullan.

Küçük stil, typo veya tek satırlık değişikliklerde gereksiz tam audit pipeline'ı çalıştırma.

---

## Web görevi sonrası checklist kontrolü

Frontend veya public web davranışını etkileyen anlamlı bir görev tamamlandığında, görevin etkilediği maddeler açısından:

`.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md`

dosyasını tekrar gözden geçir.

Yalnız **değişiklikten etkilenebilecek maddeleri** kontrol et.

Checklist'in tamamını her seferinde baştan tarama.

Örneğin metadata işi yapıldıysa aşağıdaki maddeler ilişkili olabilir:

- Meta Data
- Unique Page Title
- Canonical URL
- OpenGraph
- hreflang
- JSON-LD

Ancak aynı görevde:

- Footer
- Form Validation
- 403
- Keyboard Navigation

değişmediyse tekrar denetlenmek zorunda değildir.

---

## Git ve dış işlemler

Aşağıdaki işlemleri yalnız kullanıcı o işlem için açık yetki verdiyse gerçekleştir:

- `git push`
- Merge
- Pull Request merge
- Release / yayın
- Production deployment
- Repository ayarı değişikliği
- Branch silme
- Remote üzerinde destructive işlem

Local dosya değişiklikleri, testler ve kullanıcı tarafından istenen geliştirmeler bu kural kapsamında normal şekilde yapılabilir.