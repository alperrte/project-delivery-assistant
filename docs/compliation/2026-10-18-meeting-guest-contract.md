# Toplantı misafir frontend sözleşmesi — 2026-10-18

## Tamamlanan kapsam

Kullanıcı onayıyla salt önizleme, scoped misafir durum okuma ve organizatör/yönetici davet metadata listesi eklendi. Tarayıcı entegrasyonunda bulunan eksik CORS yol kaydı aynı mevcut origin politikasına bağlandı; `Retry-After` okunabilir oldu. Yeni migration, ENV, kimlik türü veya CSRF istisnası yoktur. Commit/push yapılmadı.

Değişiklikler yalnız `meeting-system-backend` branch'ine bağlı `.branch-worktrees/meeting-guest-contract` çalışma alanındadır; ana `meeting-system-frontend` çalışma alanına backend kaynakları kopyalanmadı.

## Önemli dosyalar

- `meeting/internal/{MeetingDtos,MeetingService,MeetingController,MeetingInviteRepository}.java`
- `meeting/internal/http/MeetingGuestController.java`
- `auth/infrastructure/config/{SecurityBaselineConfiguration,MeetingHttpLimitFilter}.java`
- `MeetingServiceTest`, `MeetingCoreIntegrationTest`, `MeetingHttpSecurityTest`
- `docs/meeting-guest-contract.md`, `.agents/{SECURITY,api}.md`

## Doğrulama

Backend dizininden:

```powershell
.\mvnw.cmd -q '-Dtest=MeetingCoreIntegrationTest,MeetingHttpSecurityTest,MeetingServiceTest,MeetingProxyRateLimitTest' test
```

Son koşum: **38 test, 0 failure, 0 error, 0 skip; Maven exit 0**. Core entegrasyon testleri gerçek Testcontainers PostgreSQL kullanır; bu testlerde medya portu test double'dır. Frontend çalışma alanındaki ayrı gerçek LiveKit/Chromium doğrulaması bu testlerle karıştırılmaz. İlk mock tabanlı kontrolün ardından gerçek tarayıcıda eksik guest CORS kaydı bulundu, düzeltildi ve son testlere olumlu/olumsuz preflight kontrolü eklendi. Tam backend suite/pre-push/production koşulmadı.

## API / Swagger

Gerçek metotlar, alanlar, izin/hata/kota/no-store sözleşmesi [devir ekinde](../meeting-guest-contract.md) bulunur. `.agents/SECURITY.md` §11 uyarınca kontrol adresleri: `/swagger-ui/index.html` veya `/v3/api-docs`, yalnız zaten açık geliştirme/test docs ayarıyla. Preview için CSRF + POST gövdesi; state için scoped cookie; davet listesi için normal PDA cookie + organizer/manager erişimi kullanılır. Secret örneği veya logu üretilmez.

## Açık sınırlar ve manuel kontrol

1. Bu worktree'deki değişiklikleri backend branch'inde kendiniz inceleyip commit edin; ajan commit/push yapmadı.
2. Frontend branch'ini bu API ekiyle birlikte çalıştırın. Yerel entegrasyon build'i bu worktree backend'inden alınmıştır; ana çalışma alanının eski backend kaynağını yeniden build etmek yeni uçları kaldırır.
3. Tek kullanımlı davette preview kullanım sayısını artırmamalı; session oluşturma bir kullanım tüketmelidir.
4. Yenilemeden sonra davet listesi görünmeli, secret görünmemeli; iptal yeni session'ı engellemeli, mevcut session'ı kesmemelidir.
5. Mevcut guest-invalid hatası yanlış kapsam, süre sonu ve revoke için ortak kalır; UI bu durumda erişimin sonlandığını gösterir.
6. Üretim TLS/TURN ve gerçek cihaz/ağ kabulü bu API tesliminin kapsamı değildir.
