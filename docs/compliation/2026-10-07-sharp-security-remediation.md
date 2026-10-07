# Sharp Dependency Security Remediation

## Teslim ve durum

2026-10-07. Kullanıcının onayladığı ayrı ve minimum transitive security patch: **sharp0.35.4→0.35.5**. **Canonical pre-push PASSED,exit0;512 backend0 failure/error/skip,291 Chromium passed+1 expected skip;lint/TypeScript/build/Docker PASS.**

Branch `general-features`, HEAD `5444612`; foundation commit/push kullanıcı tarafından tamamlandıktan sonra temiz worktree üzerinde başlandı. Commit/push/staging/pull/merge/branch değişimi yapılmadı.

## Yapılanlar

- `npm ls sharp --all` / `npm explain sharp` ve registry metadata: Next16.3.6 optional `sharp:^0.35.4`;0.35.5 semver-compatible. Sharp Node>=20.9.0; mevcut Node24.19.0 uyumlu.
- Gerçek `npm update sharp` ile lockfile güncellendi.27 sharp-family kayıt değişti: sharp/platform bindings0.35.5, bağlı libvips packages1.3.4. Bunlar aynı patch'in native dağıtımlarıdır. İlgisiz fast-deep-equal dev/devOptional metadata normalizasyonu eski haline getirildi; sürümü değişmedi.
- Final lockfile ile temiz `npm ci` geçti. Paket manifesti, diğer paket sürümleri, application/invitation/backend/config/migration/ENV kaynakları değişmedi. Major update/downgrade/force/override yok.
- Native benign PNG/JPEG/WebP/AVIF conversion, resize, SVG rasterization ve invalid-image reject6 kontrol geçti; runtime sharp0.35.5/libvips8.18.7/librsvg2.63.2. İlk smoke AVIF assertion'ı metadata'nın `heif` format adını yanlış bekliyordu; düzeltildi ve6 case yeniden geçti. Bu functional test exploit proof değildir.

## Güvenlik sonucu

[Reviewed GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), sharp<0.35.5 için HIGH; patched0.35.5. Advisory, librsvg memory vulnerability'nin belirli glibc Linux runtime koşullarında SVG decode sırasında RCE'ye yol açabileceğini bildirir. Native patch librsvg2.63.2 içerir. PDA exploit/runtime reachability yeniden üretilmedi; risk olmadığı iddia edilmez.

Final npm audit: **production0/exit0**, full5 high/exit1 (mevcut ESLint→fast-glob→micromatch→braces dev borcu). Önceki6 high/production1 bu patch öncesinin tarihsel durumudur. Sharp finding installed graph'ta kapandı; remaining dev debt ayrı bakım işidir, global release waiver yok. Source-map-js1.2.2 retained.

## Değişen dosyalar

- [frontend/package-lock.json](../../frontend/package-lock.json): yalnız sharp ve native platform/libvips aileleri.
- [.agents/SECURITY.md](../../.agents/SECURITY.md): tarihsel sharp follow-up'ın kapanış notu.
- [workspace-scrollbars.spec.ts](../../frontend/e2e/workspace-scrollbars.spec.ts): full suite setup login429 sonrası layout testinde gerçek shared member session reuse; assertion/login-account acceptance kapsamı korunur.
- Bu ayrı implementation completion. Foundation plan/completion ve uygulama kaynakları değiştirilmedi.

## Doğrulama

| Komut / aşama | Sonuç |
| --- | --- |
| `npm update sharp` |exit0;Next ^0.35.4 içinde0.35.5 |
| `npm ci` — final dar lockfile |exit0;clean install |
| `npm audit --json` |5 high dev,exit1;sharp finding yok |
| `npm audit --omit=dev --json` |0 vulnerabilities,exit0 |
| Native sharp smoke |6 cases PASS;sharp0.35.5/rsvg2.63.2 |
| `npm run lint`; `npx tsc --noEmit`; `npm run build` |exit0 |
| Account/photo/project-logo/organization-profile/team-member-preview Chromium |21 passed,exit0 |
| History/logout +scrollbar fixture target |5 passed,exit0 |
| `./pre-push/pre-push.cmd` |**PASSED exit0;512 backend0/0/0;291 Chromium+1 expected skip;lint/type/build/Docker health** |
| Final Docker/3000/8080/Swagger/API docs |Next dev restored;Docker/PostgreSQL healthy,3000/8080/Swagger/API docs200 |

First canonical backend512 PASS; Chromium290 passed+1 failure+1 expected skip,exit1. Safe trace confirmed last scrollbar setup login429. Existing real member storageState replaces redundant setup login; layout assertions unchanged, rate quotas/ENV/retries/timeouts unchanged. History/logout+scrollbar5 targeted PASS, then entire canonical rerun. Failed attempt retained and not counted PASS.

Hedefli browser normal success gerçek backend/PostgreSQL ile; mevcut açık failure injection fixtures yalnız negatif UI contract kanıtıdır. Güvenlik kotaları/ENV/auth policy değişmedi. Eski foundation gate bu patch'in PASS kanıtı yerine kullanılmadı. Backend/Testcontainers skip0; browser expected skip yalnız disabled production controlled crash route. Özel command/exit/source/audit kanıtı `.local/sharp-remediation/`; raw secrets rapora alınmadı.

## Açık konular / sınırlar

Sharp security patch ve scope gate tamamlandı. Existing5 high dev debt açık; production audit0 bütün release güvenlik kontrollerinin tamamlandığı anlamına gelmez. İşlevsel native regresyon Windows'ta koşuldu; Linux platform lock entries güncellendi, gerçek Linux exploit testi veya production rollout yapılmadı.

## Kullanıcı kontrolü

1. Account profile photo, project/organization logo ve ekip member avatars'ı aç; görsellerin yüklenmesini ve replace/remove fallback davranışlarını kontrol et.
2. Lockfile diff'inde yalnız sharp/platform/libvips ailesi değişsin; package.json ve uygulama kodu aynı olsun.
3. Bu completion kaydını incele. Dependency patch'i ayrı commit/push yapabilirsin; Git işlemleri kullanıcıya bırakıldı.
