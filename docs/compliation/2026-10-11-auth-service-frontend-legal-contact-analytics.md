# auth-service-frontend: yasal sayfalar, iletişim formu, analitik istemcisi (2026-10-11)

Plan: `PDA_HAMZA_CHECKLIST_LEGAL_CONTACT_ADMIN_PLAN.md` Task 6, 7 ve 9 (Task 8 admin arayüzleri ayrı kayıtta). Backend değişmedi (Phase 1, main `7a9b66a`).

## Teslim ve durum

Kullanıcı kararı (2026-10-11): yasal metinler taslak değil **son metin**tir. KVKK Aydınlatma Metni, Gizlilik Politikası, Çerez Politikası ve yeni Kullanım Koşulları için "Yayın öncesi inceleme" notu ve `noindex` kaldırıldı; dört sayfa ve Erişilebilirlik Bildirimi sitemap'te hreflang alternatifleriyle listelenir, robots'ta engellenmez, `llms.txt`'te yer alır. TR/EN/DE metinlerinde "teyit edilmemiştir / HUKUKİ İÇERİK GEREKLİ / taslak" ifadesi yoktur (test tarar). Henüz karar verilmemiş üç konu kesin bir durum cümlesiyle yazıldı: barındırma sağlayıcısı belirlenmedi, VERBİS değerlendirmesi sürüyor (kayıt numarası yok), AB temsilcisi (GDPR Art. 27) değerlendiriliyor.

## Yapılanlar

- **6.1 KVKK Aydınlatma Metni** (`/kvkk`): veri sorumluları Hamza Taşbay ve Alper Temiz (gerçek kişi; MERSİS/KEP yok), veri kategorileri ve elde etme yöntemi, amaç–hukuki sebep tablosu (m.5/2 c, f, ç, e; analitik m.5/1 açık rıza), alıcılar ve m.9 yurt dışı aktarım (Gmail SMTP, Google/GitHub girişi, GitHub API; barındırma TBD), saklama tablosu, m.11 hakları, başvuru yolu (form kategorisi "KVKK / veri talebi" veya `pdassistant.info@gmail.com`, en geç 30 gün, Kurul şikâyeti), veri güvenliği/ihlal bildirimi, VERBİS değerlendirmesi. Etiket üç dilde: "KVKK Aydınlatma Metni" / "KVKK Privacy Notice" / "KVKK-Datenschutzhinweis".
- **6.2 Gizlilik Politikası**: güncel kategoriler (ad/soyad, kullanıcı adı, e-posta, profil fotoğrafı, 2FA, proje/görev/sohbet/bildirim/organizasyon/takvim/hatırlatıcı, destek mesajları, onaylı analitik), hesap silme ve anonimleştirme akışı ("otomatik hesap silme yok" metni kaldırıldı), saklama tablosu, güvenlik, çocuklar (16 yaş), güncellemeler.
- **6.3 Çerez Politikası**: tablo halinde tam envanter; eksik 8 kayıt eklendi (`PDA_MFA`, `PDA_ADMIN_MFA`, `PDA_ADMIN_ENROLL`, `PDA_RESET`, `PDA_PWCHANGE`, `pda:renderer`, `pda.pendingVerification`, `pda:teams-view:v1:<kullanıcı kimliği>`), analitik saklama 12 ay, tercih kayıtlarının işlevsel kategori gerekçesi, geri çekmenin etkisi, CTA/hata olayları.
- **6.4 GDPR**: EN/DE Gizlilik Politikası'nda altı bölüm (Art. 13 sorumlu/iletişim, Art. 6 dayanaklar, Chapter V aktarım, saklama, haklar + taşınabilirlik + itiraz + şikâyet, Art. 27 değerlendirmesi); TR'de kısa not. DE çerez metni § 25 TDDDG (eski TTDSG); EN çerez metni aynı dayanakları adlandırır.
- **6.5 Kullanım Koşulları** (`/terms`; TR `kullanim-kosullari`, DE `nutzungsbedingungen`): `PAGE_ROUTES`/`SEGMENTS`, `INFO_LINKS`, sitemap, `llms.txt`, metadata/breadcrumb/JSON-LD. 11 bölüm.
- **6.6 Erişilebilirlik Bildirimi**: WCAG 2.2 AA hedefi, 10 Ekim 2026 değerlendirmesi, resmî denetim yok/tam uygunluk beyan edilmiyor, yöntem (`a11y-public.spec.ts` axe taraması + klavye/odak testleri; dosya mevcut), bilinen sınırlamalar, bildirim yolu (form kategorisi "Erişilebilirlik" veya e-posta; 30 gün).
- **6.7 SSS**: kayıt (altı haneli kod), şifre sıfırlama (kod), "hesabımı nasıl silerim / verilerime nasıl erişirim" güncellendi (23 soru korundu).
- **6.8 Altbilgi + hesap menüsü**: "Kullanım Koşulları" ve "KVKK Aydınlatma Metni" etiketi; altbilgide iletişim bağlantısının yanında görünür `mailto:` adresi; iletişim sayfası ve bilgi sayfası iletişim bloğunda da. `frontend-design-rules.md` "e-posta gösterilmez" kuralı güncellendi.
- **6.9 Kayıt bildirimi** (`registration-notice.tsx`): kayıt formu, OAuth düğmeleri altı ve davetli kayıt formu. Onay kutusu yok; Kullanım Koşulları + KVKK + Gizlilik bağlantıları yeni sekmede, metin "açık rıza talebi değildir" der.
- **6.10** `CONTACT_EMAIL` tek adres: JSON-LD (`ContactPoint`) ve `llms.txt` zaten sabiti kullanıyor, doğrulandı.
- **Task 7 İletişim formu**: kategori seçimi (Genel varsayılan; Hata bildirimi; KVKK veya veri talebi; Erişilebilirlik), isteğe bağlı soyad, honeypot `website`, `startedAt`, form altı bildirim. Tarayıcı, sunucunun 3 sn altı kuralı nedeniyle kalan süreyi bekleyip gönderir; bayat `startedAt` yazılan metni korur. Yeni backend hata kodu yok.
- **Task 9 Analitik istemcisi**: `CTA_CLICK` (7 sabit id), `CLIENT_ERROR` (render, chunk_load, unhandled_rejection, network), 12 aylık ziyaretçi kimliği yenileme, çerez/gizlilik metinleri, onay diyaloğundaki analitik açıklaması.
- "Son güncelleme" tarihi sayfa başına (`PAGE_UPDATED`): değişen bilgi sayfaları 2026-10-10.

## CTA yerleri

`header_login`/`header_register`: landing üst bölümü ve herkese açık sayfaların üst bölümü. `landing_register`/`landing_login`: landing son bölümü. `register_submit`: kayıt formu ve davetli kayıt formu başarılı gönderimi. `contact_submit`: iletişim formu başarılı gönderimi (sunucu onayından sonra). `github_repo`: altbilgi "Kaynak kod" ve landing açık kaynak bölümü bağlantısı.

## Hata raporlama tasarımı

Yalnız tür + rota şablonu gider. Kaynaklar: `app/error.tsx`, `(app)/error.tsx`, `global-error.tsx` (render/chunk_load), izleyicinin yalnız onay varken kurduğu `unhandledrejection`, `/_next/static/` dosyası yükleme hatası ve `pda:network-failure` (fetch ağ hatası; analitik uç noktasının kendisi hariç) dinleyicileri; `AbortError` sayılmaz. Oturum+rota+tür başına bir kez, toplam 20. Sıralı kuyruk; sunucunun bildiği PAGE_VIEW yoksa taşıyıcı önce bulunulan sayfanın PAGE_VIEW'ünü gönderir (tekrar sayılmaz).

## Çerez envanteri farkı

Eklendi: `PDA_MFA` (5 dk), `PDA_ADMIN_MFA` (5 dk), `PDA_ADMIN_ENROLL` (10 dk), `PDA_RESET` (10 dk), `PDA_PWCHANGE` (10 dk), sessionStorage `pda:renderer` ve `pda.pendingVerification`, localStorage `pda:teams-view:v1:<kullanıcı kimliği>` (`pda.teams.view` yerine; eski anahtar okunup silinir). Değişti: `pda:analytics-visitor` artık `{id, createdAt}`. Kod taramasında başka depolama yazımı bulunmadı (`theme` next-themes, `JSESSIONID` yalnız OAuth akışı, ikisi de listeli); `pda:*` DOM olay adları ve Web Lock adı depolama değildir.

## Doğrulama

- `npm run lint`: 0 hata (2 eski uyarı, bu işle ilgisiz). `npx tsc --noEmit`: temiz.
- Hedefli Playwright (gerçek backend, `E2E_REUSE_AUTH=1`, `--output=test-results-p2l`): footer-public-pages, contact-form, contact-delivery, cookie-consent, analytics-collection, privacy-regression, localized-routing, a11y-public (156 axe testi; yeni `/terms`, `/cookies`, `/contact` dahil), 04-external-invitation-registration, nickname-contract ve yeni analytics-events, legal-pages: ilk koşuda 271 geçti, 5 kalan test düzeltilip (eski alıcı adresi, kaldırılan `noindex` beklentisi, kararsız bir `request` dinleyicisi) yeniden koşuldu: geçti.
- Public paket (`playwright.public.config.ts`, `legal-pages.spec.ts` eklendi): 341 geçti, 2 başarısız (iletişim çift tıklama testi 3 sn bekleme nedeniyle zaman aşımı; hover testi yeni bağlantılarda hover görünümü eksikti). Test zaman aşımı ve bağlantılara `hover:` stili eklenerek düzeltildi; ilgili testler yeniden koşuldu: 7 geçti.
- Son küçük stil düzeltmesinden sonra contact-form, legal-pages, nickname-contract: geçti. `04-external-invitation-registration` son yeniden koşuda paylaşılan MANAGER fixture oturumu sona erdiği (diğer ajanın admin testleri oturumları iptal etmiş olabilir) için giriş ekranında kaldı; ilk koşuda geçmişti (bildirim satırı iddiaları dahil). Fixture yeniden yazılmadığı için tekrar koşulmadı; `E2E_REUSE_AUTH` olmadan çalıştırılmalı.
- Ekran görüntüleri (1440 açık, 390 koyu): terms, KVKK tablosu, altbilgi, iletişim, kayıt (`legal-*.png`, scratchpad).

## Açık konular

- Hukuki danışman incelemesi yapılmadı; metinler proje sahiplerinin kararıyla yayında. Emin olunmayan ifadeler agent raporundaki listede.
- Barındırma sağlayıcısı, VERBİS sonucu ve Art. 27 temsilci kararı netleşince KVKK/Gizlilik metinleri güncellenmeli.
- `CONTACT_REQUIRE_STARTED_AT=true` artık açılabilir (frontend her gönderimde gönderiyor); sunucu `min-fill-time` yükseltilirse `contact-form.tsx` içindeki `MIN_FILL_MS` de yükseltilmeli.
- PDA gelen kutusundaki e-posta kopyaları otomatik silinmez (metinler bunu söyler); veri taşınabilirliği (dışa aktarma) hâlâ talep üzerine.
- Onay sürümü (`CONSENT_VERSION`) yükseltilmedi: CTA/hata olayları aynı "analitik" kategorisinde anlatıldı. Yayın öncesi geçmiş onaylar zaten yok; isterseniz 2'ye çıkarılıp herkese yeniden sorulabilir (e2e'de `consent_version` 1 beklentisi güncellenmeli).

## Kullanıcının kontrol edeceği adımlar

1. `/tr/kullanim-kosullari`, `/tr/kvkk`, `/tr/gizlilik`, `/tr/cerez-politikasi` metinlerini okuyun; özellikle çocuklar (16 yaş), VERBİS, m.9 aktarım ve işlevsel çerez gerekçesi ifadelerini onaylayın.
2. `/tr/iletisim`: kategori seçip gönderin; Mailpit'te konu `[kategori]` etiketli, admin Destek talepleri sekmesinde satır görünmeli. Gizli alanı doldurursanız başarı görünür ama e-posta/satır oluşmaz.
3. Çerez tercihini kabul edip landing'de "Kayıt ol"a tıklayın; admin Analitik sekmesinde CTA sayısı artmalı. `/dev/error-test` ile hata üretince "Hata" tablosunda bir `render` satırı görünmeli.
4. `/tr/kayit` altında bildirim satırının onay kutusu olmadığını ve bağlantıların yeni sekmede açıldığını görün.
