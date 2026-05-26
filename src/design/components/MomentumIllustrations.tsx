import React from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
  Text as SvgText,
  type SvgProps,
} from 'react-native-svg';

import {brandColors} from '../tokens/colors';

type IllustrationProps = SvgProps & {
  size?: number;
};

type FlameAchievementProps = IllustrationProps & {
  value: number;
  variant?: 'orange' | 'purple';
};

type StreakIllustrationProps = IllustrationProps & {
  streakDays: number;
};

type StreakTier = 'cold' | 'flame' | 'hot' | 'spark';

function useGradientId(name: string) {
  return `${React.useId().replace(/[^a-zA-Z0-9]/g, '')}-${name}`;
}

function getStreakTier(streakDays: number): StreakTier {
  if (streakDays <= 0) {
    return 'cold';
  }

  if (streakDays < 7) {
    return 'spark';
  }

  if (streakDays < 14) {
    return 'flame';
  }

  return 'hot';
}

const streakVisuals: Record<
  StreakTier,
  {
    backplate: string;
    glow: string;
    highlight: string;
    shadow: string;
    start: string;
    stop: string;
  }
> = {
  cold: {
    backplate: '#EAF4FF',
    glow: '#D7ECFF',
    highlight: '#FFFFFF',
    shadow: '#086CA8',
    start: '#8ED8FF',
    stop: '#18B9FF',
  },
  spark: {
    backplate: '#FFF2E8',
    glow: '#FFE1C9',
    highlight: '#FFFFFF',
    shadow: '#A83A00',
    start: '#FFC247',
    stop: brandColors.orangeStrong,
  },
  flame: {
    backplate: '#FFF0E5',
    glow: '#FFD6BC',
    highlight: '#FFFFFF',
    shadow: '#C53512',
    start: '#FF3B18',
    stop: brandColors.orangeStrong,
  },
  hot: {
    backplate: '#FFF0E5',
    glow: '#FFD2B8',
    highlight: '#FFFFFF',
    shadow: '#A90000',
    start: '#FF2D12',
    stop: '#FF8A00',
  },
};

function StreakColdArtwork({
  gradientId,
  visual,
}: {
  gradientId: string;
  visual: (typeof streakVisuals)[StreakTier];
}) {
  return (
    <G>
      <Path
        d="M48 17 58 34 77 38 64 52 67 72 48 63 29 72 32 52 19 38 38 34Z"
        fill={`url(#${gradientId})`}
      />
      <Path
        d="M48 20V62M30 31l36 22M66 31 30 53"
        fill="none"
        opacity={0.9}
        stroke={visual.highlight}
        strokeLinecap="round"
        strokeWidth={5}
      />
      <Path
        d="M38 34 48 17 58 34M32 52 48 63 64 52"
        fill="none"
        opacity={0.38}
        stroke={visual.shadow}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={4}
      />
      <Circle cx={68} cy={25} fill={visual.highlight} opacity={0.82} r={4} />
      <Circle cx={27} cy={67} fill={visual.shadow} opacity={0.18} r={5} />
    </G>
  );
}

function StreakSparkArtwork({
  gradientId,
  visual,
}: {
  gradientId: string;
  visual: (typeof streakVisuals)[StreakTier];
}) {
  return (
    <G>
      <Path
        d="M49 77C36 74 28 64 30 51c1-8 7-13 12-19 5-5 7-10 6-16 12 8 17 19 14 31 6 3 8 10 5 17-3 8-10 13-18 13Z"
        fill={`url(#${gradientId})`}
      />
      <Path
        d="M49 67c-6-2-10-7-9-13 .6-4 4-7 7-10 3-3 4-6 4-10 6 5 8 11 6 18 3 1 4 5 3 8-2 5-6 8-11 7Z"
        fill={visual.highlight}
        opacity={0.92}
      />
      <Path
        d="M24 33 28 43 38 47 28 51 24 61 20 51 10 47 20 43Z"
        fill={visual.stop}
        opacity={0.92}
      />
      <Circle cx={72} cy={34} fill={visual.stop} opacity={0.72} r={5} />
    </G>
  );
}

function StreakFlameArtwork({
  gradientId,
  visual,
}: {
  gradientId: string;
  visual: (typeof streakVisuals)[StreakTier];
}) {
  return (
    <G>
      <Path
        d="M48 80C33 77 23 66 25 51c1-10 8-17 15-24 6-6 9-12 7-20 17 8 25 22 21 38 7 4 10 12 6 20-4 10-15 17-26 15Z"
        fill={`url(#${gradientId})`}
      />
      <Path
        d="M49 68c-8-2-13-8-12-15 .7-5 5-9 9-13 4-4 6-8 5-12 9 5 13 13 10 23 4 2 6 7 4 11-2 6-9 9-16 6Z"
        fill={visual.highlight}
        opacity={0.9}
      />
      <Path
        d="M48 80c11 2 22-5 26-15 4-8 1-16-6-20 4-16-4-30-21-38 5 15-15 21-21 44-3 15 7 26 22 29Z"
        fill={visual.shadow}
        opacity={0.18}
      />
    </G>
  );
}

function StreakHotArtwork({
  gradientId,
  visual,
}: {
  gradientId: string;
  visual: (typeof streakVisuals)[StreakTier];
}) {
  return (
    <G>
      <Path
        d="M48 82C31 79 20 66 22 49c1-11 9-18 17-26 6-6 9-12 8-20 19 9 29 25 24 43 8 4 11 14 7 23-5 11-17 17-30 13Z"
        fill={`url(#${gradientId})`}
      />
      <Path
        d="M49 69c-9-2-15-8-14-16 .8-6 5-10 10-15 4-4 6-8 5-13 11 6 15 16 12 27 5 2 6 7 4 12-3 6-10 9-17 5Z"
        fill="#FFC247"
      />
      <Path
        d="M50 61c-5-1-8-5-7-10 .4-3 3-6 6-8 2-3 4-5 3-8 6 4 8 10 6 17 3 1 4 4 3 7-2 4-6 5-11 2Z"
        fill={visual.highlight}
        opacity={0.94}
      />
      <Path
        d="M22 28 26 38 36 42 26 46 22 56 18 46 8 42 18 38Z"
        fill={visual.stop}
      />
      <Path
        d="M76 24 79 31 86 34 79 37 76 44 73 37 66 34 73 31Z"
        fill="#FF3B18"
      />
      <Circle cx={74} cy={67} fill={visual.shadow} opacity={0.18} r={5} />
    </G>
  );
}

export function MomentumStreakIllustration({
  size = 86,
  streakDays,
  ...props
}: StreakIllustrationProps): React.JSX.Element {
  const tier = getStreakTier(streakDays);
  const visual = streakVisuals[tier];
  const gradientId = useGradientId(`current-streak-${tier}`);

  return (
    <Svg height={size} viewBox="0 0 96 96" width={size} {...props}>
      <Defs>
        <LinearGradient id={gradientId} x1="20" x2="76" y1="10" y2="86">
          <Stop offset="0" stopColor={visual.start} />
          <Stop offset="1" stopColor={visual.stop} />
        </LinearGradient>
      </Defs>
      <Circle cx={48} cy={48} fill={visual.backplate} r={46} />
      <Circle cx={48} cy={48} fill={visual.glow} opacity={0.58} r={36} />
      {tier === 'cold' ? (
        <StreakColdArtwork gradientId={gradientId} visual={visual} />
      ) : tier === 'spark' ? (
        <StreakSparkArtwork gradientId={gradientId} visual={visual} />
      ) : tier === 'flame' ? (
        <StreakFlameArtwork gradientId={gradientId} visual={visual} />
      ) : (
        <StreakHotArtwork gradientId={gradientId} visual={visual} />
      )}
    </Svg>
  );
}

export function MomentumFlameIllustration({
  size = 44,
  ...props
}: IllustrationProps): React.JSX.Element {
  const gradientId = useGradientId('momentum-flame');

  return (
    <Svg height={size} viewBox="0 0 64 64" width={size} {...props}>
      <Defs>
        <LinearGradient id={gradientId} x1="16" x2="48" y1="8" y2="56">
          <Stop offset="0" stopColor="#FF2D12" />
          <Stop offset="0.62" stopColor={brandColors.orangeStrong} />
          <Stop offset="1" stopColor="#FFB020" />
        </LinearGradient>
      </Defs>
      <Path
        d="M32.4 57C21.9 55.1 15 47 16.2 36.8c.8-6.8 5.5-11.6 10.1-16.1 4.1-4 5.9-7.8 4.8-12.7 11.4 5.7 17.3 15.2 14.2 26 4.8 2.8 6.5 8.3 4.2 13.3C46.6 54 39.5 58.3 32.4 57Z"
        fill={`url(#${gradientId})`}
      />
      <Path
        d="M33.1 50c-5.8-1.1-9.1-5.3-8.4-10.6.4-3.4 2.8-5.9 5.2-8.2 2.2-2.1 3.2-4 2.7-6.5 6 3.2 9.1 8.2 7.3 13.8 2.7 1.4 3.7 4.4 2.5 7-1.5 3.4-5.4 5.5-9.3 4.5Z"
        fill="#FFFFFF"
        opacity={0.9}
      />
    </Svg>
  );
}

export function MomentumTrophyIllustration({
  size = 44,
  ...props
}: IllustrationProps): React.JSX.Element {
  const gradientId = useGradientId('momentum-trophy');

  return (
    <Svg height={size} viewBox="0 0 64 64" width={size} {...props}>
      <Defs>
        <LinearGradient id={gradientId} x1="14" x2="50" y1="10" y2="58">
          <Stop offset="0" stopColor="#FFC400" />
          <Stop offset="0.52" stopColor="#FFA300" />
          <Stop offset="1" stopColor={brandColors.orangeStrong} />
        </LinearGradient>
      </Defs>
      <Path
        d="M20 15h24v10c0 11.5-5.3 18-12 18s-12-6.5-12-18V15Z"
        fill={`url(#${gradientId})`}
      />
      <Path
        d="M20 20h-7v7.4C13 36 19.1 40 25.4 40"
        fill="none"
        stroke="#FFA300"
        strokeLinecap="round"
        strokeWidth={5}
      />
      <Path
        d="M44 20h7v7.4C51 36 44.9 40 38.6 40"
        fill="none"
        stroke="#FFA300"
        strokeLinecap="round"
        strokeWidth={5}
      />
      <Path
        d="M32 43v8"
        stroke="#F08A00"
        strokeLinecap="round"
        strokeWidth={6}
      />
      <Path
        d="M22 55h20"
        stroke="#FFA300"
        strokeLinecap="round"
        strokeWidth={6}
      />
      <Polygon
        fill="#FFFFFF"
        points="32,22 34.4,27 39.8,27.8 35.9,31.6 36.8,37 32,34.4 27.2,37 28.1,31.6 24.2,27.8 29.6,27"
      />
    </Svg>
  );
}

export function MomentumCompleteIllustration({
  size = 56,
  ...props
}: IllustrationProps): React.JSX.Element {
  const gradientId = useGradientId('momentum-check');

  return (
    <Svg height={size} viewBox="0 0 72 72" width={size} {...props}>
      <Defs>
        <LinearGradient id={gradientId} x1="16" x2="54" y1="16" y2="56">
          <Stop offset="0" stopColor="#22D86F" />
          <Stop offset="1" stopColor={brandColors.green} />
        </LinearGradient>
      </Defs>
      <Circle cx={36} cy={36} fill={`url(#${gradientId})`} r={24} />
      <Path
        d="M25 36.5 32.3 44 48 27.5"
        fill="none"
        stroke="#FFFFFF"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={6}
      />
      <Rect fill="#FFC400" height={6} rx={1.4} transform="rotate(-28 14 54)" width={4} x={12} y={51} />
      <Rect fill="#EF5DA8" height={6} rx={1.4} transform="rotate(20 58 51)" width={4} x={56} y={48} />
      <Rect fill="#7A55FF" height={7} rx={1.4} transform="rotate(-24 62 33)" width={4} x={60} y={30} />
      <Rect fill="#18B9FF" height={5} rx={1.4} transform="rotate(28 19 18)" width={4} x={17} y={16} />
    </Svg>
  );
}

export function MomentumPartyPopperIllustration({
  size = 48,
  ...props
}: IllustrationProps): React.JSX.Element {
  return (
    <Svg height={size} viewBox="0 0 72 72" width={size} {...props}>
      <Path
        d="M17 55 29 29l16 16-26 12c-1.4.6-2.7-.8-2-2Z"
        fill="#10B967"
      />
      <Path
        d="M29 29 45 45"
        stroke="#07763E"
        strokeLinecap="round"
        strokeWidth={4}
      />
      <Path
        d="M30 42c6-1 10-5 11-11"
        fill="none"
        stroke="#70E2A3"
        strokeLinecap="round"
        strokeWidth={4}
      />
      <Path
        d="M43 19c6-7 5-12 1-15"
        fill="none"
        stroke="#5A1CFF"
        strokeLinecap="round"
        strokeWidth={3}
      />
      <Path
        d="M52 30c8-2 9-7 6-12"
        fill="none"
        stroke="#18B9FF"
        strokeLinecap="round"
        strokeWidth={3}
      />
      <Path
        d="M49 39c9 3 13 1 16-4"
        fill="none"
        stroke="#10B967"
        strokeLinecap="round"
        strokeWidth={3}
      />
      <Rect fill="#FFC400" height={6} rx={1.5} transform="rotate(-30 15 27)" width={4} x={13} y={24} />
      <Rect fill="#EF5DA8" height={6} rx={1.5} transform="rotate(22 54 13)" width={4} x={52} y={10} />
      <Rect fill="#7A55FF" height={6} rx={1.5} transform="rotate(-20 62 51)" width={4} x={60} y={48} />
    </Svg>
  );
}

export function MomentumAchievementFlameIllustration({
  size = 58,
  value,
  variant = 'orange',
  ...props
}: FlameAchievementProps): React.JSX.Element {
  const gradientId = useGradientId(`achievement-flame-${variant}`);
  const isPurple = variant === 'purple';

  return (
    <Svg height={size} viewBox="0 0 72 72" width={size} {...props}>
      <Defs>
        <LinearGradient id={gradientId} x1="18" x2="54" y1="10" y2="64">
          <Stop offset="0" stopColor={isPurple ? '#7A55FF' : '#FF3B18'} />
          <Stop offset="0.58" stopColor={isPurple ? '#5A1CFF' : brandColors.orangeStrong} />
          <Stop offset="1" stopColor={isPurple ? '#B699FF' : '#FFC247'} />
        </LinearGradient>
      </Defs>
      <Path
        d="M36.5 66C23.8 63.6 15.6 53.9 17 41.4c.9-8.1 6.5-14 12-19.5 4.9-4.8 7.1-9.4 5.8-15.2 13.7 6.7 20.7 18.4 17 31.4 5.8 3.3 7.9 10 5.1 16-3.4 7.8-12 13-20.4 11.9Z"
        fill={`url(#${gradientId})`}
      />
      <SvgText
        fill="#FFFFFF"
        fontFamily="System"
        fontSize={value >= 100 ? 20 : 23}
        fontWeight="800"
        textAnchor="middle"
        x="36"
        y="48">
        {value}
      </SvgText>
    </Svg>
  );
}

export function MomentumCalendarIllustration({
  size = 46,
  ...props
}: IllustrationProps): React.JSX.Element {
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size} {...props}>
      <Rect fill="#FFE9DB" height={44} rx={10} width={42} x={11} y={14} />
      <Rect fill={brandColors.orangeStrong} height={8} rx={3} width={42} x={11} y={14} />
      <Path
        d="M22 8v12M42 8v12"
        stroke={brandColors.orangeStrong}
        strokeLinecap="round"
        strokeWidth={5}
      />
      <Path
        d="M22 38.5 29.5 46 43 30"
        fill="none"
        stroke={brandColors.orangeStrong}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={5}
      />
    </Svg>
  );
}

export function MomentumLightningIllustration({
  size = 48,
  ...props
}: IllustrationProps): React.JSX.Element {
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size} {...props}>
      <Circle cx={32} cy={32} fill="#EEE7FF" r={30} />
      <Path
        d="M36 7 18 36h14l-4 21 18-30H32l4-20Z"
        fill="none"
        stroke={brandColors.purple}
        strokeLinejoin="round"
        strokeWidth={5}
      />
    </Svg>
  );
}

export function MomentumLockedMedalIllustration({
  size = 48,
  ...props
}: IllustrationProps): React.JSX.Element {
  return (
    <Svg height={size} viewBox="0 0 64 64" width={size} {...props}>
      <Circle cx={32} cy={32} fill="#EEF0F5" r={30} />
      <Path
        d="M22 14h20l-7 14H29L22 14Z"
        fill="#D8DDE7"
      />
      <Circle cx={32} cy={40} fill="#C8CEDA" r={13} />
      <Circle cx={32} cy={40} fill="none" r={7} stroke="#FFFFFF" strokeWidth={4} />
      <Path
        d="M31 36h2v9h-2z"
        fill="#8D96AD"
      />
    </Svg>
  );
}

export function MomentumMiniTrophyIllustration({
  size = 18,
  color = brandColors.orangeStrong,
  ...props
}: IllustrationProps & {color?: string}): React.JSX.Element {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size} {...props}>
      <Path
        d="M7 4h10v4.2c0 4.8-2.2 7.4-5 7.4s-5-2.6-5-7.4V4Z"
        fill="none"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={2.3}
      />
      <Path
        d="M7 6H4.3v2.3c0 3 2.1 4.8 4.7 4.8M17 6h2.7v2.3c0 3-2.1 4.8-4.7 4.8M12 15.6v3M8.5 20h7"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.3}
      />
      <Path
        d="m12 7.2 1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3 1-2Z"
        fill={color}
      />
    </Svg>
  );
}

export function MomentumStarIllustration({
  size = 22,
  color = '#FFA300',
  ...props
}: IllustrationProps & {color?: string}): React.JSX.Element {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size} {...props}>
      <Path
        d="M12 2.8 14.9 8.7l6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9L12 2.8Z"
        fill={color}
      />
    </Svg>
  );
}

export function MomentumLockIllustration({
  size = 15,
  color = '#111827',
  ...props
}: IllustrationProps & {color?: string}): React.JSX.Element {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size} {...props}>
      <Path
        d="M7 10V8.2C7 5.2 9.1 3 12 3s5 2.2 5 5.2V10"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={3}
      />
      <Rect fill={color} height={11} rx={2.8} width={14} x={5} y={10} />
      <Circle cx={12} cy={15.2} fill="#FFFFFF" r={1.4} opacity={0.82} />
    </Svg>
  );
}

export function MomentumSmallCheckIllustration({
  size = 12,
  color = '#FFFFFF',
  ...props
}: IllustrationProps & {color?: string}): React.JSX.Element {
  return (
    <Svg height={size} viewBox="0 0 16 16" width={size} {...props}>
      <Path
        d="M3.2 8.1 6.4 11.2 13 4.8"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.6}
      />
    </Svg>
  );
}
