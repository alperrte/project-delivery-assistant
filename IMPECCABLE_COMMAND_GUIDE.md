# Impeccable — Claude Code Komut Rehberi

> Proje içi hızlı referans dosyası.  
> Impeccable, frontend arayüzlerini tasarlamak, incelemek, sadeleştirmek, iyileştirmek ve son kalite kontrolünü yapmak için kullanılan Claude Code tasarım skill'idir.

## Temel Kullanım

Genel format:

```text
/impeccable <command> <target>
```

Örnek:

```text
/impeccable audit dashboard
/impeccable critique landing page
/impeccable polish settings page
/impeccable harden checkout form
```

Belirli bir alan vermeden de kullanılabilir:

```text
/impeccable audit
/impeccable polish
```

Komut listesini görmek için:

```text
/impeccable
```

---

## Yeni Bir Projede İlk Yapılacak İş

Yeni bir projede veya Impeccable'ı ilk kez kullanırken:

```text
/impeccable init
```

Bu komut projenin kalıcı ürün bağlamını toplar ve `PRODUCT.md` oluşturur.

Mevcut bir arayüz/design system varsa ayrıca:

```text
/impeccable document
```

kullanılarak mevcut koddan kök seviyede `DESIGN.md` oluşturulabilir.

> `PRODUCT.md` ürünün ne olduğunu anlatır.  
> `DESIGN.md` mevcut görsel sistemin ve tasarım kararlarının kaydını tutar.

---

# 24 Ana Komut

## 1. Oluşturma ve Planlama

### `/impeccable craft`

Baştan sona tasarım + geliştirme akışı çalıştırır.

```text
/impeccable craft dashboard
/impeccable craft landing page
```

**Kullan:** Yeni bir ekranı sıfırdan güçlü şekilde tasarlayıp implement etmek istediğinde.

---

### `/impeccable init`

Projenin ürün bağlamını hazırlar ve `PRODUCT.md` oluşturur.

```text
/impeccable init
```

**Kullan:** Projede ilk kez Impeccable kullanırken.

---

### `/impeccable shape`

Kod yazmadan önce UX/UI yapısını planlar.

```text
/impeccable shape project dashboard
/impeccable shape authentication flow
```

**Kullan:** Implementasyona başlamadan önce layout, hiyerarşi ve kullanıcı akışını belirlemek istediğinde.

---

### `/impeccable document`

Mevcut projeyi inceleyerek `DESIGN.md` üretir.

```text
/impeccable document
```

**Kullan:** Var olan frontend'in tasarım sistemini Claude'a kalıcı bağlam olarak öğretmek istediğinde.

---

### `/impeccable extract`

Tekrarlanan UI parçalarını reusable component/token/design-system yapısına çıkarır.

```text
/impeccable extract dashboard
/impeccable extract forms
```

**Kullan:** UI büyüdüğünde component ve design token tekrarlarını temizlemek için.

---

## 2. İnceleme ve Kalite Kontrol

### `/impeccable critique`

Tasarımı UX ve görsel kalite açısından eleştirir.

```text
/impeccable critique landing
/impeccable critique dashboard
```

Özellikle şunlara bakar:

- Görsel hiyerarşi
- Netlik
- Kullanıcı akışı
- Tasarımın karakteri
- Duygusal etki
- Genel UX kalitesi

**Kullan:** "Bu gerçekten iyi görünüyor mu?" sorusunun cevabı için.

---

### `/impeccable audit`

Teknik ve kullanılabilirlik denetimi yapar.

```text
/impeccable audit
/impeccable audit dashboard
/impeccable audit mobile navigation
```

Özellikle:

- Accessibility
- Responsive davranış
- Performance
- Theming
- UI tutarlılığı
- Teknik tasarım hataları

**Kullan:** Geliştirme bittikten sonra kapsamlı kontrol için.

---

### `/impeccable polish`

Shipping öncesi son kalite geçişidir.

```text
/impeccable polish
/impeccable polish dashboard
/impeccable polish login page
```

**Kullan:** UI büyük ölçüde tamamlandıktan sonra spacing, consistency, detaylar ve genel kaliteyi toparlamak için.

---

## 3. Tasarımın Karakterini Ayarlama

### `/impeccable bolder`

Fazla güvenli, sıradan veya "AI-generated" görünen tasarımı daha karakterli hale getirir.

```text
/impeccable bolder hero
/impeccable bolder landing page
```

**Kullan:** Arayüz temiz ama sıkıcı görünüyorsa.

---

### `/impeccable quieter`

Aşırı dikkat çeken veya yorucu tasarımı sakinleştirir.

```text
/impeccable quieter dashboard
/impeccable quieter navbar
```

**Kullan:** UI fazla efektli, yoğun veya agresif hale geldiyse.

---

### `/impeccable distill`

Gereksiz karmaşıklığı ve görsel gürültüyü kaldırır.

```text
/impeccable distill dashboard
/impeccable distill project card
```

**Kullan:** Çok fazla card, border, label, açıklama veya component olduğunda.

---

### `/impeccable delight`

Arayüze kontrollü kişilik ve küçük keyifli detaylar ekler.

```text
/impeccable delight onboarding
/impeccable delight empty states
```

**Kullan:** Tasarım doğru çalışıyor ama fazla mekanik hissediyorsa.

---

### `/impeccable overdrive`

Tasarımı daha deneysel ve teknik olarak iddialı hale getirir.

```text
/impeccable overdrive hero
```

**Kullan:** Özellikle marketing/portfolio gibi alanlarda daha sıra dışı bir görsel yaklaşım istediğinde.

> Dashboard ve kurumsal ürün UI'larında dikkatli kullan.

---

## 4. Görsel Sistem

### `/impeccable colorize`

Renk kullanımını geliştirir.

```text
/impeccable colorize dashboard
/impeccable colorize analytics cards
```

**Kullan:** UI fazla gri/monokrom veya renk hiyerarşisi zayıfsa.

---

### `/impeccable typeset`

Typography sistemini iyileştirir.

```text
/impeccable typeset
/impeccable typeset landing page
```

İncelediği alanlar:

- Font seçimi
- Başlık hiyerarşisi
- Font size
- Font weight
- Line height
- Okunabilirlik

---

### `/impeccable layout`

Layout, spacing ve görsel ritmi düzenler.

```text
/impeccable layout dashboard
/impeccable layout settings page
```

**Kullan:** Componentler tek tek iyi ama sayfa bütün olarak dengesiz görünüyorsa.

---

### `/impeccable animate`

Amaca yönelik animation ve micro-interaction ekler.

```text
/impeccable animate sidebar
/impeccable animate modal transitions
```

**Kullan:** Motion gerçekten kullanıcıya feedback veya yönlendirme sağlayacaksa.

---

## 5. UX ve Dayanıklılık

### `/impeccable clarify`

Belirsiz UX metinlerini düzeltir.

```text
/impeccable clarify settings
/impeccable clarify validation messages
```

Şunları iyileştirir:

- Button text
- Label
- Error message
- Empty-state metni
- Açıklamalar
- CTA

---

### `/impeccable adapt`

Farklı ekran boyutlarına ve cihazlara adapte eder.

```text
/impeccable adapt dashboard for mobile
/impeccable adapt navbar for tablet
```

**Kullan:** Desktop tasarımını responsive hale getirirken.

---

### `/impeccable harden`

UI'ı gerçek dünya koşullarına hazırlar.

```text
/impeccable harden login form
/impeccable harden dashboard
```

Kontrol ettiği örnekler:

- Error states
- Loading states
- Empty states
- Uzun metinler
- Overflow
- Edge cases
- i18n
- Beklenmeyen kullanıcı girdileri

**Kullan:** Production öncesi mutlaka düşünülmesi gereken komutlardan biridir.

---

### `/impeccable onboard`

Onboarding ve ilk kullanım deneyimini geliştirir.

```text
/impeccable onboard project creation
/impeccable onboard dashboard
```

Özellikle:

- İlk kullanım
- Empty state
- Activation flow
- Yeni kullanıcı yönlendirmesi

---

### `/impeccable optimize`

Frontend performansını iyileştirmeye odaklanır.

```text
/impeccable optimize dashboard
/impeccable optimize image gallery
```

**Kullan:** UI tamamlandıktan sonra performans problemlerini incelemek için.

---

## 6. Browser Üzerinde Görsel İterasyon

### `/impeccable live`

Browser üzerinde görsel variant/iteration modunu başlatır.

```text
/impeccable live
```

**Kullan:** Bir componenti gerçek sayfa üzerinde görerek iteratif biçimde geliştirmek istediğinde.

---

### `/impeccable generate`

Live modda belirli bir element için alternatif tasarımlar üretir.

```text
/impeccable generate hero
/impeccable generate pricing card
```

**Kullan:** Aynı UI parçasının birkaç farklı tasarım yönünü görmek istediğinde.

---

# Önerilen Workflow

## Yeni Bir Frontend / Yeni Ekran

```text
/impeccable init
```

Ardından:

```text
/impeccable shape <screen>
```

veya tam akış istiyorsan:

```text
/impeccable craft <screen>
```

Sonrasında:

```text
/impeccable critique <screen>
/impeccable audit <screen>
/impeccable harden <screen>
/impeccable polish <screen>
```

Önerilen sıra:

```text
INIT
  ↓
SHAPE
  ↓
IMPLEMENT
  ↓
CRITIQUE
  ↓
AUDIT
  ↓
HARDEN
  ↓
POLISH
```

---

## Mevcut "AI Slop" Frontend'i Düzeltme

Önerilen akış:

```text
/impeccable critique
/impeccable distill
/impeccable layout
/impeccable typeset
/impeccable colorize
/impeccable bolder
/impeccable audit
/impeccable polish
```

Her komutu körlemesine çalıştırmak gerekmez. Critique sonucuna göre gerekli olanları seç.

---

## Dashboard / SaaS Uygulaması

Önerilen:

```text
/impeccable document
/impeccable critique dashboard
/impeccable distill dashboard
/impeccable layout dashboard
/impeccable typeset dashboard
/impeccable harden dashboard
/impeccable adapt dashboard
/impeccable audit dashboard
/impeccable polish dashboard
```

Dashboard'larda özellikle `overdrive` ve fazla `animate` kullanımından kaçın.

---

## Landing Page

Önerilen:

```text
/impeccable shape landing
/impeccable bolder landing
/impeccable typeset landing
/impeccable colorize landing
/impeccable delight landing
/impeccable animate landing
/impeccable critique landing
/impeccable audit landing
/impeccable polish landing
```

---

# Hızlı Komut Tablosu

| Komut | Amaç |
|---|---|
| `craft` | Baştan sona tasarla + geliştir |
| `init` | Proje bağlamını oluştur |
| `document` | Mevcut design system'i belgele |
| `extract` | Reusable component/token çıkar |
| `shape` | Koddan önce UX/UI planla |
| `critique` | Tasarım eleştirisi yap |
| `audit` | Teknik UI/a11y/responsive audit |
| `polish` | Final kalite geçişi |
| `bolder` | Tasarımı daha karakterli yap |
| `quieter` | Fazla güçlü tasarımı sakinleştir |
| `distill` | Karmaşıklığı azalt |
| `harden` | Edge case ve production dayanıklılığı |
| `onboard` | İlk kullanım/activation UX |
| `animate` | Purposeful motion ekle |
| `colorize` | Renk sistemini geliştir |
| `typeset` | Typography'yi iyileştir |
| `layout` | Spacing/layout/hiyerarşi düzelt |
| `delight` | Küçük karakterli detaylar ekle |
| `overdrive` | Daha deneysel görsel yaklaşım |
| `clarify` | UX metinlerini düzelt |
| `adapt` | Responsive/device adaptasyonu |
| `optimize` | Frontend performansı |
| `live` | Browser üzerinde canlı tasarım iterasyonu |
| `generate` | Live modda tasarım varyantları üret |

---

# Shortcut / Pin

Sık kullandığın bir Impeccable komutunu ayrı slash command haline getirebilirsin.

Örnek:

```text
/impeccable pin audit
```

Bundan sonra:

```text
/audit
```

kullanılabilir.

Benzer şekilde:

```text
/impeccable pin polish
/impeccable pin critique
```

gibi sık kullanılan komutlar pinlenebilir.

---

# Bu Proje İçin Önerilen Minimum Final Kontrol

Bir frontend işi tamamlanmadan önce mümkünse şu dört adım çalıştır:

```text
/impeccable critique
/impeccable audit
/impeccable harden
/impeccable polish
```

Amaç:

1. Tasarım gerçekten iyi mi?
2. Teknik/UI sorunları var mı?
3. Edge-case'lerde bozuluyor mu?
4. Shipping öncesi son kalite yeterli mi?

---

# Notlar

- Komutların çoğuna hedef verebilirsin:
  ```text
  /impeccable audit header
  /impeccable polish checkout form
  ```
- Impeccable özellikle generic AI frontend kalıplarından kaçınmayı hedefler.
- Her komutu her ekranda çalıştırmak zorunlu değildir.
- Tasarım kararları projenin mevcut design system'i ile çelişmemelidir.
- Büyük redesign öncesinde `critique` veya `shape`, final aşamada `audit` + `polish` daha sağlıklıdır.
- Yeni projede `init`, mevcut projede `document` özellikle değerlidir.

---

## Kaynak

Bu rehber, Impeccable'ın güncel resmi komut yapısı (24 komut) temel alınarak hazırlanmıştır.

Official repository: `pbakaus/impeccable`
