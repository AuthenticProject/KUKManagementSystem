# KUK BRAND DESIGN SYSTEM SPECIFICATION (v3.1.0)
## Official Brand Identity & Enterprise Design Token Standards
### Authority Reference: Official Brand Kit (`Rebranding KUK.pdf` / CV Karya Utama Kreasi)

---

## 1. BRAND FOUNDATION & PHILOSOPHY

The **KUK Management System** serves as the unified operational backbone for **CV Karya Utama Kreasi (KUK)** and its subsidiary operational units:
1. **TB KUK La Tansa** — Building materials store, architectural glass cutting, and hardware trading.
2. **KUK Palen** — Retail goods, household sundries, and operational supplies.
3. **KUK Bangunan** — Construction contracting, architectural projects, and material distribution.
4. **Kantor Pusat KUK** — Centralized executive administration, governance, and financial consolidation.

The user interface reflects an authentic, institutional, enterprise-grade identity. It departs completely from generic SaaS admin dashboards in favor of a bespoke visual aesthetic rooted in the official brand authority document (`Rebranding KUK.pdf`).

---

## 2. OFFICIAL COLOR PALETTE

The color system enforces strict hexadecimal values derived directly from the official branding package:

| Role | Color Name | Hex Code | Purpose & Application Rules |
|---|---|---|---|
| **Primary Brand** | Deep Maroon | `#540000` | Primary brand surface, institutional headers, sidebar brand container, primary action buttons, active navigation indicators. |
| **Brand Dark** | Dark Maroon | `#3B0000` | Pressed button states, active sidebar item backgrounds, dark card gradients, contrast text on light accents. |
| **Primary Accent** | Gold | `#FFCC00` | Visual highlights, active selection indicators, card top accent bars, high-contrast badges with dark text (`#540000`). Never used as small text on white backgrounds. |
| **Secondary Accent**| Dark Gold | `#996414` | High-contrast text on light surfaces, icons on white backgrounds, secondary borders, restrained decorative rules. |
| **Critical Alert** | Red / Destructive | `#FF0000` | Destructive actions (rejection, deactivation, termination), critical warning badges, overdue indicator dots. |
| **Surface Base** | Pure White | `#FFFFFF` | Main card surfaces, modal content containers, data table bodies, text on Deep Maroon backgrounds. |
| **Surface Accent** | Light Grey | `#E5E5E5` | Structural borders, subtle dividers, inactive tab outlines, empty-state boundaries. |
| **Canvas Background**| Slate White | `#F8F9FA` | Main application viewport canvas background, subtle table alternating stripes, input read-only fills. |

### Color Accessibility & Contrast Governance
- **Gold Contrast Rule:** `#FFCC00` must strictly be paired with dark typography (`#540000` or `#1A1A1A`). Small text using `#FFCC00` on white is strictly prohibited.
- **Dark Gold Rule:** When gold-themed typography or icons appear on light backgrounds (`#FFFFFF` or `#F8F9FA`), the accessible Dark Gold token (`#996414`) is required.
- **Focus Rings:** Interactive elements receive a high-visibility focus ring styled as `focus:ring-2 focus:ring-[#FFCC00] focus:ring-offset-2`.

---

## 3. TYPOGRAPHY SYSTEM

The typography hierarchy pairs two authentic typeface families:

### 3.1 Display Typeface: `Revans`
- **Source Files:** `public/brand/fonts/FontsFree-Net-Revans-Bold.ttf`, `Revans-Medium.otf`
- **Application:** Display headings (`h1`, `h2`), page headers, card titles, executive banners, kiosk hero headings.
- **CSS Utility:** `.font-display`, `font-family: 'Revans', serif`
- **Style Characteristics:** High-impact, elegant serif curves, commanding authority, geometric alignment.

### 3.2 UI & Text Typeface: `Plus Jakarta Sans`
- **Source Files:** `public/brand/fonts/PlusJakartaSans-VariableFont_wght.ttf` (weights 400, 500, 600, 700, 800)
- **Application:** Body text, navigation labels, data tables, buttons, form inputs, tabular numbers, badges.
- **CSS Utility:** `font-family: 'Plus Jakarta Sans', sans-serif`
- **Style Characteristics:** Highly legible geometric sans-serif optimized for enterprise screens and dense operational data.

### 3.3 Numeric & Monospace Standards
- **Monospace Stack:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
- **Application:** License plates, NIK, employee codes, transaction reference numbers, financial figures, currency formatting.

---

## 4. LOGO & UNIT ASSET SYSTEM

The brand identity specifies dedicated visual marks for each operational entity, served from `public/brand/logos/`:

```
public/brand/
├── logos/
│   ├── kul-horizontal.png   # TB KUK La Tansa (Full Lockup)
│   ├── kul-vertical.png     # TB KUK La Tansa (Vertical Lockup)
│   ├── kul-emblem.png       # TB KUK La Tansa (Shield Emblem)
│   ├── kup-horizontal.png   # KUK Palen (Full Lockup)
│   ├── kup-vertical.png     # KUK Palen (Vertical Lockup)
│   ├── kup-emblem.png       # KUK Palen (Shield Emblem)
│   ├── kub-horizontal.png   # KUK Bangunan (Full Lockup)
│   ├── kub-vertical.png     # KUK Bangunan (Vertical Lockup)
│   ├── kub-emblem.png       # KUK Bangunan (Shield Emblem)
│   ├── kuk-emblem.png       # Central KUK Corporate Emblem
│   └── kuk-horizontal.png   # Central KUK Corporate Lockup
├── patterns/
│   ├── pattern-dark.png     # Geometric maroon pattern for sidebar
│   └── pattern-light.png    # Subtle watermarked background
└── fonts/
    ├── PlusJakartaSans-VariableFont_wght.ttf
    └── FontsFree-Net-Revans-Bold.ttf
```

### Dynamic Unit Resolution: `src/utils/brandAssets.ts`
The system dynamically resolves the active brand asset package based on user context:
- **TB KUK La Tansa:** Renders `kul-horizontal.png` with deep maroon primary theme and construction glass accent.
- **KUK Palen:** Renders `kup-horizontal.png` with retail sundries subtitle and unit badge.
- **KUK Bangunan:** Renders `kub-horizontal.png` for contracting and materials scope.
- **Pusat / Executive Consolidation:** Renders corporate lockup with distinctive institutional `PUSAT` badge.

---

## 5. UI COMPONENT ARCHITECTURE (`src/components/ui/`)

### 5.1 Button (`src/components/ui/Button.tsx`)
Standardized variants:
- `primary`: `bg-[#540000] hover:bg-[#3B0000] text-white shadow-xs`
- `gold`: `bg-[#FFCC00] hover:bg-[#E5B800] text-[#540000] font-bold`
- `secondary`: `bg-white hover:bg-[#F8F9FA] text-[#1A1A1A] border border-[#E5E5E5]`
- `outline`: `bg-transparent hover:bg-[#540000]/5 text-[#540000] border border-[#540000]`
- `destructive`: `bg-[#FF0000] hover:bg-[#CC0000] text-white`
- `ghost`: `bg-transparent hover:bg-gray-100 text-gray-700`

### 5.2 Badge (`src/components/ui/Badge.tsx`)
Semantic indicator badges with optional status dots:
- `brand`: `bg-[#540000]/10 text-[#540000] border border-[#540000]/20`
- `gold`: `bg-[#FFF9D6] text-[#996414] border border-[#FFE066]`
- `success`: `bg-emerald-50 text-emerald-800 border border-emerald-200`
- `warning`: `bg-amber-50 text-amber-800 border border-amber-200`
- `danger`: `bg-red-50 text-red-800 border border-red-200`
- `neutral`: `bg-gray-50 text-gray-700 border border-gray-200`

### 5.3 Card & MetricCard (`src/components/ui/Card.tsx`, `MetricCard.tsx`)
- Container: Crisp `#FFFFFF` surface with `border border-[#E5E5E5]` and `rounded-2xl` geometry.
- Optional Gold Header Bar: `h-1 bg-[#FFCC00]` top indicator for high-priority operational summaries.
- Trend Indicators: Emerald up-trend badges and red warning alerts.

### 5.4 PageHeader (`src/components/ui/PageHeader.tsx`)
- Hierarchy: Breadcrumbs (`text-xs text-gray-500`) > Module Title in `font-display` (`Revans`) with icon slot > Unit badge > Action buttons slot.
- Divider: Elegant hairline accent rule (`kuk-gold-line`).

### 5.5 In-App ConfirmModal (`src/components/common/ConfirmModal.tsx`)
- Replaces raw browser `window.confirm()` with accessible, brand-styled dialogs.
- Features: Deep maroon backdrop blur, Revans header, descriptive consequences advisory, and loading spinner state.

### 5.6 Print Header & Letterhead (`src/components/common/PrintHeader.tsx`)
- Standardized institutional letterhead with official CV KARYA UTAMA KREASI Kop Surat.
- Authentic transparent unit logo on the left, corporate address and legal registration in the center, document reference number and date on the right.
- Separated from document content by a 2px `#540000` rule accented with a 1px `#FFCC00` sub-rule.

---

## 6. RESPONSIVE BREAKPOINT SPECIFICATION

| Breakpoint Tier | Target Viewport | Screen Class | Layout Strategy |
|---|---|---|---|
| **Mobile Small** | `360x800` | Android Standard | Single column cards, hidden desktop sidebar, hamburger slide-over drawer, horizontally scrollable data tables. |
| **Mobile Standard**| `390x844` | iPhone 14/15/16 | Full-width cards with 16px gutters, sticky kiosk action footers, stacked metric blocks. |
| **Tablet** | `768x1024` | iPad Mini / Air | 2-column KPI grids, compact sidebar icon-only or collapsible menu, responsive filter bars. |
| **Small Desktop** | `1024x768` | POS / Kiosk Terminals| Permanent deep maroon sidebar, multi-column forms, full data tables with paginated footers. |
| **Standard Laptop**| `1366x768` | Operational Terminals| 4-column metric dashboards, full split-screen detail views, comprehensive action toolbars. |
| **Full HD** | `1920x1080` | Executive Desktops | Centered 1600px container, maximum dense data visualization, expanded side-by-side transaction audits. |

---

## 7. AUDIT EVIDENCE INDEX

Visual proof of compliance is permanently stored in:
- `docs/screenshots/rebranding/*-desktop.png` (16 desktop screens at 1366x768)
- `docs/screenshots/rebranding/*-mobile.png` (16 mobile screens at 390x844)
- `docs/screenshots/rebranding/dashboard-palen-desktop.png` (Unit switching evidence)
