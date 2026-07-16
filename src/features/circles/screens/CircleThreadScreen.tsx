import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Camera,
  Check,
  Flame,
  Heart,
  X,
} from 'lucide-react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {SafeAreaView} from 'react-native-safe-area-context';

import {
  CircleCategoryIcon,
  getCircleCategoryVisual,
} from '../../../design/components/CircleCategoryIcon';
import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystAvatar} from '../../../design/components/HoystAvatar';
import {HoystText} from '../../../design/components/HoystText';
import {actionMotion} from '../../../design/tokens/actions';
import {brandColors} from '../../../design/tokens/colors';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {RootStackParamList} from '../../../navigation/types';
import {useSessionStore} from '../../../store/session-store';
import {useUserProfileStore} from '../../../store/profile-store';
import type {CircleDetailModel, CircleThreadItem} from '../../../types/models';
import {subscribeToMemberCircleDetail} from '../../home/services/home-data-service';
import {
  createCircleThreadMessageId,
  markCircleThreadRead,
  sendCircleThreadMessage,
  subscribeToCircleThreadItems,
  toggleCircleThreadItemLike,
  uploadCircleThreadImage,
} from '../services/circle-thread-service';

type Props = NativeStackScreenProps<RootStackParamList, 'CircleThread'>;
type ThreadTone = NonNullable<CircleThreadItem['tone']>;

const quickMessages = [
  {id: 'nice', label: '👏 Nice', text: '👏 Nice'},
  {id: 'lets-go', label: "🙌 Let's go", text: "🙌 Let's go"},
  {id: 'you-got-this', label: '💪 You got this', text: '💪 You got this'},
] as const;

function formatThreadSubtitle(detail?: CircleDetailModel) {
  if (!detail) {
    return 'Circle thread';
  }

  const memberCount = detail.memberCount ?? detail.members.length;
  const memberLabel =
    memberCount === 1 ? '1 companion' : `${memberCount} companions`;
  const streakDays =
    detail.streakDays ?? Number.parseInt(detail.streakLabel, 10);
  const streakLabel =
    Number.isFinite(streakDays) && streakDays > 0
      ? `${streakDays} day streak`
      : detail.streakLabel;

  return `${memberLabel} · ${streakLabel}`;
}

function getActivityPalette(
  tone: ThreadTone,
  theme: ReturnType<typeof useHoystTheme>,
) {
  if (tone === 'alert') {
    return {
      backgroundColor: 'rgba(255,138,61,0.16)',
      foregroundColor: theme.warningForeground,
    };
  }

  if (tone === 'pending') {
    return {
      backgroundColor: 'rgba(122,85,255,0.14)',
      foregroundColor: theme.accentSecondaryForeground,
    };
  }

  return {
    backgroundColor: 'rgba(16,185,103,0.14)',
    foregroundColor: theme.successForeground,
  };
}

function ActivityIcon({color, item}: {color: string; item: CircleThreadItem}) {
  if (item.activityType === 'streak_milestone') {
    return <Flame color={color} fill={color} size={12} strokeWidth={2.3} />;
  }

  if (item.activityType === 'nudge') {
    return <Bell color={color} size={12} strokeWidth={2.4} />;
  }

  return <Check color={color} size={12} strokeWidth={3} />;
}

function LikeButton({
  disabled,
  item,
  onPress,
}: {
  disabled?: boolean;
  item: CircleThreadItem;
  onPress: () => void;
}) {
  const theme = useHoystTheme();
  const showCount = item.likeCount > 0;
  const showButton = !disabled || showCount;

  if (!showButton) {
    return null;
  }

  return (
    <Pressable
      accessibilityLabel={`Like ${item.kind}`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({pressed}) => [
        styles.likeButton,
        {
          opacity: disabled ? 0.78 : pressed ? 0.72 : 1,
        },
      ]}>
      <Heart
        color={item.isLikedByViewer ? theme.dangerForeground : '#FF8A96'}
        fill={item.isLikedByViewer ? theme.dangerForeground : 'transparent'}
        size={14}
        strokeWidth={2.5}
      />
      {showCount ? (
        <HoystText style={styles.likeCount} tone="muted" variant="caption">
          {item.likeCount}
        </HoystText>
      ) : null}
    </Pressable>
  );
}

function ThreadMessageBubble({
  item,
  onLike,
  viewerUid,
}: {
  item: CircleThreadItem;
  onLike: (item: CircleThreadItem) => void;
  viewerUid?: string;
}) {
  const theme = useHoystTheme();
  const isViewer = Boolean(viewerUid && item.actor.uid === viewerUid);
  const bubbleColor = isViewer
    ? brandColors.blueVivid
    : theme.isDark
    ? 'rgba(255,255,255,0.10)'
    : 'rgba(255,255,255,0.86)';
  const textColor = isViewer ? brandColors.white : theme.text;

  return (
    <View
      style={[
        styles.messageRow,
        isViewer ? styles.viewerMessageRow : styles.companionMessageRow,
      ]}>
      {!isViewer ? (
        <HoystAvatar
          initials={item.actor.initials}
          imageUrl={item.actor.avatarUrl}
          size={30}
          tone="muted"
        />
      ) : null}
      <View
        style={[
          styles.messageStack,
          isViewer ? styles.viewerMessageStack : undefined,
        ]}>
        <View
          style={[
            styles.messageBubble,
            isViewer ? styles.viewerBubble : styles.companionBubble,
            {
              backgroundColor: bubbleColor,
              borderColor: isViewer ? 'transparent' : theme.glassBorder,
            },
          ]}>
          {item.mediaImageUrl ? (
            <Image
              resizeMode="cover"
              source={{uri: item.mediaImageUrl}}
              style={styles.messageImage}
              testID="circle-thread-message-image"
            />
          ) : null}
          {item.text ? (
            <HoystText style={[styles.messageText, {color: textColor}]}>
              {item.text}
            </HoystText>
          ) : null}
        </View>
        <View
          style={[
            styles.messageMetaRow,
            isViewer ? styles.viewerMessageMetaRow : undefined,
          ]}>
          <LikeButton
            disabled={isViewer}
            item={item}
            onPress={() => onLike(item)}
          />
          <HoystText
            style={styles.timestampText}
            tone="muted"
            variant="caption">
            {item.createdAtLabel}
          </HoystText>
        </View>
      </View>
    </View>
  );
}

function ThreadActivityItem({
  item,
  onLike,
  viewerUid,
}: {
  item: CircleThreadItem;
  onLike: (item: CircleThreadItem) => void;
  viewerUid?: string;
}) {
  const theme = useHoystTheme();
  const palette = getActivityPalette(item.tone ?? 'success', theme);
  const isViewer = Boolean(viewerUid && item.actor.uid === viewerUid);
  const hasProof = Boolean(item.mediaImageUrl || item.note);

  return (
    <View style={styles.activityStack}>
      <View style={styles.activityChipRow}>
        <View
          style={[
            styles.activityChip,
            {backgroundColor: palette.backgroundColor},
          ]}>
          <ActivityIcon color={palette.foregroundColor} item={item} />
          <HoystText
            numberOfLines={1}
            style={[styles.activityChipText, {color: palette.foregroundColor}]}>
            {item.text}
          </HoystText>
        </View>
        <HoystText
          style={styles.activityTimestamp}
          tone="muted"
          variant="caption">
          {item.createdAtLabel}
        </HoystText>
      </View>

      {hasProof ? (
        <View style={styles.activityProofRow}>
          <HoystAvatar
            initials={item.actor.initials}
            imageUrl={item.actor.avatarUrl}
            size={30}
            tone={item.tone === 'pending' ? 'purple' : 'green'}
            useBrandRing={item.tone === 'success'}
          />
          <View style={styles.activityProofStack}>
            <GlassPanel padding="compact" style={styles.activityProofCard}>
              {item.mediaImageUrl ? (
                <Image
                  resizeMode="cover"
                  source={{uri: item.mediaImageUrl}}
                  style={styles.activityProofImage}
                  testID="circle-thread-activity-image"
                />
              ) : null}
              {item.note ? (
                <HoystText style={styles.activityProofText}>
                  {item.note}
                </HoystText>
              ) : null}
            </GlassPanel>
            <LikeButton
              disabled={isViewer || item.readOnly}
              item={item}
              onPress={() => onLike(item)}
            />
          </View>
        </View>
      ) : (
        <View style={styles.activityLikeRow}>
          <LikeButton
            disabled={isViewer || item.readOnly}
            item={item}
            onPress={() => onLike(item)}
          />
        </View>
      )}
    </View>
  );
}

function ThreadItem({
  item,
  onLike,
  viewerUid,
}: {
  item: CircleThreadItem;
  onLike: (item: CircleThreadItem) => void;
  viewerUid?: string;
}) {
  if (item.kind === 'activity') {
    return (
      <ThreadActivityItem item={item} onLike={onLike} viewerUid={viewerUid} />
    );
  }

  return (
    <ThreadMessageBubble item={item} onLike={onLike} viewerUid={viewerUid} />
  );
}

export function CircleThreadScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const [detail, setDetail] = useState<CircleDetailModel>();
  const [items, setItems] = useState<CircleThreadItem[]>([]);
  const [hasThreadError, setHasThreadError] = useState(false);
  const [draft, setDraft] = useState('');
  const [photoUri, setPhotoUri] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const profile = useUserProfileStore(state => state.profile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const timezone = profile?.timezone ?? 'UTC';
  const canLoadThread = status === 'authenticatedReady' && Boolean(user?.uid);
  const categoryVisual = detail
    ? getCircleCategoryVisual(detail.category)
    : undefined;
  const backdropAccent = categoryVisual
    ? theme.isDark
      ? categoryVisual.accentLight
      : categoryVisual.accentColor
    : undefined;
  const subtitle = useMemo(() => formatThreadSubtitle(detail), [detail]);

  useEffect(() => {
    if (!canLoadThread || !user?.uid) {
      setDetail(undefined);
      return undefined;
    }

    return subscribeToMemberCircleDetail({
      circleId: route.params.circleId,
      onDetail: setDetail,
      onError: () => setDetail(undefined),
      timezone,
      uid: user.uid,
    });
  }, [canLoadThread, route.params.circleId, timezone, user?.uid]);

  useEffect(() => {
    if (!canLoadThread || !user?.uid) {
      setItems([]);
      setHasThreadError(false);
      return undefined;
    }

    return subscribeToCircleThreadItems({
      circleId: route.params.circleId,
      onError: () => setHasThreadError(true),
      onItems: nextItems => {
        setItems(nextItems);
        setHasThreadError(false);
      },
      uid: user.uid,
    });
  }, [canLoadThread, route.params.circleId, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      if (!canLoadThread) {
        return undefined;
      }

      markCircleThreadRead(route.params.circleId).catch(() => undefined);

      return undefined;
    }, [canLoadThread, route.params.circleId]),
  );

  useEffect(() => {
    if (canLoadThread && items.length > 0) {
      markCircleThreadRead(route.params.circleId).catch(() => undefined);
    }
  }, [canLoadThread, items.length, route.params.circleId]);

  const navigateBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.replace('CircleDetail', {circleId: route.params.circleId});
  };

  const handleChooseImage = async () => {
    const response = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });
    const uri = response.assets?.[0]?.uri;

    if (uri) {
      setPhotoUri(uri);
    }
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? draft).trim();

    if (isSending || (!text && !photoUri) || !user?.uid) {
      return;
    }

    setIsSending(true);
    try {
      const messageId = createCircleThreadMessageId(route.params.circleId);
      const mediaImageUrl = photoUri
        ? await uploadCircleThreadImage({
            circleId: route.params.circleId,
            messageId,
            uid: user.uid,
            uri: photoUri,
          })
        : undefined;

      await sendCircleThreadMessage({
        circleId: route.params.circleId,
        mediaImageUrl,
        messageId,
        text: text || undefined,
      });
      setDraft('');
      setPhotoUri(undefined);
    } catch (error) {
      Alert.alert(
        'Message failed',
        (error as {message?: string}).message ?? 'Could not send this message.',
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleLike = (item: CircleThreadItem) => {
    if (item.actor.uid === user?.uid) {
      return;
    }

    toggleCircleThreadItemLike({
      circleId: route.params.circleId,
      itemId: item.id,
    }).catch(error => {
      Alert.alert(
        'Like failed',
        (error as {message?: string}).message ?? 'Could not update the like.',
      );
    });
  };
  const canSendMessage = Boolean(draft.trim() || photoUri) && !isSending;

  return (
    <SafeAreaView
      style={[styles.safeArea, {backgroundColor: theme.background}]}>
      <FrostedBackdrop topAccentColor={backdropAccent} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}>
        <View
          testID="circle-thread-header"
          style={[
            styles.header,
            {
              borderBottomColor: theme.border,
            },
          ]}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={navigateBack}
            style={({pressed}) => [
              styles.backButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.glassBorder,
                opacity: pressed ? actionMotion.pressedOpacity : 1,
              },
            ]}>
            <ArrowLeft color={theme.text} size={21} strokeWidth={2.5} />
          </Pressable>
          {detail ? (
            <CircleCategoryIcon
              category={detail.category}
              shape="roundedSquare"
              size={38}
            />
          ) : (
            <View
              style={[styles.headerFallbackIcon, {borderColor: theme.border}]}>
              <HoystText style={styles.headerFallbackText}>H</HoystText>
            </View>
          )}
          <View style={styles.headerCopy}>
            <HoystText numberOfLines={1} style={styles.headerTitle}>
              {detail?.title ?? 'Circle'}
            </HoystText>
            <HoystText numberOfLines={1} style={styles.headerSubtitle}>
              {subtitle}
            </HoystText>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.threadContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <HoystText style={styles.dayMarker} tone="muted" variant="label">
            TODAY
          </HoystText>
          {hasThreadError && items.length === 0 ? (
            <GlassPanel padding="none" style={styles.emptyCard}>
              <View style={styles.emptyCardContent}>
                <HoystText
                  style={styles.emptyCardTitle}
                  testID="circle-thread-error-title">
                  Could not load circle chat
                </HoystText>
                <HoystText
                  style={styles.emptyCardBody}
                  testID="circle-thread-error-body"
                  tone="muted">
                  Your circle is connected, but Hoyst could not load the latest
                  thread yet.
                </HoystText>
              </View>
            </GlassPanel>
          ) : items.length > 0 ? (
            items.map(item => (
              <ThreadItem
                item={item}
                key={item.id}
                onLike={handleLike}
                viewerUid={user?.uid}
              />
            ))
          ) : (
            <GlassPanel padding="none" style={styles.emptyCard}>
              <View style={styles.emptyCardContent}>
                <HoystText
                  style={styles.emptyCardTitle}
                  testID="circle-thread-empty-title">
                  Start the circle chat
                </HoystText>
                <HoystText
                  style={styles.emptyCardBody}
                  testID="circle-thread-empty-body"
                  tone="muted">
                  Send a quick note, photo, or cheer when the group needs
                  momentum.
                </HoystText>
              </View>
            </GlassPanel>
          )}
        </ScrollView>

        <View
          style={[
            styles.composerShell,
            {
              backgroundColor: theme.isDark
                ? 'rgba(9,11,18,0.86)'
                : 'rgba(245,246,255,0.86)',
              borderTopColor: theme.border,
            },
          ]}>
          <ScrollView
            horizontal
            contentContainerStyle={styles.quickMessageRow}
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}>
            {quickMessages.map(action => (
              <Pressable
                accessibilityLabel={`Send ${action.label}`}
                accessibilityRole="button"
                disabled={isSending}
                key={action.label}
                onPress={() => {
                  handleSend(action.text).catch(() => undefined);
                }}
                style={({pressed}) => [
                  styles.quickMessageChip,
                  {opacity: pressed ? actionMotion.pressedOpacity : 1},
                ]}>
                <View
                  style={[
                    styles.quickMessagePill,
                    {
                      backgroundColor: theme.isDark
                        ? 'rgba(255,255,255,0.10)'
                        : 'rgba(255,255,255,0.94)',
                      borderColor: theme.isDark
                        ? 'rgba(255,255,255,0.16)'
                        : 'rgba(255,255,255,0.86)',
                      shadowColor: theme.glassShadow,
                    },
                  ]}
                  testID={`circle-thread-quick-pill-${action.id}`}>
                  <HoystText style={styles.quickMessageLabel}>
                    {action.label}
                  </HoystText>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          {photoUri ? (
            <View style={styles.photoPreviewRow}>
              <Image
                resizeMode="cover"
                source={{uri: photoUri}}
                style={styles.photoPreview}
              />
              <Pressable
                accessibilityLabel="Remove selected photo"
                accessibilityRole="button"
                onPress={() => setPhotoUri(undefined)}
                style={styles.removePhotoButton}>
                <X color={theme.text} size={14} strokeWidth={2.2} />
              </Pressable>
            </View>
          ) : null}

          <View
            style={[styles.composerRow, {backgroundColor: theme.surfaceStrong}]}
            testID="circle-thread-composer-row">
            <TextInput
              editable={!isSending}
              multiline
              onChangeText={setDraft}
              placeholder="Message the circle..."
              placeholderTextColor={theme.isDark ? '#848CA4' : '#B1AEC8'}
              style={[styles.composerInput, {color: theme.text}]}
              testID="circle-thread-composer-input"
              value={draft}
            />
            <View
              style={styles.composerActionCluster}
              testID="circle-thread-composer-actions">
              <Pressable
                accessibilityLabel="Add image"
                accessibilityRole="button"
                disabled={isSending}
                onPress={() => {
                  handleChooseImage().catch(() => undefined);
                }}
                style={({pressed}) => [
                  styles.composerActionButton,
                  {
                    opacity: pressed ? actionMotion.pressedOpacity : 1,
                  },
                ]}>
                <View
                  testID="circle-thread-composer-camera-circle"
                  style={[
                    styles.composerIconCircle,
                    {
                      backgroundColor: theme.isDark
                        ? 'rgba(122,85,255,0.22)'
                        : 'rgba(122,85,255,0.14)',
                    },
                  ]}>
                  <Camera
                    color={theme.accentSecondaryForeground}
                    size={18}
                    strokeWidth={2.3}
                  />
                </View>
              </Pressable>
              <Pressable
                accessibilityLabel="Send message"
                accessibilityRole="button"
                accessibilityState={{disabled: !canSendMessage}}
                onPress={() => {
                  handleSend().catch(() => undefined);
                }}
                style={({pressed}) => [
                  styles.composerActionButton,
                  {
                    opacity:
                      pressed && canSendMessage
                        ? actionMotion.pressedOpacity
                        : 1,
                  },
                ]}>
                <View
                  style={styles.sendCircle}
                  testID="circle-thread-composer-send-circle">
                  <ArrowRight
                    color={brandColors.white}
                    size={20}
                    strokeWidth={2.7}
                  />
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  activityChip: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 5,
    maxWidth: '76%',
    minHeight: 28,
    paddingHorizontal: 11,
  },
  activityChipRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  activityChipText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 17,
  },
  activityLikeRow: {
    paddingLeft: 56,
  },
  activityProofCard: {
    borderRadius: 18,
    maxWidth: 260,
    minWidth: 190,
  },
  activityProofImage: {
    borderRadius: 14,
    height: 136,
    marginBottom: 9,
    width: '100%',
  },
  activityProofRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  activityProofStack: {
    alignItems: 'flex-start',
    gap: 4,
    maxWidth: '82%',
  },
  activityProofText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 20,
  },
  activityStack: {
    alignItems: 'flex-start',
    gap: 2,
  },
  activityTimestamp: {
    color: '#B9B6CD',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  companionBubble: {
    borderWidth: 1,
  },
  companionMessageRow: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  composerActionCluster: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
    justifyContent: 'flex-end',
    width: 92,
  },
  composerActionButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flexShrink: 0,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  composerIconCircle: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  composerInput: {
    flex: 1,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 20,
    maxHeight: 96,
    minHeight: 38,
    minWidth: 0,
    paddingHorizontal: 4,
    textAlign: 'left',
    textAlignVertical: 'center',
    paddingVertical: 9,
  },
  composerRow: {
    alignItems: 'center',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 8,
    minHeight: 56,
    overflow: 'visible',
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: 'relative',
  },
  composerShell: {
    borderTopWidth: 1,
    gap: 10,
    paddingBottom: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  dayMarker: {
    alignSelf: 'center',
    color: '#A9A7BA',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    lineHeight: 14,
    marginBottom: 4,
  },
  emptyCard: {
    borderRadius: 22,
    marginTop: 0,
  },
  emptyCardBody: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 19,
  },
  emptyCardContent: {
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  emptyCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 20,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 78,
    paddingBottom: 10,
    paddingHorizontal: 20,
    paddingTop: 2,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  headerFallbackIcon: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  headerFallbackText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 19,
  },
  headerSubtitle: {
    color: '#9290AE',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 17,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 25,
  },
  keyboard: {
    flex: 1,
  },
  likeButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    minHeight: 20,
    paddingHorizontal: 4,
  },
  likeCount: {
    color: '#9A97B6',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 15,
  },
  messageBubble: {
    borderRadius: 18,
    gap: 9,
    maxWidth: 288,
    minHeight: 38,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  messageImage: {
    borderRadius: 14,
    height: 136,
    width: 220,
  },
  messageMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  messageRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  messageStack: {
    alignItems: 'flex-start',
    gap: 4,
    maxWidth: '84%',
  },
  messageText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
  },
  photoPreview: {
    borderRadius: 14,
    height: 60,
    width: 60,
  },
  photoPreviewRow: {
    alignSelf: 'flex-start',
    position: 'relative',
  },
  quickMessageChip: {
    borderRadius: radius.pill,
  },
  quickMessagePill: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    elevation: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
    shadowOffset: {height: 4, width: 0},
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  quickMessageLabel: {
    color: '#706D92',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 17,
  },
  quickMessageRow: {
    gap: 10,
  },
  removePhotoButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.pill,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: -8,
    top: -8,
    width: 24,
  },
  safeArea: {
    flex: 1,
  },
  sendCircle: {
    alignItems: 'center',
    backgroundColor: brandColors.blueVivid,
    borderRadius: radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  threadContent: {
    flexGrow: 1,
    gap: 8,
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  timestampText: {
    color: '#B9B6CD',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
  },
  viewerBubble: {
    borderBottomRightRadius: 10,
  },
  viewerMessageMetaRow: {
    alignSelf: 'flex-end',
  },
  viewerMessageRow: {
    justifyContent: 'flex-end',
  },
  viewerMessageStack: {
    alignItems: 'flex-end',
  },
});
