# Component guide

Import new components from `src/design/system`. Do not redirect legacy imports or re-export the new defaults through `HoystText`, `HoystButton`, `GlassPanel`, or `HoystScreen`.

## Public API and responsibilities

| Component | Main props and anatomy | States and ownership |
| --- | --- | --- |
| DesignSystemProvider | `scheme: light / dark / system`; local theme context | Caller passes existing preference. Does not write settings. Required for primitives. |
| DSText | `variant`, semantic `tone`, native Text props | Native scaling, wrapping; selective emphasis through nested text. |
| DSScreen | ScrollView props, `bottomClearance`, content style | Safe areas, keyboard handling, normal vertical flow. Use list-specific layouts for virtualized lists. |
| DSSectionHeading | `title`, optional `subtitle`, optional action | Heading semantics, four-point subtitle gap, wrapping title. |
| DSSurface | `kind: card / message / statistics / quiet`, optional category, `raised` | Opaque paired theme fill, role-specific radius/padding; elevation is explicit. |
| DSButton | `label`, `onPress`, `variant: primary / outline / quiet / danger`, optional category, `compact`, `busy`, `disabled`, optional `labelStyle` | Visible face inside full target. Busy disables duplicate native presses. Owning controller handles async eligibility, results and announcements. Label overrides require a documented screen-specific hierarchy; defaults are unchanged. |
| DSIconButton | `icon`, required `label`, native press props | Full target with compact visible icon; separate from sibling actions. |
| DSInput | Required `label`, optional `hint` or `error`, native TextInput props | Focus, placeholder, multiline, error, editable/read-only. Controller owns validation and submit flow. |
| DSListRow | `title`, optional `titleVariant`, subtitle, leading, action, `onPress`, accessibility label | 32-point leading column plus 12 gap. Main content and chevron open the row; direct action is a sibling. Use body variant for activity and title for commitments. |
| DSAvatar | `name`, optional image source, optional size and accessibility label | Edge-filling circular crop; initials if missing/failed; retries when source changes. No implied progress ring. |
| DSStatus | Written `label`, semantic tone, optional icon | Supplemental status, never color alone. |
| DSProgress | `completed`, `total`, required truthful `label` | Accessible count and proportional track. Bounds invalid display values; does not calculate domain totals. Zero is empty, not complete. |
| DSStatistics | Exactly two value/label/icon/tone items, optional navigation callback and accessible label | Equal columns, 16-point icons, 18/22 values, 11/15 captions, divider and approved shadow. Values wrap and container grows. |
| DSFeedback | `kind: empty / error / loading / success`, title, message, optional action | Quiet supporting layout. Keep last content while refreshing. Never replace unknown data with zero or success. |

`style` escape hatches remain native for composition, not permission to create inconsistent per-screen defaults. If a repeated override appears twice, evaluate a named role or variant and document it.

## Recipes and reuse

`DSCommitmentPreview` is a presentation recipe with externally controlled `expanded`, `onExpand`, `onDetails`, description/context/status, optional member image sources, and an optional action with a flexible label and primary/outline/quiet treatment. Compact main content and its chevron expand. Expanded non-action content and the northeast detail icon open details. Member images overlap at the 24-point avatar size and fall back to initials. Submitting an action never invokes either navigation callback. Completed and pending examples expand without inappropriate action buttons.

Do not move Home's daily-action calculations into the design system. A migrating screen continues to use its existing service/controller for eligibility, pending submissions, focus advancement, counts, timezone rollover and successful-Nudge persistence. Only provide an action prop when appropriate. Example local gallery booleans are fixtures, not production business logic.

`DSActivityPreview` composes a full-crop avatar, regular 14/20 message, timestamp, chevron and optional thumbnail. Row and thumbnail invoke the supplied destination callback. The owning screen retains event semantics, six-event preview limits where applicable, unread/read behavior and media navigation. The recipe sends no read receipts.

Reuse the existing BrandMark, CircleCategoryIcon and category lookup without changing their defaults. Keep specialized member rings, progress diagrams, achievement shields, story-share artwork and Hoy as existing domain components until their migration stage determines a scoped wrapper. Do not strip meaningful ring/badge state to make everything look like an activity avatar.

## Migration example

```tsx
import {
  DesignSystemProvider, DSScreen, DSSectionHeading, DSListRow, DSButton,
} from '../../../design/system';
import {useSettingsStore} from '../../../store/settings-store';

function CommitmentListPresentation({cards, openDetails, tapIn, isPending}) {
  const appearance = useSettingsStore(state => state.appearance);
  return (
    <DesignSystemProvider scheme={appearance}>
      <DSScreen>
        <DSSectionHeading title="Your commitments" />
        {cards.map(card => (
          <DSListRow
            key={card.id}
            title={card.title}
            onPress={() => openDetails(card.id)}
            action={card.canTapIn ? (
              <DSButton label="Tap In" compact variant="outline"
                busy={isPending(card.id)} onPress={() => tapIn(card)} />
            ) : undefined}
          />
        ))}
      </DSScreen>
    </DesignSystemProvider>
  );
}
```

This is composition pseudocode. Use the actual screen's existing typed controller and navigation contracts. Do not introduce `card.canTapIn` into the data schema just to match the example.

## Gallery coverage

- Foundations: every type role, semantic swatches, category pairs and surface styles.
- Controls: full/compact/outline/destructive/disabled/busy actions; labeled forms with validation; multiline/read-only input; independent row/action targets; full-crop image and initials.
- Patterns: two-column statistics, mixed Tap In/Nudge local progress, expandable actionable/completed/pending commitments, compact activity and thumbnail access.
- States: initial loading, retry/error resolution, empty discovery, incomplete profile, guest entry, zero/partial/complete progress, pending membership, quiet activity empty state and retained-content refresh explanation.

The gallery intentionally does not replicate authentication screens, backend subscriptions or all Hoy animations. Those are preserved specialist/domain flows, with future route-level verification in the migration inventory.

Changing page, preview width or OS text scale remounts the gallery examples and resets their local fixtures. This ensures native text is measured afresh for each comparison. It is a gallery-only behavior, not a production screen state policy.
