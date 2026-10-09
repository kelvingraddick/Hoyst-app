import {
  categories,
  palettes,
  selectableEmojis,
  normalizeCategory,
  resolveAppearance,
  readAppearance,
  categorySearchNames,
} from '../src/shared/commitment-appearance';
import {
  buildCircleEditDraft,
  buildCreateCirclePayload,
  createInitialCircleDraft,
} from '../src/features/create-circle/services/create-circle-draft';

test('catalog has ten canonical defaults, seventy complete emoji sequences and nine palettes', () => {
  expect(
    categories.map(item => [item.label, item.emoji, item.palette]),
  ).toEqual([
    ['Fitness', '🏃‍♂️', 'orange'],
    ['Wellness', '🌱', 'green'],
    ['Work', '💡', 'blue'],
    ['Learning', '📚', 'teal'],
    ['Creating', '🎨', 'gold'],
    ['Sobriety', '🧭', 'purple'],
    ['Relationships', '🤝', 'pink'],
    ['Home & Life', '🏠', 'gray'],
    ['Money', '💰', 'green'],
    ['General', '🌍', 'gray'],
  ]);
  expect(new Set(selectableEmojis).size).toBe(70);
  expect(Object.keys(palettes)).toHaveLength(9);
  for (const category of categories) {
    expect(selectableEmojis).toContain(category.emoji);
    expect(resolveAppearance(category.label).label).toBe(category.label);
    expect(resolveAppearance(category.label).palette).toBe(category.palette);
  }
});
test('legacy aliases and unknown historical categories resolve safely', () => {
  expect(normalizeCategory('Deep Work')).toBe('Work');
  expect(normalizeCategory('Writing')).toBe('Learning');
  expect(normalizeCategory('Custom')).toBe('General');
  expect(normalizeCategory('legacy unknown')).toBe('General');
  expect(categorySearchNames('Writing')).toEqual(['Learning', 'Writing']);
});
test('each field inherits independently and reset resumes inheritance', () => {
  expect(resolveAppearance('Fitness', {emoji: '🌱'})).toMatchObject({
    emoji: '🌱',
    palette: 'orange',
  });
  expect(resolveAppearance('Work', {emoji: '🌱'})).toMatchObject({
    emoji: '🌱',
    palette: 'blue',
  });
  expect(resolveAppearance('Work', {palette: 'pink'})).toMatchObject({
    emoji: '💡',
    palette: 'pink',
  });
  expect(resolveAppearance('Work', {})).toMatchObject({
    emoji: '💡',
    palette: 'blue',
  });
  expect(readAppearance({emoji: 'arbitrary', palette: '__proto__'})).toEqual(
    {},
  );
});
test('edit drafts preserve explicit overrides and serialize resets', () => {
  const draft = {
    ...createInitialCircleDraft('UTC'),
    title: 'Test',
    commitment: 'Focus',
    appearance: {emoji: '🌱', palette: 'red' as const},
  };
  const reopened = buildCircleEditDraft({
    ...buildCreateCirclePayload(draft),
    category: 'Deep Work',
  });
  expect(reopened.category).toBe('Work');
  expect(reopened.appearance).toEqual(draft.appearance);
  expect(
    buildCreateCirclePayload({...reopened, appearance: {}}).appearance,
  ).toEqual({});
});
