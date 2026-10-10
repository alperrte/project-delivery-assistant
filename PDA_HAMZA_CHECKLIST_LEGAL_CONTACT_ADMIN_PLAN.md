<!-- markdownlint-disable MD024 -->
# PDA — Master Checklist "HAMZA" Maddeleri (Yasal, İletişim, KVKK/Çerez/GDPR, Admin, Analitik) — Persistent Plan

Kaynak: `.agents/faz-md/Web_Sitesi_Master_Checklist.md` içindeki `### HAMZA` işaretli bölümler (satır 11–72 ve 293–312). Ayrıntılı kriterler: `.agents/web-rules/03_LEGAL_CORPORATE.md`, `.agents/web-rules/WEB_SITE_MASTER_CHECKLIST_TR.md` (admin/analitik için ayrıntılı kriter yok → bu planda tanımlanır).
Yürütme: implementation → targeted test → fix → re-test → DoD → `[x]`. Kodlama Sonnet 5.5 (high); inceleme/test/doküman Opus. Commit/push kullanıcıda; staging, branch geçişi ve `pull --ff-only` ajan tarafından. Test politikası: fazlarda hedefli kontroller, tam pre-push son fazda bir kez. Arka planda tam test koşarken çalışma ağacında branch değiştirilmez.

> Yasal metinler gerçek bilgilerle **inceleme taslağı** olarak yazılır; hukuki danışmanlık yerine geçmez. Sayfalardaki "Yayın öncesi inceleme" notu ve `noindex`, kullanıcı hukuki onay verene kadar kalır.

## Branch execution status

- [x] Phase 0 — Read-only audit (2026-10-10)
- [x] Phase 1 — `auth-service-backend`: iletişim/destek, saklama işleri, audit log, admin/analitik uçları
- [ ] Gate 1 — kullanıcı commit/push + merge
- [ ] Phase 2 — `auth-service-frontend`: yasal sayfalar + Kullanım Koşulları, footer, kayıt bildirimi, çerez envanteri, iletişim formu, admin/analitik arayüzleri
- [ ] Gate 2 — kullanıcı commit/push + merge
- [ ] Phase 3 — main üzerinde final doğrulama + completion + checklist `[x]` güncellemesi

Gerekçe: iletişim, analitik ve admin modülleri 2026-10-09'da auth branch'lerinde geliştirildi (`docs/compliation/2026-10-09-auth-branch-ayrimi.md`); backend uçları main'e girmeden frontend gerçek backend'le test edilemez.

## Kullanıcı kararları (2026-10-10)

- **Veri sorumlusu:** Hamza Taşbay ve Alper Temiz (gerçek kişiler, açık kaynak proje sahipleri); şirket/MERSİS/KEP yok. VERBİS için "gerçek kişi veri sorumlusu — kayıt yükümlülüğü değerlendirmesi" metni.
- **İletişim:** form + görünür adres `pdassistant.info@gmail.com` (footer, İletişim, KVKK başvuru bölümü); form varsayılan alıcısı da bu adres (`CONTACT_RECIPIENT` ile değiştirilebilir); JSON-LD/llms.txt aynı adres.
- **Admin kapsamı:** kullanıcı detayı + oturumlar + sistem durumu; kalıcı audit log + inceleme ekranı; destek talepleri + analitik raporları. **Rol değiştirme yok:** tek admin ENV hesabı; roller yalnız görüntülenir; checklist'te "tek admin politikası" olarak belgelenir.
- **Saklama süreleri:** analitik oturum/sayfa kayıtları 12 ay; analitik ziyaretçi kimliği 12 ayda yenilenir; iptal/süresi dolmuş oturumlar 30 gün; iletişim durum kayıtları 12 ay; destek mesajları 12 ay; audit log 24 ay; hesaplar silinene kadar, silinen hesap anında anonimleşir.

## Ajan kararları (gerekçeli)

- **Spam koruması:** CAPTCHA yok (üçüncü taraf ve veri aktarımı getirir); honeypot alanı + sunucu tarafı minimum doldurma süresi + mevcut rate limit/CSRF/duplicate guard.
- **İstemci hata raporlama:** yalnız analitik onayı varsa; yalnız rota şablonu + hata türü + zaman (mesaj/stack/kimlik yok). Backend 4xx/5xx sayaçları onaysız (kişisel veri yok).
- **CTA ölçümü:** analitik onayına bağlı yeni `CTA_CLICK` olay türü, sabit CTA-id listesi (landing kayıt/giriş, kayıt formu gönderimi, iletişim gönderimi).
- **Destek talepleri:** mesaj içeriği artık DB'de 12 ay saklanır (ad, e-posta, kategori, mesaj, durum: yeni/işlemde/kapandı); e-posta bildirimi devam eder; admin listesi + durum değiştirme; metinlere yansır.
- **Audit log:** `admin_audit_events` (aktör id, işlem, hedef id, zaman, sonuç; serbest metin/kişisel veri yok); yazılan olaylar: admin girişi (başarılı/başarısız), devre dışı/etkinleştir, oturum kapatma, destek talebi durum değişimi.
- **GDPR:** EN/DE sayfalarında Art. 13 uyumlu bölümler (sorumlu, amaç + Art. 6 dayanakları, alıcılar, Chapter V aktarım, saklama, haklar + taşınabilirlik, denetim makamına şikâyet); Art. 27 temsilci değerlendirmesi metni; DE çerez metni TTDSG §25'e göre.
- **Kullanım Koşulları:** yeni `/terms` sayfası (TR `kullanim-kosullari`, DE `nutzungsbedingungen`), footer + hesap menüsü linki.
- **Veri ihlali hazırlığı ve m.11 başvuru süreci:** `.agents/SECURITY.md`'ye operasyon prosedürü + public metinlerde başvuru kanalı (form "KVKK/veri talebi" kategorisi + görünür e-posta, 30 gün yanıt).
- **Veri taşınabilirliği (dışa aktarma):** bu kapsama alınmadı → FOLLOW-UP (GDPR Art. 20); metinde talep üzerine sağlanacağı yazılır.

---

## Phase 0 — Audit özeti

| Bölüm | Durum | Ana eksikler |
| --- | --- | --- |
| Footer yasal linkler | Kısmen | Kullanım Koşulları yok; görünür iletişim adresi yok; Erişilebilirlik bildirimi eksik (hedef, bilinen sınırlamalar, tarih, yanıt süresi) |
| İletişim/destek | Kod sağlam | Honeypot/zaman tuzağı yok; kategori yok; bildirim metni eksik; iki farklı adres |
| KVKK | Taslak | Sorumlu, saklama, aktarım, VERBİS, ihlal, m.11 kanalı yok; gizlilik metni + SSS güncel değil ("hesap silme yok"); kayıt formunda aydınlatma linki yok |
| Çerezler | Kod tam | Envanterde 8 eksik kayıt; saklama yer tutucuları |
| GDPR | Yok | EN/DE yalnız KVKK çevirisi |
| Admin | Kısmen | Detay/oturum/sistem arayüzü yok; audit log yok; destek kutusu yok; rol yönetimi (karar: yok) |
| Analitik | Toplama güçlü | Sayfa/giriş raporu, akış, CTA, hata oranı, saklama/purge, hukuki değerlendirme yok |

---

## Task 1 — İletişim ve destek talepleri (backend)

- [x] 1.1 Honeypot + minimum doldurma süresi (sunucu doğrular; botlara genel başarı yanıtı, kayıt yok).
- [x] 1.2 Kategori alanı (genel, hata bildirimi, KVKK/veri talebi, erişilebilirlik) — opsiyonel soyad.
- [x] 1.3 Destek mesajlarının DB'de saklanması (migration, durum alanı) + admin uçları: liste (filtre/sayfalama), detay, durum değiştirme (`USER_MANAGE`/yeni izin değil — mevcut `SYSTEM_VIEW`/`USER_MANAGE` ile).
- [x] 1.4 Alıcı varsayılanı `pdassistant.info@gmail.com`; `MAIL_PROVIDER` dokümanıyla adaptör uyumu (brevo notu düzeltilir).
- [x] 1.5 Testler (honeypot, süre, kategori, saklama, admin uçları yetki matrisi).

## Task 2 — Saklama ve imha işleri (backend)

- [x] 2.1 `@Scheduled` purge: analitik oturum/sayfa >12 ay, iptal/süresi dolmuş `user_sessions` >30 gün, `contact_requests`/destek mesajları >12 ay, audit >24 ay.
- [x] 2.2 Süreler `application.properties` + ENV ile yapılandırılabilir (varsayılanlar karar değerleri).
- [x] 2.3 Testler (sınır değerler, saat dilimi, idempotent).

## Task 3 — Kalıcı audit log (backend)

- [x] 3.1 `admin_audit_events` migration + yazıcı servis (modül sınırına uygun).
- [x] 3.2 Olaylar: admin girişi (başarılı/başarısız/kilitli), disable/enable, oturum kapatma (tek/hepsi), destek talebi durum değişimi.
- [x] 3.3 `GET /api/v1/admin/audit-events` (`AUDIT_VIEW`; filtre: işlem, tarih; sayfalama).
- [x] 3.4 Testler (yazım, yetki, PII yok).

## Task 4 — Admin sistem ve kullanıcı uçları (backend)

- [x] 4.1 Mevcut detay/oturum/overview/system-status/projects uçlarının sözleşmesini gözden geçir; eksik log satırları (enable, revoke) audit'e bağlanır.
- [x] 4.2 Sistem durumu: zamanlanmış işlerin son çalışma/sonuç bilgisi, mail etkin, aktif oturum sayısı, 24 saatlik 4xx/5xx sayaçları.
- [x] 4.3 Testler.

## Task 5 — Analitik raporlar ve olaylar (backend)

- [x] 5.1 Raporlar: en çok görüntülenen sayfalar, giriş sayfaları, çıkış sayfaları, basit akış (giriş → sonraki sayfa geçişleri), `/not-found` sayısı.
- [x] 5.2 `CTA_CLICK` olay türü (sabit CTA id allow-list) + kaynak/kampanya → kayıt dönüşümü (oturum bazlı).
- [x] 5.3 İstemci hata raporu ucu (rota şablonu + tür; onay gerekli; rate limit).
- [x] 5.4 Testler + `api.md`/`SECURITY.md`/`database.md`.

STOP → `BRANCH COMPLETE — auth-service-backend` (backend `clean verify` 892/0; V69 `support_requests`, V70 `admin_audit_events`, V71 analitik CTA/hata tabloları; not: `CONTACT_REQUIRE_STARTED_AT` frontend `startedAt` gönderince `true` yapılacak — Phase 2)

## Task 6 — Yasal içerik ve Kullanım Koşulları (frontend, TR/EN/DE)

- [ ] 6.1 KVKK Aydınlatma Metni: sorumlu (Hamza Taşbay, Alper Temiz), kanal, amaç-hukuki sebep eşleşmesi, alıcılar ve yurt dışı aktarım (Gmail SMTP, Google/GitHub OAuth, GitHub API, barındırma TBD), saklama tablosu, m.11 hakları + başvuru (form kategorisi + e-posta, 30 gün), VERBİS değerlendirmesi.
- [ ] 6.2 Gizlilik Politikası: güncel veri kategorileri (ad/soyad, profil fotoğrafı, 2FA, sohbet, bildirim, organizasyon, takvim, analitik onaylı), hesap silme/anonimleştirme akışı, saklama, güvenlik.
- [ ] 6.3 Çerez Politikası: eksik 8 kayıt + `pda:teams-view:v1:<id>`; saklama süreleri; tercih çerezlerinin kategorisi.
- [ ] 6.4 GDPR bölümleri (EN/DE): Art. 13, Art. 6, Chapter V, haklar, şikâyet hakkı, Art. 27 değerlendirmesi; DE TTDSG.
- [ ] 6.5 Kullanım Koşulları sayfası: kurallar, sorumluluklar, hesap askıya alma (DISABLED), kullanıcı içeriği, sorumluluk sınırı, açık kaynak lisansı ile ilişki, uygulanacak hukuk.
- [ ] 6.6 Erişilebilirlik bildirimi: WCAG 2.2 AA hedefi, bilinen sınırlamalar, değerlendirme tarihi/yöntemi, yanıt süresi, başvuru yolu.
- [ ] 6.7 SSS güncellemesi (hesap silme var; veri talebi kanalı).
- [ ] 6.8 Footer: Kullanım Koşulları linki, "KVKK Aydınlatma Metni" etiketi, görünür e-posta; hesap menüsü; sitemap/`isLegalPage`.
- [ ] 6.9 Kayıt formu (ve OAuth başlangıcı) aydınlatma linki (onay kutusu yok — aydınlatma/açık rıza ayrılığı).
- [ ] 6.10 `CONTACT_EMAIL` tek adres (JSON-LD, llms.txt).

## Task 7 — İletişim formu arayüzü (frontend)

- [ ] 7.1 Kategori alanı, opsiyonel soyad, honeypot + zaman damgası, bildirim metni (sorumlu, amaç, alıcı/sağlayıcı, saklama 12 ay, KVKK linki).
- [ ] 7.2 E2E (spam, kategori, başarı/hata).

## Task 8 — Admin arayüzleri (frontend)

- [ ] 8.1 Kullanıcı detayı (rozetler: rol + izinler salt okunur; bağlı sağlayıcılar; aktif oturumlar; tek/hepsini kapat — onaylı).
- [ ] 8.2 Sistem sekmesi (sağlık, mail, OAuth, zamanlanmış işler, sayaçlar, kullanıcı/proje sayıları, projeler listesi).
- [ ] 8.3 Audit log sekmesi (filtre, sayfalama).
- [ ] 8.4 Destek talepleri sekmesi (liste, detay, durum değiştirme — onaylı).
- [ ] 8.5 Analitik: en çok görüntülenen/giriş/çıkış sayfaları, akış, CTA ve dönüşüm, 404/hata sayıları.
- [ ] 8.6 Tek admin politikası notu (rol yönetimi yok).

## Task 9 — Analitik istemci (frontend)

- [ ] 9.1 CTA olayları (onaylı), istemci hata raporu (onaylı, PII yok), ziyaretçi kimliği 12 ayda yenileme.
- [ ] 9.2 E2E: onaysız hiçbir şey gitmez; onaylı CTA/hata olayları.

## Task 10 — Phase 2 regresyon + doküman

- [ ] 10.1 lint/tsc + hedefli Playwright (legal, footer, contact, consent, admin-*, analytics, privacy-regression, public paket).
- [ ] 10.2 Docs + completion kaydı.

STOP → `BRANCH COMPLETE — auth-service-frontend`

## Task 11 — Final doğrulama (main)

- [ ] 11.1 Tam `mvn clean verify`, lint/tsc/build, tam Chromium, canonical pre-push.
- [ ] 11.2 `Web_Sitesi_Master_Checklist.md` HAMZA maddelerinin `[x]` güncellemesi (yalnız doğrulananlar; hukuki onay bekleyenler not ile).
- [ ] 11.3 Final completion dokümanı.
