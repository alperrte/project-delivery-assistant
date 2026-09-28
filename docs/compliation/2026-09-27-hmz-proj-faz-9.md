# HMZ-PROJ FAZ 9 — Frontend Settings / Criteria / Repository / Project Home

**Tamamlanma tarihi:** 2026-09-27
**Durum:** HMZ-PROJ-42–46 kapsamı tamamlandı. `.agents/FRONTEND_WORKFLOW.md`'nin 7 fazlı süreci (Understand → Design Direction → Implementation → Browser Validation → UI Audit → Impeccable Final Pass) uçtan uca uygulandı.

## Kapsam ve önemli dosyalar

**HMZ-PROJ-42 — Project Settings UI:** [project-settings-form.tsx](../../frontend/src/features/projects/components/project-settings-form.tsx) — ad/açıklama/durum/öncelik/tarihler/organizasyon/hedef/tech-stack düzenleme, `isDirty` olana kadar kaydet butonu kapalı, arşivleme (confirm dialog).

**HMZ-PROJ-43 — Project Criteria UI:** [features/criteria/](../../frontend/src/features/criteria/) — kriter listesi, ilerleme çubuğu, checkbox ile tamamlama, yukarı/aşağı sıralama, create/edit/delete dialog'ları.

**HMZ-PROJ-44 — Repository Settings UI:** [repository-settings.tsx](../../frontend/src/features/repository/components/repository-settings.tsx) — genel GitHub deposu bağlama/bağlantı kesme, bağlı-değil/bağlı durumları.

**HMZ-PROJ-45 — Project Home UI:** [project-overview.tsx](../../frontend/src/features/projects/components/project-overview.tsx) — hero tarzı özet: organizasyon → proje adı + durum/öncelik rozetleri → hedef → sessiz istatistik satırı (üye sayısı/yöneticiler/bitiş tarihi) → kriter ilerlemesi + depo özeti.

**HMZ-PROJ-46 — Latest Commits Widget:** [commits-widget.tsx](../../frontend/src/features/repository/components/commits-widget.tsx) — son 10 commit, kısa SHA linki, native `Intl.RelativeTimeFormat` ile göreli zaman, yenile butonu, 429 (rate-limit) ile genel hatayı ayırt etme.

**Diğer değişen dosyalar:** [project-detail.tsx](../../frontend/src/features/projects/components/project-detail.tsx) (4 sekmeden 7 sekmeye çıkarıldı), [use-current-member.ts](../../frontend/src/features/projects/hooks/use-current-member.ts), [tabs.tsx](../../frontend/src/components/ui/tabs.tsx), `schemas.ts`, i18n dosyaları (`en.json`/`tr.json`/`de.json`), yeni shadcn primitive'leri (`checkbox.tsx`, `progress.tsx`).

## Test sırasında bulunup düzeltilen hatalar

Playwright ile canlı tarayıcı testinde bulunan gerçek regresyonlar/hatalar (planlı geliştirme değil):

1. **`useCurrentMember` boş `projectId` hatası** — proje sorgusu çözülmeden hook `projectId=""` ile çağrılıyordu, çift-slash'lı hatalı istek atıyordu (`GET /projects//members/{userId}`). `enabled: !!user && !!projectId` eklendi.
2. **Select dropdown'ları ham enum gösteriyordu** — Ayarlar formundaki Durum/Öncelik `SelectValue`'ları seçili değeri "PLANNING"/"MEDIUM" olarak gösteriyordu, çevrilmiş metin değil (Base UI'ın `SelectValue` varsayılan davranışı). Her ikisine de `children` render fonksiyonu eklenerek çözüldü.
3. **Checkbox hit-target'ı çok küçüktü** — kriter başlığına tıklamak checkbox'ı işaretlemiyordu. Checkbox + başlık tek bir `<label>` içine alındı.
4. **Mobilde 7 sekmeli `TabsList` sayfayı yatay taşırıyordu** — `overflow-x-auto max-w-full` eklenerek kendi içinde kaydırılır hale getirildi (paylaşılan `ui/tabs.tsx` primitive'i, uygulama genelinde etkili).
5. **Hedef bitiş tarihi ham ISO string olarak gösteriliyordu** — `Intl.DateTimeFormat` ile yerelleştirildi.
6. **Repository URL input'unda `type`/`autocomplete` eksikti** — `type="url" autoComplete="off"` eklendi.

## Impeccable critique/audit bulguları (kullanıcı onayıyla uygulanan kısım)

`/impeccable critique` (31/40, "Good") ve `/impeccable audit` (18/20, "Excellent") çalıştırıldı; dedektör her iki geçişte de 7 dosyada 0 bulgu verdi. Kullanıcıyla onaylanan kapsamda şu 2 P2 bulgusu düzeltildi:

- **Boşluk hissi:** az veriyle (1 üye, 1 kriter gibi) Overview/Criteria sekmeleri ekranın %70-85'ini boş bırakıyordu → `max-w-3xl` + üst çizgi ile içerik bloğuna görünür bir sınır eklendi.
- **Başlık seviyesi tutarsızlığı:** Overview'da `<h1>` yoktu (proje adı `<h2>`'ydi), diğer sekmelerde `PageHeader` `<h1>` render ediyordu → Overview'da proje adı `<h1>`, alt başlıklar `<h2>` yapıldı.

**Kullanıcı kararıyla bu fazda ele alınmayanlar** (kapsam dışı bırakıldı, ileride ayrı ele alınabilir):
- 7 sekmeli üst menünün yoğunluğu (Üyeler/Davetler/Ekipler'i "Takım" altında gruplama fikri) — not olarak bırakıldı.
- İkon buton dokunma hedefi 28px (paylaşılan `icon-sm` tasarım tokenı, tüm uygulamayı etkiler, Faz 9'a özgü değil).
- Global `prefers-reduced-motion` kuralının biraz agresif olması (Faz 8'den gelen, tüm uygulamayı etkileyen genel CSS).
- Dekoratif ikonlarda `aria-hidden` eksikliği, kriter listesinde toplu işlem/klavye kısayolu olmaması.

Not: Critique için gereken çift-ajan (dual sub-agent) izolasyonu bir API oturum kotası nedeniyle başarısız oldu; süreç, aynı bulguları doğrudan (tek bağlamda, açıkça belirtilerek) toplayacak şekilde tamamlandı — kritik bir eksiklik yaratmadı, sadece yöntem notu.

## Sertleştirme (hardening) testi

Canlı tarayıcıda: çok uzun kriter başlığı + emoji (satır kaydırma/checkbox hizalaması bozulmadı), Almanca dil değişimi (form etiketleri/buton metinleri taşmadı, Select çevirileri doğru çalıştı), silme onay akışı (confirm dialog → başarı toast'ı) test edildi. Hepsi sorunsuz.

## Doğrulama

| Komut / kontrol | Sonuç |
| --- | --- |
| `npx tsc --noEmit` | Hatasız |
| `npm run lint` | Hatasız |
| `npm run build` | Başarılı; 9 route (dinamik) derlendi |
| `impeccable detect --json` (7 dosya) | `[]` — 0 bulgu, exit 0 (hem başta hem düzeltmelerden sonra) |
| `backend\mvnw.cmd clean verify` | 204 test, 0 hata, `BUILD SUCCESS` |
| `pre-push\pre-push.cmd` | `PDA PRE-PUSH CHECK PASSED` (Docker stack build + backend/frontend health check dahil) |
| Playwright ile canlı test | Overview/Kriterler/Depo/Ayarlar/Üyeler/Ekipler sekmeleri, oluşturma/düzenleme/silme/tamamlama akışları, karanlık mod, mobil genişlik (390px), Almanca/Türkçe dil değişimi |

## Açık konular

- Yukarıdaki "kullanıcı kararıyla ele alınmayanlar" listesi (7 sekmeli IA, ikon dokunma hedefi, global reduced-motion, aria-hidden, toplu işlem) — hepsi bilinçli olarak bu fazın kapsamı dışında bırakıldı.
- `.impeccable/critique/` klasöründe bu fazın critique kaydı duruyor (üstteki 7-sekme bulgusu hâlâ "açık" olduğu için kapatılmadı) — `.gitignore`'a eklenip eklenmeyeceği size kalmış.
- Kök dizindeki `.playwright-mcp/` klasörü bu oturumun tarayıcı test ekran görüntülerini/loglarını içeriyor — commit'e dahil etmek istemezseniz `.gitignore`'a ekleyin.
- Transient bir `401` (`GET /api/v1/auth/me`) test sırasında bir kez konsola düştü; sayfa doğru render oldu ve oturum bozulmadı — auth-service'teki (Alper'in kapsamı) olası bir yarış durumu, Faz 9 koduna atfetmiyorum.

## Kullanıcı kontrolü

1. `pre-push\pre-push.cmd` çalıştırıp `PDA PRE-PUSH CHECK PASSED` görün (zaten yapıldı, tekrar çalıştırıp teyit edebilirsiniz).
2. Bir projenin detay sayfasına gidin, 7 sekmeyi (Genel Bakış/Kriterler/Üyeler/Davetler/Ekipler/Depo/Ayarlar) tek tek gezin.
3. Kriterler sekmesinde yeni kriter oluşturun, başlığa tıklayarak tamamlandı işaretleyin (checkbox'a değil), sıralamasını değiştirin, düzenleyin, silin.
4. Depo sekmesinde genel bir GitHub deposu bağlayın (örn. `https://github.com/octocat/Hello-World`), son commit'lerin göründüğünü, yenile butonunun çalıştığını, bağlantıyı kesmenin çalıştığını doğrulayın.
5. Ayarlar sekmesinde (yalnız yönetici görür) durum/öncelik/tarih değiştirip kaydedin, Genel Bakış'ta yansıdığını görün; arşivleme akışını deneyin (dikkat: geri alınamaz).
6. Dil menüsünden Almanca'ya geçip Ayarlar/Kriterler formlarında metin taşması olmadığını, tarayıcı genişliğini daraltıp (mobil) sekme çubuğunun yatay kaydığını ama sayfayı taşırmadığını doğrulayın.
