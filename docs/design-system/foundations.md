# Foundations

Use the exports in `src/design/system/tokens.ts`. These defaults are opt-in and do not replace `src/design/tokens/*`.

## Typography

Native system font: SF Pro via `System` on iOS; Android default system family by leaving `fontFamily` unset. Use platform rendering, not a bundled approximation of the generated mockup. All ordinary text supports native scaling and natural wrapping.

| Token | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| screenTitle | 24 / 29 | 600 | A screen's primary title |
| heading | 18 / 23 | 600 | Section heading |
| statistic | 18 / 22 | 600 | Compact summary values |
| title | 16 / 21 | 600 | Commitment and navigable row title |
| message | 15 / 20 | 400 | Short guidance, with selective 700 emphasis |
| body | 14 / 20 | 400 | Descriptions, activity messages, inputs |
| action | 13 / 18 | 600 | Button and form label |
| secondary | 12 / 16 | 400 | Timestamps and supporting context |
| category | 11 / 15 | 600 | Short category label |
| statCaption | 11 / 15 | 400 | Caption below a compact value |

Use sentence case for headings and controls. Category labels can remain uppercase; do not apply uppercase or tracking globally. Avoid blanket bold text. Use `DSText` nesting for selective emphasis. No forced truncation on guidance, commitment titles or forms. Truncation needs a deliberate detail destination and an accessible full label.

Screen-title 24/29 and input styling are new defaults for future screens, not claims about Home. A larger achievement, metric, chart label, or welcome treatment requires a named exception with its purpose, sizes, scaling behavior and both-theme screenshots. Do not invent a second generic type scale for each screen.

## Layout

Measurements are points on iOS and dp for layout on Android. Text sizes scale through React Native's native text behavior.

| Role | Default |
| --- | --- |
| Spacing scale | 0, 4, 8, 12, 16, 20, 24, 32, 40 |
| Page gutter | 22, an intentional exception to the four-point scale |
| Major section gap | 16 |
| Card padding / internal group gap | 12 |
| Heading to supporting text | 4 |
| Message padding | 16 |
| Category backplate / compact avatar | 32 / 24 |
| Ordinary control icon / statistics icon | 20 / 16 |
| Compact button face / full button and input | minimum 32 / 48 high |
| Interactive target | minimum 44 iOS, 48 Android |

Use natural flow, not negative margins or translated links. Row leading columns are 32 wide, followed by a 12 gap, so list links and row titles align. Actions are sibling targets. At narrow widths they can wrap while the title keeps usable space. Containers use minimum heights, not fixed text-sized heights.

`DSScreen` provides safe-area handling, keyboard avoidance on iOS, a scrolling content stack, and extra `bottomClearance` when a floating control obscures content. Supply the actual obstruction height from the containing navigator. Avoid double-counting native safe areas. Android forms must retain the application's keyboard resize behavior. Large virtualized lists should use FlatList with these layout tokens, not a FlatList nested in DSScreen's ScrollView.

## Color roles

| Semantic role | Light | Dark |
| --- | --- | --- |
| canvas | #FAFAF7 | #121212 |
| surface | #FFFFFF | #242428 |
| mutedSurface | #F1F1EE | #202024 |
| text | #070B1A | #FFFFFF |
| muted | #4D5873 | #B4BCD1 |
| action foreground | #086CA8 | #8FE2FF |
| action fill / onAction | #086CA8 / #FFFFFF | #086CA8 / #FFFFFF |
| progress | #5A1CFF | #B89FFF |
| success | #07763E | #4BE083 |
| warning | #A83A00 | #FF8A3D |
| danger | #D21F18 | #FF6B63 |
| border / inputBorder | #D8D8DD / #6C748C | #46464F / #8D96AD |
| track | #E9E9ED | #303036 |

Blue `#18B9FF` remains a saturated brand/current-day mark. Purple represents momentum/progress. Do not use bright decorative accents as small body text merely because they are brand colors. The new semantic text roles have automated contrast checks against their supported surfaces. This does not authorize recoloring Home.

Category roles preserve the existing mapping: Deep Work and Writing use blue, Fitness green, Sobriety orange, Wellness and Custom purple, General neutral. Continue using `getCircleCategoryVisual` and `CircleCategoryIcon`; do not duplicate category classification. The system defines paired opaque category backgrounds and readable foregrounds for each theme. A category action uses its paired foreground, with white text on light-mode fills and charcoal text on dark-mode pastel fills.

Pass the existing appearance preference (`light`, `dark`, `system`) to `DesignSystemProvider` at each migrated boundary. The provider resolves system appearance without writing settings. A gallery override must not escape its provider.

## Surfaces, icons and motion

- Statistics: canvas-colored surface, radius 14, horizontal padding 12, vertical padding 6, minimum height 56. Two equal columns, a 32-high divider, 12-point clearance on either side. Icons align vertically with values. Captions start at the value's left edge.
- Message: radius 18, padding 16; selective raised treatment. A speech tail is a specialist Home pattern, not included on ordinary cards.
- General reusable card: radius 20, padding 12. Home's focused-card radius 18 and horizontal padding 18 are recorded as reference exceptions.
- Input: radius 12, visible boundary; focused and invalid states use semantic colors and written feedback.
- Soft shadow: offset `(0, 6)`, opacity `0.1`, radius `12`, Android elevation `3`; light color `#92723E`, dark `#000000`. Do not clip the shadow with an ancestor's `overflow: hidden`. Native Android shadow rendering is not pixel-identical to iOS.
- Use existing Lucide icons and Hoyst artwork. Ordinary icons are 20, statistics 16, backplates 32. Icon-only controls have explicit labels. Decorative graphics are hidden from accessibility.
- Activity photos fill their circular image crop. Initials handle missing or failed images. Do not remove meaningful membership/progress rings from specialized member components.
- New primitives have no repeating or celebratory animations. Press feedback uses opacity. Future motion must respect Reduce Motion, avoid essential information conveyed only by motion, and preserve existing one-shot celebration behavior.

## Accessibility contract

Maintain 4.5:1 contrast for ordinary text and 3:1 for essential non-text boundaries. Color is supplemental to text, iconography and state labels. Buttons expose disabled/busy state, input errors are associated through labels/hints, progress announces counts and meaning, and async outcomes require platform-appropriate announcements from the owning controller.

Use native font scaling without globally capping it. Home's capped seven-day labels are a documented specialist exception, not a default for other content. Check row wrapping, large values, long translated labels, keyboard focus, logical VoiceOver/TalkBack order, back/dismiss behavior and bottom clearance. `accessibilityLiveRegion` helps Android updates; iOS controllers must explicitly announce async results where needed.
