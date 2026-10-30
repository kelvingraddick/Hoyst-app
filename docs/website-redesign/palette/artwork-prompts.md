# Palette asset provenance and edit prompts

Tool: built-in `image_gen.imagegen`, edit mode, `transparent_background: true`. Each call referenced its corresponding existing production WebP. These are the complete prompts used. The supplied app Hoy artwork was reused directly and was not regenerated.

## circle-connections

Input: `hosting/assets/circle-connections.webp` before the palette change.

Original output: `../artwork/circle-connections-blue-sage.png`.

Production asset: `hosting/assets/circle-connections.webp`.

> Edit target: the attached connected-avatar illustration. Keep EXACTLY the same four people, facial identity, expressions, photographic portrait crops, circular arrangement, central dumbbell, relative sizes and generous transparent spacing. This is a precise palette edit only. Replace the large purple ring with calm Hoyst blue (#2F6FED) and a little soft green (#10B967), recolor the central purple dumbbell blue/cyan (#18B9FF), and change the top woman's lavender portrait background to pale sage (#EDF5EF). Keep the yellow, pale sky-blue, and peach portrait backgrounds. Recolor most purple decoration strokes to blue or green; retain at most ONE tiny purple decorative mark. No new people, no rearrangement, no text, no additional objects. Same polished photographic collage style and clean smooth edges. Output genuinely transparent background, landscape canvas around 4:3 like the target, no checkerboard, no opaque white rectangle. This will replace an existing website asset.

## tap-in-together

Input: `hosting/assets/tap-in-together.webp` before the palette change.

Original output: `../artwork/tap-in-together-blue-sage.png`.

Production asset: `hosting/assets/tap-in-together.webp`.

> Edit target: the attached three-person encouragement collage. Precise palette edit only: preserve EXACTLY the same three people, facial identities, expressions, crops, positions, sizes, encouragement bubbles and green checkmark. Keep text EXACTLY 'Workout done!' and 'Nice work!' in the same handwritten font and placement. Change the lavender Workout done bubble to pale sage (#EDF5EF), with dark green (#07763E) lettering. Keep Nice work pale blue with readable blue text. Change purple connecting lines to Hoyst blue (#2F6FED) and soft green (#10B967). Change most purple decorative dashes to blue/cyan/green, leaving at most ONE tiny purple accent. Keep yellow, sage, and pale-blue portrait circles. Do not change layout, add people, or add objects. Same polished photographic collage style, clean smooth edges, wide landscape composition exactly like target. Output genuine transparency, no checkerboard or opaque rectangle. This replaces an existing website asset.

## shared-goal

Input: `hosting/assets/shared-goal.webp` before the palette change.

Original output: `../artwork/shared-goal-blue-sage.png`.

Production asset: `hosting/assets/shared-goal.webp`.

> Edit target: attached three-person shared-goal collage. Palette edit only; preserve EXACTLY the same three people, facial identities, photographic crops, arrangement, relative sizes, mountain and flag composition, connections, and encouragement bubble. Keep text EXACTLY "We've got this." in the same handwritten lettering and position. Recolor mountain and flag from purple to Hoyst blue (#2F6FED) with a small warm gold (#FFC400) flag tip. Change purple connection lines to blue and green (#10B967). Change lavender encouragement bubble to pale warm peach (#FFEADF) with readable dark blue (#1059AD) lettering. Change right portrait's purple background to pale sky blue. Keep yellow and sage portrait circles. Replace most purple decoration dashes with blue, green or warm orange, retaining at most ONE tiny purple mark. No new objects/people and no rearrangement. Maintain polished photographic collage style and clean transparency, same wide landscape composition. Output genuine transparent background, no checkerboard and no opaque rectangle. This replaces an existing website asset.

## Optimization

Generated alpha is retained. Only empty alpha bounds are trimmed; images are proportionately fit to the existing asset canvas dimensions, then encoded as quality-94 WebP. The original PNG outputs remain available alongside the earlier artwork. Colored Hoy PNGs are encoded as WebP without color changes; golden Hoy is proportionately reduced to 384 × 343 pixels.
