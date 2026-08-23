import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {
  ArrowRight,
  Archive,
  Bell,
  Camera,
  Check,
  Flame,
  Heart,
  Share2,
  X,
} from 'lucide-react-native';
import {launchImageLibrary} from 'react-native-image-picker';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystAvatar} from '../../../design/components/HoystAvatar';
import {HoystText} from '../../../design/components/HoystText';
import {SectionEyebrow} from '../../../design/components/SectionEyebrow';
import {actionMotion} from '../../../design/tokens/actions';
import {brandColors} from '../../../design/tokens/colors';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {getPhotoUploadErrorMessage} from '../../../lib/firebase/storage-error';
import type {CircleThreadItem} from '../../../types/models';
import {
  createCircleThreadMessageId,
  markCircleThreadRead,
  sendCircleThreadMessage,
  subscribeToCircleThreadItems,
  toggleCircleThreadItemLike,
  uploadCircleThreadImage,
} from '../services/circle-thread-service';
import {buildCircleThreadDaySections} from '../services/circle-thread-date';

type ThreadTone = NonNullable<CircleThreadItem['tone']>;

type CircleThreadSectionProps = {
  circleId: string;
  isArchived: boolean;
  isVisible: boolean;
  loadMoreRequestToken: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  onShareTapIn?: (item: CircleThreadItem) => void;
  timezone: string;
  viewerUid: string;
};

const THREAD_PAGE_SIZE = 20;

const quickMessages = [
  {id: 'nice', label: '👏 Nice', text: '👏 Nice'},
  {id: 'lets-go', label: "🙌 Let's go", text: "🙌 Let's go"},
  {id: 'you-got-this', label: '💪 You got this', text: '💪 You got this'},
] as const;

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

function canShareTapInActivity(item: CircleThreadItem, viewerUid?: string) {
  return Boolean(
    viewerUid &&
      item.kind === 'activity' &&
      item.activityType === 'tap_in' &&
      item.tone === 'success' &&
      item.actor.uid === viewerUid,
  );
}

function ShareTapInButton({onPress}: {onPress: () => void}) {
  const theme = useHoystTheme();

  return (
    <Pressable
      accessibilityLabel="Share Tap In"
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        styles.shareTapInButton,
        {opacity: pressed ? actionMotion.pressedOpacity : 1},
      ]}>
      <Share2
        color={theme.accentSecondaryForeground}
        size={14}
        strokeWidth={2.4}
      />
      <HoystText
        style={[
          styles.shareTapInLabel,
          {color: theme.accentSecondaryForeground},
        ]}
        variant="caption">
        Share Tap In
      </HoystText>
    </Pressable>
  );
}

function ThreadMessageBubble({
  item,
  onLike,
  readOnly,
  viewerUid,
}: {
  item: CircleThreadItem;
  onLike: (item: CircleThreadItem) => void;
  readOnly?: boolean;
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
            disabled={isViewer || readOnly}
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
  readOnly,
  onShareTapIn,
  viewerUid,
}: {
  item: CircleThreadItem;
  onLike: (item: CircleThreadItem) => void;
  readOnly?: boolean;
  onShareTapIn?: (item: CircleThreadItem) => void;
  viewerUid?: string;
}) {
  const theme = useHoystTheme();
  const palette = getActivityPalette(item.tone ?? 'success', theme);
  const isViewer = Boolean(viewerUid && item.actor.uid === viewerUid);
  const hasProof = Boolean(item.mediaImageUrl || item.note);
  const canShare = Boolean(
    onShareTapIn && canShareTapInActivity(item, viewerUid),
  );

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
              disabled={isViewer || item.readOnly || readOnly}
              item={item}
              onPress={() => onLike(item)}
            />
            {canShare ? (
              <ShareTapInButton onPress={() => onShareTapIn?.(item)} />
            ) : null}
          </View>
        </View>
      ) : (
        <View
          style={styles.activityLikeRow}
          testID={`circle-thread-activity-like-row-${item.id}`}>
          <LikeButton
            disabled={isViewer || item.readOnly || readOnly}
            item={item}
            onPress={() => onLike(item)}
          />
          {canShare ? (
            <ShareTapInButton onPress={() => onShareTapIn?.(item)} />
          ) : null}
        </View>
      )}
    </View>
  );
}

function ThreadItem({
  item,
  onLike,
  readOnly,
  onShareTapIn,
  viewerUid,
}: {
  item: CircleThreadItem;
  onLike: (item: CircleThreadItem) => void;
  readOnly?: boolean;
  onShareTapIn?: (item: CircleThreadItem) => void;
  viewerUid?: string;
}) {
  if (item.kind === 'activity') {
    return (
      <ThreadActivityItem
        item={item}
        onLike={onLike}
        readOnly={readOnly}
        onShareTapIn={onShareTapIn}
        viewerUid={viewerUid}
      />
    );
  }

  return (
    <ThreadMessageBubble
      item={item}
      onLike={onLike}
      readOnly={readOnly}
      viewerUid={viewerUid}
    />
  );
}

function mergeThreadItems(
  currentItems: CircleThreadItem[],
  nextItems: CircleThreadItem[],
) {
  const nextIds = new Set(nextItems.map(item => item.id));

  return [...nextItems, ...currentItems.filter(item => !nextIds.has(item.id))];
}

export function CircleThreadSection({
  circleId,
  isArchived,
  isVisible,
  loadMoreRequestToken,
  onLayout,
  onShareTapIn,
  timezone,
  viewerUid,
}: CircleThreadSectionProps): React.JSX.Element {
  const theme = useHoystTheme();
  const [items, setItems] = useState<CircleThreadItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [threadError, setThreadError] = useState<Error>();
  const [requestedLimit, setRequestedLimit] = useState(THREAD_PAGE_SIZE);
  const [retryKey, setRetryKey] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [photoUri, setPhotoUri] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const lastHandledLoadRequestRef = useRef(0);
  const lastMarkedItemIdRef = useRef<string | undefined>(undefined);
  const pendingMarkedItemIdRef = useRef<string | undefined>(undefined);
  const daySections = useMemo(
    () => buildCircleThreadDaySections({items, timezone}),
    [items, timezone],
  );

  useEffect(() => {
    return subscribeToCircleThreadItems({
      circleId,
      itemLimit: requestedLimit,
      onError: error => {
        setThreadError(error);
        setIsInitialLoading(false);
        setIsLoadingMore(false);
      },
      onItems: result => {
        setItems(currentItems => mergeThreadItems(currentItems, result.items));
        setHasMore(result.hasMore);
        setThreadError(undefined);
        setIsInitialLoading(false);
        setIsLoadingMore(false);
      },
      uid: viewerUid,
    });
  }, [circleId, requestedLimit, retryKey, viewerUid]);

  useEffect(() => {
    if (
      loadMoreRequestToken === 0 ||
      loadMoreRequestToken === lastHandledLoadRequestRef.current ||
      !hasMore ||
      isInitialLoading ||
      isLoadingMore
    ) {
      return;
    }

    lastHandledLoadRequestRef.current = loadMoreRequestToken;
    setIsLoadingMore(true);
    setThreadError(undefined);
    setRequestedLimit(currentLimit => currentLimit + THREAD_PAGE_SIZE);
  }, [hasMore, isInitialLoading, isLoadingMore, loadMoreRequestToken]);

  useEffect(() => {
    const latestItemId = items[0]?.id;

    if (
      !isVisible ||
      isArchived ||
      !latestItemId ||
      latestItemId === lastMarkedItemIdRef.current ||
      latestItemId === pendingMarkedItemIdRef.current
    ) {
      return;
    }

    pendingMarkedItemIdRef.current = latestItemId;
    markCircleThreadRead(circleId)
      .then(() => {
        lastMarkedItemIdRef.current = latestItemId;
      })
      .catch(() => undefined)
      .finally(() => {
        if (pendingMarkedItemIdRef.current === latestItemId) {
          pendingMarkedItemIdRef.current = undefined;
        }
      });
  }, [circleId, isArchived, isVisible, items]);

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
    let isUploadingPhoto = Boolean(photoUri);

    if (isSending || (!text && !photoUri)) {
      return;
    }

    setIsSending(true);
    try {
      const messageId = createCircleThreadMessageId(circleId);
      const mediaImageUrl = photoUri
        ? await uploadCircleThreadImage({
            circleId,
            messageId,
            uid: viewerUid,
            uri: photoUri,
          })
        : undefined;

      isUploadingPhoto = false;
      await sendCircleThreadMessage({
        circleId,
        mediaImageUrl,
        messageId,
        text: text || undefined,
      });
      setDraft('');
      setPhotoUri(undefined);
    } catch (error) {
      const message = isUploadingPhoto
        ? getPhotoUploadErrorMessage(error)
        : (error as {message?: string}).message ??
          'Could not send this message.';

      Alert.alert('Message failed', message);
    } finally {
      setIsSending(false);
    }
  };

  const handleLike = (item: CircleThreadItem) => {
    if (isArchived || item.actor.uid === viewerUid) {
      return;
    }

    toggleCircleThreadItemLike({
      circleId,
      itemId: item.id,
    }).catch(error => {
      Alert.alert(
        'Like failed',
        (error as {message?: string}).message ?? 'Could not update the like.',
      );
    });
  };
  const handleRetry = () => {
    setThreadError(undefined);
    if (items.length === 0) {
      setIsInitialLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setRetryKey(currentKey => currentKey + 1);
  };
  const canSendMessage = Boolean(draft.trim() || photoUri) && !isSending;

  return (
    <View
      onLayout={onLayout}
      style={styles.section}
      testID="circle-thread-section">
      <SectionEyebrow>Circle Feed</SectionEyebrow>

      {isArchived ? (
        <View
          style={[
            styles.archivedFooter,
            {
              backgroundColor: theme.isDark
                ? 'rgba(9,11,18,0.90)'
                : 'rgba(245,246,255,0.92)',
              borderColor: theme.border,
            },
          ]}>
          <Archive color={theme.textMuted} size={18} strokeWidth={2.2} />
          <View style={styles.archivedFooterCopy}>
            <HoystText style={styles.archivedFooterTitle}>
              Archived Circle
            </HoystText>
            <HoystText tone="muted" variant="caption">
              This feed is read-only. Restore the Circle to send or react.
            </HoystText>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.composerShell,
            {
              backgroundColor: theme.isDark
                ? 'rgba(9,11,18,0.86)'
                : 'rgba(245,246,255,0.86)',
              borderColor: theme.border,
            },
          ]}
          testID="circle-thread-composer">
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
                  {opacity: pressed ? actionMotion.pressedOpacity : 1},
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
                disabled={!canSendMessage}
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
      )}

      <View style={styles.threadContent} testID="circle-thread-feed">
        {threadError && items.length === 0 ? (
          <GlassPanel padding="none" style={styles.emptyCard}>
            <View style={styles.emptyCardContent}>
              <HoystText
                style={styles.emptyCardTitle}
                testID="circle-thread-error-title">
                Could not load Circle Feed
              </HoystText>
              <HoystText
                style={styles.emptyCardBody}
                testID="circle-thread-error-body"
                tone="muted">
                Your circle is connected, but Hoyst could not load the latest
                thread yet.
              </HoystText>
              <Pressable
                accessibilityLabel="Retry Circle Feed"
                accessibilityRole="button"
                onPress={handleRetry}
                style={({pressed}) => [
                  styles.retryButton,
                  {opacity: pressed ? actionMotion.pressedOpacity : 1},
                ]}>
                <HoystText style={styles.retryButtonLabel}>Try again</HoystText>
              </Pressable>
            </View>
          </GlassPanel>
        ) : isInitialLoading ? (
          <View style={styles.loadingRow} testID="circle-thread-loading">
            <ActivityIndicator color={theme.accentTertiaryForeground} />
            <HoystText tone="muted" variant="caption">
              Loading Circle Feed...
            </HoystText>
          </View>
        ) : items.length > 0 ? (
          daySections.map(section => (
            <View key={section.dateKey} style={styles.daySection}>
              <HoystText
                style={styles.dayMarker}
                testID={`circle-thread-day-${section.dateKey}`}
                tone="muted"
                variant="label">
                {section.label}
              </HoystText>
              {section.items.map(item => (
                <ThreadItem
                  item={item}
                  key={item.id}
                  onLike={handleLike}
                  readOnly={isArchived}
                  onShareTapIn={onShareTapIn}
                  viewerUid={viewerUid}
                />
              ))}
            </View>
          ))
        ) : (
          <GlassPanel padding="none" style={styles.emptyCard}>
            <View style={styles.emptyCardContent}>
              <HoystText
                style={styles.emptyCardTitle}
                testID="circle-thread-empty-title">
                Start the Circle Feed
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

        {isLoadingMore ? (
          <View style={styles.loadingRow} testID="circle-thread-loading-more">
            <ActivityIndicator color={theme.accentTertiaryForeground} />
            <HoystText tone="muted" variant="caption">
              Loading older activity...
            </HoystText>
          </View>
        ) : threadError && items.length > 0 ? (
          <View style={styles.paginationError}>
            <HoystText tone="muted" variant="caption">
              Could not load older activity.
            </HoystText>
            <Pressable
              accessibilityLabel="Retry older circle activity"
              accessibilityRole="button"
              onPress={handleRetry}
              style={({pressed}) => [
                styles.retryButton,
                {opacity: pressed ? actionMotion.pressedOpacity : 1},
              ]}>
              <HoystText style={styles.retryButtonLabel}>Try again</HoystText>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  archivedFooter: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  archivedFooterCopy: {flex: 1, gap: 2},
  archivedFooterTitle: {fontSize: 15, fontWeight: '800', lineHeight: 19},
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
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
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
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
    padding: 12,
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
  daySection: {
    gap: 8,
    width: '100%',
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
  shareTapInButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    minHeight: 20,
    paddingHorizontal: 4,
  },
  shareTapInLabel: {
    fontWeight: '800',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
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
  paginationError: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
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
  retryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  retryButtonLabel: {
    color: brandColors.blueVivid,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 17,
  },
  section: {
    gap: 14,
    width: '100%',
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
    gap: 12,
    paddingBottom: 8,
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
