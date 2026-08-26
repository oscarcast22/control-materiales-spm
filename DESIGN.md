---
name: Kinetic Minimal
colors:
  surface: '#f6fafe'
  surface-dim: '#d6dade'
  surface-bright: '#f6fafe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f4f8'
  surface-container: '#eaeef2'
  surface-container-high: '#e4e9ed'
  surface-container-highest: '#dfe3e7'
  on-surface: '#171c1f'
  on-surface-variant: '#474651'
  inverse-surface: '#2c3134'
  inverse-on-surface: '#edf1f5'
  outline: '#777682'
  outline-variant: '#c8c5d3'
  surface-tint: '#5655a8'
  primary: '#060046'
  on-primary: '#ffffff'
  primary-container: '#1a146b'
  on-primary-container: '#8482d9'
  inverse-primary: '#c3c0ff'
  secondary: '#00677f'
  on-secondary: '#ffffff'
  secondary-container: '#00d2ff'
  on-secondary-container: '#00566a'
  tertiary: '#00130a'
  on-tertiary: '#ffffff'
  tertiary-container: '#002b1b'
  on-tertiary-container: '#009f6e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#100563'
  on-primary-fixed-variant: '#3e3c8f'
  secondary-fixed: '#b6ebff'
  secondary-fixed-dim: '#47d6ff'
  on-secondary-fixed: '#001f28'
  on-secondary-fixed-variant: '#004e60'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f6fafe'
  on-background: '#171c1f'
  surface-variant: '#dfe3e7'
  deep-indigo: '#1a146b'
  electric-blue: '#00d2ff'
  slate-gray: '#474651'
  surface-border: '#e2e8f0'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  gutter-md: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1440px
---

## Brand & Style

The design system is a high-performance, professional UI framework that balances executive authority with modern agility. It targets professional SaaS environments, fintech, and enterprise tools where clarity and precision are non-negotiable.

The visual direction is **Minimalism with Kinetic Depth**. Unlike traditional flat design which can feel "dead," this system uses subtle, multi-layered shadows and a high-contrast palette to create a sense of focused energy. It avoids the visual noise of neomorphism and the heavy blurring of glassmorphism in favor of structural integrity, generous whitespace, and sharp functional boundaries. The emotional response is one of "calm efficiency"—a tool that feels expensive, reliable, and exceptionally fast.

**Key Principles:**
- **Intentional Flatness:** Surfaces are primary flat planes; depth is an functional indicator, not a decorative texture.
- **High Contrast:** Strong delineation between primary brand colors and neutral backgrounds to ensure accessibility and rapid information scanning.
- **Micro-Precision:** 1px borders and specific corner radii create a "machined" feel.

## Colors

The color strategy is anchored by **Deep Indigo**, providing a sophisticated and trustworthy foundation. The neutral scale is biased toward **Slate Grays**, avoiding warm or muddy tones to keep the interface feeling clean and crisp.

**Application Strategy:**
- **Primary:** Deep Indigo is used for primary brand moments, core navigation, and high-priority action buttons.
- **Secondary:** Electric Blue acts as a functional accent for focus states, progress indicators, and interactive highlights.
- **Neutral Scale:** Backgrounds use a very light slate (#f8fafc to #f1f5f9). Text should primarily use the Deep Indigo at high contrast for headings and Slate Gray for secondary information.
- **Borders:** A consistent 1px border (#e2e8f0) is used to define containers where shadows are too heavy or where distinct data boundaries are required.

## Typography

This design system uses **Inter** across all levels to maximize legibility in dense administrative data, forms, and tables while preserving a precise contemporary tone.

**Usage Rules:**
- **Tight Kerning:** High-level headers use negative letter-spacing to feel more compact and modern.
- **Labeling:** The `label-caps` style is essential for metadata, table headers, and small descriptive text to ensure it is not confused with interactive body text.
- **Scale:** On mobile, large headlines are aggressively scaled down to maintain visual hierarchy without forcing excessive scrolling.
- **Weight:** Avoid light weights; use Regular (400) for body and Semi-Bold (600) or Bold (700+) for structural elements to maintain the "high contrast" requirement.

## Layout & Spacing

The layout philosophy follows a **Fixed Grid** on desktop and a **Fluid Grid** on mobile, grounded in an 8px spacing rhythm.

- **Grid Model:** 12-column grid for desktop with 24px gutters. Elements should align strictly to these columns to maintain the "Flat/Minimalist" structured feel.
- **Desktop (1200px+):** Centered content area with a 1440px max-width and 32px outer margins.
- **Tablet (768px - 1199px):** 8-column fluid grid with 24px margins.
- **Mobile (<768px):** 4-column fluid grid with 16px margins.
- **Spacing Rhythm:** All internal padding and external margins must be multiples of 8px. Use 24px (Unit 3) as the default internal padding for cards and containers.

## Elevation & Depth

To maintain the "flat" requirement while providing visual hierarchy, the system uses **Multi-layered Soft Shadows** instead of gradients or bevels.

- **Resting State (Flat):** Most components (Inputs, Chips, Lists) sit directly on the surface with a 1px #e2e8f0 border and no shadow.
- **Surface Level 1 (Cards):** Uses a very subtle, dual-stack shadow to indicate elevation: 
  *Shadow 1: 0px 1px 2px rgba(0,0,0,0.05)*
  *Shadow 2: 0px 4px 12px rgba(26, 20, 107, 0.04)*
- **Surface Level 2 (Modals/Popovers):** A more pronounced but still diffused shadow:
  *Shadow 1: 0px 10px 25px -5px rgba(26, 20, 107, 0.08)*
- **Interactive Depth:** On hover, primary buttons do not grow; instead, their shadow deepens slightly to simulate being "raised" toward the user.

## Shapes

The shape language is modern and approachable without becoming "bubbly."

- **Primary Radius:** 12px-16px is used for large containers like cards and modals.
- **Component Radius:** 8px for buttons, inputs, and selection controls. This provides a clean, professional "clicky" feel.
- **Consistency:** Every corner must be rounded. Sharp 0px corners are forbidden to maintain the design system's friendly-yet-professional tone.

## Components

### Buttons
- **Primary:** Solid Deep Indigo background with white text. 8px corner radius. No gradient. On hover, apply a 10% white overlay.
- **Secondary:** 1px #e2e8f0 border with Deep Indigo text. 
- **Ghost:** No border or background; uses Deep Indigo or Electric Blue text.

### Input Fields
- **Default:** 1px #e2e8f0 border, white background, 8px radius.
- **Focus:** 1px Electric Blue border with a 3px soft outer glow (#00d2ff at 10% opacity). Labels use the `label-md` style above the field.

### Cards
- **Structure:** White background, 16px radius, 1px #e2e8f0 border. 
- **Elevation:** Use the "Surface Level 1" soft shadow.

### Chips & Badges
- **Status:** Pill-shaped (rounded-full). Use a 10% opacity version of the status color (e.g., 10% Green for success) with a 100% opacity bold label inside.

### Lists & Data Tables
- **Rows:** 1px bottom-border only. No alternating row colors. On hover, the entire row takes a 2% Deep Indigo tint to indicate interactivity.
- **Headers:** Use `label-caps` for all column headers to maximize data-density and clarity.

### Checkboxes & Radios
- **Active State:** Solid Deep Indigo fill with a white checkmark/dot. Use an 8px radius for checkboxes (softened square) to match the button language.
