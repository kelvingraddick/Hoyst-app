# 🧠 HOYST Design System (MVP)

## 1. Brand identity

### Core concept
Hoyst is about:
- consistency over perfection
- momentum through small Commitments
- social accountability with low friction

The UI should feel:
- premium
- calm but energized
- minimal but expressive
- modern iOS-inspired
- tactile and slightly playful

---

## 2. Logo system

### Primary mark
- Circular “H” logo with multicolor ring  
- Inner fill: dark (charcoal/black)  
- Outer ring: gradient spectrum (green → orange → purple → blue)  

### Usage rules
- Use full-color logo on:
  - home screen  
  - onboarding  
  - branding moments  

- Use simplified/mono versions for:
  - small icons  
  - avatars  
  - tab bar if needed  

### App icon
- Rounded square  
- Dark background  
- Centered circular “H” with glow/gradient ring  

---

## 3. Color system

### Primary palette

| Name | Hex | Usage |
|------|-----|------|
| Hoyst Green | #3BAF4A | success, completion, streak health |
| Momentum Orange | #FF8A3D | CTA, energy, tap-in button |
| Focus Red | #E5483D | alerts, warnings |
| Ambient Purple | #8B6CFF | motion, accents |
| Hoyst Charcoal | #1F2933 | base dark UI |
| Soft Gray | #9CA3AF | secondary text |
| Pure White | #FFFFFF | light mode base |

---

### Semantic usage

- Done → Green  
- Pending → Gray  
- Missed → Orange  
- Alerts → Red  

---

### Gradient system

Primary gradient used across the app: Green → Orange → Purple → Blue

Used for:
- tap-in ring  
- avatars  
- highlights  
- streak indicators  

---

## 4. Light vs Dark mode

### Dark mode (primary)
- Background: near-black (#0B0B0C)  
- Cards: translucent dark glass  
- Text: white / soft gray  

### Light mode
- Background: white  
- Cards: frosted white with shadow  
- Same accent colors  

### Rule
Dark mode is the primary visual target.  
Light mode mirrors structure and behavior.

---

## 5. Glass (Liquid Glass) system

### Card style
- Semi-transparent background  
- Blur effect  
- Subtle border  
- Soft elevation shadow  

### Design tokens
- Border radius: 20–28  
- Padding: 16–20  
- Background opacity: 0.6–0.8  
- Border: rgba(255,255,255,0.08)  

### Platform guidance
- iOS: native blur views  
- Android: simulate using opacity + gradients + shadow  

---

## 6. Typography

### Style
- Clean, modern sans-serif  
- Prefer system font (SF Pro equivalent)  

### Hierarchy

| Type | Usage |
|------|------|
| Large Title | screen headers |
| Title | card headers |
| Body | default text |
| Caption | metadata |

### Tone
- short  
- friendly  
- human  

Example:
- "Tap in to keep your circle alive"  

---

## 7. Layout system

### Spacing scale

4, 8, 12, 16, 20, 24, 32

### Layout rules
- vertical stacking  
- generous padding  
- consistent spacing  
- avoid crowding  

---

## 8. Core UI components

### 8.1 Tap-In Button
- Primary CTA  
- Large and centered  
- Orange fill or gradient ring  
- Rounded pill shape  

States:
- default  
- pressed (scale down)  
- success (glow/confetti optional)  

---

### 8.2 Gradient Ring
Used for:
- main CTA  
- avatars  
- streak indicators  

Behavior:
- subtle animation  
- not distracting  

---

### 8.3 Circle Card
Contains:
- circle name  
- member count  
- progress bar  
- status  

Style:
- glass background  
- rounded corners  
- subtle shadow  

---

### 8.4 Progress bar
- rounded edges  
- green fill  
- smooth animation  

---

### 8.5 Avatar stack
- circular avatars  
- optional gradient ring  
- slight overlap  

---

### 8.6 Status indicators

| Status | Style |
|------|------|
| Done | green |
| Missed | orange |
| Rest | gray |

---

## 9. Navigation

### Bottom tab bar

Tabs:
- Home  
- Groups  
- Tap-In (center)  
- Insights  
- Profile  

### Style
- floating  
- glass background  
- rounded container  
- emphasized center action  

---

## 10. Key screens

### Home (Today)
- greeting  
- streak summary  
- Tap-In CTA  
- circle list  

### Circle detail
- progress  
- member status  
- chat  
- nudge actions

### Insights
- activity heatmap  
- completion percentages  
- trends  

---

## 11. Motion & animation

### Principles
- smooth  
- subtle  
- responsive  

### Use cases
- button press → scale  
- tap-in → glow  
- progress → animated fill  
- gradient ring → slow movement  

Avoid:
- aggressive or distracting animations  

---

## 12. Accessibility

- color is not the only indicator  
- support dynamic type  
- maintain contrast in light mode  

---

## 13. Design tokens (example)

```ts
export const colors = {
  primary: '#FF8A3D',
  success: '#3BAF4A',
  danger: '#E5483D',
  backgroundDark: '#0B0B0C',
  backgroundLight: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
}

export const gradients = {
  primaryRing: ['#3BAF4A', '#FF8A3D', '#8B6CFF', '#3BAF4A'],
}
```

## 14. Implementation priorities

When building UI:
	1.	Layout and spacing
	2.	Color system
	3.	Glass effect
	4.	Gradients
	5.	Motion

⸻

## 15. What to avoid
	•	heavy borders
	•	flat UI
	•	overly bright neon colors
	•	cluttered layouts
	•	enterprise-style components

⸻

## 16. Future enhancements
	•	streak flame animation
	•	weekly recap cards
	•	leaderboard visuals
	•	micro-interactions

⸻

Notes for developers (Codex)
	•	Use NativeWind for styling
	•	Build reusable components early
	•	Centralize theme and tokens
	•	Prefer composition over duplication
	•	Keep UI consistent across screens
	•	Prioritize shared code over platform-specific unless required
