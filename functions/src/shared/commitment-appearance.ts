/** Platform-neutral appearance catalog. Overrides never change category identity. */
export const palettes = {
  green: {
    label: 'Green',
    accent: '#10B967',
    background: '#E7F8EF',
    foreground: '#07763E',
    darkForeground: '#70E2A3',
  },
  purple: {
    label: 'Purple',
    accent: '#7A55FF',
    background: '#F0ECFF',
    foreground: '#5A1CFF',
    darkForeground: '#B8A5FF',
  },
  blue: {
    label: 'Blue',
    accent: '#18B9FF',
    background: '#E7F8FF',
    foreground: '#086CA8',
    darkForeground: '#8FE2FF',
  },
  orange: {
    label: 'Orange',
    accent: '#FF6D00',
    background: '#FFF0E6',
    foreground: '#A83A00',
    darkForeground: '#FFB36B',
  },
  gray: {
    label: 'Gray',
    accent: '#6C748C',
    background: '#EEF1F7',
    foreground: '#4D5873',
    darkForeground: '#B4BCD1',
  },
  pink: {
    label: 'Pink',
    accent: '#EC4899',
    background: '#FCE7F3',
    foreground: '#9D174D',
    darkForeground: '#F9A8D4',
  },
  teal: {
    label: 'Teal',
    accent: '#14B8A6',
    background: '#E6FAF5',
    foreground: '#0F766E',
    darkForeground: '#5EEAD4',
  },
  gold: {
    label: 'Yellow/gold',
    accent: '#EAB308',
    background: '#FFF7D6',
    foreground: '#854D0E',
    darkForeground: '#FDE047',
  },
  red: {
    label: 'Red',
    accent: '#FF3B30',
    background: '#FFECEB',
    foreground: '#B91C1C',
    darkForeground: '#FF9A94',
  },
} as const;
export type PaletteId = keyof typeof palettes;
export type CommitmentAppearance = {emoji?: string; palette?: PaletteId};
export const categories = [
  {label: 'Fitness', emoji: '🏃‍♂️', palette: 'orange'},
  {label: 'Wellness', emoji: '🌱', palette: 'green'},
  {label: 'Work', emoji: '💡', palette: 'blue'},
  {label: 'Learning', emoji: '📚', palette: 'teal'},
  {label: 'Creating', emoji: '🎨', palette: 'gold'},
  {label: 'Sobriety', emoji: '🧭', palette: 'purple'},
  {label: 'Relationships', emoji: '🤝', palette: 'pink'},
  {label: 'Home & Life', emoji: '🏠', palette: 'gray'},
  {label: 'Money', emoji: '💰', palette: 'green'},
  {label: 'General', emoji: '🌍', palette: 'gray'},
] as const;
export const legacyAliases: Record<string, string> = {
  'Deep Work': 'Work',
  Writing: 'Learning',
  Custom: 'General',
};
export const emojiGroups = [
  {
    label: 'Movement',
    emojis: ['🏋️', '💪', '🏃‍♂️', '🚶', '🚴', '🏊', '🧘', '🤸', '🥾', '⚽'],
  },
  {
    label: 'Wellbeing',
    emojis: ['🌱', '🌿', '🪴', '🌸', '❤️', '🧠', '😴', '🛌', '🥗', '💧'],
  },
  {
    label: 'Focus and Learning',
    emojis: ['💡', '🎯', '⏱️', '📚', '💻', '🧑‍💻', '🎧', '🔬', '🧮', '🗂️'],
  },
  {
    label: 'Recovery and Support',
    emojis: ['🧭', '🛡️', '⚓', '🌅', '🕊️', '🫶', '🤝', '🌈', '🔒', '🪷'],
  },
  {
    label: 'Writing and Creativity',
    emojis: ['✍️', '📝', '📖', '📓', '🖊️', '🎨', '🎵', '🎸', '🎹', '📷'],
  },
  {
    label: 'Everyday Life',
    emojis: ['🏠', '🧹', '🧺', '🍳', '🛒', '💰', '🐾', '🌍', '👥', '📞'],
  },
  {
    label: 'Goals and Milestones',
    emojis: ['🧩', '⭐', '✨', '🔥', '🚀', '🏆', '🏁', '✅', '📅', '🔔'],
  },
] as const;
export const selectableEmojis: readonly string[] = emojiGroups.flatMap(
  group => [...group.emojis],
);
const key = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
export function normalizeCategory(value: unknown): string {
  const name = typeof value === 'string' ? value : '';
  const alias = Object.entries(legacyAliases).find(
    ([old]) => key(old) === key(name),
  )?.[1];
  return (
    categories.find(category => key(category.label) === key(alias ?? name))
      ?.label ?? 'General'
  );
}
export function categorySearchNames(value: unknown): string[] {
  const canonical = normalizeCategory(value);
  return [
    canonical,
    ...Object.keys(legacyAliases).filter(
      old => legacyAliases[old] === canonical,
    ),
  ];
}
/** Defensive reader for historical data; request validation rejects invalid overrides. */
export function readAppearance(value: unknown): CommitmentAppearance {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const raw = value as Record<string, unknown>;
  return {
    ...(typeof raw.emoji === 'string' && selectableEmojis.includes(raw.emoji)
      ? {emoji: raw.emoji}
      : {}),
    ...(typeof raw.palette === 'string' &&
    Object.prototype.hasOwnProperty.call(palettes, raw.palette)
      ? {palette: raw.palette as PaletteId}
      : {}),
  };
}
export function resolveAppearance(
  category: unknown,
  appearance?: CommitmentAppearance,
) {
  const label = normalizeCategory(category);
  const defaults = categories.find(item => item.label === label)!;
  const overrides = readAppearance(appearance);
  const palette = overrides.palette ?? defaults.palette;
  return {
    ...palettes[palette],
    label,
    emoji: overrides.emoji ?? defaults.emoji,
    palette,
    darkBackground: palettes[palette].accent + '20',
  };
}

const emojiNames = [
  'Weight lifting',
  'Flexed arm',
  'Man running',
  'Walking',
  'Cycling',
  'Swimming',
  'Meditation',
  'Cartwheel',
  'Hiking boot',
  'Soccer ball',
  'Seedling',
  'Herb',
  'Potted plant',
  'Blossom',
  'Heart',
  'Brain',
  'Sleeping',
  'Bed',
  'Salad',
  'Water drop',
  'Light bulb',
  'Target',
  'Stopwatch',
  'Books',
  'Laptop',
  'Technologist',
  'Headphones',
  'Microscope',
  'Abacus',
  'File folders',
  'Compass',
  'Shield',
  'Anchor',
  'Sunrise',
  'Dove',
  'Heart hands',
  'Handshake',
  'Rainbow',
  'Lock',
  'Lotus',
  'Writing hand',
  'Memo',
  'Open book',
  'Notebook',
  'Pen',
  'Artist palette',
  'Music',
  'Guitar',
  'Piano',
  'Camera',
  'House',
  'Broom',
  'Laundry basket',
  'Cooking',
  'Shopping cart',
  'Money bag',
  'Paw prints',
  'Globe',
  'People',
  'Telephone',
  'Puzzle piece',
  'Star',
  'Sparkles',
  'Fire',
  'Rocket',
  'Trophy',
  'Finish flag',
  'Check mark',
  'Calendar',
  'Bell',
];
export function emojiAccessibilityLabel(emoji: string) {
  return emojiNames[selectableEmojis.indexOf(emoji)] ?? 'Commitment emoji';
}
