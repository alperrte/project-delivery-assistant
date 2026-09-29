---
name: Titanium Engineering Precision
colors:
  surface: '#fbf9f9'
  surface-dim: '#dbdad9'
  surface-bright: '#fbf9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f3'
  surface-container: '#efeded'
  surface-container-high: '#e9e8e7'
  surface-container-highest: '#e3e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#45474a'
  inverse-surface: '#303031'
  inverse-on-surface: '#f2f0f0'
  outline: '#75777a'
  outline-variant: '#c5c6c9'
  surface-tint: '#5e5e5f'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1c1d'
  on-primary-container: '#848485'
  inverse-primary: '#c7c6c7'
  secondary: '#5a5f64'
  on-secondary: '#ffffff'
  secondary-container: '#dce0e6'
  on-secondary-container: '#5e6368'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1b1b1e'
  on-tertiary-container: '#848387'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e3e2e3'
  primary-fixed-dim: '#c7c6c7'
  on-primary-fixed: '#1b1c1d'
  on-primary-fixed-variant: '#464748'
  secondary-fixed: '#dee3e8'
  secondary-fixed-dim: '#c2c7cc'
  on-secondary-fixed: '#171c20'
  on-secondary-fixed-variant: '#42474c'
  tertiary-fixed: '#e4e1e5'
  tertiary-fixed-dim: '#c8c6c9'
  on-tertiary-fixed: '#1b1b1e'
  on-tertiary-fixed-variant: '#47464a'
  background: '#fbf9f9'
  on-background: '#1b1c1c'
  surface-variant: '#e3e2e2'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.025em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.015em
  title-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 0.75rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 1.75rem
  space-2xl: 2.5rem
---

## Brand & Style
This design system embodies the calculated precision, focus, and speed required by high-performance engineering and product management teams. The visual tone is strictly minimalist, architectural, and utilitarian—eliminating decorative fluff in favor of structural clarity, high scannability, and metallic neutral tones.

Rooted in modern technical minimalism with subtle Swiss grid influences, the UI evokes feelings of calm authority, frictionless productivity, and reliable data density. Every element serves an operational purpose: visual hierarchies rely on typography weighting, hairline borders, and intentional tonal contrast rather than saturated fills. The design feels like precision-milled aluminum hardware translated to software.

## Colors
The color palette strictly adheres to a monochromatic and metallic spectrum: true blacks, titanium whites, brushed silvers, cool slates, and carbon tones. There are absolutely no blue, purple, violet, or navy undertones across surfaces or accents.

### Light Mode Surfaces
- **Canvas Base:** `#FFFFFF` (Pure pristine white)
- **Subtle Surface / Sidebars:** `#F9FAFA` to `#F4F5F6` (Milled silver / cool technical gray)
- **Card & Elevated Surfaces:** `#FFFFFF`
- **Hairline Borders:** `#E5E7EB` (Subtle boundary definition)
- **Primary Text:** `#090A0B` (Jet black)
- **Secondary Text:** `#525866` (Slate graphite)
- **Muted Text / Meta:** `#8C93A0` (Silver pewter)

### Dark Mode Surfaces (Strict Neutral & Titanium)
- **Canvas Background:** `#090A0B` (Pure deep carbon)
- **Sidebar & Surface Base:** `#111214` (Onyx black)
- **Surface Elevation (Cards, Modals):** `#18191B` (Titanium slate)
- **Hover & Highlight Surfaces:** `#222326` (Brushed steel)
- **Hairline Borders:** `#27282B` (Low-contrast graphite)
- **Primary Text:** `#F4F5F6` (Pure titanium white)
- **Secondary Text:** `#A1A1AA` (Muted silver)
- **Muted Text / Placeholders:** `#52525B` (Charcoal gray)

### Status & Indicator Tokens
Status tokens provide micro-indicators (dots, subtle tags) without polluting the neutral canvas:
- **Active / Done:** `#10B981` (Crisp Emerald)
- **In Progress / Planning:** `#64748B` (Neutral Cool Slate) or `#2563EB` (Pure Technical Blue only for strict system links if mandated, otherwise default to high-contrast white/black state tags)
- **Warning / Medium Priority:** `#F59E0B` (Amber)
- **Critical / Urgent:** `#EF4444` (Pure Vermilion Red)

## Typography
Built around `Inter` with tabular numeral support (`font-variant-numeric: tabular-nums`) enabled across all metric and table views.

Hierarchy is enforced strictly via weight (`400` body, `500` functional labels, `600` headers) and size step-downs. Letter spacing is slightly negative on headlines for optical tightness, while labels and keyboard shortcuts (`Ctrl K`) remain neutral or slightly tracked for fast legibility at glance speed.

## Layout & Spacing
The system uses a fixed-dock 3-column architecture designed for 1440px+ displays, with graceful collapse across smaller breakpoints:

- **Left Rail (Navigation):** Fixed width `240px` (or `64px` icon-only collapsed). Houses primary workspace switchers, primary navigation tabs, and system settings.
- **Center Canvas (Work Engine):** Fluid width (flex 1), minimum `640px`. Houses the primary greeting, contextual tabs (`Genel Bakış`, `Aktivite`, `Atananlarım`), the quick-start hero banner, data tables, and two-column operational lists.
- **Right Rail (Dock / Insights):** Fixed width `300px` to `340px`. Dedicated to sprint burndown, quick actions, and the interactive mini calendar.

### Breakpoint Matrix
- **Desktop (>= 1280px):** 3-column layout active simultaneously.
- **Tablet / Small Laptop (1024px - 1279px):** Right rail collapses into an off-canvas drawer or shifts beneath the main operational grid.
- **Mobile (< 768px):** Left sidebar folds into a slide-over drawer; center canvas converts to a single-column stacked layout with `16px` outer margins.

## Elevation & Depth
Visual hierarchy is achieved through crisp 1px hairline borders (`border: 1px solid var(--border)`) and subtle surface tonal shifts rather than dramatic floating drop-shadows.

- **Level 0 (Base Canvas):** Flat, unbordered background.
- **Level 1 (Cards, Tables, Panels):** 1px border (`#E5E7EB` in light, `#27282B` in dark), zero or feather-light ambient diffusion (`0 1px 2px rgba(0, 0, 0, 0.03)`).
- **Level 2 (Dropdowns, Command Palette, Floating Menus):** High surface contrast with clean edge definition and focused ambient shadow (`0 8px 24px rgba(0, 0, 0, 0.08)` in light; `0 8px 24px rgba(0, 0, 0, 0.4)` in dark).
- **Quick Action Hero Banner:** Utilizes an ultra-subtle abstract metallic gradient mask (`linear-gradient(135deg, #F3F4F6 0%, #FFFFFF 100%)` in light mode; `linear-gradient(135deg, #1C1D20 0%, #111214 100%)` in dark mode) to create focal priority without chromatic visual noise.

## Shapes
The design system adopts a controlled, semi-technical soft geometry (`roundedness: 1`):
- **Base Components (Inputs, Buttons, Badges):** `4px` to `6px` radius (`rounded-sm` / `rounded-md`), communicating structure and precision.
- **Cards, Panels & Quick Start Banner:** `8px` to `10px` radius (`rounded-lg`), ensuring a clean modern frame without toy-like pill bubbles.
- **Status Indicators & Avatars:** Circular (`full` / `50%`) to visually differentiate identity and micro-status from rectilinear interaction surfaces.

## Components

### Buttons
- **Primary:** Solid jet black background (`#090A0B`) in light mode (solid `#F4F5F6` in dark mode) with inverted crisp typography, `6px` corner radius, `8px 14px` padding, and a subtle scale down (`0.98`) on active press.
- **Secondary / Ghost:** Transparent background with hairline border or pure hover fill (`#F4F5F6` in light, `#1C1D20` in dark), icon prefix/suffix aligned at `16px`.
- **Quick Action Grid Buttons:** Large full-width surface items with icon pill containers, subtle hover background fill, and right-aligned arrow triggers.

### Tables & List Items (Projelerin List)
- **Headers:** `11px` uppercase slate typography, border-bottom `1px solid var(--border)`, zero vertical padding waste.
- **Row Heights:** Fixed `48px` to `56px`, subtle `#FAFAFA` hover state in light mode (`#161719` in dark mode).
- **Progress Trackers:** Hairline progress tracks (`4px` height) with solid charcoal/slate progress fills and tabular percentage strings (`%38`, `12 / 28`).

### Navigation Rail Items
- **Active State:** Clean solid background fill (`#EAEBED` in light mode, `#222325` in dark mode), bold weight typography, high-contrast icon.
- **Inactive State:** Transparent background, muted slate typography, hover transition to soft metallic tint.

### Inputs & Command Bars
- **Search Command Bar:** Pill-box search input with embedded keyboard pill badge (`Ctrl K`), subtle hairline border, and muted placeholder text.

### Mini Calendar & Date Pickers
- **Day Grid:** Crisp `28px x 28px` circular interaction targets. Current day denoted by solid black fill and white text. Scheduled days indicated with miniature `3px` status dots beneath dates.



### dark theme

---
name: Titanium Engineering Precision
colors:
  surface: '#fbf9f9'
  surface-dim: '#dbdad9'
  surface-bright: '#fbf9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f3'
  surface-container: '#efeded'
  surface-container-high: '#e9e8e7'
  surface-container-highest: '#e3e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#45474a'
  inverse-surface: '#303031'
  inverse-on-surface: '#f2f0f0'
  outline: '#75777a'
  outline-variant: '#c5c6c9'
  surface-tint: '#5e5e5f'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1c1d'
  on-primary-container: '#848485'
  inverse-primary: '#c7c6c7'
  secondary: '#5a5f64'
  on-secondary: '#ffffff'
  secondary-container: '#dce0e6'
  on-secondary-container: '#5e6368'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1b1b1e'
  on-tertiary-container: '#848387'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e3e2e3'
  primary-fixed-dim: '#c7c6c7'
  on-primary-fixed: '#1b1c1d'
  on-primary-fixed-variant: '#464748'
  secondary-fixed: '#dee3e8'
  secondary-fixed-dim: '#c2c7cc'
  on-secondary-fixed: '#171c20'
  on-secondary-fixed-variant: '#42474c'
  tertiary-fixed: '#e4e1e5'
  tertiary-fixed-dim: '#c8c6c9'
  on-tertiary-fixed: '#1b1b1e'
  on-tertiary-fixed-variant: '#47464a'
  background: '#fbf9f9'
  on-background: '#1b1c1c'
  surface-variant: '#e3e2e2'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.025em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.015em
  title-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 0.75rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 1.75rem
  space-2xl: 2.5rem
---

## Brand & Style
This design system embodies the calculated precision, focus, and speed required by high-performance engineering and product management teams. The visual tone is strictly minimalist, architectural, and utilitarian—eliminating decorative fluff in favor of structural clarity, high scannability, and metallic neutral tones.

Rooted in modern technical minimalism with subtle Swiss grid influences, the UI evokes feelings of calm authority, frictionless productivity, and reliable data density. Every element serves an operational purpose: visual hierarchies rely on typography weighting, hairline borders, and intentional tonal contrast rather than saturated fills. The design feels like precision-milled aluminum hardware translated to software.

## Colors
The color palette strictly adheres to a monochromatic and metallic spectrum: true blacks, titanium whites, brushed silvers, cool slates, and carbon tones. There are absolutely no blue, purple, violet, or navy undertones across surfaces or accents.

### Light Mode Surfaces
- **Canvas Base:** `#FFFFFF` (Pure pristine white)
- **Subtle Surface / Sidebars:** `#F9FAFA` to `#F4F5F6` (Milled silver / cool technical gray)
- **Card & Elevated Surfaces:** `#FFFFFF`
- **Hairline Borders:** `#E5E7EB` (Subtle boundary definition)
- **Primary Text:** `#090A0B` (Jet black)
- **Secondary Text:** `#525866` (Slate graphite)
- **Muted Text / Meta:** `#8C93A0` (Silver pewter)

### Dark Mode Surfaces (Strict Neutral & Titanium)
- **Canvas Background:** `#090A0B` (Pure deep carbon)
- **Sidebar & Surface Base:** `#111214` (Onyx black)
- **Surface Elevation (Cards, Modals):** `#18191B` (Titanium slate)
- **Hover & Highlight Surfaces:** `#222326` (Brushed steel)
- **Hairline Borders:** `#27282B` (Low-contrast graphite)
- **Primary Text:** `#F4F5F6` (Pure titanium white)
- **Secondary Text:** `#A1A1AA` (Muted silver)
- **Muted Text / Placeholders:** `#52525B` (Charcoal gray)

### Status & Indicator Tokens
Status tokens provide micro-indicators (dots, subtle tags) without polluting the neutral canvas:
- **Active / Done:** `#10B981` (Crisp Emerald)
- **In Progress / Planning:** `#64748B` (Neutral Cool Slate) or `#2563EB` (Pure Technical Blue only for strict system links if mandated, otherwise default to high-contrast white/black state tags)
- **Warning / Medium Priority:** `#F59E0B` (Amber)
- **Critical / Urgent:** `#EF4444` (Pure Vermilion Red)

## Typography
Built around `Inter` with tabular numeral support (`font-variant-numeric: tabular-nums`) enabled across all metric and table views.

Hierarchy is enforced strictly via weight (`400` body, `500` functional labels, `600` headers) and size step-downs. Letter spacing is slightly negative on headlines for optical tightness, while labels and keyboard shortcuts (`Ctrl K`) remain neutral or slightly tracked for fast legibility at glance speed.

## Layout & Spacing
The system uses a fixed-dock 3-column architecture designed for 1440px+ displays, with graceful collapse across smaller breakpoints:

- **Left Rail (Navigation):** Fixed width `240px` (or `64px` icon-only collapsed). Houses primary workspace switchers, primary navigation tabs, and system settings.
- **Center Canvas (Work Engine):** Fluid width (flex 1), minimum `640px`. Houses the primary greeting, contextual tabs (`Genel Bakış`, `Aktivite`, `Atananlarım`), the quick-start hero banner, data tables, and two-column operational lists.
- **Right Rail (Dock / Insights):** Fixed width `300px` to `340px`. Dedicated to sprint burndown, quick actions, and the interactive mini calendar.

### Breakpoint Matrix
- **Desktop (>= 1280px):** 3-column layout active simultaneously.
- **Tablet / Small Laptop (1024px - 1279px):** Right rail collapses into an off-canvas drawer or shifts beneath the main operational grid.
- **Mobile (< 768px):** Left sidebar folds into a slide-over drawer; center canvas converts to a single-column stacked layout with `16px` outer margins.

## Elevation & Depth
Visual hierarchy is achieved through crisp 1px hairline borders (`border: 1px solid var(--border)`) and subtle surface tonal shifts rather than dramatic floating drop-shadows.

- **Level 0 (Base Canvas):** Flat, unbordered background.
- **Level 1 (Cards, Tables, Panels):** 1px border (`#E5E7EB` in light, `#27282B` in dark), zero or feather-light ambient diffusion (`0 1px 2px rgba(0, 0, 0, 0.03)`).
- **Level 2 (Dropdowns, Command Palette, Floating Menus):** High surface contrast with clean edge definition and focused ambient shadow (`0 8px 24px rgba(0, 0, 0, 0.08)` in light; `0 8px 24px rgba(0, 0, 0, 0.4)` in dark).
- **Quick Action Hero Banner:** Utilizes an ultra-subtle abstract metallic gradient mask (`linear-gradient(135deg, #F3F4F6 0%, #FFFFFF 100%)` in light mode; `linear-gradient(135deg, #1C1D20 0%, #111214 100%)` in dark mode) to create focal priority without chromatic visual noise.

## Shapes
The design system adopts a controlled, semi-technical soft geometry (`roundedness: 1`):
- **Base Components (Inputs, Buttons, Badges):** `4px` to `6px` radius (`rounded-sm` / `rounded-md`), communicating structure and precision.
- **Cards, Panels & Quick Start Banner:** `8px` to `10px` radius (`rounded-lg`), ensuring a clean modern frame without toy-like pill bubbles.
- **Status Indicators & Avatars:** Circular (`full` / `50%`) to visually differentiate identity and micro-status from rectilinear interaction surfaces.

## Components

### Buttons
- **Primary:** Solid jet black background (`#090A0B`) in light mode (solid `#F4F5F6` in dark mode) with inverted crisp typography, `6px` corner radius, `8px 14px` padding, and a subtle scale down (`0.98`) on active press.
- **Secondary / Ghost:** Transparent background with hairline border or pure hover fill (`#F4F5F6` in light, `#1C1D20` in dark), icon prefix/suffix aligned at `16px`.
- **Quick Action Grid Buttons:** Large full-width surface items with icon pill containers, subtle hover background fill, and right-aligned arrow triggers.

### Tables & List Items (Projelerin List)
- **Headers:** `11px` uppercase slate typography, border-bottom `1px solid var(--border)`, zero vertical padding waste.
- **Row Heights:** Fixed `48px` to `56px`, subtle `#FAFAFA` hover state in light mode (`#161719` in dark mode).
- **Progress Trackers:** Hairline progress tracks (`4px` height) with solid charcoal/slate progress fills and tabular percentage strings (`%38`, `12 / 28`).

### Navigation Rail Items
- **Active State:** Clean solid background fill (`#EAEBED` in light mode, `#222325` in dark mode), bold weight typography, high-contrast icon.
- **Inactive State:** Transparent background, muted slate typography, hover transition to soft metallic tint.

### Inputs & Command Bars
- **Search Command Bar:** Pill-box search input with embedded keyboard pill badge (`Ctrl K`), subtle hairline border, and muted placeholder text.

### Mini Calendar & Date Pickers
- **Day Grid:** Crisp `28px x 28px` circular interaction targets. Current day denoted by solid black fill and white text. Scheduled days indicated with miniature `3px` status dots beneath dates.