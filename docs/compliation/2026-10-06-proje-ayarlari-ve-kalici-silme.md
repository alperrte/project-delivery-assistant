# Proje ayarları yenilemesi ve kalıcı proje silme

## Teslim ve durum

2026-10-07. **Yedi madde de tamamlandı.** Backend ve frontend aynı çalışma ağacında yazıldı; dosyalar branch'lere kullanıcı tarafından ayrılacak. Commit, push, staging, merge yapılmadı.

Doğrulama özeti: backend tam paket **509 test, 0 hata**; Chromium ilgili spec listesi **yeşil** (son tam koşu 60 geçti + 2 düşen test düzeltildi, ardından 27 ve 24 testlik yeniden koşular geçti); `tsc --noEmit` ve `eslint` temiz. Docker backend yeniden derlendi, V58 canlı geliştirme veritabanına uygulandı.

## Yapılanlar

1. **Projeyi sil.** "Projeyi arşivle" yerine GitHub tarzı, proje adının birebir yazılmasını isteyen "Projeyi sil" onayı. Silme **kalıcıdır**; yalnız projenin kurucusu (`createdBy`, hâlâ aktif Proje Yöneticisi) silebilir. Kurucu olmayan yöneticiye düğme gösterilmez, sunucu `403` döner. Kimseye bildirim gitmez; silinen projenin bildirimleri temizlenir.
2. **Teknoloji mini popup'ı.** Ayarlarda logo + ad chip'leri ve "Teknolojileri düzenle" ile açılan `ProjectTechDialog`; içinde oluşturma ekranındaki `TechPicker`, mevcut seçim işaretli gelir, "Uygula" forma yazar, kalıcı kayıt kaydet çubuğuyla olur.
3. **Canlı önizleme sağda açık.** 7/5 ızgara; gerçek `ProjectCard` `preview` kipinde, `lg` üstünde sticky. `lg` altında formun altına iner, kaydet çubuğunda "Önizleme" bağlantısı vardır. Oluşturma sayfasıyla ortak `ProjectPreviewPanel`.
4. **Proje hedefi** formdan kalktı; kayıtlı değer güncellemede aynen geri gönderilir, genel bakış "Proje profili" `açıklama || hedef || boş metin` gösterir.
5. **Kapak görseli önizlemesi** ayarlarda (yoksa noktalı yedek yüzey).
6. **Tarihler** task-service `DatePicker` ile; başlangıç değişince bitiş sırası yeniden doğrulanır.
7. **Kart teknoloji şeridi:** tek satır, yalnız logo (`size-8` kare), kanonik ada göre tekilleştirilmiş, en çok 6 + `+N`.

Doğrulama sırasında bulunup düzeltilen iki sorun:

- Önizleme paneli 320 px'te yatay taşma yapıyordu (uzun proje adı, aside'ın min-content'i ızgara sütununu genişletiyordu) → `min-w-0`.
- `lg:items-start` aside'ı içeriği kadar kısa tutuyor, sticky önizleme kaydırınca kayboluyordu → kaldırıldı; `project-settings.spec.ts` içine "önizleme kaydırırken görünür kalır" testi eklendi.

## Önemli dosyalar

**Backend:** `V58__project_delete_cascade.sql`, `project/ProjectDeletedEvent.java`, `notification/application/ProjectDeletionCleanup.java`, `NotificationRepository`, `ProjectService.delete`, `ProjectController`, `SecurityBaselineConfiguration`, `ProjectDeleteCascadeMigrationTest`, `ProjectApiIntegrationTest`.

**Frontend:** `features/projects/components/` altında `project-settings-form.tsx`, `project-preview-panel.tsx` (yeni), `project-tech-dialog.tsx` (yeni), `project-create-page.tsx`, `project-card.tsx`, `project-overview.tsx`, `banner-field.tsx`; `features/projects/api.ts`, `schemas.ts`; `components/common/confirm-dialog.tsx` (`requireText`); `i18n/messages/{tr,en,de}.json`; e2e: `project-settings.spec.ts` (yeni), `helpers.ts`, `01-project-lifecycle`, `11-project-banner`, `organization-project-association`, `task-date-picker`.

**Belgeler:** `.agents/SECURITY.md`, `.agents/api.md`, `.agents/database.md`, `.agents/frontend-design-rules.md`.

## Doğrulama

- Backend: `ProjectDeleteCascadeMigrationTest` (V57'ye göç, bir projeyi tüm alt tablolarla doldur, ikinci projeyi yanına koy, V58'e göç et, sil; yalnız ilk projenin satırları gider), `ProjectApiIntegrationTest` ekleri (kurucu 204; eş yönetici/üye/CSRF'siz 403; oturumsuz 401; bilinmeyen/arşivli 404; bildirim temizliği; aynı adla yeniden oluşturma), `ModularityTest` yeşil. Tam paket 509 test, 0 hata.
- Chromium (ilgili liste): `project-settings` (10), `01-project-lifecycle`, `11-project-banner`, `organization-project-association`, `project-create-page`, `project-logo-settings`, `task-date-picker`, `21-task-models`, `05-settings-page`. Tam koşuda 60 geçti; düşen iki test (`organization-project-association` warm ve 320 px) düzeltildikten sonra yeniden koşuda geçti.
- Elle bakış: ayarlar 1440 px (sticky önizleme), 390 px (tek sütun, önizleme altta), 320 px üç dilde açık/koyu taşma yok; proje listesinde 9 teknolojili kart tek satır + `+3`.

## API

`DELETE /api/v1/projects/{projectId}` → `204`. `401` oturumsuz, `403` CSRF eksik / üye değil / yönetici değil / kurucu değil, `404` bilinmeyen veya arşivli. Çerez oturumu + CSRF. `POST /projects/{id}/archive` backend'de durur, arayüz kullanmaz. `PUT /projects/{id}` tam güncellemedir; arayüz `projectGoal`'ı düzenlemez ama aynen geri gönderir.

Swagger: `/swagger-ui/index.html` (`API_DOCS_ENABLED=true`).

## Açık konular

- **V58 geri alınamaz veri silme getirir.** Şemada artık bir `projects` satırını silen her şey alt verileri de siler; tek çağıran `ProjectService.delete` (kurucu). Karar `.agents/database.md`'de kayıtlı.
- **Önceden var olan dev hatası (bu işten kaynaklanmıyor, düzeltilmedi):** `components/layout/workspace-history.ts` `window.navigation` `currententrychange` dinliyor; Next'in ilk soft navigasyonunda `useInsertionEffect must not schedule updates.` hatası çıkıyor ve Next dev rozeti sağ alttaki düğmelerin üstüne biniyor. Bu yüzden `organization-project-association` warm testinde "Projeyi oluştur" düğmesi klavyeyle (focus + Enter) tetikleniyor. Üretim derlemesini etkilemez.
- E2E oturumları kısa sürede doluyor; kayıt ucu hız sınırı (429, 600 sn) nedeniyle tekrar koşularda `E2E_REUSE_USERS=1` kullanıldı. Sınır gevşetilmedi.
- Silinen projede başka bir üyenin eşzamanlı yazma isteği 404/409 alabilir (kabul edilen yarış).
- context7 MCP yetkilendirilmediği için kullanılamadı.

## Kullanıcı kontrolü

1. Kurucu hesapla bir deneme projesi aç → Ayarlar → "Projeyi sil": ad yazılana kadar düğme pasif; silince `/projeler`'e döner, proje ve bildirimleri gider.
2. İkinci bir Proje Yöneticisi ile aynı ayarlara gir: "Tehlikeli bölge" görünmez.
3. Ayarlarda tarih seçici, teknoloji popup'ı, kapak önizlemesi, sağda sabit önizleme ve 320/390 px görünümü kontrol edilir.

Commit mesajı:

```text
Backend: feat(project): permanent project deletion with founder-only DELETE endpoint and V58 cascade

Frontend: feat(project): settings live preview, tech dialog, date picker and type-the-name project deletion
```
