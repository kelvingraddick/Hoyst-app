import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  Clipboard as ClipboardIcon,
  Instagram,
  Link2,
  MoreHorizontal,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Circle, Path} from 'react-native-svg';

import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {brandColors} from '../../../design/tokens/colors';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {env} from '../../../config/env';
import type {RootStackParamList} from '../../../navigation/types';
import {
  TapInStoryTemplateCard,
  tapInStoryShareCardSize,
} from '../components/TapInStoryShareCard';
import {
  buildTapInStoryShareData,
  copyTapInStoryImageToClipboard,
  getAvailableTapInStoryTemplates,
  shareTapInStoryImage,
  shareTapInStoryToInstagram,
  shareTapInStoryToSnapchat,
  type TapInStoryTemplateId,
} from '../services/tap-in-story-share';

type Props = NativeStackScreenProps<RootStackParamList, 'TapInStoryShare'>;

type ShareDestination =
  | 'clipboard'
  | 'instagram'
  | 'link'
  | 'more'
  | 'snapchat';

type DestinationConfig = {
  backgroundColor: string;
  iconColor: string;
  id: ShareDestination;
  label: string;
  renderIcon?: (color: string) => React.ReactNode;
  Icon?: LucideIcon;
};

const destinationConfigs: DestinationConfig[] = [
  {
    backgroundColor: '#FFE3DC',
    iconColor: '#FF6D00',
    id: 'instagram',
    label: 'Instagram\nStory',
    renderIcon: () => <InstagramGlyph />,
  },
  {
    backgroundColor: '#FFF2BA',
    iconColor: '#111111',
    id: 'snapchat',
    label: 'Snapchat',
    renderIcon: () => <SnapchatGlyph />,
  },
  {
    backgroundColor: '#DFE6FF',
    iconColor: brandColors.blueVivid,
    id: 'link',
    label: 'Copy Link',
    Icon: Link2,
  },
  {
    backgroundColor: '#DDF0E8',
    iconColor: '#0C8D4B',
    id: 'clipboard',
    label: 'Copy to\nClipboard',
    Icon: ClipboardIcon,
  },
  {
    backgroundColor: '#E6E0FF',
    iconColor: brandColors.purpleBright,
    id: 'more',
    label: 'More',
    Icon: MoreHorizontal,
  },
];

const HEADER_CONTROL_SIZE = 36;
const PREVIEW_VERTICAL_RESERVE = 340;

function getShareErrorMessage(error: unknown) {
  return (
    (error as {message?: string}).message ??
    'The story image could not be shared. Try again in a moment.'
  );
}

function setClipboardString(value: string) {
  const {Clipboard} = require('react-native') as typeof import('react-native');
  Clipboard.setString(value);
}

function InstagramGlyph() {
  return (
    <LinearGradient
      colors={['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5']}
      end={{x: 1, y: 1}}
      start={{x: 0, y: 0}}
      style={styles.instagramGlyph}>
      <Instagram color="#FFFFFF" size={23} strokeWidth={2.35} />
    </LinearGradient>
  );
}

function SnapchatGlyph() {
  return (
    <Svg height={28} viewBox="0 0 28 28" width={28}>
      <Circle cx={14} cy={14} fill="#FFFC00" r={13} />
      <Path
        d="M14 5.2c3.05 0 4.95 2.2 4.95 5.15v2.25c0 .42.15.73.48.9.34.17.75.28 1.18.4.44.13.78.43.78.88 0 .82-1.07 1.22-2.2 1.46.26.62.76 1.14 1.43 1.45.4.2.66.49.66.89 0 .58-.52.86-1.09.86-.3 0-.64-.07-1.02-.18-.29-.09-.56-.13-.82-.13-.68 0-1.13.3-1.62.63-.6.4-1.28.86-2.73.86s-2.13-.46-2.73-.86c-.49-.33-.94-.63-1.62-.63-.26 0-.53.04-.82.13-.38.11-.72.18-1.02.18-.57 0-1.09-.28-1.09-.86 0-.4.26-.69.66-.89.67-.31 1.17-.83 1.43-1.45-1.13-.24-2.2-.64-2.2-1.46 0-.45.34-.75.78-.88.43-.12.84-.23 1.18-.4.33-.17.48-.48.48-.9v-2.25C9.05 7.4 10.95 5.2 14 5.2Z"
        fill="#FFFFFF"
        stroke="#111111"
        strokeLinejoin="round"
        strokeWidth={1.15}
      />
    </Svg>
  );
}

function DestinationButton({
  config,
  disabled,
  isBusy,
  onPress,
}: {
  config: DestinationConfig;
  disabled: boolean;
  isBusy: boolean;
  onPress: () => void;
}) {
  const Icon = config.Icon;
  const label = isBusy ? 'Working...' : config.label;

  return (
    <Pressable
      accessibilityLabel={config.label.replace('\n', ' ')}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.destination,
        {
          opacity: disabled ? 0.46 : pressed ? 0.86 : 1,
          transform: [{scale: pressed && !disabled ? 0.97 : 1}],
        },
      ]}>
      <View
        style={[
          styles.destinationIcon,
          {backgroundColor: config.backgroundColor},
        ]}>
        {config.renderIcon ? (
          config.renderIcon(config.iconColor)
        ) : Icon ? (
          <Icon color={config.iconColor} size={25} strokeWidth={2.35} />
        ) : null}
      </View>
      <HoystText numberOfLines={2} style={styles.destinationLabel}>
        {label}
      </HoystText>
    </Pressable>
  );
}

function getTemplateIndexFromScroll(
  event: NativeSyntheticEvent<NativeScrollEvent>,
  pageWidth: number,
) {
  if (pageWidth <= 0) {
    return 0;
  }

  return Math.max(0, Math.round(event.nativeEvent.contentOffset.x / pageWidth));
}

export function TapInStoryShareScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const {height, width} = useWindowDimensions();
  const captureRef = useRef<View>(null);
  const carouselRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [busyDestination, setBusyDestination] = useState<ShareDestination>();
  const [isPhotoSettled, setIsPhotoSettled] = useState(!route.params.photoUri);
  const carouselWidth = Math.max(1, width - 40);
  const availablePreviewHeight = Math.max(1, height - PREVIEW_VERTICAL_RESERVE);
  const previewScale = Math.min(
    1,
    carouselWidth / tapInStoryShareCardSize.width,
    availablePreviewHeight / tapInStoryShareCardSize.height,
  );
  const previewWidth = tapInStoryShareCardSize.width * previewScale;
  const previewHeight = tapInStoryShareCardSize.height * previewScale;
  const storyData = useMemo(
    () =>
      buildTapInStoryShareData({
        detail: {
          commitment: route.params.commitment ?? "Today's Tap In",
          inviteUrl: route.params.inviteUrl,
          memberCount: route.params.memberCount,
          periodTapInCount: route.params.periodTapInCount,
          progressLabel: route.params.progressLabel,
          streakDays: route.params.streakDays,
          streakLabel: route.params.streakLabel,
          title: route.params.circleTitle ?? 'Hoyst Circle',
        },
        note: route.params.note,
        photoUri: route.params.photoUri,
      }),
    [
      route.params.circleTitle,
      route.params.commitment,
      route.params.inviteUrl,
      route.params.memberCount,
      route.params.note,
      route.params.periodTapInCount,
      route.params.photoUri,
      route.params.progressLabel,
      route.params.streakDays,
      route.params.streakLabel,
    ],
  );
  const templates = useMemo(
    () => getAvailableTapInStoryTemplates(storyData),
    [storyData],
  );
  const activeTemplate: TapInStoryTemplateId =
    templates[Math.min(activeIndex, templates.length - 1)] ?? 'designedPost';
  const requiresPhotoSettled =
    activeTemplate === 'photoOverlay' && Boolean(storyData.photoUri);
  const canCapture = !requiresPhotoSettled || isPhotoSettled;
  const isBusy = Boolean(busyDestination);
  const activeDotStyle = useMemo(
    () => ({backgroundColor: theme.text}),
    [theme.text],
  );
  const previewBackgroundStyle = theme.isDark
    ? styles.previewBackgroundDark
    : styles.previewBackgroundLight;

  useEffect(() => {
    if (activeIndex >= templates.length) {
      setActiveIndex(templates.length - 1);
    }
  }, [activeIndex, templates.length]);

  useEffect(() => {
    setIsPhotoSettled(!storyData.photoUri || activeTemplate !== 'photoOverlay');
  }, [activeTemplate, storyData.photoUri]);

  const close = () => {
    navigation.goBack();
  };

  const assertCaptureReady = () => {
    if (!captureRef.current || !canCapture) {
      Alert.alert(
        'Story is getting ready',
        'Give the image one more moment, then try sharing again.',
      );
      return false;
    }

    return true;
  };

  const runShareAction = async (
    destination: ShareDestination,
    action: () => Promise<void>,
  ) => {
    if (isBusy) {
      return;
    }

    setBusyDestination(destination);
    try {
      await action();
    } catch (error) {
      Alert.alert('Could not share story', getShareErrorMessage(error));
    } finally {
      setBusyDestination(undefined);
    }
  };

  const copyInviteLink = () => {
    if (!storyData.inviteUrl) {
      Alert.alert(
        'Circle link unavailable',
        'This Circle does not have a share link yet.',
      );
      return;
    }

    setClipboardString(storyData.inviteUrl);
    Alert.alert('Link copied', 'Circle invite link copied to clipboard.');
  };

  const handleDestinationPress = (destination: ShareDestination) => {
    if (destination === 'link') {
      copyInviteLink();
      return;
    }

    if (destination === 'clipboard') {
      if (!assertCaptureReady()) {
        return;
      }

      runShareAction('clipboard', async () => {
        await copyTapInStoryImageToClipboard(captureRef);
        Alert.alert('Image copied', 'Story image copied to clipboard.');
      }).catch(() => undefined);
      return;
    }

    if (!assertCaptureReady()) {
      return;
    }

    if (destination === 'instagram') {
      runShareAction('instagram', () =>
        shareTapInStoryToInstagram({
          appId: env.instagramAppId,
          inviteUrl: storyData.inviteUrl,
          message: storyData.shareMessage,
          storyCardRef: captureRef,
          templateId: activeTemplate,
        }),
      ).catch(() => undefined);
      return;
    }

    if (destination === 'snapchat') {
      runShareAction('snapchat', () =>
        shareTapInStoryToSnapchat({
          message: storyData.shareMessage,
          storyCardRef: captureRef,
          templateId: activeTemplate,
        }),
      ).catch(() => undefined);
      return;
    }

    runShareAction('more', () =>
      shareTapInStoryImage(captureRef, storyData.shareMessage),
    ).catch(() => undefined);
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActiveIndex(
      Math.min(
        templates.length - 1,
        getTemplateIndexFromScroll(event, carouselWidth),
      ),
    );
  };

  return (
    <HoystScreen
      background={<FrostedBackdrop />}
      contentContainerStyle={styles.content}
      scrollEnabled={false}>
      <View style={styles.captureLayer} pointerEvents="none">
        <View collapsable={false} ref={captureRef} style={styles.captureCard}>
          <TapInStoryTemplateCard
            onPhotoSettled={() => {
              setIsPhotoSettled(true);
            }}
            story={storyData}
            templateId={activeTemplate}
          />
        </View>
      </View>

      <View style={styles.headerRow}>
        <Pressable
          accessibilityLabel="Close Share Tap In"
          accessibilityRole="button"
          hitSlop={8}
          onPress={close}
          style={({pressed}) => [
            styles.closeButton,
            {
              backgroundColor: theme.surfaceSoft,
              borderColor: theme.border,
              opacity: pressed ? 0.92 : 1,
            },
          ]}>
          <X color={theme.text} size={19} strokeWidth={2.4} />
        </Pressable>
        <HoystText
          numberOfLines={1}
          style={[styles.headerTitle, {color: theme.text}]}>
          Share Tap In
        </HoystText>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.carouselBlock}>
        <ScrollView
          bounces={false}
          decelerationRate="fast"
          horizontal
          onMomentumScrollEnd={handleScrollEnd}
          pagingEnabled
          ref={carouselRef}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          style={[styles.carousel, {width: carouselWidth}]}>
          {templates.map(templateId => (
            <View
              key={templateId}
              style={[styles.carouselPage, {width: carouselWidth}]}>
              <View
                style={[
                  styles.previewFrame,
                  templateId === 'transparentStats'
                    ? styles.previewBackgroundTransparent
                    : previewBackgroundStyle,
                  {
                    height: previewHeight,
                    width: previewWidth,
                  },
                ]}>
                <View
                  style={[
                    styles.previewScaler,
                    {
                      left:
                        -(tapInStoryShareCardSize.width * (1 - previewScale)) /
                        2,
                      top:
                        -(tapInStoryShareCardSize.height * (1 - previewScale)) /
                        2,
                      transform: [{scale: previewScale}],
                    },
                  ]}>
                  <TapInStoryTemplateCard
                    showTransparencyGrid={templateId === 'transparentStats'}
                    story={storyData}
                    templateId={templateId}
                  />
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dotsRow}>
          {templates.map((templateId, index) => (
            <Pressable
              accessibilityLabel={`Show story option ${index + 1}`}
              accessibilityRole="button"
              hitSlop={8}
              key={templateId}
              onPress={() => {
                carouselRef.current?.scrollTo({
                  animated: true,
                  x: carouselWidth * index,
                });
                setActiveIndex(index);
              }}
              style={[
                styles.dot,
                index === activeIndex ? activeDotStyle : styles.inactiveDot,
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.shareBlock}>
        <HoystText tone="muted" variant="label" style={styles.shareLabel}>
          SHARE TO
        </HoystText>
        <View style={styles.destinationsRow}>
          {destinationConfigs.map(config => (
            <DestinationButton
              config={config}
              disabled={
                isBusy ||
                ((config.id === 'instagram' ||
                  config.id === 'snapchat' ||
                  config.id === 'more' ||
                  config.id === 'clipboard') &&
                  !canCapture)
              }
              isBusy={busyDestination === config.id}
              key={config.id}
              onPress={() => handleDestinationPress(config.id)}
            />
          ))}
        </View>
      </View>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  captureCard: {
    height: tapInStoryShareCardSize.height,
    width: tapInStoryShareCardSize.width,
  },
  captureLayer: {
    height: tapInStoryShareCardSize.height,
    left: -1200,
    position: 'absolute',
    top: 0,
    width: tapInStoryShareCardSize.width,
  },
  carousel: {
    flexGrow: 0,
  },
  carouselBlock: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
  },
  carouselPage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: HEADER_CONTROL_SIZE,
    justifyContent: 'center',
    width: HEADER_CONTROL_SIZE,
  },
  content: {
    flexGrow: 1,
    minHeight: '100%',
    paddingBottom: 16,
    paddingTop: 6,
  },
  destination: {
    alignItems: 'center',
    gap: 7,
    minWidth: 58,
  },
  destinationIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  destinationLabel: {
    color: '#77799A',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 12,
    minHeight: 24,
    textAlign: 'center',
  },
  destinationsRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dot: {
    borderRadius: radius.pill,
    height: 7,
    width: 7,
  },
  dotsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: 12,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: HEADER_CONTROL_SIZE,
  },
  headerSpacer: {
    width: HEADER_CONTROL_SIZE,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 22,
    textAlign: 'center',
  },
  instagramGlyph: {
    alignItems: 'center',
    borderRadius: 9,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  inactiveDot: {
    backgroundColor: 'rgba(16,24,40,0.18)',
  },
  previewBackgroundDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  previewBackgroundLight: {
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  previewBackgroundTransparent: {
    backgroundColor: '#11131C',
  },
  previewFrame: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  previewScaler: {
    height: tapInStoryShareCardSize.height,
    position: 'absolute',
    width: tapInStoryShareCardSize.width,
  },
  shareBlock: {
    gap: 8,
    paddingTop: 0,
  },
  shareLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    lineHeight: 14,
  },
});
