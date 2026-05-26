# Hoyst Design System

## 1. North Star

Hoyst should feel like a premium accountability app built around personal reliability, shared commitments, and visible momentum. The new visual system follows the 2026 restyle references in `design-guide/hoyst-restyle-2026/`:

- `01-home.png`
- `02-nav.png`
- `03-center-ring.png`
- `04-tap-in.png`
- `05-capsule.png`
- `06-circles.png`
- `07-momentum.png`

The design target is dual fidelity. Light mode and dark mode should feel like the same product, with the same spacing, glass depth, spectrum rings, iconography, and information hierarchy.

## 2. Product Language

- **User:** Hoyst account owner.
- **Member:** User participating in a Circle.
- **Companion:** Mutual relationship, used only when the product is describing true social accountability.
- **Circle:** Shared commitment space.
- **Commitment:** Specific action a Circle is built around.
- **Opportunity:** A scheduled chance to Tap In for a Commitment.
- **Tap In:** The user records that they showed up for an available opportunity.
- **Momentum:** Personal reliability score based on completed available opportunities.
- **Circle Progression:** Collective progress for the current Circle opportunity.

Momentum rewards consistency, not volume. The formula is:

```text
Momentum = completed available opportunities / available opportunities * 100
```

Status levels:

- `0%`: Getting Started
- `1%` to `30%`: Building Momentum
- `31%` to `70%`: Strong Momentum
- `71%` to `100%`: Peak Momentum

## 3. Color

### Brand Spectrum

The Hoyst ring is the signature asset. Use the same spectrum everywhere a ring appears:

- Green: `#00C853`
- Yellow: `#FFC400`
- Orange: `#FF6D00`
- Pink: `#FF1EA8`
- Purple: `#5A1CFF`
- Blue: `#18B9FF`

### Light Theme

- App background: `#F7F8FB`
- Primary surface: `rgba(255,255,255,0.92)`
- Strong surface: `#FFFFFF`
- Muted surface: `#EEF1F7`
- Text: `#070B1A`
- Muted text: `#4D5873`
- Subtle text: `#6C748C`
- Hairline border: `rgba(16,24,40,0.08)`
- Accent: `#4B16F4`

### Dark Theme

- App background: `#090B12`
- Primary surface: `rgba(18,20,30,0.88)`
- Strong surface: `#151827`
- Muted surface: `#222638`
- Text: `#F8FAFF`
- Muted text: `#B4BCD1`
- Subtle text: `#8D96AD`
- Hairline border: `rgba(255,255,255,0.10)`
- Accent: `#8C6CFF`

### Semantic Tones

- Success: `#10B967`
- Warning: `#FF6D00`
- Danger: `#FF3B30`
- Info: `#2F7CFF`
- Purple: `#5A1CFF`

## 4. Typography

Use Benzin SemiBold for major display moments if licensed font files are available in the app. If the font is not present, fall back to the platform system font while preserving the same token names.

- `hero`: 52 px, line height 56, weight 800
- `display`: 42 px, line height 46, weight 800
- `headline`: 32 px, line height 36, weight 800
- `title`: 24 px, line height 29, weight 800
- `subtitle`: 20 px, line height 25, weight 800
- `body`: 16 px, line height 22, weight 500
- `bodyStrong`: 16 px, line height 21, weight 800
- `caption`: 13 px, line height 17, weight 600
- `tiny`: 11 px, line height 13, weight 700
- `button`: 17 px, line height 21, weight 800
- `navLabel`: 12 px, line height 14, weight 800

Letter spacing should be `0` unless a tiny uppercase label needs positive spacing. Do not use negative letter spacing.

## 5. Spacing And Shape

Baseline mobile width is 390 to 393 pt.

- Screen horizontal padding: 20
- Section gap: 24
- Card gap: 14 to 16
- Card padding: 18 to 20
- Compact row gap: 8 to 12
- Minimum touch target: 44
- Floating nav height: 86
- Center Tap In nav mark: 72 to 78

Radii:

- Small controls: 16
- Cards: 24
- Large glass panels: 28
- Floating nav: 32
- Pills: 999

## 6. Glass And Depth

Glass is structural, not decorative.

- Use frosted surfaces for cards, panels, nav, and capsule buttons.
- Use a faint border only to separate glass from the page.
- Use shadow and soft glow together for floating elements.
- The center Tap In action should overlap the nav pill vertically and glow from the bottom more than the top.
- Avoid heavy opaque dividers. Use spacing and soft surface changes first.

## 7. Core Components

### Spectrum Ring

Use for Tap In, avatar status, Momentum markers, and large decorative marks. The ring must stay circular, preserve the brand spectrum, and support small, medium, large, and nav sizes.

### Momentum Capsule Button

Primary Tap In action. It is a frosted pill with a spectrum border or glow, left ring icon, and bold label. The icon owns the left activation zone and the label supports the action.

Minimum height is 48 for compact cards and 54 for primary actions.

### Floating Navigation

Tabs are:

1. Home
2. Circles
3. Tap In
4. Momentum
5. Profile

All non-center tabs show icon plus label. Active state uses purple. Inactive state uses muted text. The center Tap In ring is larger, overlaps the nav pill, and has a soft spectrum glow.

### Metric Panel

Use for stats like Momentum, completed, ready, streak, overview counts, and score. It should align icon, number, label, and support text consistently, using equal columns where comparison matters.

### Opportunity Card

Use for Today's Tap In, Circles, and Needs Attention lists. It includes:

- Circle icon
- Title
- Status chip
- Companion count
- Circle progress
- Avatar stack
- Capsule Tap In button
- Optional chevron

### Achievement Card

Use for Momentum milestones. Cards should be compact, visually scannable, and show locked or completed states without relying on color alone.

## 8. Screen Direction

### Home

Home should show:

- Logo, notification action, and avatar
- Human greeting
- Momentum summary card
- Today's Tap In preview
- Active Circles
- Recent Momentum
- Floating navigation

### Tap In

Tap In should show:

- Back control
- Completed and Ready stats
- Waiting commitments section
- Opportunity cards
- Completed Today confirmation

### Circles

Circles should show:

- Overview metrics
- Needs Attention
- All Circles
- Companion Updates
- New Circle
- Discovery entry points formerly owned by Explore

### Momentum

Momentum should show:

- Current streak
- Momentum score
- Today's Win
- Achievements
- Reward progress

### Profile

Profile keeps settings and account behavior but should use the same glass, spacing, icon, and typography rules.

## 9. Accessibility

- Touch targets must be at least 44 px.
- Do not communicate status by color alone.
- Dynamic text must not overlap buttons, avatars, or neighboring content.
- Reduce or disable decorative animation when reduced motion is active.
- Light and dark themes must pass contrast for primary text and actions.

## 10. Implementation Order

1. Tokens and shared components.
2. Navigation.
3. Momentum opportunity data model.
4. Home, Tap In, Circles, Momentum, Profile.
5. Visual QA in light and dark mode.
