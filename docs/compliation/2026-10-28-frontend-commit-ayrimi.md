# Frontend commit ayrımı — 2026-10-28

## Tamamlanan kapsam

Onaylanan frontend değişiklikleri dört servis branch'ine ayrıldı. Branch tabanları salt okunur fetch ile güncel origin/main (604370fbb432f3e443f5d47937548e8248684f1f) üzerinden karşılaştırıldı; tüm eski servis uçları bu tabanın atasıydı. Servis branch'leri geçmiş kaybetmeden bu tabana ilerletildi, her birine tek ayrıntılı commit eklendi. Yerel main branch'ine merge, reset veya commit yapılmadı; push yapılmadı.

Ortak tasarım/checklist belgeleri ve sürüm general-features içinde toplandı. Böylece branch'lerin değiştirdiği dosya kümeleri birbirinden ayrıdır; diğer servis değişiklikleri yanlış branch'e taşınmaz. Bu kaydı içeren project-service-frontend commit'i proje/organizasyon kapak-logo düzeltmelerini içerir.

## Değişen önemli dosyalar ve branch'ler

| Branch | Commit / kapsam |
| --- | --- |
| project-service-frontend | Bu kayıt ile aynı commit; globals.css, EntityCard ve proje kapak/logo/önizleme teslim kayıtları |
| meeting-system-frontend | 1ad19b833b5e28fc0be5096fa08621aa67683829 — toplantı aksiyonları, ikon seçimi, hizalama, mini kart |
| task-service-frontend | 7ed3bf5763aa20d07c5a7605e52f4a36e6047d0c — Görevlerim araması ve yeni görev breadcrumb |
| general-features | b1a7cde5243df3cf78798ff2dea6161df291d679 — PDA Version : v2.9.9, ortak footer/sidebar ve toplu standart/doğrulama belgeleri |

## Çalıştırılan doğrulama komutları

- git fetch origin --no-tags
- Branch'lerin origin/main ve kendi remote uçlarıyla ancestry karşılaştırmaları.
- Her commit için git diff --cached --check ve dosya sahipliği karşılaştırması.
- git merge-tree --write-tree: Git ağaçları üzerinde main ref'ini değiştirmeyen dört branch birleşme provası.
- Kaynak snapshot dosyalarının Git blob hash'leriyle birleşik prova ağacının karşılaştırılması.
- Commit author/committer ve attribution trailer kontrolleri.

## Test/doğrulama sonuçları

Frontend davranış kanıtları servis teslim kayıtlarındadır; yalnız commit ayırma nedeniyle Playwright/pre-push/backend testleri tekrar çalıştırılmadı. Dört branch'in dosya kümeleri ayrıdır. Güncel main tabanına göre birleşme provası conflict olmadan geçti. Commitler mevcut Git kullanıcı kimliğiyle oluşturuldu; ajan imzası, Authored-by veya Co-authored-by eklenmedi. Onaylanan kaynaklar Git dışındaki tmp/branch-commits/snapshot altında ayrıca yedeklendi.

## Açık kalan konular ve doğrulanmayan sınırlar

Main veya servis remote'larına sonradan yapılacak değişiklikler yeni bir karşılaştırma gerektirebilir. Bu kontrol, yukarıdaki origin/main snapshot'ına aittir. GitHub PR merge/release/deployment yapılmadı. Yerel main'in önceki farklı geçmişi değiştirilmedi. README/release/landing içerik tasarımı bu commit adımından sonraki iştir.

## Kullanıcının manuel kontrol adımları

Repo kökünde aşağıdaki komutlarla her yerel branch'i aynı adlı remote branch'e gönderin; force gerekmez:

~~~powershell
git push origin project-service-frontend
git push origin meeting-system-frontend
git push origin task-service-frontend
git push origin general-features
~~~

Ardından PR'ları main'e kendiniz birleştirin. Kontrol edilen snapshot'ta sıralama bağımlılığı yoktur; düzenli inceleme için proje → toplantı → görev → genel sırası kullanılabilir. Son durum manifest'i tmp/branch-commits/manifest.json dosyasındadır.
