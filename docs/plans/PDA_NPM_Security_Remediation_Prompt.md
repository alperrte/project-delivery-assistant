# PDA — NPM Security Remediation Plan

PDA frontend tarafında `npm audit` uyarıları için güvenli ve kontrollü bir remediation çalışması yapılacak.

Amaç:
- mevcut uygulama davranışını bozmadan gereksiz dependency zincirini azaltmak,
- `npm audit fix --force` veya major downgrade gibi riskli otomatik değişikliklerden kaçınmak,
- `shadcn` CLI bağımlılığını gerçekten kullanıp kullanmadığımızı doğrulamak,
- yalnız kullanılan CSS davranışlarını koruyarak gereksiz JS/CLI dependency zincirini kaldırmak,
- ESLint/Next toolchain tarafındaki kalan advisory zincirini kontrollü şekilde değerlendirmek,
- production öncesi gerçek build/deployment etkisini doğrulamak.

Kaynak rapor:

```text
PDA_NPM_Hata_ve_Cozum_Raporu_2026-10-05.md
```

Rapordaki bulguları körlemesine kabul etme; repository'deki gerçek kullanım, package.json, package-lock.json, imports, CSS ve build çıktılarıyla doğrula.

## Sabit kararlar

```text
npm audit fix --force        → KULLANMA
Major downgrade              → YAPMA
ESLint/Next kalite zinciri   → KALDIRMA
Security warning suppression → YAPMA
Audit seviyesini düşürme     → YAPMA
node_modules elle patch      → YAPMA
```

Öncelikli remediation:

```text
Kullanılmayan shadcn CLI / JS dependency zincirini kaldır
↓
Gerekli shadcn CSS davranışlarını güvenli şekilde local olarak koru
↓
package-lock'u gerçek npm install ile güncelle
↓
UI/build regression testleri
↓
npm audit sonuçlarını yeniden ölç
↓
Kalan braces/ESLint zincirini ayrı raporla
```

## 1. Mevcut Dependency Kullanımını Doğrula

Önce şunları incele:

- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/src/app/globals.css`
- `frontend/src/**`
- `frontend/scripts/**`
- Next config
- ESLint config
- shadcn config varsa
- UI componentleri
- CSS imports
- Tailwind/PostCSS config

Özellikle şunu kanıtla:

> `shadcn` npm paketinin JavaScript CLI/registry/ts-morph API'si production veya build code tarafından gerçekten kullanılıyor mu?

Şunları ara:

```text
import ... from "shadcn"
require("shadcn")
npx shadcn
shadcn CLI
registry
ts-morph
fast-glob
```

Sadece package.json'da olması kullanım kanıtı değildir.

## 2. Shadcn CSS Kullanımını Haritala

Mevcut:

```css
@import "shadcn/tailwind.css";
```

veya eşdeğer kullanım varsa gerçek CSS ihtiyacını çıkar.

Özellikle mevcut componentlerde kullanılan davranışları bul:

- dialog
- select
- dropdown-menu
- tooltip
- popover
- sheet
- modal
- animations
- `data-open:`
- `data-closed:`
- keyframes
- utility classes
- transition variants

Amaç:

> `shadcn` paketini kaldırırken kullanılan CSS davranışları kaybolmamalı.

Gerekli CSS'i minimum ve kontrollü şekilde local stylesheet'e taşı.

Tüm `shadcn/tailwind.css` dosyasını körlemesine kopyalama.

Sadece PDA'nın gerçekten kullandığı selector/variant/keyframe davranışlarını çıkar.

Lisans/provenance bilgisini gerekiyorsa yorum veya belge ile koru.

## 3. Local CSS Yapısı

Mevcut design system ve CSS yapısına uygun bir dosya oluştur.

Örneğin repository yapısına uygunsa:

```text
frontend/src/styles/shadcn-compat.css
```

veya mevcut style convention'a uygun başka bir konum.

Bu dosya:

- yalnız gerekli CSS/variants/keyframes içermeli
- mevcut dark/light theme token sistemini bozmamalı
- Tailwind ile çakışmamalı
- duplicate utility üretmemeli
- gereksiz global selector eklememeli

Sonra:

```css
@import "shadcn/tailwind.css";
```

yerine bu local compat stylesheet kullanılmalı.

## 4. Shadcn Dependency Removal

Repository analizinde shadcn CLI/JS gerçekten kullanılmıyorsa:

```text
shadcn
```

paketini `dependencies` içinden kaldır.

Manual package.json edit + lock hack yapma.

Gerçek npm komutuyla lock'u güncelle.

Örneğin uygun ise:

```bash
npm uninstall shadcn
```

veya repository'nin package manager convention'ına uygun komut.

Sonrasında:

```bash
npm ci
```

ile temiz kurulum doğrula.

Eğer shadcn'in herhangi bir JS/CLI kullanımı bulunursa dependency'yi kaldırma; önce raporla.

## 5. Dependency Tree Yeniden Ölçümü

Değişiklikten sonra çalıştır:

```bash
npm ls braces micromatch fast-glob ts-morph shadcn eslint-config-next --json
npm audit --json
npm audit --omit=dev --json
```

Before/after karşılaştırması yap.

Şunları net raporla:

- toplam high sayısı
- production `--omit=dev` high sayısı
- hangi zincir kalktı
- hangi zincir kaldı
- `shadcn → ts-morph/fast-glob` zinciri tamamen kaldırıldı mı
- ESLint/Next zinciri kaldı mı

Audit sayısını düşmüş göstermek için warning suppression kullanma.

## 6. ESLint / Next Zincirine Dokunma Kuralı

Şu aşamada:

```text
eslint-config-next
@next/eslint-plugin-next
fast-glob
micromatch
braces
```

zincirini çözmek için:

- ESLint'i kaldırma
- Next ESLint config'i kaldırma
- eski major sürüme downgrade yapma
- `npm audit fix --force` kullanma
- rastgele package override ekleme

YAPMA.

Mevcut official patched release yoksa bu zinciri açık dependency-security debt olarak bırak.

Ancak güncel registry/advisory durumunu uygulama anında tekrar doğrula.

Eğer resmi patched release artık mevcutsa:

1. sürümü doğrula
2. release/advisory'yi doğrula
3. compatibility kontrolü yap
4. normal package update planı çıkar

Kullanıcı onayı olmadan major değişiklik yapma.

## 7. Backport / Patch Kararı

Bu taskın varsayılan kapsamı:

```text
custom braces patch/backport UYGULAMA
```

olmalıdır.

Ancak production release çok yakınsa ve resmi fix hâlâ yoksa ayrı bir öneri hazırla.

Bu öneride:

- exact upstream diff
- patch maintenance burden
- `patch-package` veya npm override yaklaşımı
- string input
- AST input
- parse
- compile
- expand
- stringify
- deep nesting
- Windows path
- consumer regression

testlerini açıkla.

Kullanıcı açıkça onaylamadan custom security patch ekleme.

## 8. UI Regression

Shadcn CSS dependency kaldırıldıktan sonra en az şu componentleri doğrula:

- Dialog
- Select
- Dropdown Menu
- Tooltip
- Popover varsa
- Sheet/modal varsa
- form dropdownları
- project create
- organization create/edit
- settings
- chat
- light theme
- dark theme

Özellikle kontrol et:

```text
open/close animation
data-open/data-closed variants
opacity
scale
slide
focus ring
overlay
z-index
pointer interaction
keyboard interaction
```

CSS kaybı nedeniyle "component çalışıyor ama animasyon/stil bozuldu" durumu kabul edilmemeli.

## 9. Theme / Animation Regression

PDA'daki:

- light/dark theme
- theme transition
- reduced motion
- dropdown transitions
- dialog transitions

bozulmamalı.

Hardcoded style ile mevcut design token sistemini bypass etme.

## 10. Build / Type / Lint Validation

Değişiklikten sonra çalıştır:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Hepsi geçmeli.

ESLint zincirinde audit warning olması lint'in kaldırılması için gerekçe değildir.

## 11. Playwright Regression

Mevcut Playwright altyapısını kullan.

Özellikle shadcn-style davranış kullanan sayfaları kapsa:

- dialogs
- selects
- dropdowns
- tooltips
- project create
- organization create/edit
- project settings
- chat
- theme

Sonra full Chromium suite çalıştır.

## 12. Full Pre-Push

Değişiklikler hedefli testlerden geçtikten sonra mevcut kalite kapısını çalıştır:

```powershell
.\pre-push\pre-push.cmd
```

Şunlar geçmeli:

- backend gate
- lint
- TypeScript
- frontend build
- Playwright
- Docker build/health

`npm audit` mevcut pre-push gate'inin parçası değilse bunu sessizce gate'e ekleme.

Audit sonucunu ayrıca raporla.

## 13. Production Bundle / Deployment Check

`npm audit --omit=dev` sayısını tek başına production exploitability kanıtı kabul etme.

Yeni temiz build sonrası:

- Next build output
- `.nft.json`
- standalone/server bundle varsa
- Docker image dependency içeriği

üzerinde şu paketlerin production artifact'e girip girmediğini incele:

```text
braces
micromatch
fast-glob
ts-morph
shadcn
```

Şunları ayır:

```text
installed dependency
build-time dependency
runtime bundled dependency
browser bundle dependency
server runtime dependency
```

Bu ayrım final raporda açık olsun.

## 14. Security Assessment

Finalde şu üç konuyu ayrı ayrı değerlendir:

### A — Advisory exists?
Gerçek CVE/advisory mevcut mu?

### B — Installed vulnerable version?
PDA dependency tree'sinde gerçekten var mı?

### C — Reachable runtime path?
PDA production runtime/user input üzerinden tetiklenebilir bir yol doğrulandı mı?

Bunları birbirine karıştırma.

## 15. Git Güvenliği

Kullanıcı değişikliklerini kaybetme.

Kullanma:

```text
git reset --hard
git checkout .
```

Plan dışı dosyaları revert etme.

Commit/push yapma.

## 16. Çalışma Düzeni

Taskları şu sırada uygula:

```text
1. dependency usage audit
2. shadcn CSS usage mapping
3. local compatibility CSS
4. shadcn dependency removal
5. clean npm install
6. npm audit before/after comparison
7. lint/type/build
8. targeted UI regression
9. full Playwright
10. pre-push
11. production bundle/runtime dependency check
12. final security report
```

Bir aşama tamamlanmadan sonraki aşamaya geçme.

## 17. Final Rapor

Final cevabını şu sırayla ver:

### 1. Executive Summary
Ne değişti?

### 2. Dependency Changes
Hangi package kaldırıldı/güncellendi?

### 3. Shadcn CSS Migration
Hangi CSS davranışları local olarak korundu?

### 4. Audit Before / After

| Kontrol | Önce | Sonra |
|---|---:|---:|
| npm audit high | ... | ... |
| npm audit --omit=dev high | ... | ... |

### 5. Remaining Vulnerability Chain
Kalan braces/micromatch/fast-glob zinciri.

### 6. Runtime Reachability
Production/user input üzerinden doğrulanmış exploit yolu var mı?

### 7. Production Artifact Check
Hangi paketler build/runtime artifact içinde kaldı?

### 8. Regression Results
Lint/type/build/UI/Playwright.

### 9. Pre-Push
Sonuç.

### 10. Security Recommendation

Şu dört durumdan net birini seç:

```text
SAFE TO KEEP TEMPORARILY
REQUIRES PATCH BEFORE PRODUCTION
WAIT FOR OFFICIAL FIX
BLOCK PRODUCTION
```

ve nedenini açıkla.

### 11. Remaining Work
Varsa resmi fix takibi veya future patch işi.

## Kritik Kurallar

1. `npm audit fix --force` kullanma.
2. Major downgrade yapma.
3. ESLint/Next kalite zincirini kaldırma.
4. Audit warning suppress etme.
5. Paket sürümünü sahte değiştirme.
6. `node_modules` elle patchleme.
7. Kullanılmayan shadcn JS/CLI zincirini gerçek kullanım analizi olmadan kaldırma.
8. Gerekli shadcn CSS davranışlarını kaybetme.
9. CSS'i körlemesine komple kopyalama.
10. UI regression testlerini atlama.
11. `--omit=dev` sonucunu tek başına runtime exploit kanıtı sayma.
12. Advisory, installed version ve runtime reachability'yi ayrı değerlendir.
13. Resmi patched release varsa implementation öncesi güncel olarak doğrula.
14. Custom braces backport'u kullanıcı onayı olmadan uygulama.
15. Production bundle/runtime dependency içeriğini temiz build sonrası kontrol et.
16. Commit/push yapma.
17. Mevcut kullanıcı değişikliklerini kaybetme.
18. Sonuçta audit before/after rakamlarını açıkça yaz.
