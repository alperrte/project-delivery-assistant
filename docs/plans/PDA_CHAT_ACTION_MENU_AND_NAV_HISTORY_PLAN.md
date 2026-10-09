# PDA — Chat Action Menu & Workspace History Planı

Tarih: 2026-10-06. Durum: **Tasks 1–8 complete; full gate PASSED.**

Source of truth: `.agents/PDA_Chat_Action_Menu_and_Nav_History_Prompt.md` dosyasının 1–41 bölümleri, kritik kuralları ve teslim formatının tamamı. Mevcut kaynak incelendi; `frontend/CLAUDE.md` → `frontend/AGENTS.md`, frontend workflow/design token kuralları ve ilgili yerel Next/Base UI API belgeleri kullanıldı. İlk teslim yalnız plandı; bu implementation turunun güncel source/test/gate kanıtı aşağıdaki verification kayıtlarında ve ayrı completion kaydındadır. Commit/push/staging/branch değişimi yapılmadı.

## 1. Başlangıç durumu ve gerçek kaynak bulguları

Branch `project-service-frontend`, HEAD `c2ae934`; başlangıçta yalnız kullanıcı prompt'u untracked. HEAD, frontend/backend remediation PR'larının merge'lerini içeriyor; eski teslim kayıtları bu yeni UX taskının başarı kanıtı sayılmadı.

| Alan | Gerçek dosya / davranış | Plan etkisi |
| --- | --- | --- |
| Message actions | `frontend/src/features/chat/components/message-actions.tsx`: ayrı Reply button ve React EmojiPicker trigger; desktop opacity0 olsa da flex row yer kaplıyor | Tek chevron/menu; action flow row kaldırılacak |
| Bubble/spacing | `message-list.tsx`: bubble → timestamp+MessageActions row → ReactionChips | Chips bubble'dan sonra gelecek; timestamp action'dan bağımsız |
| Chips | `reaction-chips.tsx`: mt1, flex-wrap; count/mine/pending ve PUT/DELETE callbacks | Aynı davranış; araya action yüksekliği eklenmeyecek |
| Emoji picker | `emoji-picker.tsx`: internal open state, kendi Smiley trigger'ı, existing Base UI Popover Portal/z50, Escape consume/finalFocus | Controlled/anchored reaction kullanımına küçük extension; composer eski kullanım korunur |
| Menu primitive | `components/ui/dropdown-menu.tsx`: existing Base UI Menu, portal/positioner; installed Menu Root `onOpenChangeComplete`, Popup `finalFocus` destekler | Yeni menu library yok; handoff için primitive lifecycle |
| Positioning | installed Base UI `PopoverPositionerProps` shared positioning'den `anchor` Element/ref alabiliyor | Picker aynı chevron ref'ine anchored; ikinci görünür trigger gerekmez |
| Ownership | `layout/app-shell.tsx`: authenticated workspace'te ortak ChatProvider + ChatRoot; landing `contained` ayrı presentation | History controls authenticated shell'de; contained demo canlı history'ye bağlanmaz |
| Navbar | `app-header.tsx`: viewport-centered fixed pill, sidebar yanında değil; autohide; mobile hamburger/search/locale/theme/bell/account zaten var | Pair mevcut navbar içine eklenecek; önceki viewport-merkezli konum korunacak; dar ekranda iki row |
| Reserve/inert | AppShell main pt72; ChatPanel top72; ChatRoot main'i full sırasında inert yapar | Ortak header reserve; history controls main dışında, full chat'te erişilebilir |
| Router | `i18n/navigation.tsx`: push/replace/prefetch localize; spread edilen Next back/forward değiştirilmez | Existing router.back()/forward() kullan; history URL'sini tekrar localize etme |
| Locale | `locale-switcher.tsx`: `window.location.assign(switchLocale(...))`, full document entry | Locale back/forward doğal document/BFCache davranışıyla test edilecek |
| Chat page semantics | `chat-provider.tsx`: logical pathname+section observer; full→closed, compact/bar korunur; ownerKey user+project | Arrow click'te premature chat.close yok; gerçekleşen logical route değişimi belirleyici |
| Existing tests | `17-project-chat.spec.ts`, `chat-replies-reactions.spec.ts`, `chat-responsive.spec.ts`, `chat-cache.spec.ts` | Eski reply/react locator'ları menü flow'una güncellenir; backend/WS assertion'ları korunur |

`frontend/src` içinde mevcut workspace router.back/forward kontrolü veya history capability store bulunmadı. Backend reply/reaction API/cache/WS/version/resync yeniden tasarlanmayacak. Mevcut inline action row'un boşluğu code'dan doğrulandı; yeni UI'nin görsel kabulü implementation screenshot'larıyla verilecek.

## 2. Kesin ürün ve teknik kararlar

### 2.1 Chat menu / picker state ve geometry

- Confirmed mesajda tek küçük chevron; desktop hover/focus-within **ve open state** sırasında görünür, mobile sürekli erişilebilir. Pending/unconfirmed outbox'a yeni action sunulmaz.
- Trigger overlay/absolute anchor; **hover veya menu open bubble ölçülerini değiştirmez**. Text'i örtmez: kalıcı inset/gutter veya corner reservation kullanılır. Own/other mirrored alignment, 44px mobile hit area ve viewport collision proof Task2/7'de ölçülür; küçük glyph ile hit area ayrılır.
- Bubble → reaction chips (mevcut mt1 token, yaklaşık4px) → timestamp. Ayrı Reply/React flow satırı yok; menü/picker portal içindedir. Long/emoji-only/quoted messages plaintext ve native text selection korunur.
- Local state machine: `closed → menu → handoff(reply|react) → closed|picker`. Selection menu'yu kapatır; close-complete sırasında uygun existing callback/picker açılır. Aynı anda iki popup/focus trap açık kalmaz.
- Handoff'ta Menu finalFocus eski trigger'a yarışarak focus çalmasın. Reply composer focus'una, React anchored picker ilk button'una aktarılır; normal Escape/outside close chevron'a dönebilir. Navigation/unmount/context switch sırasında pending handoff cancel edilir; detached anchor'a focus yok.
- Shared EmojiPicker controlled open/anchor/optional trigger kullanımına extension alabilir; current composer24/caret behavior değişmez. Reaction6 canonical codes ve existing callbacks/versioned snapshots aynen kalır. Arbitrary setTimeout ile handoff zamanlama yapılmaz; primitive lifecycle kullanılır.
- Escape önce açık menu/picker'ı kapatır ve event'i consume eder; chat minimize'a düşmez. Reply context/composer/panel eski Escape önceliği korunur. Reply draft/retry/outbox/read/unread/cache/business behavior değişmez.

### 2.2 Native history ve kullanıcı kararı

**Kullanıcı onayı:** PDA okları güvenilir aynı-origin geçmişle sınırlı olacak; farklı site geçmişine geçiş için browser okları doğal kalacak. Browser back/forward/mouse/Alt shortcut davranışı intercept edilmeyecek.

Native `window.navigation.canGoBack/canGoForward` capability için birincil kaynak; actual action mevcut localized helper üzerinden **router.back()/router.forward()**. Native capability false ise native disabled. URL listesi, custom route-name stack, history index state injection, history.pushState/replaceState override veya private Next state mutation yok. [WHATWG same-origin history scope](https://html.spec.whatwg.org/dev/nav-history-apis.html) bu sınırı açıklar; [MDN canGoBack](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/canGoBack) ve [canGoForward](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/canGoForward) capability tanımlarını verir.

Installed Chromium public-login probe: initial entries1/index0/backfalse/forwardfalse fakat history.length2; local push sonrası backtrue/forwardfalse; browser back sonrası backfalse/forwardtrue. Bu yüzden `history.length>1`, document.referrer veya bir in-memory visited counter exact capability sayılmaz. Private `.local/chat-action-nav-plan/capability-probe.json` yalnız primitive proof'tur; Next SPA/full feature E2E geçti iddiası değildir.

SSR snapshot safe disabled; hydration sonrasında feature detection. Store `useSyncExternalStore` veya eşdeğer client-safe subscription ile native `currententrychange`, completion/error ve `pageshow` sonrası live capability okur; snapshot stable primitive/cached object olmalı. Next push/replace/popstate ile aynı browser entry'nin durumu izlenir; kendi navigation intercept handler'ı yok. `onClick` action'dan önce capability tekrar okunur.

Eski/unsupported API durumunda capability **unknown** olarak tutulur: oklar görünür fakat disabled ve localized unavailable açıklaması taşır; “history yok” diye yanlış claim yapılmaz. Browser okları kullanılabilir. Current latest compatibility [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/canGoBack)'de Baseline2026; older-browser behavior ayrıca fallback testidir, feature saklanmaz. TypeScript DOM lib tam Navigation interface sağlamıyorsa yalnız kullanılan readonly capabilities/events için narrow local type yazılır; TS/npm upgrade yapılmaz.

### 2.3 Shell placement ve navigation lifecycle

- Yeni bağımsız floating toolbar yok. Pair, mevcut AppHeader composition'ında search öncesinde; navbar fiziksel viewport merkezindeki önceki konumunda kalır; sidebar expanded/collapsed geçişi navbar konumunu değiştirmez.
- Dar ekranda controls kaybedilmez: existing header iki row olabilir. Birinci row hamburger + history pair + search; ikinci row locale/theme/bell/account. Desktop aynı içerik tek row. Tab order DOM order ile tutarlı;320px'te taşma yok,44px touch hit area.
- Main reserved top ve ChatPanel top için **tek shared responsive reserve** kullanılır. Mevcut72px varsayımı mobile two-row'da güncellenir; header autohide transform reserve'i azaltmaz. Mevcut dialog/toast z-index, sticky save bars, dashboard özel padding ve collapsed/mobile sidebar korunur.
- History buttons full chat tarafından örtülmez veya inert olmaz; AppHeader main'in dışında kalır. Actual pathname/section traversal → provider existing full-close; compact/bar aynı ownerKey'de persistent. No-op/disabled/failed traversal UI'yi kapatmaz; X veya old chat trigger'a navigation focus restore yok.
- Query history için `section` değiştiren actual push entry test edilir; ordinary filter/pagination chat pageKey'ine kendiliğinden eklenmez. Native URL/query/hash/locale entry olduğu gibi traversed edilir.
- Rapid ←←→ için fixed debounce yok; native capability events ve gerçek completion kullanılır. Önce unlocked browser behavior gözlenir; gerçek duplicate/pending issue varsa minimum transition guard planlanır, queue corruption veya forever-disabled lock yapılmaz.
- Logout/account boundary history'yi silmez. Private route'a dönüş existing auth guard'ı çalıştırmalı; BFCache/session freshness ve chat owner generation izolasyonu gerçek test edilir. Security flaw bulunursa yeniden üretim/kök neden raporlanır; auth mimarisini sessizce değiştirme.

## Task 1 — Preflight, contracts ve baseline

**Prerequisite:** yok. **Dosyalar:** bu plan; chat/shell/routing primitives, installed Next docs/Base UI types, relevant tests.

- [x] 1.1 HEAD/branch/index/worktree ve source hashes al; kullanıcı değişikliklerini koru. Plan HEADc2ae934 ile source farklarını değerlendir.
- [x] 1.2 Current inline row geometry, Bubble/chip spacing, menu/Popover anchors/focus contracts ve history Native API feature detection'ını doğrula.
- [x] 1.3 Kullanıcının same-origin kararını, unsupported/unknown disabled açıklamasını ve actual router.back/forward kullanımını freeze et; external browser davranışına dokunma.
- [x] 1.4 Desktop viewport-centered / mobile two-row header layout ve shared main/chat reserve'i current tokens/DOM ölçüleriyle somutlaştır. Contained landing demo live history açmasın.
- [x] 1.5 Current targeted chat/navigation/locale/landing tests baseline çalıştır; outdated fixture/source/image veya skip gerçek nedenini kaydet. Test için process/port etkisi gerektiğinde mevcut izin kapsamını değerlendir.

### Definition of Done

- [x] State, focus, native capability, layout, auth/context ve demo contract'ında implementasyonu engelleyen belirsizlik yok.
- [x] Baseline source/runtime/test scope kayıtlı; yeni feature için başarı claim'i yok.

## Task 2 — Message action menu, picker handoff ve chip placement

**Prerequisite:** Task1. **Dosyalar:** MessageActions, MessageList, EmojiPicker, gerekirse existing dropdown wrapper'a dar prop forwarding; chat E2E. **Backend/DB/WS:** değişiklik yok.

- [x] 2.1 Tek confirmed-message chevron/button ve existing DropdownMenu içinde Reply/React item'ları; own/other overlay alignment, permanently reserved clearance, active/open visibility.
- [x] 2.2 Inline action row kaldır; chips doğrudan bubble sonrası, timestamp ayrı. Hover/open layout height veya scrollHeight zıplaması üretmesin; text/quote overlay altında kalmasın.
- [x] 2.3 Controlled reaction picker current chevron ref'ine anchored; composer picker default uncontrolled flow korunur. Same canonical6/callbacks/mine toggle/pending flags, no additive/fake success.
- [x] 2.4 Menu close-complete→reply/picker handoff; finalFocus suppression, Escape consume, outside dismiss ve anchor/unmount cancellation. Aynı anda iki açık layer yok.
- [x] 2.5 Existing group/direct reply, real reaction+reload, pending/outbox/retry/resync tests'inde yeni entry point kullan; persistence ve unread assertions silinmesin.

### Definition of Done

- [x] Tek trigger mevcut reply/react'i çalıştırır; chips yakın, own/other geometry stable; pending actions yok.
- [x] Real REST/WS/regression geçti; backend/API/version/cache davranışına dokunulmadı.

## Task 3 — Menu touch/keyboard/i18n ve scope cleanup

**Prerequisite:** Task2. **Dosyalar:** MessageActions/picker/list, TR/EN/DE catalogs, action-menu tests.

- [x] 3.1 Native button aria-label, Tab/Enter/Space, menu arrows/item selection, Escape/outside dismissal/focus restore. Mevcut reply.action/reactions.action/emoji translations reuse; yalnız yeni actions labels ekle.
- [x] 3.2 Mobile görünür trigger ve44px hit area; long-press zorunlu değil. Native text selection/copy, scroll/pagination ve tooltip/portal clipping korunur.
- [x] 3.3 Reaction disabled/pending yalnız ilgili action'ı etkiler; existing offline reply draft policy korunur. Handoff sırasında project/conversation/account değişiminde stale callback/focus yok.
- [x] 3.4 Small/long/emoji-only/reply message, mine/other, compact/full ve light/dark keyboard/touch targeted E2E.

### Definition of Done

- [x] Üç dil/a11y/touch/focus ve context cleanup geçti; composer24 behavior ve panel Escape regresyonları sağlam.
- [x] Menu keyboard modelini primitive sağlar; eksik fake menu/grid semantics yok.

## Task 4 — Native history capability adapter

**Prerequisite:** Task3. **Dosyalar:** proposed `layout/use-workspace-history.ts` veya küçük layout history module; native capability tests. **Backend/security:** no new API/auth/storage.

- [x] 4.1 Feature detect native Navigation readonly capabilities/currentEntry; SSR/unknown/unsupported distinct state, stable external-store snapshot.
- [x] 4.2 Native current-entry/completion/error/pageshow events subscribe/cleanup; push/replace/browser traversal sync. Private Next `__NA`/tree state untouched; no history method patch veya URL stack.
- [x] 4.3 Capability recheck→existing router.back/forward; no URL execution/localization rewrite. Same-origin boundary native disabled; unsupported localized explanation.
- [x] 4.4 Fresh entry, push/back/forward, replace/no new entry, back→new push drops forward, duplicate URL entries/query/hash, reload/BFCache, browser/Alt/mouse synchronization. Unsupported API test fixture ayrı TEST-ONLY.

### Definition of Done

- [x] Flags actual browser entry ile eşleşir; history.length/referrer tahmini kullanılmaz. External browser arrows doğal kalır.
- [x] Unknown state sahte “history yok” değildir; native unsupported fallback ve no listener leak doğrulandı.

## Task 5 — AppHeader/viewport-centered controls ve responsive reserve

**Prerequisite:** Task4. **Dosyalar:** proposed WorkspaceHistoryControls, AppHeader/AppShell, shared layout reserve/globals gerekirse, ChatPanel top offset, catalogs; header/sidebar/landing tests.

- [x] 5.1 Existing Button/Tooltip + Phosphor arrows; TR/EN/DE back/forward/group/unavailable labels, native disabled and accessible explanation. No new package.
- [x] 5.2 Pair existing header search öncesine; desktop viewport centering ve sidebar durumundan bağımsız konum. Navbar search, locale, theme, bell, account ve autohide korunur.
- [x] 5.3 ≤small viewport two-row composition ve stable shared reserve; main/header/full ChatPanel birbiriyle çakışmaz. Header hidden/visible veya dropdown open reserve değiştirmez; viewport320 overflow yok.
- [x] 5.4 Contained demo history flags disabled/no-op, listener/real navigation yok; current real-component demo visuals/inert izolasyonunu koru.
- [x] 5.5 Desktop/tablet/mobile, collapsed sidebar/drawer, keyboard/search shortcut, long labels, theme/motion ve sticky save bar regressions.

### Definition of Done

- [x] Mevcut ortalanmış navbar içinde discoverable oklar; mobile özellik kaybolmaz, full chat sırasında kullanılabilir; ayrı floating toolbar yok.
- [x] Header/main/chat geometry, focus order ve landing/autoHide/drawer regressions geçti.

## Task 6 — Chat + history/locale/account integration

**Prerequisite:** Task5. **Dosyalar:** history adapter/controls, existing provider/root yalnız gerçek regression gerektirirse; chat-navigation and localized-route E2E.

- [x] 6.1 Projects→Project→Tasks→Calendar; PDA back/back/forward ve browser back→PDA forward senkronizasyonu, native history entry/URL kanıtı.
- [x] 6.2 Real section pushes, replace, query/hash ve locale full document entries; exact localized href/query/html.lang geri/ileri doğru. Manual page-name registry yok.
- [x] 6.3 Full+actual logical page traversal→closed/no bar; no-op/disabled/failed traversal full'u kapatmaz. Compact/bar aynı ownerKey'de conversation/text/reply/outbox state korur; X tekrar açılmaz.
- [x] 6.4 ProjectA→B→back, rapid ←←→ ve stale REST/WS/context cleanup; eski project draft/cache diğerine sızmaz. Existing generation/message-ID/reactionVersion/resync guard'ları değiştirilmez.
- [x] 6.5 Logout→private history/back/forward, account switch, pageshow/BFCache authentication guard. Farklı-origin browser back normal; PDA boundary disabled. Açık auth flaw varsa önce report/approval, fake cache veya security relaxation yok.

### Definition of Done

- [x] Native/browser/PDA entry semantics ve localized/auth boundaries doğru; chart dışı custom history yok.
- [x] Full close / dock persistence / focus-inert / project-account isolation hedefli gerçek E2E'den geçti.

## Task 7 — Birleşik visual/layout/runtime regresyonu

**Prerequisite:** Task6. **Dosyalar:** proposed `chat-action-menu.spec.ts`, `workspace-history.spec.ts`; existing chat-replies-reactions/chat-responsive/chat-cache/17-project-chat, locale/header/landing specs.

- [x] 7.1 Real two-user group/direct reply/react/send/retry/reload; normal success backend/PostgreSQL, no route.fulfill. Menu locator helpers güncellensin; eski business assertions kalsın.
- [x] 7.2 Chip distance token sınırında; hover/open bubble height/scrollHeight stabil; single/multi chips, long/short/emoji-only/reply/own/other. Screenshot yerleşim/clipping/glyph contrast manuel incele.
- [x] 7.3 320/390/768/1024/1440px, full/compact/bar, light/dark/TR-EN-DE, reduced-motion ve explicit motion-off. Menu/picker portal first/last/scrolled message bounds; touch text selection.
- [x] 7.4 Native/browser/PDA history, no/forward branch, section/hash/locale, unsupported fallback, external boundary, rapid/mixed input, account/BFCache. Actual routes/requests önce listeners ile kaydedilsin.
- [x] 7.5 Unread/read/history pagination/reconnect/chunk50 shared resync/duplicate events/outbox/failed retry/selection/renewal/demos regressions; QA only own IDs cleanup, user data/volumes korunur.

### Definition of Done

- [x] Geometry, a11y, runtime/data ve history acceptance matrix kanıtlı; source/command/exit/count/artifact kayıtlı.
- [x] Açık feature blocker varsa next task tamamlandı sayılmaz; screenshot veya eski completion tek başına PASS değil.

## Task 8 — Full gate, belgeler ve ayrı implementation completion

**Prerequisite:** Task7. **Dosyalar:** plan evidence/checks, relevant design/folder/architecture notes, scoped web checklist; ayrı completion.

- [x] 8.1 Current source frontend lint/TypeScript/production build, targeted ve full Chromium çalıştır. Runtime backend/image uygunluğu doğrulansın; stale server/expired auth fixture success sayılmaz.
- [x] 8.2 Canonical `./pre-push/pre-push.cmd` çalıştır: **backend full gate atlanmaz**, lint/type/build/all E2E/Docker build/start/health. Port/service etkisi için doğrulanmış process ve izin kapsamı; ENV/security quota gevşetme yok.
- [x] 8.3 Native capability/browser support ve same-origin/fallback sınırlarını, header reserve/menu behavior ve changed files'i belgelerde güncelle. Web checklist yalnız impacted scoped note; global kutuları topluca [x] yapma.
- [x] 8.4 `docs/compliation/YYYY-MM-DD-chat-action-menu-workspace-history.md` ancak gerçekten tamamlanınca oluştur; README formatı ve prompt final headings, command/exit/pass-fail-skip, manual controls/remaining limits içerilsin. Plan completion yerine geçirilmesin.
- [x] 8.5 Final source/index/HEAD check, user changes korunmuş; commit/push/staging yok. Test için servis geçici durduysa restore/health. Existing npm dev debt ayrı, yeni dependency yok.

### Definition of Done

- [x] Full regression + canonical pre-push PASSED, backend skip'leri PASS sayılmadı; bütün önceki DoD/checks kanıtlı.
- [x] Ayrı completion ve manual checks hazır; yalnız blocker yoksa `Kalan blocker yok.` yazıldı. Bu plan tesliminde o iddia yapılmaz.

## Validation planı ve final teslim

Uygulanan validation rotası (gerçek final command/exit/count kanıtı verification kayıtlarında ve completion kaydındadır):

```powershell
Push-Location frontend
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
npx.cmd playwright test e2e/chat-action-menu.spec.ts e2e/workspace-history.spec.ts e2e/workspace-history-context.spec.ts e2e/native-history.spec.ts e2e/chat-replies-reactions.spec.ts e2e/chat-responsive.spec.ts e2e/17-project-chat.spec.ts --project=chromium
npx.cmd playwright test --project=chromium
Pop-Location
.\pre-push\pre-push.cmd
```

Final implementation raporu prompt sırası: Final verdict; Chat message action changes; Reaction chip layout; Reply/reaction behavior; Back/forward navigation; Browser history synchronization; Chat navigation interaction; Accessibility/responsive/theme; Changed files; Test results; Remaining issues. No new backend contract bekleniyor; gerçek ihtiyaç çıkarsa önce nedeni raporla.

| Prompt kapsamı | Plan |
| --- | --- |
| 1–13 | source findings + menu/picker geometry/state, Task1–3/7 |
| 14–24,28–32 | native capability/approved same-origin/locale/auth/chat, Task4–6/7 |
| 25–27,33–35 | tokens/mobile/a11y/i18n/visual proof, Task2/3/5/7 |
| 36–41 + kritik kurallar | no backend/dependency/Git changes; ordered tasks/full gate/separate delivery, Task1/8 |

**İlk plan tesliminin tarihsel sınırı:** İlk turda yalnız plan ve private native capability probe vardı; production/test/config değişikliği veya feature completion yoktu. Implementation onayı sonraki kullanıcı mesajıyla verildi. Güncel tamamlanma durumu yukarıdaki checkbox'lar ve aşağıdaki gerçek verification kayıtlarıdır; ayrı teslim: `docs/compliation/2026-10-06-chat-action-menu-workspace-history.md`.

### Task 1 verification

HEADc2ae934/status/index/hash snapshot; current backend build/start and lint/type/build exit0. Targeted baseline48 Chromium passed (chat/reply/reaction/cache/locale/landing). Native capability contract/same-origin approval, no private history patch, header reserve128px mobile/72px desktop, nonmodal menu and lifecycle handoff freeze. Native primitive probe stored separately; baseline screenshots copied. No feature implementation claim.

### Task 2 verification

Current lint/type/build exit0;16 real chat/reply/reaction/cache/resync/persistence Chromium passed, extra geometry1 passed. Bubble→chips4px→timestamp; menu open width/height/scrollHeight unchanged, Escape leaves full panel visible. Nonmodal existing Menu lifecycle handoff and anchored controlled reaction picker, composer default preserved; backend/schema/WS/cache untouched. task2-final-ui.log/task2-geometry-ui.log.

### Task 3 verification

Lint/type/build exit0;10 real Chromium tests passed + extended menu matrix1. TR/EN/DE label/menu keyboard Enter/Space/arrows/Escape focus,44px touch, native text selection, own/other long/short/emoji and anchored popup bounds; compact/full reply and navigation unmount cancellation passed. Normal finalFocus uses primitive default; handoff suppressed. Backend unchanged. task3-final-ui.log/task3-matrix-ui.log.

### Task 4 verification

Lint/type/build exit0; native2 tests passed. Unknown/pending/known bit snapshots, fresh capability action recheck, subscription cleanup, real push/replace/query/hash/back/forward/branch/reload and off-origin browser boundary verified. No classic-history patches, private Next state writes, custom URL stack or storage. task4-final-ui.log.

### Task 5 verification

Task5 current lint/type/build exit0; sidebar/locale/landing/native 12 passed plus final header/fallback 2 passed. Actual 320/390/768/1024/1440 light/dark geometry, 44px touch hit areas, expanded256/collapsed80 alignment, mobile header112/reserve128/full-chat inert isolation; contained landing tests passed. Initial geometry tests sampled autohide transition; corrected to real pointer reveal and settled CSS scale, then reran successfully.

### Task 6 verification

Task6 lint/type/build exit0, history/chat/localized-routing 31 passed and project/canceled/rapid context 1 passed. Real PDA/browser back-forward, full closed/dock text+reply retained, section versus filter/hash, replace native index, branch drops forward, locale document traversal/html.lang, logout private redirect, account and A-B-A isolation; canceled native traversal fixture TEST-ONLY. Rapid native mixed inputs remain aligned without adding debounce or transition lock.

### Task 7 verification

Task7 lint/type/build exit0; combined real chat/history/landing/native/cache/renewal suite 50 passed, final visual/motion 2 passed. 320/390/768/1024/1440 light/dark screenshots inspected; popup bounds, 4px chips, stable bubble/scroll, own/other long/short/emoji/quote, mobile44, three-language labels and compact behavior. Motion-off/reduced composer/reaction/menu durations checked. Initial extra visual test sampled button width transition; final waits settled44 and passed. QA project IDs archived; user data/volumes untouched.

### Task 8 verification

Canonical pre-push PASSED exit0: clean verify464 backend0 fail/error/skip, lint/type/build0, full Chromium240 passed+1 expected crash-route skip, Docker build/start/health200. Initial full menu fixture timeout corrected and targeted1 PASS; first canonical failed only settings JS chunk net::ERR_CONNECTION_REFUSED, unchanged settings targeted6 PASS and final canonical full rerun PASS. Full npm5 high dev/production0 separately; baseline source/HEAD/index protected, no backend/dependency/config changes, no commit/push/staging. Scoped docs + separate completion created; Next dev restored frontend/backend200; QA own IDs archive/API checks, no user data/volume deletion.

### 2026-10-06 — Navbar konum düzeltmesi

Kullanıcı isteği önceki sidebar hizalama kararını geçersiz kıldı: navbar eski fiziksel viewport merkezine geri alındı; sidebar daraltma/genişletme konumunu değiştirmez. Oklar navbar içinde kalır; kontrollerin sığması için desktop genişlikleri620/700/760px. Güncel kaynakta lint, TypeScript, production build exit0; viewport/header/history/sidebar/locale/landing gerçek Chromium14 passed (`navbar-center-verified-ui.log`).320/390/640/768/1024/1440px light/dark center, control bounds ve kontrol çakışmaması doğrulandı. Önceki464 backend/240 Chromium canonical gate bu düzeltmeden önceki teslimin kanıtıdır; bu küçük yerleşim düzeltmesinde full gate tekrarlanmadı. Next dev restore edildi; commit/push/staging yok.
