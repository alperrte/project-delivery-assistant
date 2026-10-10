# PDA — UI / Workflow / State / Notification Refinements — Final Completion

Kaynak talep: `.agents/PDA_UI_Workflow_State_Notification_Refinements_Plan_and_Implementation.md` (15 talep). Plan ve ilerleme: [PDA_UI_WORKFLOW_STATE_NOTIFICATION_REFINEMENTS_PLAN.md](../../PDA_UI_WORKFLOW_STATE_NOTIFICATION_REFINEMENTS_PLAN.md). Faz kayıtları:

- [general-features](2026-10-10-general-features-ui-refinements.md)
- [project-service-backend](2026-10-10-project-service-backend-pagination-invitation-banner.md)
- [project-service-frontend](2026-10-10-project-service-frontend-ui-refinements.md)
- [squad-service-backend](2026-10-10-squad-service-teams-invite-response-badge.md)
- [notification-service](2026-10-10-notification-history-delete.md)

## Final verdict

15 talebin tamamı uygulandı. Her faz kendi branch'inde, kullanıcının commit/push/merge'üyle main'e girdi (PR #126, #127, #128, #129, #131). Birleşik `origin/main` (`85f784d`) üzerinde doğrulama yapıldı:

- Backend 664/0/0/0.
- Lint, TypeScript ve production build temiz.
- Docker build/start/health geçti.
- Tam Chromium paketi 811/814.
- Public paket 277/278.

Kalan sonuçların durumu:

- **Entegrasyon çakışması:** Paralel merge edilen `ui-ux-app.spec.ts`, eski kriter dialogunu bekliyordu. Sayfa akışına uyarlandı ve dosya 23/23 geçti. Bu düzeltme henüz commit edilmedi; bkz. "Remaining issues".
- **Aralıklı testler:**
  - `team-member-preview` oturum 401'i (9 tam koşunun 8'inde görüldü; tek başına ve ilgili spec'lerle her zaman geçiyor).
  - `a11y-public` forgot-password dark mobile kontrastı (`--repeat-each=3` ile 36/36).

Md'nin final DoD'si "Full regression PASS" ve "Canonical pre-push PASS" şartlarını koşuyor. `team-member-preview` nedeniyle bu iki şart katı biçimde **sağlanmadı**; kullanıcı her fazda bu aralıklı hatayı kayıtlı istisna olarak kabul etti. Bu nedenle global durum: **tamamlandı, kayıtlı test-altyapısı istisnasıyla.**

## Task checklist

- [x] 1 — Proje/Organizasyon create doğrulama özeti
- [x] 2 — Öncelik kart/önizleme tutarlılığı
- [x] 3 — Commit geçmişi sayfalama
- [x] 4 — Organizasyon kartı = proje kartı ölçüleri
- [x] 5 — Kriter oluştur/düzenle tam sayfa
- [x] 6 — Silinen proje sidebar/rota temizliği
- [x] 7 — Ekipler Kart | Tablo | Şema
- [x] 8 — Proje Davetlerim yeniden tasarım
- [x] 9 — Davet önizlemesinde banner
- [x] 10 — Üye Davet Et tam sayfa
- [x] 11 — Ekip daveti yanıt rozeti (+N)
- [x] 12 — Bildirim geçmişi tekli silme + Tümünü sil
- [x] 13 — Görev yorumu Enter / Ctrl+Enter
- [x] 14 — Sprint oluştur/düzenle tam sayfa
- [x] 15 — Ortak DatePicker + yeni TimePicker + tüm tüketiciler

## Create form validation summary

`FormErrorSummary` + `StickyFormActions` bileşenleri eklendi. Başarısız gönderimde odak sayfa sırasına göre ilk hatalı alana gidiyor; bu, merge sırasında Alper'in ekip standardına uyarlandı. Özet `role="alert"` ile duyuruluyor ve bölüm bağlantıları alana götürüyor; inline hatalar korunuyor. Proje ve organizasyon formu aynı standardı kullanıyor. Tek bölümlü formlarda (kriter, sprint) özet yok; inline hata ve odak yeterli.

## Project priority consistency

Sorun cache değil, kartta öncelik gösteriminin olmamasıydı. Kart başlık bandında proje skalasıyla çip eklendi; ayar önizlemesi canlı izliyor. Değişiklik yenilemeden yansıyor ve diğer projeler etkilenmiyor.

## Deleted project navigation cleanup

`useSelectedProject` 404/403'te seçimi bırakıyor (`forgetSelectedProject`). Silme sonrası yalnız o projenin cache anahtarları kaldırılıyor ve `router.replace("/projects")` yapılıyor. Eski adresler gömülü 404 gösteriyor.

## Criteria create page

`criteria/new` ve `criteria/[id]/edit` sayfaları eklendi (TR `kriterler/yeni`). Dialog kaldırıldı. Kriter mutasyonları Project Home ilerlemesini de yeniliyor (eski hata düzeltildi).

## Member invitation page

`team-invitations/new` sayfası eklendi (TR `ekip-davetleri/yeni`). `?team=` ile ekip kilitleniyor ve başarıda ekip detayına dönülüyor. Aday arama, "Ekibe ekle", e-posta daveti ve rol/mesaj alanları korundu. Yetki sunucuda.

## Sprint create page

`sprints/new` ve `sprints/[id]/edit` sayfaları eklendi (TR `sprintler/yeni`). Ortak DatePicker kullanılıyor, bitiş tarihi başlangıçtan önce olamıyor, dialog kaldırıldı.

## Commit history pagination

Backend `X-Has-Next-Page` başlığını GitHub `Link rel="next"` bilgisinden türetiyor (sayfa 10'da her zaman `false`; CORS'ta açığa çıkarıldı). Arayüzde Önceki · numaralar · Sonraki kontrolü var; sayfa `?cpage=` ile tutuluyor ve yüklenirken iskelet gösteriliyor.

## Organization card alignment

`OrganizationCard` ortak `EntityCard` kabuğunu kullanıyor. 320–1440 genişlikte boyutlar proje kartıyla ±1px.

## Teams grid/table

Kart, Tablo ve Şema aynı sorgudan besleniyor. Görünüm değiştirirken ek istek yok ve sayfa korunuyor; tercih kullanıcıya özel saklanıyor.

## Project Invitations redesign

`xl` ve üstünde semantik tablo, altında kartlar var. Filtre ve sayfa URL'de; kabul, red, önizleme, sayaç ve aktör izolasyonu korunuyor.

## Project invitation banner preview

`GET /api/v1/project-invitations/{id}/banner` eklendi: yalnız davet edilen kişi, kendi bekleyen daveti için erişebiliyor. Preview `bannerVersion` taşıyor. Görsel yoksa ya da yüklenemezse yedek yüzey gösteriliyor.

## Team invitation response badge

Mevcut `PROJECT_INVITATION_ACCEPTED/REJECTED` bildirimleri ve unread-count'a eklenen `projectId` + `type` filtresi kullanılıyor. "+N" rozeti bekleyen davet sayısından ayrı. Okundu yalnız bildirim merkezinden ya da şeritteki açık eylemle işaretleniyor. Rozeti yalnız daveti gönderen yönetici görüyor.

## Notification History deletion

`DELETE /notifications/{id}` ve `DELETE /notifications?read=true` yalnız kendi okunmuş kayıtları fiziksel olarak siliyor. Okunmamışlar korunuyor, IDOR kapalı. Arayüzde satır içi iki adımlı onay ve "Tümünü sil" onay penceresi var.

## Task comment keyboard behavior

Masaüstünde Enter gönderiyor, Ctrl/Cmd+Enter imlece yeni satır ekliyor, Shift+Enter yeni satır olarak kalıyor. IME ve @mention güvenli; dokunmatikte Enter yeni satır ekliyor. Çift gönderim engellendi.

## Shared DatePicker / TimePicker

`DatePicker` artık `min`/`max` alıyor; yeni `TimePicker` 24 saatlik ve listbox tabanlı. Hatırlatıcı, görev deadline saati, çalışma kaydı ve sprint alanları bunlara taşındı. Native date/time girdisi kalmadı. Backend tarih/saat ve saat dilimi sözleşmeleri değişmedi.

## Cache / navigation / account isolation

Hard reload kullanılmadı ve global `queryClient.clear()` yapılmadı. Yeni sorgu anahtarları aktör ailesi altında; çıkış temizliği bunları kapsıyor. Hesap ve proje değişiminde rozet, görünüm tercihi ve davet verisi sızmadığı E2E ile doğrulandı.

## Responsive / accessibility / i18n

Tüm yeni metinler TR/EN/DE (DE resmi "Sie"). Yeni ekranlar 320/390/768/1024/1440 genişlikte, açık ve koyu temada doğrulandı. 44px hedefler, `aria-*` ilişkileri ve odak yönetimi uygulandı.

## Backend / database changes

- Migration ve ENV değişikliği yok.
- Yeni uçlar:
  - davet banner GET
  - bildirim DELETE ×2
- Genişleyen uçlar:
  - commits (`X-Has-Next-Page`)
  - davet preview (`bannerVersion`)
  - bildirim liste ve unread-count (`projectId` + `type` filtresi)
- `SecurityBaselineConfiguration` değişiklikleri (hepsi kullanıcı onaylı):
  - 1 GET matcher (davet banner'ı)
  - 1 DELETE matcher satırı (bildirimler)
  - 1 CORS expose header (`X-Has-Next-Page`)
- Ayrıntılar `.agents/SECURITY.md`'de.

## Changed files

Faz kayıtlarında ve plan dosyasında listelendi. Faz 6'da yapılan değişiklik:

- `frontend/e2e/ui-ux-app.spec.ts` (entegrasyon çakışması uyarlaması)
- bu doküman
- plan güncellemesi

## Test results

| Doğrulama (birleşik `origin/main` `85f784d`) | Sonuç |
| --- | --- |
| Backend `mvnw clean verify` | 664 / 0 failure / 0 error / 0 skip |
| ESLint, `tsc --noEmit`, `next build` | Temiz |
| Tam Chromium (`playwright.config.ts`) | 811 geçti, 1 skip, 2 başarısız: `team-member-preview` (aralıklı); `ui-ux-app` kriter testi (düzeltildi → dosya 23/23) |
| Public paket (`playwright.public.config.ts`) | 277 geçti, 1 skip, 1 aralıklı (`a11y-public` forgot-password dark mobile → `--repeat-each=3` 36/36) |
| Docker build/start/health | Geçti |

## Remaining issues

- ~~`ui-ux-app.spec.ts` uyarlaması commit edilmedi.~~ **Kapandı:** uyarlama, bu doküman ve plan PR #133 ile main'e girdi (`1ba8509`).
- **`team-member-preview` aralıklı 401:** `team-deletion-notifications` kayıtlı oturumu iki tarayıcı bağlamında paylaşıyor. Uzun koşularda refresh-token yeniden kullanımı oturumu iptal ediyor. Test altyapısı düzeltmesi önerilir.
- **`next start` aralıklı `ERR_CONNECTION_REFUSED`:** Pre-push'un frontend sunucusu kaynaklı; birkaç koşuda tek test etkilendi.
- **Pre-push ortam tuzağı:** Son adım backend'i `docker-compose.e2e.yml` olmadan yeniden başlatıyor. Sonraki E2E öncesi override ile başlatılması gerekiyor.
- ~~Yerel `main` eski ve ilişkisiz.~~ **Kapandı:** eski hâl `main-old-backup` olarak yedeklendi, yerel `main` `origin/main`'e eşitlendi.
- ~~Davet 409 genel metin.~~ **Kapandı (kullanıcı kararı):** `project-service-backend` takibinde özel `INVITATION_ALREADY_PENDING`, `INVITATION_TARGET_ALREADY_MEMBER` ve `INVITATION_NOT_PENDING` kodları ile TR/EN/DE mesajlar eklendi. Ayrıntı [2026-10-10-invitation-conflict-codes.md](2026-10-10-invitation-conflict-codes.md).

## Pending product decisions

- E-posta doğrulama ve davetin e-posta ile eşleştirilmesi (önceki oturumlardan açık).
- BASIC depo modunda commit özetine sayfalama: kullanıcı "şimdilik kalsın, sonra hatırlat" dedi (2026-10-10).
- **Karara bağlandı (2026-10-10):** "+N" yanıt rozeti yalnız daveti gönderen yöneticide kalır.
