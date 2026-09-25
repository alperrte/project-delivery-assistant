# PDA — Pre-Push Quality Gate

Bu klasör, GitHub Actions kullanılmadan önce her `git push` öncesinde yerelde çalıştırılacak zorunlu kalite kontrollerini içerir.

## Tek komut

Repository kökünde:

```powershell
.\pre-push\pre-push.cmd
```

Herhangi bir adım başarısız olursa script `exit 1` ile durur ve push yapılmamalıdır.

## Her push öncesi zorunlu kontroller

1. Repository / secret güvenliği
   - `.env` Git tarafından track edilmemeli veya staged olmamalı.
   - `.pem`, `.key`, `.p12`, `.pfx`, `.jks` gibi hassas dosyalar staged olmamalı.
   - `git diff --check` whitespace / conflict kalıntılarını kontrol eder.

2. Docker erişimi
   - Docker daemon erişilebilir olmalı.

3. PostgreSQL
   - `docker compose up -d postgres`
   - PostgreSQL healthcheck başarılı olana kadar beklenir.

4. Backend
   - `backend\mvnw.cmd clean verify`
   - Mevcut ve gelecekte eklenecek JUnit, Spring, Security, repository, integration, Spring Modulith ve Testcontainers testleri Maven lifecycle üzerinden çalışır.
   - JaCoCo `verify` aşamasında rapor üretir.

5. Frontend
   - Gerekirse `npm ci`
   - `npm run lint`
   - `npx tsc --noEmit`
   - `npm run build`

6. Docker Compose
   - `docker compose config --quiet`
   - `docker compose up -d --build`
   - Backend ve frontend image'ları build edilir ve stack ayağa kaldırılır.

7. Runtime smoke test
   - Backend: `http://localhost:${BACKEND_PORT}/actuator/health`
   - Frontend: `http://localhost:${FRONTEND_PORT}`
   - Her iki HTTP kontrolü de başarılı olmalıdır.

8. Playwright
   - Projeye Playwright eklendiğinde script otomatik olarak `test:e2e` npm scriptini çalıştırır.
   - Şu an `test:e2e` yoksa bu adım skip edilir.

## Her push'ta çalıştırılmayacak testler

Bunlar proje planında daha sonraki gate/release aşamalarına uygundur:

- Chromium + Firefox + WebKit tam browser matrisi
- k6 load/stress/spike/soak
- SonarQube Cloud analizi
- Release'e özel full regression senaryoları

Bunlar geliştikçe ilgili fazlarda ayrıca çalıştırılır.

## Başarılı sonuç

```text
PDA PRE-PUSH CHECK PASSED
Safe to git push.
```

Bu mesaj görülmeden push yapılmamalıdır.
