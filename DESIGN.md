---
name: "SD Proxy"
description: "A compact image generation control room for expert creators."
colors:
  forest-ink: "#0b1410"
  deep-panel: "#12201a"
  raised-panel: "#182a23"
  moss-border: "#2c4b3e"
  mist-text: "#deeee2"
  sage-muted: "#8eb6a1"
  studio-green: "#4fd18b"
  mint-signal: "#8ce0b9"
  ember-danger: "#e0626f"
  amber-warning: "#efb366"
  success-mint: "#5fd3a6"
typography:
  display:
    fontFamily: "Avenir Next, Segoe UI, Helvetica Neue, Trebuchet MS, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.02em"
  headline:
    fontFamily: "Avenir Next, Segoe UI, Helvetica Neue, Trebuchet MS, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: "Avenir Next, Segoe UI, Helvetica Neue, Trebuchet MS, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Avenir Next, Segoe UI, Helvetica Neue, Trebuchet MS, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "normal"
  label:
    fontFamily: "Avenir Next, Segoe UI, Helvetica Neue, Trebuchet MS, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  pill: "999px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "24px"
components:
  button-base:
    backgroundColor: "{colors.raised-panel}"
    textColor: "{colors.mint-signal}"
    rounded: "{rounded.sm}"
    padding: "7px 12px"
    typography: "{typography.label}"
  button-primary:
    backgroundColor: "{colors.studio-green}"
    textColor: "{colors.forest-ink}"
    rounded: "{rounded.sm}"
    padding: "7px 12px"
    typography: "{typography.label}"
  button-danger:
    backgroundColor: "{colors.raised-panel}"
    textColor: "{colors.ember-danger}"
    rounded: "{rounded.sm}"
    padding: "7px 12px"
    typography: "{typography.label}"
  tab-active:
    backgroundColor: "{colors.studio-green}"
    textColor: "{colors.forest-ink}"
    rounded: "{rounded.pill}"
    padding: "7px 12px"
    typography: "{typography.label}"
  input-field:
    backgroundColor: "{colors.forest-ink}"
    textColor: "{colors.mist-text}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
    typography: "{typography.body}"
  card-panel:
    backgroundColor: "{colors.deep-panel}"
    textColor: "{colors.mist-text}"
    rounded: "{rounded.md}"
    padding: "12px"
  chip-tag:
    backgroundColor: "{colors.raised-panel}"
    textColor: "{colors.mist-text}"
    rounded: "{rounded.pill}"
    padding: "3px 7px"
    typography: "{typography.label}"
---

# Design System: SD Proxy

## 1. Overview

**Creative North Star: "The Creator's Control Room"**

SD Proxy should feel like a compact creative command surface: dense, exact, and quiet enough for long generation sessions. The interface is built for power creators who move between prompt writing, backend selection, queue work, history recall, gallery curation, logs, and API settings without wanting the product to slow them down.

The visual system is restrained by default, using tinted dark surfaces, small type, crisp borders, pill navigation, and one clear accent color for current selection and primary action. It can support many themes, but the core behavior stays the same: controls close to the work, image output at the center, and enough structure that provider complexity reads as manageable.

It explicitly rejects the generic SaaS dashboard, toy image app, crypto/neon tool, corporate admin panel, and maximalist visual playground called out in PRODUCT.md. Any future screen should pass a simple test: would an expert creator trust this during a two-hour session, or would the styling get in the way?

**Key Characteristics:**
- Dense, stable control surfaces with compact spacing and predictable grids.
- Restrained accent usage for primary actions, active tabs, focus, and state.
- Themeable semantic tokens, not one-off colors per component.
- Lightweight elevation: borders and tonal layers first, shadows only for overlay or depth.
- Creative but precise copy, with labels that stay close to the task.

## 2. Colors

The default palette is a forest-studio control room: near-black green surfaces, moss borders, mist text, and a clear mint-green signal color.

### Primary

- **Studio Green** (`studio-green`): The primary action and selection signal. Use it for active tabs, primary buttons, focus borders, badges, progress fills, and drop-target activation.
- **Mint Signal** (`mint-signal`): The secondary accent for headings and primary hover states. Use it to lift hierarchy without adding another hue family.

### Secondary

- **Ember Danger** (`ember-danger`): Destructive actions, invalid states, and serious errors. Pair with text or icons, never rely on red alone.
- **Amber Warning** (`amber-warning`): Cost estimates, weighted prompt tags, warnings, and states that need attention without blocking the flow.
- **Success Mint** (`success-mint`): Positive completion and success states. Keep it near the existing green family so status stays calm.

### Neutral

- **Forest Ink** (`forest-ink`): Page background and form field background. This is the deepest working surface.
- **Deep Panel** (`deep-panel`): Main card and overlay surface.
- **Raised Panel** (`raised-panel`): Buttons, nested provider sections, image cards, queue rows, and secondary containers.
- **Moss Border** (`moss-border`): The primary structural stroke for cards, fields, tabs, images, and toolbars.
- **Mist Text** (`mist-text`): Primary readable text.
- **Sage Muted** (`sage-muted`): Labels, secondary metadata, hints, and inactive navigation.

### Named Rules

**The Signal Rarity Rule.** Studio Green is a task signal, not decoration. If more than one tenth of a screen is green, the screen is probably shouting.

**The Theme Token Rule.** New colors must enter through the semantic theme variables first. Components should consume `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, and status tokens.

**The No Neon Rule.** Do not introduce high-saturation cyan, magenta, purple, or crypto-style glow treatments. The existing theme list may include developer palettes, but SD Proxy's own visual language stays minimal and controlled.

## 3. Typography

**Display Font:** Avenir Next, with Segoe UI, Helvetica Neue, Trebuchet MS, and sans-serif fallbacks.  
**Body Font:** Avenir Next, with the same fallback stack.  
**Label/Mono Font:** UI labels use the main stack. Code and syntax helpers use `ui-monospace`, `SFMono-Regular`, `Menlo`, `Monaco`, `Consolas`, `Liberation Mono`, and `Courier New`.

**Character:** The type system is compact and product-native. It uses one sans stack across headings, labels, buttons, and body text so the workbench feels coherent under high control density.

### Hierarchy

- **Display** (700, 20px, 1.2 line-height): App title, top-level identity, and rare page-level anchors.
- **Headline** (700, 14px, 1.25 line-height): Panel headers, collapsible section labels, provider blocks, and feature groups.
- **Title** (600, 13px, 1.3 line-height): Subsection titles, status headings, and compact card titles.
- **Body** (400, 13px, 1.35 line-height): Inputs, textarea content, table-like rows, dense settings, and default UI text.
- **Label** (600, 11px, 0.02em letter spacing): Field labels, badges, compact button text, metadata, and count indicators.

### Named Rules

**The Dense Legibility Rule.** Keep type small, but never vague. Labels must remain close to controls, visible focus states must survive density, and explanatory prose should stay under 75 characters per line when it becomes paragraph text.

**The One Family Rule.** Do not add decorative display fonts to product UI labels, buttons, fields, logs, or settings. Creative energy belongs in workflow quality and image output, not in ornamental type.

## 4. Elevation

SD Proxy uses tonal layering and borders as the main depth system. Shadows are present, but they are small and structural: light contact shadows for panels, stronger shadows for modal images, autocomplete, context menus, toasts, and overlays that must sit above dense controls.

### Shadow Vocabulary

- **Panel Contact** (`0 1px 2px rgba(0,0,0,.25)`): Default card, fixed toolbar, and compact surface separation.
- **Overlay Lift** (`0 12px 30px rgba(0,0,0,.35)`): Modal imagery, autocomplete menus, context menus, and toasts.

### Named Rules

**The Border First Rule.** Reach for border, surface, and accent state before shadow. A dense creative tool should feel organized, not floaty.

**The Overlay Shadow Rule.** Strong shadows are reserved for layers that must cover or interrupt the workspace: modal images, menus, toasts, and autocomplete.

## 5. Components

### Buttons

Buttons are compact, tactile, and stateful without becoming decorative.

- **Shape:** Gently squared controls with a small radius (6px). Icon-only and compact variants use the same vocabulary.
- **Primary:** Studio Green background with Forest Ink text, 7px 12px padding, 12px type, and 700 weight. Use for generation, processing, build, and confirm actions.
- **Hover / Focus:** Hover shifts to Mint Signal. Focus uses a 2px accent glow. Active state moves down by 1px.
- **Secondary:** Raised Panel background, accent-tinted border, Mint Signal text, and the same radius.
- **Danger:** Raised Panel mixed with danger color, danger border, and danger text. Hover increases danger tint and returns text to Mist Text.

### Chips

Chips are compact prompt and organization markers, not decorative pills.

- **Style:** Raised Panel mixed with Studio Green, pill radius, 3px 7px padding, and 11px type.
- **State:** Hover becomes Studio Green with Forest Ink text. Weighted tags use Amber Warning tint to communicate prompt weight.

### Cards / Containers

Cards are utilitarian grouping surfaces for dense controls.

- **Corner Style:** Medium radius (10px) for cards and toolbars. Small radius (6px) for image cards and fields.
- **Background:** A subtle Deep Panel gradient mixed with Studio Green at the top edge, then Deep Panel.
- **Shadow Strategy:** Panel Contact only. Nested provider panels should stay calm and practical.
- **Border:** Moss Border, or a border mixed with the accent when the component needs affordance.
- **Internal Padding:** 12px for cards, 6px to 8px for image cards and rows, 20px for drop zones.

### Inputs / Fields

Inputs are dark, bounded, and designed for repeated editing.

- **Style:** Forest Ink background, Moss Border stroke, Mist Text content, 8px 10px padding, and 6px radius.
- **Focus:** Border shifts to Studio Green with the shared 2px focus ring.
- **Error / Disabled:** Error states should combine Ember Danger border or text with explicit copy. Disabled states use reduced opacity and keep layout stable.

### Navigation

Navigation uses two rows of pill tabs so general and local workflows stay visible.

- **Default:** Raised Panel, accent-mixed border, Sage Muted text, 12px type, and 999px radius.
- **Hover:** Surface mixes toward the accent and text shifts to Mist Text.
- **Active:** Studio Green fill, Forest Ink text, accent border, and 700 weight.
- **Mobile:** Tabs become horizontally scrollable under 900px. Keep labels on one line and preserve hit targets.

### Image Cards

Image cards are inspection surfaces first.

- **Style:** Raised Panel, 6px padding, 6px radius, and an accent-mixed border.
- **Images:** Full-width thumbnails with a 4px radius and a quiet border.
- **Actions:** Button row appears below the image. Prompt overlay appears on hover with a dark scrim.

### Drop Zones

Drop zones are generous compared with the rest of the UI because they handle file placement.

- **Style:** 2px dashed Moss Border, 10px radius, 20px padding, muted text, and a transparent panel fill.
- **Drag State:** Border changes to Studio Green and background mixes Raised Panel with the accent.

## 6. Do's and Don'ts

### Do:

- **Do** keep expert controls close. Prefer compact sections, visible settings, and fast tab access over broad empty panels.
- **Do** use the semantic theme tokens for new UI. New components should inherit from the current theme instead of hard-coding a palette.
- **Do** communicate state through text, icons, and shape in addition to color.
- **Do** preserve reduced-motion behavior. Any new animation must be disabled by the existing `prefers-reduced-motion` rule.
- **Do** keep cards shallow. A card may contain controls, but avoid stacking card inside card unless it represents a real provider-specific subpanel.
- **Do** keep generated images, prompts, backend differences, and history more prominent than decorative chrome.

### Don't:

- **Don't** make SD Proxy feel like a generic SaaS dashboard.
- **Don't** make SD Proxy feel like a toy image app.
- **Don't** make SD Proxy feel like a crypto/neon tool.
- **Don't** make SD Proxy feel like a corporate admin panel.
- **Don't** make SD Proxy feel maximalist or non-minimalist.
- **Don't** add decorative metrics, vague marketing copy, huge empty panels, loud novelty styling, or interface chrome that competes with prompts, generated images, settings, logs, and history.
- **Don't** use gradient text, side-stripe borders, glassmorphism as default, or identical card grids as filler.
- **Don't** use full-saturation accents on inactive states. Accent means action, selection, focus, or status.
