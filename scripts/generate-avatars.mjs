import {execFileSync} from 'node:child_process';
import {mkdirSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const avatarRoot = path.join(projectRoot, 'src', 'assets', 'avatars');
const sourceRoot = path.join(avatarRoot, 'source');
const shouldRasterize = process.argv.includes('--rasterize');

const avatars = [
  {
    slug: 'kelvin',
    backgroundStart: '#264B3E',
    backgroundEnd: '#173028',
    accent: '#F3B57B',
    shirt: '#6FCF97',
    skin: '#B9784A',
    hair: '#1C1716',
    hairStyle: 'curl',
    accessory: 'glasses',
  },
  {
    slug: 'ava',
    backgroundStart: '#6F3A32',
    backgroundEnd: '#2B1817',
    accent: '#F4BF95',
    shirt: '#F1A574',
    skin: '#F1C7AE',
    hair: '#8B4630',
    hairStyle: 'bob',
    accessory: 'earrings',
  },
  {
    slug: 'marcus',
    backgroundStart: '#1C3559',
    backgroundEnd: '#0E1827',
    accent: '#6FB0FF',
    shirt: '#4C7DF0',
    skin: '#5F3B2B',
    hair: '#13100F',
    hairStyle: 'fade',
    accessory: 'none',
  },
  {
    slug: 'theo',
    backgroundStart: '#7D5630',
    backgroundEnd: '#2E1E15',
    accent: '#FFD27A',
    shirt: '#F7B14A',
    skin: '#F4D2B2',
    hair: '#B88237',
    hairStyle: 'wave',
    accessory: 'none',
  },
  {
    slug: 'nina',
    backgroundStart: '#184642',
    backgroundEnd: '#0D2422',
    accent: '#74E1D1',
    shirt: '#45B8AA',
    skin: '#C68D67',
    hair: '#221A19',
    hairStyle: 'bun',
    accessory: 'none',
  },
  {
    slug: 'rory',
    backgroundStart: '#5D4230',
    backgroundEnd: '#241914',
    accent: '#F2C6A2',
    shirt: '#B37A55',
    skin: '#F1D4BE',
    hair: '#9C4F2F',
    hairStyle: 'fade',
    accessory: 'beard',
  },
  {
    slug: 'lia',
    backgroundStart: '#553B62',
    backgroundEnd: '#231724',
    accent: '#D5A6FF',
    shirt: '#A46FE0',
    skin: '#D8A07E',
    hair: '#1C171C',
    hairStyle: 'long',
    accessory: 'none',
  },
  {
    slug: 'noah',
    backgroundStart: '#37513A',
    backgroundEnd: '#162318',
    accent: '#A3D98B',
    shirt: '#7AA95B',
    skin: '#C89363',
    hair: '#181514',
    hairStyle: 'fade',
    accessory: 'none',
  },
  {
    slug: 'zoe',
    backgroundStart: '#6A2445',
    backgroundEnd: '#2B1020',
    accent: '#FF9BBE',
    shirt: '#EF6D8F',
    skin: '#7A4A36',
    hair: '#151112',
    hairStyle: 'braids',
    accessory: 'earrings',
  },
  {
    slug: 'june',
    backgroundStart: '#34405C',
    backgroundEnd: '#171A28',
    accent: '#AAB8FF',
    shirt: '#7E8EE8',
    skin: '#EFC8B1',
    hair: '#161417',
    hairStyle: 'long',
    accessory: 'none',
  },
  {
    slug: 'mia',
    backgroundStart: '#555139',
    backgroundEnd: '#242116',
    accent: '#E3DB92',
    shirt: '#B8A94E',
    skin: '#C7926C',
    hair: '#36251D',
    hairStyle: 'pony',
    accessory: 'none',
  },
  {
    slug: 'kai',
    backgroundStart: '#29424C',
    backgroundEnd: '#111B1F',
    accent: '#86CBE0',
    shirt: '#4B7F91',
    skin: '#8C5E42',
    hair: '#171313',
    hairStyle: 'buzz',
    accessory: 'none',
  },
];

mkdirSync(sourceRoot, {recursive: true});

for (const avatar of avatars) {
  const svgPath = path.join(sourceRoot, `${avatar.slug}.svg`);

  writeFileSync(svgPath, createSvg(avatar));
}

if (shouldRasterize) {
  for (const avatar of avatars) {
    const svgPath = path.join(sourceRoot, `${avatar.slug}.svg`);
    const pngPath = path.join(avatarRoot, `${avatar.slug}.png`);
    const quickLookPath = path.join(avatarRoot, `${avatar.slug}.svg.png`);

    rmSync(quickLookPath, {force: true});
    rmSync(pngPath, {force: true});

    execFileSync('qlmanage', ['-t', '-s', '384', '-o', avatarRoot, svgPath], {
      stdio: 'ignore',
    });
    renameSync(quickLookPath, pngPath);
  }
}

console.log(
  shouldRasterize
    ? `Generated ${avatars.length} avatar SVGs and PNGs in ${avatarRoot}`
    : `Generated ${avatars.length} avatar SVGs in ${sourceRoot}`,
);

function createSvg(avatar) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="384" height="384" viewBox="0 0 384 384" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-${
      avatar.slug
    }" x1="48" y1="28" x2="336" y2="356" gradientUnits="userSpaceOnUse">
      <stop stop-color="${avatar.backgroundStart}"/>
      <stop offset="1" stop-color="${avatar.backgroundEnd}"/>
    </linearGradient>
    <linearGradient id="shirt-${
      avatar.slug
    }" x1="192" y1="220" x2="192" y2="370" gradientUnits="userSpaceOnUse">
      <stop stop-color="${mixHex(avatar.shirt, '#FFFFFF', 0.12)}"/>
      <stop offset="1" stop-color="${mixHex(avatar.shirt, '#000000', 0.16)}"/>
    </linearGradient>
  </defs>
  <rect width="384" height="384" rx="72" fill="url(#bg-${avatar.slug})"/>
  <circle cx="300" cy="88" r="76" fill="${setAlpha(avatar.accent, 0.18)}"/>
  <circle cx="74" cy="302" r="56" fill="${setAlpha(avatar.accent, 0.12)}"/>
  <path d="M76 310C110 254 152 226 192 226C234 226 278 254 308 310V384H76V310Z" fill="url(#shirt-${
    avatar.slug
  })"/>
  <ellipse cx="192" cy="332" rx="138" ry="86" fill="${setAlpha(
    avatar.shirt,
    0.48,
  )}"/>
  ${hairBack(avatar)}
  <rect x="169" y="188" width="46" height="46" rx="20" fill="${mixHex(
    avatar.skin,
    '#000000',
    0.06,
  )}"/>
  <ellipse cx="192" cy="150" rx="76" ry="84" fill="${avatar.skin}"/>
  <ellipse cx="163" cy="154" rx="7" ry="8" fill="#231D1A"/>
  <ellipse cx="221" cy="154" rx="7" ry="8" fill="#231D1A"/>
  <path d="M191 160V184" stroke="${mixHex(
    avatar.skin,
    '#6B4C3A',
    0.45,
  )}" stroke-width="5" stroke-linecap="round"/>
  <path d="M168 199C178 208 205 208 216 199" stroke="${mixHex(
    avatar.skin,
    '#6B3A32',
    0.78,
  )}" stroke-width="6" stroke-linecap="round"/>
  <ellipse cx="143" cy="176" rx="13" ry="7" fill="${setAlpha(
    mixHex(avatar.skin, '#FF7A93', 0.3),
    0.36,
  )}"/>
  <ellipse cx="241" cy="176" rx="13" ry="7" fill="${setAlpha(
    mixHex(avatar.skin, '#FF7A93', 0.3),
    0.36,
  )}"/>
  ${hairFront(avatar)}
  ${accessory(avatar)}
</svg>
`;
}

function hairBack(avatar) {
  switch (avatar.hairStyle) {
    case 'long':
      return `<path d="M114 136C114 88 147 54 192 54C237 54 270 88 270 136V252C248 272 221 286 192 286C163 286 136 272 114 252V136Z" fill="${avatar.hair}"/>`;
    case 'bob':
      return `<path d="M120 142C120 88 150 56 192 56C234 56 264 88 264 142V222C243 240 219 250 192 250C165 250 141 240 120 222V142Z" fill="${avatar.hair}"/>`;
    case 'braids':
      return `<g>
        <path d="M123 148C123 91 152 57 192 57C232 57 261 91 261 148V214C240 228 217 235 192 235C167 235 144 228 123 214V148Z" fill="${
          avatar.hair
        }"/>
        <rect x="105" y="164" width="26" height="112" rx="13" fill="${mixHex(
          avatar.hair,
          '#FFFFFF',
          0.05,
        )}"/>
        <rect x="253" y="164" width="26" height="112" rx="13" fill="${mixHex(
          avatar.hair,
          '#FFFFFF',
          0.05,
        )}"/>
      </g>`;
    case 'bun':
      return `<g>
        <circle cx="192" cy="62" r="28" fill="${avatar.hair}"/>
        <path d="M122 150C122 95 151 61 192 61C233 61 262 95 262 150V220C241 238 217 247 192 247C167 247 143 238 122 220V150Z" fill="${avatar.hair}"/>
      </g>`;
    case 'pony':
      return `<g>
        <ellipse cx="256" cy="136" rx="24" ry="52" fill="${mixHex(
          avatar.hair,
          '#000000',
          0.08,
        )}"/>
        <path d="M124 138C124 90 154 60 192 60C230 60 260 90 260 138V218C239 235 216 245 192 245C168 245 145 235 124 218V138Z" fill="${
          avatar.hair
        }"/>
      </g>`;
    default:
      return '';
  }
}

function hairFront(avatar) {
  switch (avatar.hairStyle) {
    case 'curl':
      return `<g>
        <path d="M118 132C118 84 148 58 192 58C236 58 266 84 266 132C246 116 224 108 192 108C160 108 138 116 118 132Z" fill="${avatar.hair}"/>
        <circle cx="138" cy="106" r="22" fill="${avatar.hair}"/>
        <circle cx="174" cy="92" r="25" fill="${avatar.hair}"/>
        <circle cx="212" cy="90" r="24" fill="${avatar.hair}"/>
        <circle cx="248" cy="106" r="21" fill="${avatar.hair}"/>
      </g>`;
    case 'bob':
      return `<path d="M120 140C130 96 154 72 192 72C230 72 254 96 264 140L250 118C236 103 218 97 192 97C166 97 148 103 134 118L120 140Z" fill="${mixHex(
        avatar.hair,
        '#000000',
        0.06,
      )}"/>`;
    case 'fade':
      return `<g>
        <path d="M124 132C131 90 158 64 192 64C226 64 253 90 260 132C240 116 218 108 192 108C166 108 144 116 124 132Z" fill="${
          avatar.hair
        }"/>
        <rect x="120" y="128" width="18" height="60" rx="9" fill="${mixHex(
          avatar.hair,
          '#FFFFFF',
          0.08,
        )}"/>
        <rect x="246" y="128" width="18" height="60" rx="9" fill="${mixHex(
          avatar.hair,
          '#FFFFFF',
          0.08,
        )}"/>
      </g>`;
    case 'wave':
      return `<path d="M122 138C129 92 159 68 192 68C220 68 245 82 260 122C241 108 220 103 195 103C168 103 145 113 122 138Z" fill="${avatar.hair}"/>`;
    case 'bun':
      return `<path d="M124 140C134 94 159 74 192 74C225 74 250 94 260 140L244 122C230 110 214 104 192 104C170 104 154 110 140 122L124 140Z" fill="${mixHex(
        avatar.hair,
        '#000000',
        0.05,
      )}"/>`;
    case 'long':
      return `<path d="M118 138C126 92 156 68 192 68C228 68 258 92 266 138C245 119 221 111 192 111C163 111 139 119 118 138Z" fill="${mixHex(
        avatar.hair,
        '#000000',
        0.04,
      )}"/>`;
    case 'braids':
      return `<path d="M124 142C132 94 159 71 192 71C225 71 252 94 260 142C243 120 220 111 192 111C164 111 141 120 124 142Z" fill="${avatar.hair}"/>`;
    case 'pony':
      return `<path d="M126 136C134 92 160 70 192 70C224 70 250 92 258 136C242 119 220 111 192 111C164 111 142 119 126 136Z" fill="${avatar.hair}"/>`;
    case 'buzz':
      return `<path d="M128 128C138 92 161 74 192 74C223 74 246 92 256 128C237 116 216 109 192 109C168 109 147 116 128 128Z" fill="${mixHex(
        avatar.hair,
        '#FFFFFF',
        0.04,
      )}"/>`;
    default:
      return '';
  }
}

function accessory(avatar) {
  switch (avatar.accessory) {
    case 'glasses':
      return `<g stroke="${setAlpha(
        '#142026',
        0.82,
      )}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="137" y="139" width="40" height="28" rx="12"/>
        <rect x="207" y="139" width="40" height="28" rx="12"/>
        <path d="M177 152H207"/>
      </g>`;
    case 'earrings':
      return `<g fill="${mixHex(avatar.accent, '#FFFFFF', 0.24)}">
        <circle cx="122" cy="189" r="6"/>
        <circle cx="262" cy="189" r="6"/>
      </g>`;
    case 'beard':
      return `<path d="M153 184C159 212 173 226 192 226C211 226 225 212 231 184C219 194 206 199 192 199C178 199 165 194 153 184Z" fill="${mixHex(
        avatar.hair,
        '#000000',
        0.04,
      )}"/>`;
    default:
      return '';
  }
}

function setAlpha(hex, alpha) {
  const normalized = hex.replace('#', '');
  const channel =
    normalized.length === 3
      ? normalized
          .split('')
          .map(value => value + value)
          .join('')
      : normalized;
  const value = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');

  return `#${channel}${value}`;
}

function mixHex(colorA, colorB, amount) {
  const [aRed, aGreen, aBlue] = hexToRgb(colorA);
  const [bRed, bGreen, bBlue] = hexToRgb(colorB);

  return rgbToHex(
    Math.round(aRed + (bRed - aRed) * amount),
    Math.round(aGreen + (bGreen - aGreen) * amount),
    Math.round(aBlue + (bBlue - aBlue) * amount),
  );
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map(channel => channel + channel)
          .join('')
      : normalized;

  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue]
    .map(channel => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}
