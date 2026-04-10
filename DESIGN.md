# Design System Strategy: High-Energy Accountability

## 1. Overview & Creative North Star
**Creative North Star: The Neon Precisionist**

This design system is not a utility; it is a high-performance engine for human consistency. Moving away from the "standard" SaaS aesthetic, we embrace a "Neon Precisionist" philosophy. This approach pairs the mathematical rigor of minimalist layouts with the kinetic energy of gaming interfaces. 

We break the traditional grid through **intentional layering and depth transitions**. Elements shouldn't just sit on a screen; they should feel like they are floating in a three-dimensional void. We use high-contrast typography scales and overlapping glass textures to move beyond the "template" look, creating an editorial feel that treats a user's habits as premium content.

---

## 2. Colors & Surface Logic

Our palette is anchored in a deep, nocturnal foundation (`#0e0e0e`) to allow our primary vibrant purple (`#ba9eff`) and secondary neon green (`#6bff8f`) to radiate.

### The "No-Line" Rule
**Borders are forbidden for sectioning.** To define boundaries, we use background color shifts and tonal transitions. A section is defined by moving from `surface` to `surface-container-low`. Using a 1px line is a failure of tonal management.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the Material tiers to define importance:
- **Level 0 (Base):** `surface` (#0e0e0e) – The void.
- **Level 1 (Sections):** `surface-container-low` (#131313) – Subtle differentiation.
- **Level 2 (Cards):** `surface-container` (#1a1a1a) – Elevated focus.
- **Level 3 (Interactive Elements):** `surface-container-highest` (#262626) – Immediate priority.

### The "Glass & Gradient" Rule
To achieve a premium, custom feel, use **Glassmorphism** for floating controllers and navigation bars.
- **Recipe:** Apply `surface-container` at 60% opacity with a 20px backdrop-blur. 
- **Signature Textures:** For main Action Buttons or Hero Progress Rings, use a linear gradient from `primary` (#ba9eff) to `primary-dim` (#8455ef) at a 135° angle. This adds "soul" and prevents the flatness common in budget apps.

---

## 3. Typography: Editorial Authority

We use a dual-typeface system to balance personality with readability.

*   **Display & Headlines (Plus Jakarta Sans):** These are your "shout" moments. Use `display-lg` and `headline-md` with tight tracking (-2%) and bold weights. This font provides a modern, geometric energy that feels custom-built for a gamified experience.
*   **Body & Labels (Inter):** The "workhorse." Inter is used for all functional data. It provides a neutral, high-legibility contrast to the expressive headlines.

**Hierarchy Strategy:** 
Use `display-sm` for user greeting and primary stats. Use `label-md` for metadata, but always in uppercase with +5% letter spacing to maintain a premium, architectural feel.

---

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are too "dirty" for this aesthetic. We achieve lift through light and transparency.

- **The Layering Principle:** Instead of a shadow, place a `surface-container-high` card on top of a `surface` background. The shift from `#0e0e0e` to `#20201f` provides a cleaner, more sophisticated separation.
- **Ambient Glows:** When an element must "float" (like a Tap-In button), use an **Ambient Glow** rather than a shadow. Apply a blur of 32px using the `primary` color at 15% opacity.
- **The "Ghost Border" Fallback:** If a container requires more definition against a complex background, use a 1px stroke of `outline-variant` (#484847) at **15% opacity**. It should be felt, not seen.
- **Avatar Status Rings:** User avatars must utilize a 2px `secondary` (#6bff8f) ring to indicate completion. This ring should have a subtle outer glow (4px blur) of the same color to simulate a "lit" neon tube.

---

## 5. Components

### Buttons & Inputs
*   **Primary Action (Tap-In):** Use the `xl` (1.5rem) roundedness. Apply the Primary-to-Primary-Dim gradient. Text should be `title-md` in `on-primary-fixed` (black) for maximum punch.
*   **Input Fields:** Use `surface-container-highest`. No borders. The active state is indicated by a 1px "Ghost Border" at 40% opacity using the `secondary` neon green.

### Progress Rings & Gamification
*   **The Progress Ring:** Use a stroke width of 8px. The background track is `surface-variant`. The active track is a gradient from `secondary` to `primary`.
*   **Status Chips:** Small, pill-shaped (`full` roundedness). Use `surface-container-high` with `label-sm` text.

### Cards & Lists
*   **Card Anatomy:** Use `lg` (1rem) corner radius. Forbid dividers.
*   **Separation:** Separate list items using the **Spacing Scale** (e.g., 12px vertical gap) rather than lines. If a list is dense, use alternating background tints between `surface-container-low` and `surface-container-lowest`.

### Navigation Bar
*   Floating "Glass" island. Use `surface-container` at 70% opacity, 24px backdrop blur, and `xl` corner radius. Icons should use `on-surface-variant` for inactive and `secondary` for active states.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical layouts (e.g., a large stat on the left, a small progress ring on the right) to create visual interest.
*   **Do** use "Breathing Room." If you think there’s enough padding, add 8px more.
*   **Do** lean into the neon green (`secondary`) for "Success" and "Action" states—it is the heartbeat of the app.

### Don't
*   **Don't** use 100% opaque borders or pure black (#000000) for anything other than the `surface-container-lowest`.
*   **Don't** use standard Material Design blue or red. Use `tertiary` (#ffb148) for warnings and `error` (#ff6e84) for critical alerts.
*   **Don't** use sharp corners. Everything must feel "soft-touch" via the `lg` and `xl` roundedness tokens.