# Ekipler sayfası yeniden tasarımı

**Tamamlanma tarihi:** 2026-10-01
**Kapsam:** General Team kaldırma, ekipsiz üye olmaması, ekip üzerinden davet, tam sayfa ekip formu ve canlı önizleme, tıklanabilir kartlar, liste/şema görünümü, filtreli ekip detayı ve "Ekibi düzenle" modu, Davetler alt öğesi ve sayfası, kurucu koruması.

## Yapılanlar

**Backend**
- [V35__teams_without_general.sql](../../backend/src/main/resources/db/migration/V35__teams_without_general.sql): `squads.updated_by`, `project_invitations.team_id`. Mevcut General Team normal ekibe döner, hiçbir özel ekipte olmayan aktif üyeler ona yazılır, `is_general` ve ilgili kısıtlar kalkar.
- Otomatik General Team yok. Proje ekipsiz başlar. İlk ekipte oluşturan zorla eklenir (`includeCreator`).
- Kural: her üye en az bir ekipte kalır. `TEAM_LAST_MEMBERSHIP`, `TEAM_ARCHIVE_WOULD_ORPHAN` (adlarıyla), `TEAM_HAS_CHILDREN`, `TEAM_MEMBER_EXISTS`, `TEAM_CIRCULAR_PARENT` kodlu hatalar döner.
- Davet `teamId` taşır (zorunlu). Kabulde proje ve ekip üyeliği aynı transaction'da yazılır. Project modülü Squad'ı import etmez: [ProjectTeamDirectory](../../backend/src/main/java/com/pda/project/ProjectTeamDirectory.java) portunu Squad uygular.
- Kurucu (`projects.created_by`) projeden çıkarılamaz ve Project Manager rolü düşürülemez (`PROJECT_OWNER_PROTECTED`); son yönetici `LAST_PROJECT_MANAGER`.
- Ekip listesi yanıtına `updatedBy`, `memberPreview`, `lastJoined`; üye yanıtına `otherTeams`. Yeni `candidates` aday arama endpoint'i.
- Davet listesi `status` filtresi; davet e-postasına ekip adı.

**Frontend**
- Rotalar: `teams/new`, `teams/[teamId]`, `teams/[teamId]/edit`; eski `members` rotası detaya yönlenir.
- [teams-page.tsx](../../frontend/src/features/squads/components/teams-page.tsx): liste/şema (`?view=`, localStorage), boş durum. [team-card.tsx](../../frontend/src/features/squads/components/team-card.tsx): tüm kart tıklanabilir. [team-chart.tsx](../../frontend/src/features/squads/components/team-chart.tsx): saf CSS org şeması.
- [team-form-page.tsx](../../frontend/src/features/squads/components/team-form-page.tsx): tam sayfa form, yapışkan canlı önizleme, `beforeunload` koruması.
- [team-detail-page.tsx](../../frontend/src/features/squads/components/team-detail-page.tsx) ve [team-members-table.tsx](../../frontend/src/features/squads/components/team-members-table.tsx): arama, rol filtresi, sıralama (URL'de), düzenleme modu (rol, ekipten çıkar, projeden çıkar; kurucu için kilit).
- [invitations-page.tsx](../../frontend/src/features/invitations/components/invitations-page.tsx): sidebar'da rozetli "Davetler" alt öğesi, durum sekmeleri, ekip sütunu, onaylı iptal.
- `tabs.tsx`: default varyantta gizli `after` çizgisi kaydırma çubuğu yaratıyordu, düzeltildi.
- i18n tr/en/de, hata kodları, eski dialog/panel dosyaları silindi. Yeni npm bağımlılığı yok, `.env` değişmedi.

**Dokümanlar:** `.agents/api.md`, `architecture.md`, `database.md`, `SECURITY.md` §11, `frontend-design-rules.md`; eski iki refactor dosyasına "yerini aldı" notu.

## Doğrulama
- `./mvnw test`: başarılı. V35 Docker'da uygulandı.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`: temiz.
- Playwright (`npx playwright test`): ekip ile ilgili tüm spec'ler (01, 02, 03, 04, teams-page) geçti. `project-create-page.spec.ts` her testte yeni kullanıcı kaydettiği için art arda koşuda kayıt hız sınırına takılıyor; backend yeniden başlatılıp tek tek koşulduğunda geçiyor (ekiplerle ilgisiz, mevcut davranış).
- Playwright MCP görsel kontrol: 1440 ve 390 px, koyu tema; liste, şema, detay (düzenleme modu), form ve davetler sayfası. 390 px'de yatay kayma yok.

## Açık konular
- Dış davet önizleme/kabul yanıtı ekip adını açığa çıkarmıyor (güvenlik gerekçesiyle bilinçli); kabul ekranında ekip adı gösterilmiyor.
- Ekip üyeleri istemcide filtrelenir (ad users modülünde olduğundan); çok büyük ekiplerde sunucu tarafı filtre gerekir.
- Bildirim zili hâlâ yer tutucu; bildirim metinlerinin i18n'e taşınması ayrı iş.
- İsteğe bağlı ek backend testleri: ekip listesi sabit sorgu sayısı, V35 dönüşüm testi, `teamId`'siz davet 400.

## Kullanıcı kontrolü
1. Yeni proje oluşturun: Ekipler sekmesi "Henüz ekip yok" göstermeli.
2. "Yeni ekip": "Beni de bu ekibe ekle" işaretli ve kilitli, sağdaki önizleme yazdıkça güncellenmeli.
3. Kartın herhangi bir yerine tıklayın: ekip detayına gitmeli. Liste/Şema geçişi `?view=` ile hatırlanmalı.
4. Detayda "Ekibi düzenle": rol düzenleme ve ekipten çıkarma görünmeli; kurucu satırında projeden çıkarma yerine kilit olmalı.
5. "Üye ekle" ile bir kullanıcıyı davet edin; sidebar'daki Davetler rozeti artmalı, kabulden sonra kişi ekipte görünmeli.
