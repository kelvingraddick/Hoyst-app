import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
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
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import {getCircleCategoryVisual} from '../../../design/components/CircleCategoryIcon';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {
  DesignSystemProvider,
  DSText,
  useSystemTheme,
} from '../../../design/system';
import {env} from '../../../config/env';
import type {RootStackParamList} from '../../../navigation/types';
import type {CircleDetailModel} from '../../../types/models';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {useSettingsStore} from '../../../store/settings-store';
import {subscribeToMemberCircleDetail} from '../../home/services/home-data-service';
import {
  getProfileSummary,
  type ProfileSummary,
} from '../../profile/services/profile-summary-service';
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
  renderIcon?: () => React.ReactNode;
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
    iconColor: '#2878DD',
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
    iconColor: '#6E3DF3',
    id: 'more',
    label: 'More',
    Icon: MoreHorizontal,
  },
];
const HEADER_CONTROL_SIZE = 44;
const DOTS_BLOCK_HEIGHT = 27;
const SHARE_TRAY_HEIGHT = 126;
const SCREEN_HORIZONTAL_PADDING = 22;
const MIN_TOP_SAFE_PADDING = Platform.OS === 'ios' ? 44 : 20;
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
      <Instagram color="#FFFFFF" size={22} strokeWidth={2.3} />
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
  const systemTheme = useSystemTheme();
  const Icon = config.Icon;
  return (
    <Pressable
      accessibilityLabel={config.label.replace('\n', ' ')}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.destination,
        {opacity: disabled ? 0.42 : pressed ? 0.8 : 1},
      ]}>
      <View
        style={[
          styles.destinationIcon,
          {backgroundColor: config.backgroundColor},
        ]}>
        {config.renderIcon ? (
          config.renderIcon()
        ) : Icon ? (
          <Icon color={config.iconColor} size={24} strokeWidth={2.25} />
        ) : null}
      </View>
      <DSText
        numberOfLines={2}
        style={[styles.destinationLabel, {color: systemTheme.muted}]}>
        {isBusy ? 'Working...' : config.label}
      </DSText>
    </Pressable>
  );
}
function getTemplateIndexFromScroll(
  event: NativeSyntheticEvent<NativeScrollEvent>,
  pageWidth: number,
) {
  return pageWidth <= 0
    ? 0
    : Math.max(0, Math.round(event.nativeEvent.contentOffset.x / pageWidth));
}

export function TapInStoryShareScreen(props: Props): React.JSX.Element {
  const appearance = useSettingsStore(state => state.appearance);
  return (
    <DesignSystemProvider scheme={appearance}>
      <TapInStoryShareController {...props} />
    </DesignSystemProvider>
  );
}
function TapInStoryShareController({
  navigation,
  route,
}: Props): React.JSX.Element {
  const legacyTheme = useHoystTheme();
  const systemTheme = useSystemTheme();
  const profile = useUserProfileStore(state => state.profile);
  const sessionStatus = useSessionStore(state => state.status);
  const sessionUser = useSessionStore(state => state.user);
  const insets = useSafeAreaInsets();
  const {height, width} = useWindowDimensions();
  const captureRef = useRef<View>(null);
  const carouselRef = useRef<ScrollView>(null);
  const [detail, setDetail] = useState<CircleDetailModel>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [busyDestination, setBusyDestination] = useState<ShareDestination>();
  const [carouselBlockHeight, setCarouselBlockHeight] = useState(0);
  const [isPhotoSettled, setIsPhotoSettled] = useState(!route.params.photoUri);
  const [hasResolvedProfileSummary, setHasResolvedProfileSummary] =
    useState(false);
  const [profileSummary, setProfileSummary] = useState<ProfileSummary>();
  const snapshotDetail = useMemo(
    () => ({
      commitment: route.params.commitment ?? "Today's Tap In",
      inviteUrl: route.params.inviteUrl,
      memberCount: route.params.memberCount,
      periodTapInCount: route.params.periodTapInCount,
      progressLabel: route.params.progressLabel,
      streakDays: route.params.streakDays,
      streakLabel: route.params.streakLabel,
      title: route.params.circleTitle ?? 'Hoyst Circle',
    }),
    [route.params],
  );
  const displayDetail = detail ?? snapshotDetail;
  const category = getCircleCategoryVisual(detail?.category ?? 'General');
  const safeTopPadding = Math.max(insets.top, MIN_TOP_SAFE_PADDING) + 4;
  const safeBottomPadding = Math.max(insets.bottom, 12) + 8;
  const carouselWidth = Math.max(1, width - SCREEN_HORIZONTAL_PADDING * 2);
  const fallbackCarouselHeight = Math.max(
    1,
    height -
      safeTopPadding -
      HEADER_CONTROL_SIZE -
      SHARE_TRAY_HEIGHT -
      safeBottomPadding -
      30,
  );
  const availablePreviewHeight = Math.max(
    1,
    (carouselBlockHeight || fallbackCarouselHeight) - DOTS_BLOCK_HEIGHT,
  );
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
        detail: displayDetail,
        note: route.params.note,
        photoUri: route.params.photoUri,
        profileSummary,
      }),
    [displayDetail, profileSummary, route.params.note, route.params.photoUri],
  );
  const templates = useMemo(
    () => getAvailableTapInStoryTemplates(storyData),
    [storyData],
  );
  const activeTemplate: TapInStoryTemplateId =
    templates[Math.min(activeIndex, templates.length - 1)] ?? 'tapInMoment';
  const requiresPhotoSettled =
    activeTemplate === 'tapInMoment' && Boolean(storyData.photoUri);
  const canCapture =
    hasResolvedProfileSummary && (!requiresPhotoSettled || isPhotoSettled);
  const isBusy = Boolean(busyDestination);
  useEffect(() => {
    if (sessionStatus !== 'authenticatedReady' || !sessionUser?.uid) {
      return;
    }
    return subscribeToMemberCircleDetail({
      circleId: route.params.circleId,
      onDetail: nextDetail => setDetail(nextDetail),
      onError: () => undefined,
      timezone: profile?.timezone ?? 'UTC',
      uid: sessionUser.uid,
    });
  }, [
    profile?.timezone,
    route.params.circleId,
    sessionStatus,
    sessionUser?.uid,
  ]);
  useEffect(() => {
    if (activeIndex >= templates.length) {
      setActiveIndex(Math.max(0, templates.length - 1));
    }
  }, [activeIndex, templates.length]);
  useEffect(() => {
    let active = true;
    setHasResolvedProfileSummary(false);
    getProfileSummary()
      .then(summary => {
        if (active) {
          setProfileSummary(summary);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setHasResolvedProfileSummary(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    setIsPhotoSettled(!storyData.photoUri || activeTemplate !== 'tapInMoment');
  }, [activeTemplate, storyData.photoUri]);
  const assertCaptureReady = () => {
    if (captureRef.current && canCapture) {
      return true;
    }
    Alert.alert(
      'Story is getting ready',
      'Give the image one more moment, then try sharing again.',
    );
    return false;
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
  const handleDestinationPress = (destination: ShareDestination) => {
    if (destination === 'link') {
      if (!storyData.inviteUrl) {
        Alert.alert(
          'Circle link unavailable',
          'This Circle does not have a share link yet.',
        );
        return;
      }
      setClipboardString(storyData.inviteUrl);
      Alert.alert('Link copied', 'Circle invite link copied to clipboard.');
      return;
    }
    if (!assertCaptureReady()) {
      return;
    }
    if (destination === 'clipboard') {
      runShareAction(destination, async () => {
        await copyTapInStoryImageToClipboard(captureRef);
        Alert.alert('Image copied', 'Story image copied to clipboard.');
      }).catch(() => undefined);
      return;
    }
    if (destination === 'instagram') {
      runShareAction(destination, () =>
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
      runShareAction(destination, () =>
        shareTapInStoryToSnapchat({
          message: storyData.shareMessage,
          storyCardRef: captureRef,
          templateId: activeTemplate,
        }),
      ).catch(() => undefined);
      return;
    }
    runShareAction(destination, () =>
      shareTapInStoryImage(captureRef, storyData.shareMessage),
    ).catch(() => undefined);
  };
  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    setActiveIndex(
      Math.min(
        templates.length - 1,
        getTemplateIndexFromScroll(event, carouselWidth),
      ),
    );
  const handleCarouselLayout = (event: LayoutChangeEvent) =>
    setCarouselBlockHeight(current =>
      Math.abs(current - event.nativeEvent.layout.height) > 1
        ? event.nativeEvent.layout.height
        : current,
    );
  return (
    <View style={[styles.screen, {backgroundColor: systemTheme.canvas}]}>
      <Svg
        height={286}
        pointerEvents="none"
        style={styles.categoryFade}
        width="100%">
        <Defs>
          <SvgLinearGradient id="shareCategoryFade" x1="0" x2="0" y1="0" y2="1">
            <Stop
              offset="0"
              stopColor={category.backplateColor}
              stopOpacity={legacyTheme.isDark ? 0.22 : 0.92}
            />
            <Stop offset="1" stopColor={systemTheme.canvas} stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>
        <Rect fill="url(#shareCategoryFade)" height="286" width="100%" />
      </Svg>
      <View
        collapsable={false}
        pointerEvents="none"
        ref={captureRef}
        style={styles.captureLayer}>
        <TapInStoryTemplateCard
          onPhotoSettled={() => setIsPhotoSettled(true)}
          story={storyData}
          templateId={activeTemplate}
        />
      </View>
      <View style={[styles.content, {paddingTop: safeTopPadding}]}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityLabel="Close Share Tap In"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => navigation.goBack()}
            style={({pressed}) => [
              styles.closeButton,
              {
                backgroundColor: systemTheme.surface,
                borderColor: systemTheme.border,
                opacity: pressed ? 0.72 : 1,
              },
            ]}>
            <X color={systemTheme.text} size={19} strokeWidth={2.2} />
          </Pressable>
          <DSText
            numberOfLines={1}
            style={[styles.headerTitle, {color: systemTheme.text}]}>
            Share Tap In
          </DSText>
          <View style={styles.headerSpacer} />
        </View>
        <View onLayout={handleCarouselLayout} style={styles.carouselBlock}>
          <ScrollView
            bounces={false}
            decelerationRate="fast"
            horizontal
            onMomentumScrollEnd={handleScrollEnd}
            pagingEnabled
            ref={carouselRef}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            style={[
              styles.carousel,
              {height: previewHeight, width: carouselWidth},
            ]}>
            {templates.map(templateId => (
              <View
                key={templateId}
                style={[
                  styles.carouselPage,
                  {height: previewHeight, width: carouselWidth},
                ]}>
                <View
                  style={[
                    styles.previewFrame,
                    templateId === 'transparentOverlay'
                      ? styles.previewBackgroundTransparent
                      : {backgroundColor: systemTheme.surface},
                    {height: previewHeight, width: previewWidth},
                  ]}>
                  <View
                    style={[
                      styles.previewScaler,
                      {
                        left:
                          -(
                            tapInStoryShareCardSize.width *
                            (1 - previewScale)
                          ) / 2,
                        top:
                          -(
                            tapInStoryShareCardSize.height *
                            (1 - previewScale)
                          ) / 2,
                        transform: [{scale: previewScale}],
                      },
                    ]}>
                    <TapInStoryTemplateCard
                      showTransparencyGrid={templateId === 'transparentOverlay'}
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
                  {
                    backgroundColor:
                      index === activeIndex
                        ? category.accentColor
                        : systemTheme.border,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>
      <View
        style={[
          styles.shareTray,
          {
            backgroundColor: systemTheme.canvas,
            borderColor: systemTheme.border,
            paddingBottom: safeBottomPadding,
          },
        ]}>
        <DSText style={[styles.shareLabel, {color: systemTheme.muted}]}>
          Share to
        </DSText>
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
    </View>
  );
}
const styles = StyleSheet.create({
  captureLayer: {
    height: tapInStoryShareCardSize.height,
    left: -1200,
    position: 'absolute',
    top: 0,
    width: tapInStoryShareCardSize.width,
  },
  carousel: {flexGrow: 0},
  carouselBlock: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
  },
  carouselPage: {alignItems: 'center', justifyContent: 'center'},
  categoryFade: {left: 0, position: 'absolute', top: 0},
  closeButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: HEADER_CONTROL_SIZE,
    justifyContent: 'center',
    width: HEADER_CONTROL_SIZE,
  },
  content: {flex: 1, paddingHorizontal: SCREEN_HORIZONTAL_PADDING},
  destination: {alignItems: 'center', gap: 6, minWidth: 55},
  destinationIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  destinationLabel: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
    minHeight: 24,
    textAlign: 'center',
  },
  destinationsRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dot: {borderRadius: radius.pill, height: 7, width: 7},
  dotsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    height: DOTS_BLOCK_HEIGHT,
    justifyContent: 'center',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: HEADER_CONTROL_SIZE,
  },
  headerSpacer: {width: HEADER_CONTROL_SIZE},
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
    textAlign: 'center',
  },
  instagramGlyph: {
    alignItems: 'center',
    borderRadius: 9,
    height: 29,
    justifyContent: 'center',
    width: 29,
  },
  previewBackgroundTransparent: {backgroundColor: '#15161E'},
  previewFrame: {borderRadius: 20, overflow: 'hidden'},
  previewScaler: {
    height: tapInStoryShareCardSize.height,
    position: 'absolute',
    width: tapInStoryShareCardSize.width,
  },
  screen: {flex: 1},
  shareLabel: {fontSize: 12, fontWeight: '600', lineHeight: 16},
  shareTray: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingTop: 12,
  },
});
